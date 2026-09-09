import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { catalogueDocumentSchema } from "@/lib/catalogue/validation";

export const dynamic = "force-dynamic";

async function isAuthorized(request: Request) {
  const configuredToken = process.env.ISHOPP_INGESTION_API_TOKEN;
  const suppliedToken = request.headers.get("x-ishopp-ingestion-token");

  if (configuredToken && suppliedToken && suppliedToken === configuredToken) {
    return true;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.app_metadata?.role === "admin";
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = catalogueDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_catalogue_document", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("catalogue_documents")
    .insert({
      retailer_id: input.retailerId,
      store_branch_id: input.storeBranchId ?? null,
      source_url: input.sourceUrl ?? null,
      storage_path: input.storagePath ?? null,
      content_hash: input.contentHash ?? null,
      mime_type: input.mimeType,
      original_filename: input.originalFilename ?? null,
      captured_at: input.capturedAt ?? new Date().toISOString(),
      page_count: input.pageCount ?? null,
      status: "queued",
    })
    .select("id,retailer_id,store_branch_id,status,created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "duplicate_catalogue_document" }, { status: 409 });
    }
    console.error("catalogue document ingestion failed", error);
    return NextResponse.json({ error: "catalogue_document_ingestion_failed" }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

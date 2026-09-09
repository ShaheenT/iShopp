import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { catalogueExtractionSchema } from "@/lib/catalogue/validation";

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

  const parsed = catalogueExtractionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_catalogue_extraction", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const admin = createAdminClient();

  const { data: document } = await admin
    .from("catalogue_documents")
    .select("id,status")
    .eq("id", input.documentId)
    .maybeSingle();

  if (!document) {
    return NextResponse.json({ error: "catalogue_document_not_found" }, { status: 404 });
  }

  if (document.status === "failed") {
    return NextResponse.json({ error: "catalogue_document_failed" }, { status: 409 });
  }

  const { data, error } = await admin
    .from("catalogue_extractions")
    .insert({
      document_id: input.documentId,
      extractor_type: input.extractorType,
      extractor_version: input.extractorVersion,
      status: "completed",
      raw_text: input.rawText ?? null,
      extracted_data: input.extractedData ?? null,
      confidence: input.confidence ?? null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select("id,document_id,status,confidence,created_at")
    .single();

  if (error) {
    console.error("catalogue extraction ingestion failed", error);
    return NextResponse.json({ error: "catalogue_extraction_ingestion_failed" }, { status: 500 });
  }

  await admin
    .from("catalogue_documents")
    .update({ status: "processed", updated_at: new Date().toISOString() })
    .eq("id", input.documentId);

  return NextResponse.json({ data }, { status: 201 });
}

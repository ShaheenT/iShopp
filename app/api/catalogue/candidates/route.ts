import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { specialCandidateSchema } from "@/lib/catalogue/validation";

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

  const parsed = specialCandidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_special_candidate", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const admin = createAdminClient();

  const { data: extraction } = await admin
    .from("catalogue_extractions")
    .select("id,document_id,status")
    .eq("id", input.extractionId)
    .maybeSingle();

  if (!extraction) {
    return NextResponse.json({ error: "catalogue_extraction_not_found" }, { status: 404 });
  }

  if (extraction.status !== "completed") {
    return NextResponse.json({ error: "catalogue_extraction_not_completed" }, { status: 409 });
  }

  const { data: document } = await admin
    .from("catalogue_documents")
    .select("id,retailer_id,store_branch_id")
    .eq("id", extraction.document_id)
    .maybeSingle();

  if (!document || document.retailer_id !== input.retailerId) {
    return NextResponse.json({ error: "catalogue_source_mismatch" }, { status: 422 });
  }

  const { data, error } = await admin
    .from("special_candidates")
    .insert({
      extraction_id: input.extractionId,
      retailer_id: input.retailerId,
      store_branch_id: input.storeBranchId ?? document.store_branch_id ?? null,
      product_id: input.productId ?? null,
      title: input.title ?? null,
      brand: input.brand ?? null,
      unit: input.unit ?? null,
      regular_price: input.regularPrice ?? null,
      special_price: input.specialPrice ?? null,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      source_url: input.sourceUrl ?? null,
      source_type: input.sourceType ?? "catalogue",
      confidence: input.confidence ?? null,
      raw_payload: input.rawPayload,
      status: "pending",
    })
    .select("id,status,created_at")
    .single();

  if (error) {
    console.error("special candidate ingestion failed", error);
    return NextResponse.json({ error: "special_candidate_ingestion_failed" }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

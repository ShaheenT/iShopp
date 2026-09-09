import { NextResponse } from "next/server";

import { fulfilmentIngestionSchema } from "@/lib/fulfilment/ingestion";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = fulfilmentIngestionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_fulfilment_ingestion", details: parsed.error.flatten() }, { status: 400 });

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const input = parsed.data;
  const { data, error } = await supabase.rpc("ingest_fulfilment_rule", {
    p_retailer_id: input.retailerId,
    p_store_branch_id: input.storeBranchId ?? null,
    p_fulfilment_mode: input.fulfilmentMode,
    p_delivery_fee: input.deliveryFee,
    p_minimum_order_value: input.minimumOrderValue ?? null,
    p_currency: input.currency,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt ?? null,
    p_source_url: input.sourceUrl ?? null,
    p_source_type: input.sourceType,
    p_source_hash: input.sourceHash ?? null,
    p_evidence_storage_path: input.evidence.storagePath ?? null,
    p_evidence_extracted_text: input.evidence.extractedText ?? null,
    p_evidence_extracted_data: input.evidence.extractedData ?? {},
    p_evidence_source_url: input.evidence.sourceUrl ?? null,
    p_evidence_source_hash: input.evidence.sourceHash ?? null,
  });

  if (error) {
    console.error("fulfilment ingestion failed", error);
    const status = error.message.includes("access denied") ? 403 : 400;
    return NextResponse.json({ error: "fulfilment_ingestion_failed" }, { status });
  }

  return NextResponse.json({ data: data?.[0] ?? null }, { status: 201 });
}

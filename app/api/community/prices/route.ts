import { NextResponse } from "next/server";

import { communityPriceSubmissionSchema } from "@/lib/community/price-submission";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = communityPriceSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_community_price_submission", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const input = parsed.data;
  const { data, error } = await supabase.rpc("submit_community_price", {
    p_product_id: input.productId,
    p_retailer_id: input.retailerId,
    p_store_branch_id: input.storeBranchId ?? null,
    p_observed_price: input.observedPrice,
    p_regular_price: input.regularPrice ?? null,
    p_currency: input.currency,
    p_observed_at: input.observedAt ?? null,
    p_source_url: input.sourceUrl ?? null,
    p_notes: input.notes ?? null,
    p_evidence_source_url: input.evidence.sourceUrl ?? null,
    p_evidence_storage_path: input.evidence.storagePath ?? null,
    p_evidence_source_hash: input.evidence.sourceHash ?? null,
    p_evidence_extracted_text: input.evidence.extractedText ?? null,
    p_evidence_extracted_data: input.evidence.extractedData ?? {},
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    console.error("community price submission failed", error);
    return NextResponse.json({ error: "community_price_submission_failed" }, { status: 400 });
  }

  const existing = data?.[0] ?? null;
  return NextResponse.json({ data: existing, meta: { idempotent: true } }, { status: 201 });
}

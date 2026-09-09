import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createSpecialSchema } from "@/lib/specials/validation";

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

  const parsed = createSpecialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_special", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("specials")
    .insert({
      product_id: input.productId,
      retailer_id: input.retailerId,
      store_branch_id: input.storeBranchId ?? null,
      title: input.title ?? null,
      regular_price: input.regularPrice ?? null,
      special_price: input.specialPrice,
      currency: "ZAR",
      starts_at: input.startsAt,
      ends_at: input.endsAt ?? null,
      source_url: input.sourceUrl ?? null,
      source_type: input.sourceType ?? null,
      verification_status: "pending",
      verified_at: null,
    })
    .select("id,verification_status,created_at")
    .single();

  if (error) {
    console.error("special ingestion failed", error);
    return NextResponse.json({ error: "special_ingestion_failed" }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

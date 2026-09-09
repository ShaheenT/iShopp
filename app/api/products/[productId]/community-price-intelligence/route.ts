import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const productIdSchema = z.string().uuid();

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  if (!productIdSchema.safeParse(productId).success) {
    return NextResponse.json({ error: "invalid_product_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("get_community_price_intelligence", {
    p_product_id: productId,
  });
  if (error) {
    console.error("community price intelligence failed", error);
    return NextResponse.json({ error: "community_price_intelligence_failed" }, { status: 400 });
  }

  return NextResponse.json({ data: data?.[0] ?? null });
}

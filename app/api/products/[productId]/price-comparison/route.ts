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
  const parsed = productIdSchema.safeParse(productId);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_product_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("compare_product_prices", {
    p_product_id: parsed.data,
  });

  if (error) {
    console.error("price comparison GET failed", error);
    return NextResponse.json(
      { error: "price_comparison_unavailable" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: data ?? [],
    meta: {
      productId: parsed.data,
      retailerCount: data?.length ?? 0,
    },
  });
}

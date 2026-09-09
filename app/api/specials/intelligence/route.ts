import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  productId: z.string().uuid(),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = paramsSchema.safeParse({
    productId: url.searchParams.get("productId"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_product_id", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_product_price_intelligence", {
    p_product_id: parsed.data.productId,
  });

  if (error) {
    console.error("price intelligence GET failed", error);
    return NextResponse.json(
      { error: "price_intelligence_unavailable" },
      { status: 500 },
    );
  }

  const intelligence = Array.isArray(data) ? data[0] ?? null : null;

  if (!intelligence) {
    return NextResponse.json(
      { error: "product_not_found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: intelligence });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  q: z.string().trim().min(2).max(100),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const parsed = querySchema.safeParse({ q: query });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_product_search" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id,name,brand,barcode,unit,retailer_id,retailers(id,name)")
    .eq("verification_status", "verified")
    .not("retailer_id", "is", null)
    .or(
      `name.ilike.%${parsed.data.q}%,brand.ilike.%${parsed.data.q}%,barcode.ilike.%${parsed.data.q}%`,
    )
    .order("name")
    .limit(12);

  if (error) {
    console.error("product search failed", error);
    return NextResponse.json({ error: "product_search_failed" }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}

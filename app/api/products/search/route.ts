import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  q: z.string().trim().min(2).max(100),
});

type ProductSearchResult = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  unit: string | null;
  retailer_id: string;
  retailers: { id: string; name: string } | null;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const parsed = querySchema.safeParse({ q: query });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_product_search" }, { status: 400 });
  }

  const term = parsed.data.q.replace(/[%_]/g, "");
  const supabase = await createClient();
  const base = () => supabase
    .from("products")
    .select("id,name,brand,barcode,unit,retailer_id,retailers(id,name)")
    .eq("verification_status", "verified")
    .not("retailer_id", "is", null);

  const [nameResult, brandResult, barcodeResult] = await Promise.all([
    base().ilike("name", `%${term}%`).limit(12),
    base().ilike("brand", `%${term}%`).limit(12),
    base().eq("barcode", term).limit(12),
  ]);

  const error = nameResult.error ?? brandResult.error ?? barcodeResult.error;
  if (error) {
    console.error("product search failed", error);
    return NextResponse.json({ error: "product_search_failed" }, { status: 400 });
  }

  const products = new Map<string, ProductSearchResult>();
  for (const item of [...(nameResult.data ?? []), ...(brandResult.data ?? []), ...(barcodeResult.data ?? [])]) {
    products.set(item.id, item as ProductSearchResult);
  }

  return NextResponse.json({ data: Array.from(products.values()).slice(0, 12) });
}

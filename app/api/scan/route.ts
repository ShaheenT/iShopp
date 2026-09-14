import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scanSchema } from "@/lib/validation/commerce";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = scanSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_scan_request", details: parsed.error.flatten() }, { status: 400 });

  const { barcode, query } = parsed.data;
  const supabase = await createClient();
  let productQuery = supabase.from("products").select("id,name,brand,description,barcode,image_url,unit_text,categories(id,name,slug)").eq("active", true).limit(10);
  if (barcode) productQuery = productQuery.eq("barcode", barcode);
  else if (query) productQuery = productQuery.or(`name.ilike.%${query}%,brand.ilike.%${query}%`);
  const { data: products, error } = await productQuery;
  if (error) return NextResponse.json({ error: "scan_lookup_failed" }, { status: 503 });

  const ids = (products ?? []).map((p) => p.id);
  let specials: unknown[] = [];
  if (ids.length) {
    const result = await supabase.from("specials").select("id,title,price,original_price,currency,starts_at,ends_at,source_url,product_id,retailers(id,name,slug),branches(id,name,address_line_1,city,latitude,longitude)").in("product_id", ids).eq("active", true).order("price", { ascending: true });
    if (result.error) return NextResponse.json({ error: "scan_special_lookup_failed" }, { status: 503 });
    specials = result.data ?? [];
  }
  return NextResponse.json({ data: { matches: products ?? [], specials } });
}

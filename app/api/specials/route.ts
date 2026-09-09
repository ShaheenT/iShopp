import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { publicSpecialQuerySchema } from "@/lib/specials/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = publicSpecialQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { retailerId, productId, categoryId, limit, offset } = parsed.data;
  const supabase = await createClient();

  let query = supabase
    .from("specials")
    .select(
      `id,title,regular_price,special_price,currency,starts_at,ends_at,source_url,source_type,verified_at,
       product:products!inner(id,name,brand,unit,image_url,category_id),
       retailer:retailers!inner(id,name,slug,website_url),
       store_branch:store_branches(id,name,suburb,city,province)`,
      { count: "exact" },
    )
    .eq("verification_status", "verified")
    .lte("starts_at", new Date().toISOString())
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order("starts_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (retailerId) query = query.eq("retailer_id", retailerId);
  if (productId) query = query.eq("product_id", productId);
  if (categoryId) query = query.eq("products.category_id", categoryId);

  const { data, error, count } = await query;

  if (error) {
    console.error("specials GET failed", error);
    return NextResponse.json({ error: "specials_unavailable" }, { status: 500 });
  }

  return NextResponse.json({
    data,
    pagination: {
      limit,
      offset,
      total: count ?? 0,
    },
  });
}

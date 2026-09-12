import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { catalogQuerySchema } from "@/lib/validation/catalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = catalogQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_query",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { q, category, page, limit } = parsed.data;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const supabase = await createClient();
    let query = supabase
      .from("products")
      .select(
        "id,name,brand,description,barcode,image_url,unit_text,category_id,categories(id,name,slug)",
        { count: "exact" },
      )
      .eq("active", true)
      .order("name", { ascending: true })
      .range(from, to);

    if (q) {
      query = query.or(`name.ilike.%${q}%,brand.ilike.%${q}%,barcode.eq.${q}`);
    }

    if (category) {
      query = query.eq("categories.slug", category);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: "catalog_query_failed" },
        { status: 503 },
      );
    }

    return NextResponse.json({
      data: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        total_pages: count ? Math.ceil(count / limit) : 0,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "catalog_query_failed" },
      { status: 503 },
    );
  }
}

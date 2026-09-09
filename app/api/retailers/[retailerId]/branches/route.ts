import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const retailerIdSchema = z.string().uuid();

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ retailerId: string }> },
) {
  const { retailerId } = await params;
  if (!retailerIdSchema.safeParse(retailerId).success) {
    return NextResponse.json({ error: "invalid_retailer_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_branches")
    .select("id,name,address_line_1,suburb,city,province,postal_code")
    .eq("retailer_id", retailerId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("retailer branches lookup failed", error);
    return NextResponse.json({ error: "retailer_branches_lookup_failed" }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}

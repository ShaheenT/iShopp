import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { shareSchema } from "@/lib/validation/commerce";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_share", details: parsed.error.flatten() }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const { data, error } = await supabase.from("shares").insert({ ...parsed.data, user_id: user.id }).select("id,channel,product_id,special_id,list_id,created_at").single();
  if (error) return NextResponse.json({ error: "share_create_failed" }, { status: 503 });
  return NextResponse.json({ data }, { status: 201 });
}

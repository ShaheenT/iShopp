import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({ name: z.string().trim().min(1).max(100).default("My Basket") });
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("shopping_baskets").select("id,name,created_at,updated_at").eq("user_id", userData.user.id).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "baskets_unavailable" }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_basket" }, { status: 400 });
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("shopping_baskets").insert({ user_id: userData.user.id, name: parsed.data.name }).select("id,name,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: "basket_creation_failed" }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

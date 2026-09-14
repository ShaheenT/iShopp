import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { shoppingListSchema } from "@/lib/validation/commerce";

export const dynamic = "force-dynamic";

async function userClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await userClient();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const { data, error } = await supabase.from("shopping_lists").select("id,name,created_at,updated_at,shopping_list_items(id,product_id,quantity,note,products(id,name,brand,image_url,unit_text))").eq("user_id", user.id).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "shopping_lists_fetch_failed" }, { status: 503 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const parsed = shoppingListSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_shopping_list", details: parsed.error.flatten() }, { status: 400 });
  const { supabase, user } = await userClient();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const { data, error } = await supabase.from("shopping_lists").insert({ user_id: user.id, name: parsed.data.name }).select("id,name,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: "shopping_list_create_failed" }, { status: 503 });
  return NextResponse.json({ data }, { status: 201 });
}

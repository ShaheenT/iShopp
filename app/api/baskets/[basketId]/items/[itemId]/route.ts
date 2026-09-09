import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();
const patchSchema = z.object({ quantity: z.number().int().min(1).max(999) });
export const dynamic = "force-dynamic";

async function authItem(basketId: string, itemId: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { supabase, user: null, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!idSchema.safeParse(basketId).success || !idSchema.safeParse(itemId).success) return { supabase, user: userData.user, response: NextResponse.json({ error: "invalid_id" }, { status: 400 }) };
  const { data, error } = await supabase.from("shopping_basket_items").select("id").eq("id", itemId).eq("basket_id", basketId).eq("shopping_baskets.user_id", userData.user.id).maybeSingle();
  if (error) return { supabase, user: userData.user, response: NextResponse.json({ error: "basket_item_lookup_failed" }, { status: 500 }) };
  if (!data) return { supabase, user: userData.user, response: NextResponse.json({ error: "basket_item_not_found" }, { status: 404 }) };
  return { supabase, user: userData.user, response: null };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ basketId: string; itemId: string }> }) {
  const { basketId, itemId } = await params;
  const auth = await authItem(basketId, itemId);
  if (auth.response) return auth.response;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_basket_item" }, { status: 400 });
  const { data, error } = await auth.supabase.from("shopping_basket_items").update({ quantity: parsed.data.quantity, updated_at: new Date().toISOString() }).eq("id", itemId).eq("basket_id", basketId).select("id,product_id,quantity,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: "basket_item_update_failed" }, { status: 500 });
  await auth.supabase.from("shopping_baskets").update({ updated_at: new Date().toISOString() }).eq("id", basketId).eq("user_id", auth.user!.id);
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ basketId: string; itemId: string }> }) {
  const { basketId, itemId } = await params;
  const auth = await authItem(basketId, itemId);
  if (auth.response) return auth.response;
  const { error } = await auth.supabase.from("shopping_basket_items").delete().eq("id", itemId).eq("basket_id", basketId);
  if (error) return NextResponse.json({ error: "basket_item_delete_failed" }, { status: 500 });
  await auth.supabase.from("shopping_baskets").update({ updated_at: new Date().toISOString() }).eq("id", basketId).eq("user_id", auth.user!.id);
  return NextResponse.json({ data: { id: itemId, deleted: true } });
}

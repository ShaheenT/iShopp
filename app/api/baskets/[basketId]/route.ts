import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();
const patchSchema = z.object({ name: z.string().trim().min(1).max(100) });
export const dynamic = "force-dynamic";

async function authBasket(basketId: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { supabase, user: null, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!idSchema.safeParse(basketId).success) return { supabase, user: userData.user, response: NextResponse.json({ error: "invalid_basket_id" }, { status: 400 }) };
  return { supabase, user: userData.user, response: null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ basketId: string }> }) {
  const { basketId } = await params;
  const auth = await authBasket(basketId);
  if (auth.response) return auth.response;
  const { data, error } = await auth.supabase.from("shopping_baskets").select("id,name,created_at,updated_at,shopping_basket_items(id,product_id,quantity,created_at,updated_at)").eq("id", basketId).eq("user_id", auth.user!.id).maybeSingle();
  if (error) return NextResponse.json({ error: "basket_unavailable" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "basket_not_found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ basketId: string }> }) {
  const { basketId } = await params;
  const auth = await authBasket(basketId);
  if (auth.response) return auth.response;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_basket" }, { status: 400 });
  const { data, error } = await auth.supabase.from("shopping_baskets").update({ name: parsed.data.name, updated_at: new Date().toISOString() }).eq("id", basketId).eq("user_id", auth.user!.id).select("id,name,created_at,updated_at").maybeSingle();
  if (error) return NextResponse.json({ error: "basket_update_failed" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "basket_not_found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ basketId: string }> }) {
  const { basketId } = await params;
  const auth = await authBasket(basketId);
  if (auth.response) return auth.response;
  const { data, error } = await auth.supabase.from("shopping_baskets").delete().eq("id", basketId).eq("user_id", auth.user!.id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "basket_delete_failed" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "basket_not_found" }, { status: 404 });
  return NextResponse.json({ data: { id: data.id, deleted: true } });
}

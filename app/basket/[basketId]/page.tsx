import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BasketView from "@/app/components/basket-view";

export const dynamic = "force-dynamic";

type BasketItemRow = {
  id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  products: {
    id: string;
    name: string;
    brand: string | null;
    unit: string | null;
    image_url: string | null;
  }[];
};

export default async function BasketPage({ params }: { params: Promise<{ basketId: string }> }) {
  const { basketId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=required");

  const { data: basket } = await supabase
    .from("shopping_baskets")
    .select("id,name,created_at,updated_at")
    .eq("id", basketId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!basket) notFound();

  const { data: rawItems } = await supabase
    .from("shopping_basket_items")
    .select("id,product_id,quantity,created_at,updated_at,products(id,name,brand,unit,image_url)")
    .eq("basket_id", basketId)
    .order("created_at");

  const items = (rawItems as BasketItemRow[] | null ?? []).map((item) => ({
    ...item,
    products: item.products[0] ?? null,
  }));

  return <BasketView basket={basket} items={items} />;
}

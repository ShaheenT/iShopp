import { redirect } from "next/navigation";

import IShoppDashboard from "@/app/components/ishopp-dashboard";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/?auth=required");

  const { data: baskets } = await supabase
    .from("shopping_baskets")
    .select("id,name,created_at,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const basketIds = (baskets ?? []).map((basket) => basket.id);
  let itemCount = 0;

  if (basketIds.length) {
    const { count } = await supabase
      .from("shopping_basket_items")
      .select("id", { count: "exact", head: true })
      .in("basket_id", basketIds);
    itemCount = count ?? 0;
  }

  return (
    <IShoppDashboard
      email={user.email ?? ""}
      name={(user.user_metadata?.full_name as string | undefined) ?? ""}
      baskets={baskets ?? []}
      itemCount={itemCount}
    />
  );
}

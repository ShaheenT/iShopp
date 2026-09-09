import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import ShoppingPlanView from "@/app/components/shopping-plan-view";

export const dynamic = "force-dynamic";

export default async function ShoppingPlanPage({ params }: { params: Promise<{ basketId: string }> }) {
  const { basketId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/?auth=required");

  const { data: basket } = await supabase
    .from("shopping_baskets")
    .select("id, name, created_at, updated_at")
    .eq("id", basketId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!basket) redirect("/dashboard");

  return <ShoppingPlanView basket={basket} />;
}

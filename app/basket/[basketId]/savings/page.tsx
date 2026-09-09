import { notFound, redirect } from "next/navigation";

import SavingsView from "@/app/components/savings-view";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SavingsPage({ params }: { params: Promise<{ basketId: string }> }) {
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

  return <SavingsView basket={basket} />;
}

import { redirect } from "next/navigation";

import RewardsView from "@/app/components/rewards-view";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/?auth=required");

  return <RewardsView />;
}

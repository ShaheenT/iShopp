import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CompareView from "@/app/components/compare-view";

export const dynamic = "force-dynamic";

export default async function ComparePage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=required");
  const { data: product } = await supabase.from("products").select("id,name,brand,unit").eq("id", productId).eq("verification_status", "verified").maybeSingle();
  if (!product) notFound();
  const { data: offers, error } = await supabase.rpc("compare_product_prices", { p_product_id: productId });
  if (error) throw new Error("Unable to load verified price comparison");
  return <CompareView product={product} offers={offers ?? []} />;
}

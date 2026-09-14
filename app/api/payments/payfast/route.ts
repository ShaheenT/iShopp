import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkoutSchema } from "@/lib/validation/commerce";
import { getPayFastConfig, payFastEndpoint, payFastSignature } from "@/lib/payfast";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payment_request", details: parsed.error.flatten() }, { status: 400 });
  const config = getPayFastConfig();
  if (!config) return NextResponse.json({ error: "payment_provider_not_configured" }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const { data: order, error } = await supabase.from("orders").select("id,total,currency,status").eq("id", parsed.data.basket_id).eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "payment_order_lookup_failed" }, { status: 503 });
  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  if (order.status !== "pending_payment") return NextResponse.json({ error: "order_not_payable" }, { status: 409 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) return NextResponse.json({ error: "app_url_not_configured" }, { status: 503 });
  const fields: Record<string, string> = {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: `${baseUrl}/checkout/success?order=${order.id}`,
    cancel_url: `${baseUrl}/checkout/cancel?order=${order.id}`,
    notify_url: `${baseUrl}/api/payments/payfast/itn`,
    name_first: user.user_metadata?.full_name?.split(" ")[0] ?? "iShopp",
    email_address: user.email ?? "",
    m_payment_id: order.id,
    amount: Number(order.total).toFixed(2),
    item_name: `iShopp order ${order.id}`,
  };
  fields.signature = payFastSignature(fields, config.passphrase);
  return NextResponse.json({ provider: "payfast", endpoint: payFastEndpoint(config.sandbox), fields });
}

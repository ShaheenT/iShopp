"use client";

import { useState } from "react";
import IShoppLogo from "./ishopp-logo";
import styles from "./shopping-plan-view.module.css";

type Basket = { id: string; name: string; created_at: string; updated_at: string };
type PlanItem = { productId: string; retailerId: string; retailerName: string; branchId?: string | null; specialId: string; quantity: number; unitPrice: number; lineTotal: number; currency: string };
type RetailerSubtotal = { retailerId: string; retailerName: string; subtotal: number; deliveryFee: number; storeVisitCost: number; minimumOrder: number; minimumOrderSurcharge: number; landedSubtotal: number };
type Plan = { planId: string | null; expiresAt: string | null; totalProductCost: number; deliveryFees: number; storeVisitCost: number; minimumOrderSurcharges: number; totalLandedCost: number; retailerCount: number; allocations: PlanItem[]; retailerSubtotals: RetailerSubtotal[] };

export default function ShoppingPlanView({ basket }: { basket: Basket }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  async function createPlan() {
    if (loading) return;
    const key = idempotencyKey ?? crypto.randomUUID();
    setIdempotencyKey(key);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/basket/${basket.id}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ maxStores: 2, storeVisitCost: 0 }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error === "basket_not_fully_available" ? "There is not enough verified fulfilment coverage to build a complete plan yet." : payload.error === "verified_fulfilment_rule_missing" ? "A verified fulfilment rule is missing for one of the selected offers." : payload.error === "idempotency_key_reused" ? "This plan request is already associated with another basket." : payload.error === "shopping_plan_creation_failed" ? "The plan could not be committed. The verified commercial data may have changed." : payload.error ?? "The shopping plan is unavailable.");
      }
      setPlan(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The shopping plan is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  const currency = plan?.allocations[0]?.currency ?? "ZAR";
  const money = (value: number | undefined | null) => value == null ? "—" : `${currency} ${value.toFixed(2)}`;
  const grouped = plan?.retailerSubtotals ?? [];

  return (
    <main className={styles.shell}>
      <nav className={styles.nav}>
        <a href="/dashboard" aria-label="iShopp dashboard"><IShoppLogo className={styles.logo} /></a>
        <a href={`/basket/${basket.id}`}>← {basket.name}</a>
      </nav>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>VERIFIED SHOPPING PLAN</p>
        <h1>Your best way<br /><em>to buy.</em></h1>
        <p>One practical plan built from verified prices and verified fulfilment rules. No assumed stock, fees or discounts.</p>
      </section>

      {error && <div className={styles.error} role="alert">{error}</div>}

      {!plan && (
        <section className={styles.start}>
          <div>
            <span>MAXIMUM STORES</span>
            <strong>2</strong>
          </div>
          <div>
            <span>COMMERCIAL DATA</span>
            <strong>Verified</strong>
          </div>
          <button type="button" onClick={createPlan} disabled={loading}>{loading ? "Building your plan…" : "Build my shopping plan →"}</button>
          <small>The request is retry-safe, and the server checks verified commercial data again before committing it.</small>
        </section>
      )}

      {plan && (
        <>
          <section className={styles.total}>
            <div>
              <p className={styles.eyebrow}>TOTAL LANDED COST</p>
              <h2>{money(plan.totalLandedCost)}</h2>
              <p>{plan.retailerCount} {plan.retailerCount === 1 ? "retailer" : "retailers"} · verified commercial route</p>
            </div>
            <div className={styles.breakdown}>
              <div><span>PRODUCTS</span><strong>{money(plan.totalProductCost)}</strong></div>
              <div><span>DELIVERY</span><strong>{money(plan.deliveryFees)}</strong></div>
              <div><span>STORE COST</span><strong>{money(plan.storeVisitCost)}</strong></div>
            </div>
          </section>

          <section className={styles.section}>
            <p className={styles.eyebrow}>WHERE TO BUY</p>
            <h2>The route.</h2>
            <div className={styles.retailers}>
              {grouped.map((retailer) => (
                <article key={retailer.retailerId} className={styles.retailer}>
                  <div className={styles.retailerTop}><h3>{retailer.retailerName}</h3><strong>{money(retailer.landedSubtotal)}</strong></div>
                  <p>{money(retailer.subtotal)} products · {money(retailer.deliveryFee)} delivery</p>
                  {retailer.minimumOrder > 0 && <small>Minimum order: {money(retailer.minimumOrder)}</small>}
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <p className={styles.eyebrow}>YOUR BASKET</p>
            <div className={styles.items}>
              {plan.allocations.map((item) => (
                <div className={styles.item} key={`${item.productId}-${item.retailerId}-${item.branchId ?? "retailer"}`}>
                  <div><strong>{item.retailerName}</strong><span>{item.quantity} × {money(item.unitPrice)}</span></div>
                  <strong>{money(item.lineTotal)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.trust}>
            <strong>Plan verified.</strong>
            <p>iShopp validated the selected offers and fulfilment rules again when this plan was created. If commercial data changes, a new plan should be generated.</p>
            {plan.expiresAt && <small>Valid until {new Date(plan.expiresAt).toLocaleString()}</small>}
          </section>
        </>
      )}

      <footer className={styles.footer}>Verified commercial data only. iShopp does not invent savings.</footer>
    </main>
  );
}

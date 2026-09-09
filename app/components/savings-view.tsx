"use client";

import { useEffect, useState } from "react";
import IShoppLogo from "./ishopp-logo";
import styles from "./savings-view.module.css";

type Basket = { id: string; name: string; created_at: string; updated_at: string };
type Savings = { currentCost: number; optimizedCost: number; savings: number; savingsPercent: number; currency: string; verified: boolean };
type Optimization = { totalCost?: number; productCost?: number; deliveryCost?: number; storeVisitCost?: number; retailerCount?: number; currency?: string; stores?: Array<Record<string, unknown>> };

export default function SavingsView({ basket }: { basket: Basket }) {
  const [savings, setSavings] = useState<Savings | null>(null);
  const [optimization, setOptimization] = useState<Optimization | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/basket/${basket.id}/savings`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Savings are unavailable.");
        if (!cancelled) setSavings(payload.data);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Savings are unavailable.");
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [basket.id]);

  async function optimize() {
    if (optimizing) return;
    setOptimizing(true); setError(null);
    try {
      const response = await fetch(`/api/basket/${basket.id}/fulfilment-optimize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ maxStores: 2, storeVisitCost: 0 }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error === "basket_not_fully_available" ? "The current verified offers cannot fulfil the complete basket." : payload.error ?? "Optimisation is unavailable.");
      setOptimization(payload.data);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Optimisation is unavailable."); }
    finally { setOptimizing(false); }
  }

  const currency = savings?.currency ?? optimization?.currency ?? "ZAR";
  const money = (value: number | undefined | null) => value == null ? "—" : `${currency} ${value.toFixed(2)}`;

  return (
    <main className={styles.shell}>
      <nav className={styles.nav}><a href="/dashboard" aria-label="iShopp dashboard"><IShoppLogo className={styles.logo} /></a><a href={`/basket/${basket.id}`}>← {basket.name}</a></nav>
      <section className={styles.hero}><p className={styles.eyebrow}>BASKET INTELLIGENCE</p><h1>How much can<br /><em>you save?</em></h1><p>iShopp compares verified commercial data first. Optimisation only appears when the underlying offers and fulfilment rules support it.</p></section>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <section className={styles.summary}>
        <div><span>VERIFIED BASKET SAVINGS</span><strong>{loading ? "…" : savings ? money(savings.savings) : "—"}</strong><small>{loading ? "Calculating from verified offers" : savings?.savingsPercent ? `${savings.savingsPercent.toFixed(2)}% potential product-price difference` : "No verified saving established"}</small></div>
        <div><span>OPTIMISED PRODUCT COST</span><strong>{loading ? "…" : savings ? money(savings.optimizedCost) : "—"}</strong><small>{savings?.verified ? "Verified source data" : "Unavailable"}</small></div>
      </section>
      <section className={styles.decision}>
        <div><p className={styles.eyebrow}>NEXT DECISION</p><h2>Price is only<br />the beginning.</h2><p>Now account for practical fulfilment: which retailers can cover the basket, how many store visits are needed, and what verified delivery rules apply.</p></div>
        <div className={styles.action}><button type="button" onClick={optimize} disabled={optimizing || loading}>{optimizing ? "Optimising…" : "Optimise my basket →"}</button><small>Uses a maximum of 2 stores and no assumed visit cost.</small></div>
      </section>
      {optimization && <section className={styles.result}><div className={styles.resultHead}><div><p className={styles.eyebrow}>PRACTICAL PLAN</p><h2>Best verified route.</h2></div><strong>{money(optimization.totalCost)}</strong></div><div className={styles.metrics}><div><span>PRODUCTS</span><strong>{money(optimization.productCost)}</strong></div><div><span>DELIVERY</span><strong>{money(optimization.deliveryCost)}</strong></div><div><span>STORES</span><strong>{optimization.retailerCount ?? "—"}</strong></div></div></section>}
      <footer className={styles.footer}>Verified commercial data only. iShopp does not invent savings.</footer>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

type Product = {
  id: string;
  name: string;
  brand: string | null;
  unit: string | null;
};

type PriceRow = {
  product_id: string;
  retailer_id: string;
  retailer_name: string;
  retailer_slug: string;
  branch_id: string | null;
  branch_name: string | null;
  special_id: string;
  special_price: number;
  regular_price: number | null;
  currency: string;
  starts_at: string;
  ends_at: string | null;
  savings_percent: number | null;
  rank_position: number;
};

export default function PriceComparison({ product }: { product: Product }) {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadComparison() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${product.id}/compare`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 401) throw new Error("Sign in to view live comparisons");
        throw new Error(payload.error ?? "Price comparison failed");
      }
      setRows((payload.data ?? []) as PriceRow[]);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Price comparison failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setRows([]);
    setLoaded(false);
    setError(null);
  }, [product.id]);

  const cheapest = rows[0]?.special_price;
  const mostExpensive = rows.length ? rows[rows.length - 1]?.special_price : undefined;
  const potentialSaving = cheapest !== undefined && mostExpensive !== undefined
    ? Math.max(0, mostExpensive - cheapest)
    : 0;

  return (
    <section className="price-comparison" aria-labelledby="price-comparison-title">
      <div className="price-comparison-header">
        <div>
          <p className="eyebrow">COMPARE</p>
          <h3 id="price-comparison-title">Where can I buy it cheapest?</h3>
          <p>Only currently verified retailer prices are shown. Community submissions appear here only after verification.</p>
        </div>
        <button className="secondary-button" type="button" onClick={loadComparison} disabled={loading}>
          {loading ? "Checking…" : loaded ? "Refresh prices" : "See current prices"}
        </button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {loaded && rows.length === 0 && !error && (
        <div className="comparison-empty">No current verified retailer specials are available for this product yet.</div>
      )}

      {rows.length > 0 && (
        <>
          <div className="savings-callout">
            <div><span>Best verified price</span><strong>R {cheapest?.toFixed(2)}</strong></div>
            <div><span>Potential saving</span><strong>R {potentialSaving.toFixed(2)}</strong></div>
          </div>

          <div className="comparison-list">
            {rows.map((row) => (
              <article className={`comparison-card ${row.rank_position === 1 ? "is-best" : ""}`} key={row.special_id}>
                <div className="comparison-rank">#{row.rank_position}</div>
                <div className="comparison-main">
                  <strong>{row.retailer_name}</strong>
                  <span>{row.branch_name ?? "Retailer-wide price"}</span>
                </div>
                <div className="comparison-price">
                  <strong>R {Number(row.special_price).toFixed(2)}</strong>
                  {row.regular_price !== null && <span>Was R {Number(row.regular_price).toFixed(2)}</span>}
                </div>
                {row.savings_percent !== null && <div className="comparison-saving">{Number(row.savings_percent).toFixed(0)}% off</div>}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

"use client";

import { useRef, useState } from "react";

type Product = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  unit: string | null;
  retailer_id: string;
  retailers: { id: string; name: string } | null;
};

type Branch = {
  id: string;
  name: string;
  suburb: string | null;
  city: string | null;
};

type Evidence = {
  storagePath: string;
  sourceHash: string;
};

export default function SnapScan() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready to capture");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [price, setPrice] = useState("");
  const [regularPrice, setRegularPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function capture(nextFile?: File) {
    if (!nextFile) return;
    setFile(nextFile);
    setFileName(nextFile.name);
    setStatus("Photo captured — identify the product below");
    setError(null);
    setSubmitted(false);
  }

  async function searchProducts() {
    if (query.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/search?q=${encodeURIComponent(query.trim())}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Product search failed");
      setProducts(payload.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Product search failed");
    } finally {
      setBusy(false);
    }
  }

  async function chooseProduct(nextProduct: Product) {
    setProduct(nextProduct);
    setProducts([]);
    setBranchId("");
    setError(null);
    const response = await fetch(`/api/retailers/${nextProduct.retailer_id}/branches`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Could not load branches");
      return;
    }
    setBranches(payload.data ?? []);
  }

  async function uploadEvidence(): Promise<Evidence> {
    if (!file) throw new Error("Capture a price photo first");
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/community/evidence", { method: "POST", body });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Evidence upload failed");
    return payload.data as Evidence;
  }

  async function submitContribution() {
    if (!product || !price) {
      setError("Select the product and enter the observed price");
      return;
    }
    if (!file) {
      setError("Capture a price photo so the contribution has evidence");
      return;
    }

    const observedPrice = Number(price);
    const regular = regularPrice ? Number(regularPrice) : undefined;
    if (!Number.isFinite(observedPrice) || observedPrice <= 0) {
      setError("Enter a valid price greater than zero");
      return;
    }
    if (regular !== undefined && (!Number.isFinite(regular) || regular < observedPrice)) {
      setError("Regular price cannot be below the observed price");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus("Uploading evidence…");
    try {
      const evidence = await uploadEvidence();
      setStatus("Submitting for verification…");
      const response = await fetch("/api/community/prices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          retailerId: product.retailer_id,
          storeBranchId: branchId || null,
          observedPrice,
          regularPrice: regular ?? null,
          currency: "ZAR",
          observedAt: new Date().toISOString(),
          notes: "Submitted through Snap / Scan",
          evidence: {
            storagePath: evidence.storagePath,
            sourceHash: evidence.sourceHash,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 401) throw new Error("Sign in to share a community price");
        throw new Error(payload.error ?? "Price submission failed");
      }
      setSubmitted(true);
      setStatus("Price submitted — pending community verification");
    } catch (err) {
      setStatus("Capture ready");
      setError(err instanceof Error ? err.message : "Price submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="snap-scan" aria-labelledby="snap-scan-title">
      <div className="snap-scan-copy">
        <p className="eyebrow">SNAP / SCAN</p>
        <h2 id="snap-scan-title">Turn what you see into useful shopping intelligence.</h2>
        <p>Capture the product or shelf price, match it to the verified catalogue, then send the evidence into the community verification flow.</p>

        <div className="snap-scan-actions">
          <button className="primary-button" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
            {file ? "Retake photo" : "Capture a price"}
          </button>
          <input ref={inputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => capture(e.target.files?.[0])} />
        </div>

        <p className="capture-status" role="status">{status}{fileName ? ` · ${fileName}` : ""}</p>

        {file && !submitted && (
          <div className="contribution-form">
            <label>
              Find the product
              <span className="input-row">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. milk, coffee, detergent" onKeyDown={(e) => e.key === "Enter" && searchProducts()} />
                <button type="button" onClick={searchProducts} disabled={busy || query.trim().length < 2}>Search</button>
              </span>
            </label>

            {products.length > 0 && (
              <div className="product-results" role="listbox" aria-label="Product results">
                {products.map((item) => (
                  <button key={item.id} type="button" onClick={() => chooseProduct(item)}>
                    <strong>{item.name}</strong>
                    <span>{[item.brand, item.unit, item.retailers?.name].filter(Boolean).join(" · ")}</span>
                  </button>
                ))}
              </div>
            )}

            {product && (
              <div className="selected-product">
                <span>Product</span>
                <strong>{product.name}</strong>
                <small>{product.retailers?.name}{product.unit ? ` · ${product.unit}` : ""}</small>
              </div>
            )}

            {product && (
              <label>
                Store / branch <span className="optional">optional</span>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">Retailer-wide price</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}{branch.suburb || branch.city ? ` · ${[branch.suburb, branch.city].filter(Boolean).join(", ")}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {product && (
              <div className="price-grid">
                <label>
                  Price
                  <span className="input-prefix"><span>R</span><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" /></span>
                </label>
                <label>
                  Regular price <span className="optional">optional</span>
                  <span className="input-prefix"><span>R</span><input inputMode="decimal" value={regularPrice} onChange={(e) => setRegularPrice(e.target.value)} placeholder="0.00" /></span>
                </label>
              </div>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}

            {product && (
              <button className="primary-button submit-price" type="button" onClick={submitContribution} disabled={busy}>
                {busy ? "Working…" : "Share price"}
              </button>
            )}
          </div>
        )}

        {submitted && (
          <div className="submission-success" role="status">
            <span>✓</span>
            <div><strong>Contribution received</strong><p>Your evidence is stored privately and the price is now pending verification. Verified data will feed future comparisons and savings.</p></div>
          </div>
        )}
      </div>

      <div className="scan-frame" aria-hidden="true">
        <div className="scan-corner top-left" />
        <div className="scan-corner top-right" />
        <div className="scan-corner bottom-left" />
        <div className="scan-corner bottom-right" />
        <div className="scan-line" />
        <span>PRODUCT / PRICE</span>
      </div>
    </section>
  );
}

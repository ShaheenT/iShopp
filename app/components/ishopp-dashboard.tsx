"use client";

import { useEffect, useMemo, useState } from "react";
import IShoppLogo from "./ishopp-logo";
import AuthModal from "./auth-modal";
import styles from "./ishopp-dashboard.module.css";
import { createClient } from "@/lib/supabase/client";

type Basket = { id: string; name: string; created_at: string; updated_at: string };
type Props = { email: string; name: string; baskets: Basket[]; itemCount: number };
type Product = { id: string; name: string; brand: string | null; unit: string | null; retailers: { id: string; name: string } | null };

export default function IShoppDashboard({ email, name, baskets: initialBaskets, itemCount: initialItemCount }: Props) {
  const [baskets, setBaskets] = useState(initialBaskets);
  const [itemCount, setItemCount] = useState(initialItemCount);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const firstName = useMemo(() => name.trim().split(/\s+/)[0] || email.split("@")[0] || "there", [name, email]);
  const activeBasket = baskets[0] ?? null;

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setResults([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(term)}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json();
        setResults(response.ok ? payload.data ?? [] : []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally { setSearching(false); }
    }, 260);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  async function createBasket() {
    if (creating) return;
    setCreating(true);
    try {
      const response = await fetch("/api/baskets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "My Basket" }) });
      const payload = await response.json();
      if (response.ok && payload.data) setBaskets((current) => [payload.data, ...current]);
    } finally { setCreating(false); }
  }

  async function addProduct(product: Product) {
    let basket = activeBasket;
    if (!basket) {
      const response = await fetch("/api/baskets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "My Basket" }) });
      const payload = await response.json();
      if (!response.ok || !payload.data) return;
      basket = payload.data;
      setBaskets((current) => [basket!, ...current]);
    }
    const response = await fetch(`/api/baskets/${basket.id}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: product.id, quantity: 1 }) });
    if (response.ok) { setItemCount((count) => count + 1); setQuery(""); setResults([]); }
  }

  async function signOut() { await createClient().auth.signOut(); window.location.href = "/"; }

  return (
    <main className={styles.shell}>
      <nav className={styles.nav} aria-label="Dashboard navigation">
        <a href="/" aria-label="iShopp home"><IShoppLogo className={styles.logo} /></a>
        <div className={styles.links}><a href="/">Discover</a><a className={styles.active} href="/dashboard">My iShopp</a><a href="/#community">Community</a></div>
        <div className={styles.account}><span>{email}</span><button type="button" onClick={signOut}>Sign out</button></div>
      </nav>
      <section className={styles.hero}>
        <div><p className={styles.eyebrow}>YOUR SHOPPING INTELLIGENCE</p><h1>Good to see you,<br /><em>{firstName}.</em></h1><p>Build your basket, compare verified prices and turn community intelligence into a better buying decision.</p></div>
        <button className={styles.capture} type="button" onClick={() => setAuthOpen(true)}>Snap / Scan <span>→</span></button>
      </section>
      <section className={styles.grid}>
        <article className={`${styles.card} ${styles.market}`}>
          <div className={styles.kicker}><span>01</span><span>MARKETPLACE</span></div><h2>What are you buying?</h2><p>Search the verified catalogue. No invented prices. Just products the system can identify.</p>
          <div className={styles.search}><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a product or brand" aria-label="Search products" />{searching && <small>Searching</small>}</div>
          {results.length > 0 && <div className={styles.results}>{results.map((product) => <button key={product.id} type="button" onClick={() => addProduct(product)}><span><strong>{product.name}</strong><small>{[product.brand, product.unit, product.retailers?.name].filter(Boolean).join(" · ") || "Verified product"}</small></span><b>+ Basket</b></button>)}</div>}
          {query.length >= 2 && !searching && results.length === 0 && <div className={styles.empty}>No verified products matched that search.</div>}
        </article>
        <article className={`${styles.card} ${styles.basket}`}>
          <div className={styles.kicker}><span>02</span><span>YOUR BASKET</span></div>
          <div className={styles.basketHead}><div><h2>{activeBasket?.name ?? "Start a basket"}</h2><p>{itemCount} {itemCount === 1 ? "item" : "items"} across your baskets</p></div><button className={styles.newButton} type="button" onClick={createBasket} disabled={creating}>{creating ? "Creating…" : "+ New basket"}</button></div>
          {activeBasket ? <a className={styles.basketLink} href={`/basket/${activeBasket.id}`}>Open basket <span>→</span></a> : <p className={styles.basketEmpty}>Add your first product and iShopp will create a basket for you.</p>}
        </article>
      </section>
      <section className={styles.next}>
        <div><p className={styles.eyebrow}>THE NEXT DECISION</p><h2>Compare first.<br /><em>Optimise second.</em></h2></div>
        <div className={styles.nextCopy}><p>Once your basket has products, iShopp can use verified retailer intelligence to compare practical buying options and calculate savings without guessing.</p><div className={styles.nextSteps}><span><b>03</b> Compare</span><span><b>04</b> Optimise</span><span><b>05</b> Save</span></div></div>
      </section>
      <footer className={styles.footer}><IShoppLogo className={styles.footerLogo} /><span>Share More. Save More.</span></footer>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}

"use client";

import { useState } from "react";
import IShoppLogo from "./ishopp-logo";
import styles from "./basket-view.module.css";

type Product = { id: string; name: string; brand: string | null; unit: string | null; image_url: string | null };
type Item = { id: string; product_id: string; quantity: number; products: Product | null };
type Basket = { id: string; name: string; created_at: string; updated_at: string };

export default function BasketView({ basket, items: initialItems }: { basket: Basket; items: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [saving, setSaving] = useState<string | null>(null);

  async function updateQuantity(item: Item, quantity: number) {
    if (quantity < 1 || saving) return;
    setSaving(item.id);
    try {
      const response = await fetch(`/api/baskets/${basket.id}/items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity }) });
      if (response.ok) setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity } : entry));
    } finally { setSaving(null); }
  }

  return (
    <main className={styles.shell}>
      <nav className={styles.nav}><a href="/dashboard" aria-label="Back to dashboard"><IShoppLogo className={styles.logo} /></a><a className={styles.back} href="/dashboard">← My iShopp</a></nav>
      <section className={styles.hero}><div><p className={styles.eyebrow}>YOUR BASKET</p><h1>{basket.name}</h1><p>{items.length} {items.length === 1 ? "product" : "products"}. Quantities are saved to your account.</p></div><a className={styles.shop} href="/dashboard">Add products <span>→</span></a></section>
      <section className={styles.list}>
        {items.length === 0 ? <div className={styles.empty}><h2>Your basket is empty.</h2><p>Search the verified marketplace from your dashboard to add your first product.</p><a href="/dashboard">Browse marketplace →</a></div> : items.map((item) => <article className={styles.item} key={item.id}><div><p className={styles.brand}>{item.products?.brand ?? "Verified product"}</p><h2>{item.products?.name ?? "Product"}</h2><p className={styles.unit}>{item.products?.unit ?? ""}</p></div><div className={styles.controls}><button disabled={saving === item.id || item.quantity <= 1} onClick={() => updateQuantity(item, item.quantity - 1)} aria-label="Decrease quantity">−</button><strong>{item.quantity}</strong><button disabled={saving === item.id} onClick={() => updateQuantity(item, item.quantity + 1)} aria-label="Increase quantity">+</button></div><a className={styles.compare} href={`/compare/${item.product_id}`}>Compare verified prices <span>→</span></a></article>)}
      </section>
      <section className={styles.future}><p className={styles.eyebrow}>NEXT</p><h2>Compare → Optimise → Save.</h2><p>Price comparison and basket optimisation will use verified commercial data only. iShopp will never manufacture a price to complete the experience.</p></section>
    </main>
  );
}

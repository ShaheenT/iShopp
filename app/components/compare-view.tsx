import IShoppLogo from "./ishopp-logo";
import styles from "./compare-view.module.css";

type Product = { id: string; name: string; brand: string | null; unit: string | null };
type Offer = Record<string, unknown>;

function text(offer: Offer, keys: string[]) { for (const key of keys) { const value = offer[key]; if (value !== null && value !== undefined && value !== "") return String(value); } return "—"; }
function number(offer: Offer, keys: string[]) { for (const key of keys) { const value = Number(offer[key]); if (Number.isFinite(value)) return value; } return null; }

export default function CompareView({ product, offers }: { product: Product; offers: Offer[] }) {
  const ranked = [...offers].sort((a, b) => (number(a, ["special_price", "price", "unit_price"]) ?? Infinity) - (number(b, ["special_price", "price", "unit_price"]) ?? Infinity));
  const best = ranked.find((offer) => number(offer, ["special_price", "price", "unit_price"]) !== null);
  const bestPrice = best ? number(best, ["special_price", "price", "unit_price"]) : null;
  return (
    <main className={styles.shell}>
      <nav className={styles.nav}><a href="/dashboard" aria-label="iShopp dashboard"><IShoppLogo className={styles.logo} /></a><a href="/dashboard">← My iShopp</a></nav>
      <section className={styles.hero}><p className={styles.eyebrow}>VERIFIED PRICE INTELLIGENCE</p><h1>{product.name}</h1><p>{[product.brand, product.unit].filter(Boolean).join(" · ") || "Verified product"}</p></section>
      <section className={styles.content}>
        <div className={styles.summary}><span>LOWEST VERIFIED PRICE</span><strong>{bestPrice === null ? "—" : `R ${bestPrice.toFixed(2)}`}</strong><small>{best ? `${text(best, ["retailer_name", "retailer", "name"])}${text(best, ["branch_name", "store_branch_name"]) !== "—" ? ` · ${text(best, ["branch_name", "store_branch_name"])}` : ""}` : "No current verified offer"}</small></div>
        <div className={styles.list}>{ranked.length ? ranked.map((offer, index) => { const price = number(offer, ["special_price", "price", "unit_price"]); return <article className={`${styles.row} ${index === 0 ? styles.best : ""}`} key={`${text(offer,["special_id","id"]) }-${index}`}><span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span><div><h2>{text(offer, ["retailer_name", "retailer", "name"])}</h2><p>{text(offer, ["branch_name", "store_branch_name", "branch"])}</p></div><div className={styles.price}><strong>{price === null ? "—" : `R ${price.toFixed(2)}`}</strong><small>{text(offer, ["currency"])}</small></div></article>; }) : <div className={styles.empty}>There are no current verified offers for this product.</div>}</div>
      </section>
      <footer className={styles.footer}>Verified commercial data only. Compare before you buy.</footer>
    </main>
  );
}

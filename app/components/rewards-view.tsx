"use client";

import { useEffect, useState } from "react";
import IShoppLogo from "./ishopp-logo";
import styles from "./rewards-view.module.css";

type Rewards = {
  points: number;
  verifiedContributions: number;
  trustScore: number;
  trustLevel: string;
};

export default function RewardsView() {
  const [rewards, setRewards] = useState<Rewards | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/rewards", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Rewards are unavailable.");
        if (!cancelled) setRewards(payload.data);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Rewards are unavailable.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className={styles.shell}>
      <nav className={styles.nav}>
        <a href="/dashboard" aria-label="iShopp dashboard"><IShoppLogo className={styles.logo} /></a>
        <a href="/dashboard">My iShopp</a>
      </nav>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>COMMUNITY REWARDS</p>
        <h1>Your contribution<br /><em>has value.</em></h1>
        <p>Every verified price makes iShopp more useful for the next shopper. Your contribution builds trust and earns points.</p>
      </section>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <section className={styles.score}>
        <div className={styles.points}><span>YOUR POINTS</span><strong>{rewards?.points ?? "—"}</strong><small>Earned from verified contributions</small></div>
        <div className={styles.trust}><span>TRUST LEVEL</span><strong>{rewards?.trustLevel ?? "—"}</strong><small>{rewards ? `${rewards.trustScore.toFixed(0)} / 100 trust score` : "Building your record"}</small></div>
      </section>
      <section className={styles.details}>
        <p className={styles.eyebrow}>WHAT COUNTS</p>
        <div className={styles.row}><strong>Verified price contributions</strong><span>{rewards?.verifiedContributions ?? "—"}</span></div>
        <div className={styles.row}><strong>Trust is earned</strong><span>Verified outcomes</span></div>
        <div className={styles.row}><strong>Rewards are points</strong><span>Not cash</span></div>
      </section>
      <section className={styles.cta}>
        <p className={styles.eyebrow}>KEEP THE LOOP MOVING</p>
        <h2>Snap a price.<br />Help someone save.</h2>
        <a href="/#community">Share a price →</a>
      </section>
      <footer className={styles.footer}>iShopp rewards are ledger-based points. They are not a cash balance.</footer>
    </main>
  );
}

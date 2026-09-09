"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import IShoppLogo from "./ishopp-logo";
import SnapScan from "./snap-scan";
import AuthModal from "./auth-modal";

const steps = [
  { number: "01", title: "Snap / Scan", text: "Capture a product, shelf label or special while you shop." },
  { number: "02", title: "Share", text: "Add the price and evidence so the community can verify it." },
  { number: "03", title: "Compare", text: "See verified prices across retailers and branches." },
  { number: "04", title: "Save", text: "Build the lowest practical basket and reduce your spend." },
];

export default function IShoppHome() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [captureName, setCaptureName] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserEmail(data.user?.email ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUserEmail(session?.user?.email ?? null);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  function handleCapture(file?: File) {
    if (!file) return;
    setCaptureName(file.name);
  }

  function startCapture() {
    if (!userEmail) { setAuthOpen(true); return; }
    inputRef.current?.click();
  }

  async function signOut() { await createClient().auth.signOut(); }

  return (
    <main className="ishopp-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="iShopp home"><IShoppLogo className="ishopp-logo" /></a>
        <div className="nav-links"><a href="#how-it-works">How it works</a><a href="#savings">Savings</a><a href="#community">Community</a></div>
        <div className="nav-account">
          {userEmail ? <button className="nav-account-button" type="button" onClick={signOut} title="Sign out">{userEmail.split("@")[0]} · Sign out</button> : <button className="nav-account-button" type="button" onClick={() => setAuthOpen(true)}>Sign in</button>}
          <button className="nav-action" onClick={startCapture}>Snap a price</button>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">COMMUNITY RETAIL INTELLIGENCE</p><h1>Share more.<br /><em>Save more.</em></h1>
          <p className="hero-text">Snap a product or price. Share it with the community. iShopp turns verified shopping data into better buying decisions.</p>
          <div className="hero-actions"><button className="primary-button" onClick={startCapture}><span className="button-icon">＋</span> Snap / Scan</button><a className="secondary-button" href="#how-it-works">See how it works</a></div>
          <p className="trust-line"><span className="pulse" /> Verified community intelligence · Built for real savings</p>
        </div>
        <div className="capture-card" id="community"><div className="capture-glow" /><div className="capture-inner">
          <div className="capture-icon">⌁</div><p className="capture-kicker">START HERE</p><h2>What are you shopping for?</h2>
          <p>Capture a product, shelf label or special. Your evidence becomes the starting point for community price intelligence.</p>
          <button className="capture-button" onClick={startCapture}>Capture product</button>
          {captureName && <p className="capture-status">Ready: {captureName}</p>}
          <input ref={inputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => handleCapture(event.target.files?.[0])} />
          <p className="capture-note">Photo evidence stays attached to the contribution flow.</p>
        </div></div>
      </section>

      <SnapScan />

      <section className="flow-section" id="how-it-works"><div className="section-heading"><p className="eyebrow">THE iSHOPP LOOP</p><h2>From a quick snap<br />to a smarter basket.</h2></div>
        <div className="flow-grid">{steps.map((step) => <article className="flow-card" key={step.number}><span className="step-number">{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
      </section>
      <section className="savings-section" id="savings"><div><p className="eyebrow">THE PROMISE</p><h2>Don&apos;t just find a price.<br /><em>Find the better decision.</em></h2></div><div className="savings-points"><div><strong>01</strong><span>Verified prices, not guesses.</span></div><div><strong>02</strong><span>Retailer and branch-aware comparisons.</span></div><div><strong>03</strong><span>Basket optimisation for practical savings.</span></div></div></section>
      <footer className="footer"><IShoppLogo className="footer-logo" /><span>Share More. Save More.</span></footer>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}

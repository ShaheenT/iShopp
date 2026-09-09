"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "reset";
type Props = { open: boolean; onClose: () => void };

export default function AuthModal({ open, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setError(null); setMessage(null); } }, [open]);
  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    try {
      const supabase = createClient();
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/` });
        if (resetError) throw resetError;
        setMessage("If an account exists for that email, a password reset link has been sent."); return;
      }
      if (mode === "signup") {
        if (!name.trim()) throw new Error("Please enter your name.");
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } });
        if (signUpError) throw signUpError;
        if (!data.session) setMessage("Account created. Check your email to verify your account before signing in."); else onClose();
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }

  const title = mode === "signin" ? "Welcome back." : mode === "signup" ? "Create your iShopp account." : "Reset your password.";
  const description = mode === "signin" ? "Sign in to compare verified prices, build baskets and contribute to the community." : mode === "signup" ? "Join the community powering smarter shopping decisions." : "Enter your email and we’ll send instructions if an account exists.";
  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" type="button" aria-label="Close" onClick={onClose}>×</button>
        <p className="eyebrow">iSHOPP ACCOUNT</p><h2 id="auth-title">{title}</h2><p className="auth-description">{description}</p>
        <form onSubmit={submit}>
          {mode === "signup" && <label className="auth-field"><span>Name</span><input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></label>}
          <label className="auth-field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          {mode !== "reset" && <label className="auth-field"><span>Password</span><input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-message" role="status">{message}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}</button>
        </form>
        <div className="auth-links">
          {mode === "signin" && <button type="button" onClick={() => setMode("reset")}>Forgot password?</button>}
          {mode === "reset" && <button type="button" onClick={() => setMode("signin")}>Back to sign in</button>}
          {mode !== "reset" && <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Create an account" : "Already have an account? Sign in"}</button>}
        </div>
      </section>
      <style jsx>{` .auth-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(17,17,17,.42);backdrop-filter:blur(12px)}.auth-modal{position:relative;width:min(460px,100%);padding:40px;border:1px solid rgba(255,255,255,.55);border-radius:30px;background:#f7f7f4;box-shadow:0 30px 100px rgba(0,0,0,.25)}.auth-close{position:absolute;top:17px;right:17px;width:34px;height:34px;border:0;border-radius:50%;background:#e9e9e5;font-size:22px;line-height:1}.auth-modal h2{margin:0;font-size:36px;line-height:1;letter-spacing:-1.8px}.auth-description{margin:16px 0 28px;color:#666;line-height:1.55;font-size:14px}.auth-field{display:block;margin:14px 0}.auth-field span{display:block;margin-bottom:7px;color:#555;font-size:11px;font-weight:800}.auth-field input{width:100%;padding:14px;border:1px solid #d2d2cd;border-radius:13px;background:white;outline:0}.auth-field input:focus{border-color:#777;box-shadow:0 0 0 3px rgba(109,117,104,.12)}.auth-submit{width:100%;margin-top:10px}.auth-error,.auth-message{font-size:12px;line-height:1.45}.auth-error{color:#9b3d32}.auth-message{color:#5e685a;padding:12px;border-radius:12px;background:#e9eee6}.auth-links{display:flex;justify-content:center;margin-top:20px}.auth-links button{border:0;background:none;color:#666;font-size:12px;text-decoration:underline;text-underline-offset:3px}@media(max-width:520px){.auth-modal{padding:30px 22px;border-radius:24px}.auth-modal h2{font-size:30px}}`}</style>
    </div>
  );
}

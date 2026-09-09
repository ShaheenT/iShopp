"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "reset";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AuthModal({ open, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMessage(null);
  }, [open]);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();

      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/`,
        });
        if (resetError) throw resetError;
        setMessage("If an account exists for that email, a password reset link has been sent.");
        return;
      }

      if (mode === "signup") {
        if (!name.trim()) throw new Error("Please enter your name.");
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setMessage("Account created. Check your email to verify your account before signing in.");
        } else {
          onClose();
        }
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signin" ? "Welcome back." : mode === "signup" ? "Create your iShopp account." : "Reset your password.";
  const description = mode === "signin"
    ? "Sign in to compare verified prices, build baskets and contribute to the community."
    : mode === "signup"
      ? "Join the community powering smarter shopping decisions."
      : "Enter your email and we’ll send instructions if an account exists.";

  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" type="button" aria-label="Close" onClick={onClose}>×</button>
        <p className="eyebrow">iSHOPP ACCOUNT</p>
        <h2 id="auth-title">{title}</h2>
        <p className="auth-description">{description}</p>

        <form onSubmit={submit}>
          {mode === "signup" && (
            <label className="auth-field">
              <span>Name</span>
              <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
          )}
          <label className="auth-field">
            <span>Email</span>
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          {mode !== "reset" && (
            <label className="auth-field">
              <span>Password</span>
              <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
            </label>
          )}

          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-message" role="status">{message}</p>}

          <button className="primary-button auth-submit" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </button>
        </form>

        <div className="auth-links">
          {mode === "signin" && <button type="button" onClick={() => setMode("reset")}>Forgot password?</button>}
          {mode === "reset" && <button type="button" onClick={() => setMode("signin")}>Back to sign in</button>}
          {mode !== "reset" && (
            <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "Create an account" : "Already have an account? Sign in"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

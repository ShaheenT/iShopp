import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  async function signIn(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const next = safeNext(String(formData.get("next") ?? null));

    if (!email || !password) redirect(`/login?error=missing_credentials&next=${encodeURIComponent(next)}`);

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) redirect(`/login?error=invalid_credentials&next=${encodeURIComponent(next)}`);
    redirect(next);
  }

  return <LoginForm signIn={signIn} searchParams={searchParams} />;
}

async function LoginForm({
  signIn,
  searchParams,
}: {
  signIn: (formData: FormData) => Promise<void>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next ?? null);
  const message = params.error === "invalid_credentials"
    ? "Invalid email or password."
    : params.error === "missing_credentials"
      ? "Email and password are required."
      : params.error === "auth_callback"
        ? "Authentication could not be completed."
        : null;

  return (
    <main>
      <h1>Sign in to iShopp</h1>
      {message && <p role="alert">{message}</p>}
      <form action={signIn}>
        <input type="hidden" name="next" value={next} />
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}

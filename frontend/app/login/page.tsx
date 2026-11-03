"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = useMemo(() => searchParams.get("redirect") || "/dashboard", [searchParams]);
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@societygatepass.com");
  const [password, setPassword] = useState("Admin@123");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await login({ email, password });
      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-8 md:px-10">
      <section className="grid w-full overflow-hidden rounded-xl border border-border bg-surface shadow-[0_30px_80px_rgba(37,48,23,0.10)] lg:grid-cols-[1fr_0.95fr]">
        <div className="bg-accent-strong px-8 py-10 text-white md:px-10 md:py-12">
          <p className="text-sm uppercase tracking-[0.2em] text-white/70">Welcome back</p>
          <h1 className="mt-4 font-display text-5xl leading-[0.95] tracking-tight">
            Enter the gate management portal.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-white/80">
            Use the seeded admin, owner, or security account to verify the full
            Phase 1 authentication flow and role-based access.
          </p>
        </div>
        <div className="bg-white/80 px-8 py-10 md:px-10 md:py-12">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">
                Email
              </label>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
                className="w-full rounded-lg border border-border bg-white px-4 py-3 outline-none transition focus:border-accent-strong"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">
                Password
              </label>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                required
                className="w-full rounded-lg border border-border bg-white px-4 py-3 outline-none transition focus:border-accent-strong"
              />
            </div>
            {error ? (
              <p className="rounded-lg border border-danger/20 bg-[#fff1ea] px-4 py-3 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
            className="w-full rounded-xl bg-accent-strong px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p className="mt-6 text-sm text-muted">
            Owner and security accounts are created by an administrator.
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

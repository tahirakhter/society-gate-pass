import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 md:px-10">
      <section className="relative overflow-hidden rounded-xl border border-border bg-surface px-6 py-8 shadow-[0_30px_80px_rgba(37,48,23,0.10)] backdrop-blur md:px-10 md:py-12">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent-soft blur-3xl" />
        <div className="absolute bottom-0 right-0 h-48 w-48 translate-x-10 translate-y-10 rounded-full bg-[#efc885]/60 blur-3xl" />
        <div className="relative grid gap-10 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="space-y-6">
            <p className="inline-flex rounded-md border border-border bg-white/65 px-4 py-2 text-sm tracking-[0.2em] text-muted uppercase">
              Society Gate Pass
            </p>
            <div className="space-y-4">
              <h1 className="max-w-3xl font-display text-5xl leading-[0.95] tracking-tight text-foreground md:text-7xl">
                Secure resident entry starts before the gate opens.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted md:text-xl">
                Phase 1 now includes authentication, role-based access, and
                house-owner mapping for owners, security staff, and admins.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl bg-accent-strong px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue"
              >
                Sign in to the portal
              </Link>
            </div>
          </div>
          <div className="grid gap-4">
            {[
              ["Owner", "Access assigned houses, create visitor passes, and share QR codes."],
              ["Security", "Use a dedicated login with the correct permissions for gate operations."],
              ["Admin", "Create user accounts and assign houses from one controlled workspace."],
            ].map(([title, copy]) => (
              <article
                key={title}
                className="rounded-[1.5rem] border border-border bg-white/70 p-5 shadow-[0_12px_30px_rgba(37,48,23,0.08)]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-strong">
                  {title}
                </p>
                <p className="mt-3 text-base leading-7 text-muted">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

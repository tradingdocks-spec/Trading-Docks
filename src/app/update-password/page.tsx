import type { Metadata } from "next";

import { updatePassword } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Update Password",
  description: "Choose a new password for your Trading Docks account.",
  robots: {
    index: false,
    follow: false,
  },
};

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function UpdatePasswordPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-td-canvas px-5 text-td-primary">
      <section className="w-full max-w-md rounded-3xl border border-td-ink/10 bg-td-ink/[0.04] p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-td-accent-text">
          Trading Docks
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-td-secondary">
          Use at least eight characters.
        </p>
        {error ? (
          <p className="mt-5 rounded-xl border border-td-danger/20 bg-td-danger/10 p-3 text-sm text-td-danger">
            {error}
          </p>
        ) : null}
        <form action={updatePassword} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="password">
              New password
            </label>
            <input
              className="h-12 w-full rounded-xl border border-td-ink/10 bg-td-canvas px-4 outline-none focus:border-td-accent"
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="confirmPassword">
              Confirm new password
            </label>
            <input
              className="h-12 w-full rounded-xl border border-td-ink/10 bg-td-canvas px-4 outline-none focus:border-td-accent"
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <button className="h-12 w-full rounded-xl bg-td-accent font-semibold text-td-on-accent hover:bg-td-accent">
            Update password
          </button>
        </form>
      </section>
    </main>
  );
}

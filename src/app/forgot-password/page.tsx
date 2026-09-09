import type { Metadata } from "next";
import Link from "next/link";

import { requestPasswordReset } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Request a secure Trading Docks password reset link.",
  robots: {
    index: false,
    follow: false,
  },
};

type Props = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const { error, success } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-td-canvas px-5 text-td-primary">
      <section className="w-full max-w-md rounded-3xl border border-td-ink/10 bg-td-ink/[0.04] p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-td-accent-text">
          Trading Docks
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm leading-6 text-td-secondary">
          Enter the email address connected to your account.
        </p>

        {error ? (
          <p className="mt-5 rounded-xl border border-td-danger/20 bg-td-danger/10 p-3 text-sm text-td-danger">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-5 rounded-xl border border-td-success/20 bg-td-success/10 p-3 text-sm text-td-success">
            {success}
          </p>
        ) : null}

        {!success ? (
          <form action={requestPasswordReset} className="mt-6 space-y-4">
            <label className="block text-sm font-medium" htmlFor="email">
              Email address
            </label>
            <input
              className="h-12 w-full rounded-xl border border-td-ink/10 bg-td-canvas px-4 outline-none focus:border-td-accent"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            <button className="h-12 w-full rounded-xl bg-td-accent font-semibold text-td-on-accent hover:bg-td-accent">
              Send reset link
            </button>
          </form>
        ) : null}

        <Link className="mt-6 inline-block text-sm text-td-accent-text hover:text-td-accent-text" href="/sign-in">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}

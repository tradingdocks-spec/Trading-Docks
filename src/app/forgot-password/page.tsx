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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
          Trading Docks
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Enter the email address connected to your account.
        </p>

        {error ? (
          <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">
            {success}
          </p>
        ) : null}

        {!success ? (
          <form action={requestPasswordReset} className="mt-6 space-y-4">
            <label className="block text-sm font-medium" htmlFor="email">
              Email address
            </label>
            <input
              className="h-12 w-full rounded-xl border border-white/10 bg-slate-900 px-4 outline-none focus:border-cyan-400"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            <button className="h-12 w-full rounded-xl bg-cyan-400 font-semibold text-slate-950 hover:bg-cyan-300">
              Send reset link
            </button>
          </form>
        ) : null}

        <Link className="mt-6 inline-block text-sm text-cyan-300 hover:text-cyan-200" href="/sign-in">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}

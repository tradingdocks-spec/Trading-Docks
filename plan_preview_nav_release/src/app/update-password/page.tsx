import { updatePassword } from "@/app/actions/auth";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function UpdatePasswordPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
          Trading Docks
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Use at least eight characters.
        </p>
        {error ? (
          <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <form action={updatePassword} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="password">
              New password
            </label>
            <input
              className="h-12 w-full rounded-xl border border-white/10 bg-slate-900 px-4 outline-none focus:border-cyan-400"
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
              className="h-12 w-full rounded-xl border border-white/10 bg-slate-900 px-4 outline-none focus:border-cyan-400"
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <button className="h-12 w-full rounded-xl bg-cyan-400 font-semibold text-slate-950 hover:bg-cyan-300">
            Update password
          </button>
        </form>
      </section>
    </main>
  );
}

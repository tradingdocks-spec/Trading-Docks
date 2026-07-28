import { SUPPORTED_GAMES } from "./landing-data";

export function TrustedGames() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-[1480px] px-5 sm:px-8 lg:px-12">
      <div className="rounded-[28px] border border-white/[0.08] bg-[#071522]/78 px-5 py-6 shadow-[0_28px_90px_rgba(0,0,0,0.3)] backdrop-blur-xl">
        <div className="grid gap-7 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#536a80]">
              Built for real operators
            </p>

            <p className="mt-3 text-sm leading-6 text-[#9aabba]">
              Built for Magic and Pokémon collectors, marketplace sellers, LGS
              owners, and growing card businesses.
            </p>
          </div>

          <div className="flex flex-wrap justify-start gap-3 lg:justify-end">
            {SUPPORTED_GAMES.map((game) => (
              <div
                key={game.label}
                className="group flex items-center gap-3 rounded-2xl border border-white/[0.075] bg-black/[0.1] px-4 py-3 text-xs font-medium text-[#a9b8c8] transition duration-300 hover:-translate-y-1 hover:border-[#00d7f2]/25 hover:bg-[#00d7f2]/[0.04] hover:text-white"
              >
                <span className="flex h-7 min-w-7 items-center justify-center rounded-lg border border-[#00d7f2]/13 bg-[#00d7f2]/[0.04] px-1.5 text-[8px] font-bold text-[#20e7ff]">
                  {game.short}
                </span>
                {game.label}
              </div>
            ))}

          </div>
        </div>
      </div>
    </section>
  );
}

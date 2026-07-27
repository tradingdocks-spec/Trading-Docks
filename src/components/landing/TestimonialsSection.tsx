import { TESTIMONIALS } from "./landing-data";

export function TestimonialsSection() {
  return (
    <section className="relative z-10 border-y border-white/[0.055] bg-white/[0.012]">
      <div className="mx-auto w-full max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#20e7ff]">
            Product principles
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            A workspace designed around the life of every card.
          </h2>
          <p className="mt-5 text-base leading-7 text-[#8296aa]">
            Clear foundations for collectors, growing sellers, and established stores.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <article
              key={testimonial.quote}
              className="rounded-[24px] border border-white/[0.075] bg-[#071522]/78 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]"
            >
              <p className="text-base leading-7 text-[#dbe8f1]">{testimonial.quote}</p>

              <div className="mt-6 border-t border-white/[0.06] pt-5">
                <p className="text-sm font-semibold">{testimonial.name}</p>
                <p className="mt-1 text-xs text-[#60778c]">{testimonial.role}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

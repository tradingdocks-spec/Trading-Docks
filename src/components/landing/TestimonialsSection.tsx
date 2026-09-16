import { TESTIMONIALS } from "./landing-data";

export function TestimonialsSection() {
  return (
    <section className="relative z-10 border-y border-td-ink/[0.055] bg-td-ink/[0.012]">
      <div className="mx-auto w-full max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-td-accent-text">
            Product principles
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            A workspace designed around the life of every card.
          </h2>
          <p className="mt-5 text-base leading-7 text-td-secondary">
            Clear foundations for collectors, growing sellers, and established stores.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <article
              key={testimonial.quote}
              className="rounded-[24px] border border-td-ink/[0.075] bg-td-surface/78 p-6 shadow-[0_24px_70px_rgb(var(--td-shadow-rgb)/calc(0.22*var(--td-shadow-strength)))]"
            >
              <p className="text-base leading-7 text-td-primary">{testimonial.quote}</p>

              <div className="mt-6 border-t border-td-ink/[0.06] pt-5">
                <p className="text-sm font-semibold">{testimonial.name}</p>
                <p className="mt-1 text-xs text-td-secondary">{testimonial.role}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

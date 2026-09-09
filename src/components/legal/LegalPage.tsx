import Link from "next/link";

import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";

type LegalSection = {
  title: string;
  paragraphs: string[];
};

export function LegalPage({
  eyebrow,
  title,
  introduction,
  sections,
}: {
  eyebrow: string;
  title: string;
  introduction: string;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen bg-td-canvas text-td-primary">
      <Header />
      <main className="px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm font-medium text-td-accent-text transition hover:text-td-accent-text"
        >
          ← Back to Trading Docks
        </Link>

        <header className="mt-12 border-b border-td-ink/[0.08] pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-td-accent-text">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 text-sm leading-7 text-td-secondary">{introduction}</p>
          <p className="mt-3 text-xs text-td-muted">Last updated July 27, 2026</p>
        </header>

        <div className="space-y-10 py-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-td-primary">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-sm leading-7 text-td-secondary"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="border-t border-td-ink/[0.08] py-8 text-xs text-td-muted">
          Questions? Contact{" "}
          <a
            href="mailto:tradingdocks@gmail.com"
            className="text-td-accent-text transition hover:text-td-accent-text"
          >
            tradingdocks@gmail.com
          </a>
          .
        </footer>
        </div>
      </main>
      <Footer />
    </div>
  );
}

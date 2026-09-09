"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import { type MouseEvent, useEffect, useRef, useState } from "react";

import { TransitionLink } from "@/components/navigation/PolishedNavigation";
import { BrandMark } from "./BrandMark";
import styles from "./SignatureHero.module.css";
import { ThemePicker } from "@/components/theme/ThemeProvider";

const PRODUCT_NAV = [
  { label: "Lifecycle", href: "#experience" },
  { label: "Platform", href: "#platform" },
  { label: "Market", href: "#market" },
  { label: "Pricing", href: "#pricing" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuPanel = useRef<HTMLDivElement>(null);

  function navigateToSection(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    if (!href.startsWith("#")) return;

    const target = document.querySelector(href);
    if (!target) return;

    event.preventDefault();
    setOpen(false);
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    window.history.pushState(null, "", href);
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    if (!open) return;
    menuPanel.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
      if (event.key === "Tab") {
        const links =
          menuPanel.current?.querySelectorAll<HTMLAnchorElement>("a[href]");
        const last = links?.[links.length - 1];
        if (event.shiftKey && document.activeElement === menuButton.current) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          menuButton.current?.focus();
        }
      }
    }
    const desktop = window.matchMedia("(min-width: 1280px)");
    function onResize() {
      if (desktop.matches) setOpen(false);
    }
    desktop.addEventListener("change", onResize);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
      desktop.removeEventListener("change", onResize);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-td-ink/[0.06] bg-td-canvas/96 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] w-full max-w-[1480px] items-center justify-between px-4 sm:px-8 xl:px-12">
        <BrandMark priority />

        <nav
          aria-label="Primary site navigation"
          className="hidden items-center gap-1 xl:flex"
        >
          {PRODUCT_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(event) => navigateToSection(event, item.href)}
              className="px-3 py-2 text-sm font-medium text-td-muted transition hover:text-td-primary"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          <TransitionLink
            href="/sign-in"
            className="inline-flex h-10 shrink-0 items-center px-4 text-sm font-medium text-td-secondary transition hover:text-td-primary"
          >
            Log in
          </TransitionLink>
          <TransitionLink
            href="/sign-up?plan=free"
            className={`${styles.primaryButton} group inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] bg-td-accent px-4 text-sm font-semibold text-td-on-accent transition hover:bg-td-accent`}
          >
            <span className="relative z-10">Start free</span>
            <ArrowRight className="relative z-10 h-4 w-4" />
          </TransitionLink>
        </div>

        <ThemePicker />
        <button
          ref={menuButton}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={open ? "homepage-mobile-navigation" : undefined}
          aria-label={open ? "Close navigation" : "Open navigation"}
          className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-td-ink/[0.1] text-td-primary transition active:scale-95 xl:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div
          ref={menuPanel}
          id="homepage-mobile-navigation"
          className="fixed inset-x-0 top-[68px] z-50 h-[calc(100dvh-68px)] overflow-y-auto border-t border-td-ink/[0.06] bg-td-canvas px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-4 xl:hidden"
        >
          <nav
            aria-label="Mobile site navigation"
            className="mx-auto flex max-w-md flex-col gap-2"
          >
            {PRODUCT_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(event) => navigateToSection(event, item.href)}
                className="flex min-h-[52px] items-center justify-between border-b border-td-ink/[0.08] px-1 text-base font-semibold text-td-primary last:border-b-0"
              >
                {item.label}
                <ArrowRight className="h-4 w-4 text-td-accent-text" />
              </a>
            ))}
          </nav>

          <div className="mx-auto mt-4 grid max-w-md grid-cols-2 gap-3">
            <TransitionLink
              href="/sign-in"
              className="inline-flex h-[48px] items-center justify-center rounded-[10px] border border-td-ink/[0.1] text-sm font-semibold text-td-primary"
            >
              Log in
            </TransitionLink>
            <TransitionLink
              href="/sign-up?plan=free"
              className="inline-flex h-[48px] items-center justify-center gap-2 rounded-[10px] bg-td-accent text-sm font-semibold text-td-on-accent"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </TransitionLink>
          </div>
        </div>
      ) : null}
    </header>
  );
}

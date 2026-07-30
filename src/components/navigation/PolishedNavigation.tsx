"use client";

import type { MouseEvent, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type TransitionLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
};

export function TransitionLink({
  href,
  className,
  children,
  ariaLabel,
}: TransitionLinkProps) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(href);
      return;
    }

    setLeaving(true);
    window.setTimeout(() => router.push(href), 360);
  }

  return (
    <>
      <a
        href={href}
        onClick={navigate}
        className={className}
        aria-label={ariaLabel}
        aria-busy={leaving}
      >
        {children}
      </a>

      {leaving ? (
        <div className="td-route-wipe" aria-hidden="true">
          <div className="td-route-wipe__glow" />
          <div className="td-route-wipe__mark">
            <span>T</span>D
          </div>
          <div className="td-route-wipe__line" />
        </div>
      ) : null}
    </>
  );
}

type ExploreLinkProps = {
  href: `#${string}`;
  className?: string;
  children: ReactNode;
};

export function ExploreLink({ href, className, children }: ExploreLinkProps) {
  function reveal(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    target.classList.remove("td-section-arrival");
    target.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });

    if (!reducedMotion) {
      window.setTimeout(() => {
        target.classList.add("td-section-arrival");
        window.setTimeout(
          () => target.classList.remove("td-section-arrival"),
          900,
        );
      }, 420);
    }

    window.history.replaceState(null, "", href);
  }

  return (
    <a href={href} onClick={reveal} className={className}>
      {children}
    </a>
  );
}

export function RouteEntrance({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => {
      window.cancelAnimationFrame(frame);
      setReady(false);
    };
  }, [pathname]);

  return (
    <div
      key={pathname}
      className={ready ? "td-route-enter td-route-enter--ready" : "td-route-enter"}
    >
      {children}
    </div>
  );
}

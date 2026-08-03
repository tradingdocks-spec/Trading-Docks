"use client";

import { useEffect } from "react";

export function LandingExperienceEffects() {
  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".td-spotlight-card"));
    const cleanups = cards.map((card) => {
      const move = (event: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--td-mouse-x", `${event.clientX - rect.left}px`);
        card.style.setProperty("--td-mouse-y", `${event.clientY - rect.top}px`);
      };
      card.addEventListener("mousemove", move);
      return () => card.removeEventListener("mousemove", move);
    });

    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-td-reveal]"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).dataset.tdVisible = "true";
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    revealNodes.forEach((node) => observer.observe(node));

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      observer.disconnect();
    };
  }, []);

  return null;
}

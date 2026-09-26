"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./storefront.module.css";

/** Native modal behavior supplies focus containment, Escape and background inertness. */
export function StorefrontDialog({ children, labelledBy, onClose, variant = "detail" }: {
  children: ReactNode;
  labelledBy: string;
  onClose: () => void;
  variant?: "detail" | "sheet";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      returnFocus?.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} aria-labelledby={labelledBy}
    className={`${styles.theme} ${styles.dialog} ${variant === "sheet" ? styles.sheet : styles.detailDialog}`}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
      )).filter((element) => element.getClientRects().length > 0);
      const target = event.shiftKey ? controls.at(-1) : controls[0];
      const boundary = event.shiftKey ? controls[0] : controls.at(-1);
      if (target && (document.activeElement === boundary || document.activeElement === event.currentTarget)) {
        event.preventDefault();
        target.focus();
      }
    }}
    onClick={(event) => { if (event.target === event.currentTarget) {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    } }}>
    {children}
  </dialog>;
}

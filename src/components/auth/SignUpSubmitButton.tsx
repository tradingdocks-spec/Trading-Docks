"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";

export function SignUpSubmitButton() {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const form = buttonRef.current?.form;
    if (!form) return;

    const updateValidity = () => setIsValid(form.checkValidity());
    updateValidity();

    form.addEventListener("input", updateValidity);
    form.addEventListener("change", updateValidity);

    return () => {
      form.removeEventListener("input", updateValidity);
      form.removeEventListener("change", updateValidity);
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      type="submit"
      disabled={pending || !isValid}
      aria-busy={pending}
      className="premium-cta group flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-b from-td-accent via-td-accent to-td-accent px-4 text-xs font-semibold text-td-on-accent shadow-[0_14px_32px_rgb(var(--td-accent-rgb)/0.26),inset_0_1px_0_rgb(var(--td-ink-rgb)/0.68),inset_0_-1px_0_rgb(var(--td-accent-rgb)/0.3)] transition duration-300 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-[0_18px_40px_rgb(var(--td-accent-rgb)/0.34),inset_0_1px_0_rgb(var(--td-ink-rgb)/0.72)] focus:outline-none focus:ring-4 focus:ring-td-accent/20 disabled:translate-y-0 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
    >
      {pending ? (
        <>
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          Creating account
        </>
      ) : (
        <>
          Create account
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 group-disabled:translate-x-0" />
        </>
      )}
    </button>
  );
}

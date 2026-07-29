"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

const REMEMBER_EMAIL_KEY = "trading-docks-remembered-email";
const REMEMBER_DEVICE_KEY = "trading-docks-remember-device";

export function RememberedEmailField() {
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const savedPreference = window.localStorage.getItem(REMEMBER_DEVICE_KEY);
      const shouldRemember = savedPreference !== "false";
      setRememberMe(shouldRemember);
      setEmail(
        shouldRemember
          ? window.localStorage.getItem(REMEMBER_EMAIL_KEY) ?? ""
          : "",
      );
    } catch {
      // Sign-in still works when storage is unavailable or browser-blocked.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const input = emailInputRef.current;
    const form = input?.form;
    if (!input || !form) return;
    const loginForm = form;

    // Password managers and mobile Safari can populate an input without
    // dispatching React's change/blur events. Read the live DOM value at the
    // last possible moment so the submitted address is always remembered.
    function rememberSubmittedEmail() {
      try {
        const formData = new FormData(loginForm);
        const submittedEmail = String(formData.get("email") ?? "").trim();
        const shouldRemember = formData.get("rememberMe") === "on";

        window.localStorage.setItem(
          REMEMBER_DEVICE_KEY,
          String(shouldRemember),
        );

        if (shouldRemember && submittedEmail) {
          window.localStorage.setItem(REMEMBER_EMAIL_KEY, submittedEmail);
        } else {
          window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      } catch {
        // Authentication must remain usable when device storage is blocked.
      }
    }

    loginForm.addEventListener("submit", rememberSubmittedEmail);
    return () =>
      loginForm.removeEventListener("submit", rememberSubmittedEmail);
  }, []);

  function updateEmail(value: string) {
    setEmail(value);
    if (!rememberMe) return;

    try {
      if (value.trim()) {
        window.localStorage.setItem(REMEMBER_EMAIL_KEY, value.trim());
      } else {
        window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch {
      // The field remains usable without device storage.
    }
  }

  function updateRememberMe(checked: boolean) {
    setRememberMe(checked);

    try {
      window.localStorage.setItem(REMEMBER_DEVICE_KEY, String(checked));
      if (checked && email.trim()) {
        window.localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      } else if (!checked) {
        window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch {
      // The server-side session preference is still submitted with the form.
    }
  }

  return (
    <>
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-[10px] font-medium text-slate-200"
        >
          Email address
        </label>

        <input
          ref={emailInputRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => updateEmail(event.target.value)}
          onBlur={(event) => updateEmail(event.target.value)}
          placeholder="you@example.com"
          suppressHydrationWarning
          className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.035] px-3.5 text-xs text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-cyan-400/50 focus:bg-cyan-400/[0.035] focus:ring-4 focus:ring-cyan-400/10"
        />
      </div>

      <label className="flex min-h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg px-1 text-[10px] text-slate-400 transition hover:text-slate-300">
        <input
          name="rememberMe"
          type="checkbox"
          checked={rememberMe}
          onChange={(event) => updateRememberMe(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/20 bg-white/[0.035] text-transparent transition peer-checked:border-cyan-300/60 peer-checked:bg-cyan-300 peer-checked:text-slate-950 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-300/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#07151f]"
        >
          <Check className="h-3 w-3 stroke-[3]" />
        </span>
        <span>
          Remember me on this device
          {ready && rememberMe ? (
            <span className="ml-1 text-slate-500">· email and sign-in</span>
          ) : null}
        </span>
      </label>
    </>
  );
}

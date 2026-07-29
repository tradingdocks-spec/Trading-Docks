"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordFieldProps = {
  autoComplete?: "current-password" | "new-password";
  id?: string;
  minLength?: number;
  name?: string;
  placeholder?: string;
};

export function PasswordField({
  autoComplete = "current-password",
  id = "password",
  minLength,
  name = "password",
  placeholder = "Enter your password",
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-white/15 bg-white/[0.045] px-3.5 pr-11 text-xs text-white outline-none transition placeholder:text-slate-500 hover:border-white/25 focus:border-cyan-400/60 focus:bg-cyan-400/[0.045] focus:ring-4 focus:ring-cyan-400/10"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-400 transition hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300"
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Eye aria-hidden="true" className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

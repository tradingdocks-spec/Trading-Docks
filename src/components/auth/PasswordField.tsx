"use client";

import { useState } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { Eye, EyeOff } from "lucide-react";

type PasswordFieldProps = {
  autoComplete?: "current-password" | "new-password";
  describedBy?: string;
  id?: string;
  minLength?: number;
  name?: string;
  placeholder?: string;
  showMinLengthRequirement?: boolean;
};

export function PasswordField({
  autoComplete = "current-password",
  describedBy,
  id = "password",
  minLength,
  name = "password",
  placeholder = "Enter your password",
  showMinLengthRequirement = false,
}: PasswordFieldProps) {
  const hydrated = useHydrated();
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const minLengthMet = minLength == null || value.length >= minLength;

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          placeholder={placeholder}
          aria-describedby={describedBy}
          onChange={(event) => setValue(event.currentTarget.value)}
          className="h-10 w-full rounded-lg border border-td-ink/15 bg-td-ink/[0.045] px-3.5 pr-11 text-sm text-td-primary outline-none transition placeholder:text-td-muted hover:border-td-ink/25 focus:border-td-accent/60 focus:bg-td-accent/[0.045] focus:ring-4 focus:ring-td-accent/10"
        />
        <button
          type="button"
          disabled={!hydrated}
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-td-secondary transition hover:text-td-accent-text focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-td-accent"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Eye aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </div>

      {showMinLengthRequirement && minLength ? (
        <p
          id={describedBy}
          className={`mt-1.5 flex items-center gap-1.5 text-[11px] ${
            minLengthMet ? "text-td-success/80" : "text-td-muted"
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              minLengthMet ? "bg-td-success" : "bg-td-raised"
            }`}
          />
          8+ characters
        </p>
      ) : null}
    </div>
  );
}

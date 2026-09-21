"use client";
import { useState } from "react";
import { parseMinor } from "@/lib/pos/domain";
/** Preserve the text being typed instead of moving the caret with toFixed(). */
export function MoneyInput({
  value,
  onValue,
  disabled,
  placeholder,
}: {
  value?: number;
  onValue: (value: number | undefined) => void;
  disabled: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const formatted = value === undefined ? "" : (value / 100).toFixed(2);
  return (
    <input
      inputMode="decimal"
      value={editing ? draft : formatted}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => {
        setDraft(formatted);
        setEditing(true);
      }}
      onBlur={() => setEditing(false)}
      onChange={(e) => {
        setDraft(e.target.value);
        if (!e.target.value) onValue(undefined);
        else {
          const parsed = parseMinor(e.target.value);
          if (parsed !== null) onValue(parsed);
        }
      }}
    />
  );
}

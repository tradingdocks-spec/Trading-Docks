"use client";
import { useEffect, useState } from "react";
import { Terminals } from "./Terminals";
import Link from "next/link";
import { createScanner } from "@/lib/pos/scanner";
export function Hardware() {
  const [value, setValue] = useState(""),
    [manual, setManual] = useState("");
  useEffect(() => {
    const scan = createScanner(setValue);
    const handle = (event: KeyboardEvent) =>
      scan(
        event,
        event.target instanceof HTMLElement &&
          Boolean(
            event.target.closest("input,textarea,select,[contenteditable]"),
          ),
      );
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  return (
    <section className="pos-hardware">
      <h2>Barcode Scanners</h2>
      <p>
        Scan a label with a USB keyboard-wedge scanner ending in Enter. This
        test displays the decoded value and never adds inventory to a sale.
      </p>
      <p role="status">{value ? `Received: ${value}` : "Ready to scan"}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setValue(manual.trim());
        }}
      >
        <label>
          Dedicated scanner input
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button>Test input</button>
      </form>
      <Terminals />
      <h2>Label Printers</h2>
      <p>
        Choose your media in Label Studio, then use Print Test Label. Check
        alignment, readable bars, and exactly one physical label.
      </p>
      <Link href="/dashboard/label-studio?source=pos">
        Open Label Studio printer test
      </Link>
      <h2>Receipt Printers</h2><p>Use the receipt Print action and choose 58 mm, 80 mm, or Letter. Verify a test receipt on your printer before opening the register.</p>
    </section>
  );
}

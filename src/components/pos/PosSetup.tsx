"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { posWrite } from "@/lib/pos/client";
import { parseMinor, type Bootstrap } from "@/lib/pos/domain";

export function PosSetup({ data }: { data: Bootstrap }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="pos-setup"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = new FormData(event.currentTarget);
        const taxBps = parseMinor(String(form.get("tax")));
        if (taxBps === null || taxBps > 2500) {
          setMessage("Enter a tax rate between 0 and 25%.");
          return;
        }
        setBusy(true);
        setMessage("");
        try {
          await posWrite("setup", {
            name: form.get("name"),
            registerName: form.get("registerName"),
            locationId: form.get("location"),
            taxBps,
            timezone: form.get("timezone"),
          });
          router.push("/dashboard/pos");
          router.refresh();
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Could not save setup.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        Connect a store location to your existing inventory storage. Checkout
        uses each item’s asking price.
      </p>
      <label>
        Store location name
        <input
          name="name"
          required
          maxLength={100}
          placeholder="Phoenix store"
        />
      </label>
      <label>
        Store timezone
        <input
          name="timezone"
          required
          defaultValue="America/Phoenix"
          placeholder="IANA timezone, such as America/Phoenix"
        />
      </label>
      <label>
        Inventory storage
        <select name="location" required defaultValue="">
          <option value="" disabled>
            Choose existing storage
          </option>
          {data.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      {!data.locations.length && (
        <p>
          Create an inventory storage location first, or use an existing
          configured register.
        </p>
      )}
      <label>
        Sales tax (%)
        <input
          name="tax"
          inputMode="decimal"
          required
          placeholder="Enter 0 if tax does not apply"
        />
      </label>
      <label>
        Register name
        <input
          name="registerName"
          required
          maxLength={100}
          placeholder="Front register"
        />
      </label>
      <p>
        Tax is added after discounts. Mark non-taxable inventory explicitly in
        inventory data. Restricted discounts and price overrides require a
        separately authenticated manager’s approval.
      </p>
      <button
        className="pos-primary"
        disabled={busy || !data.canManage || !data.locations.length}
      >
        {busy ? "Saving…" : "Create location and register"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}

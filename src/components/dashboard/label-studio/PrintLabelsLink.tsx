"use client";
import type { ReactNode, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { labelStudioHref } from "@/lib/label-studio/routes";
export function PrintLabelsLink({
  ids,
  className,
  children,
}: {
  ids: string[];
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (ids.length <= 50) return;
    event.preventDefault();
    if (ids.length > 500) {
      window.alert(
        "Select at most 500 inventory records per print queue. Copies can total up to 10,000 labels.",
      );
      return;
    }
    try {
      const token = crypto.randomUUID();
      sessionStorage.setItem(
        `td.label.selection.${token}`,
        JSON.stringify(ids),
      );
      router.push(
        `/dashboard/label-studio?source=inventory&selection=${token}`,
      );
    } catch {
      window.alert(
        "Selection storage is unavailable. Select at most 50 records to transfer them directly.",
      );
    }
  }
  return (
    <a
      href={labelStudioHref(
        "inventory",
        "print-labels",
        ids.length <= 50 ? ids : undefined,
      )}
      onClick={open}
      className={className}
    >
      {children}
    </a>
  );
}

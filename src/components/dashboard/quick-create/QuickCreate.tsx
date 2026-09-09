"use client";

import {
  ChevronDown,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { QuickCreateMenu } from "./QuickCreateMenu";

type WorkspaceType =
  | "Collector"
  | "Seller"
  | "LGS"
  | "Warehouse";

type QuickCreateProps = {
  className?: string;
  compact?: boolean;
  currentWorkspaceType?: WorkspaceType;
};

export function QuickCreate({
  className = "",
  compact = false,
  currentWorkspaceType,
}: QuickCreateProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );
    };
  }, [closeMenu]);

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      const isQuickCreateShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "p";

      if (isQuickCreateShortcut) {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      if (event.key === "Escape" && open) {
        event.preventDefault();
        closeMenu();
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyboardShortcut,
      );
    };
  }, [closeMenu, open]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        aria-label="Open Quick Create"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`group relative flex items-center justify-center overflow-hidden rounded-xl border transition-all duration-200 ${
          open
            ? "border-td-accent/35 bg-td-accent/[0.11] text-td-accent-text shadow-[0_0_0_1px_rgb(var(--td-accent-rgb)/0.06),0_10px_30px_rgb(var(--td-shadow-rgb)/calc(0.25*var(--td-shadow-strength))),0_0_28px_rgb(var(--td-accent-rgb)/0.11)]"
            : "border-td-accent/20 bg-gradient-to-b from-td-accent/[0.12] to-td-accent/[0.06] text-td-accent-text shadow-[0_8px_24px_rgb(var(--td-shadow-rgb)/calc(0.22*var(--td-shadow-strength))),0_0_24px_rgb(var(--td-accent-rgb)/0.06)] hover:-translate-y-0.5 hover:border-td-accent/35 hover:bg-td-accent/[0.13] hover:shadow-[0_12px_32px_rgb(var(--td-shadow-rgb)/calc(0.3*var(--td-shadow-strength))),0_0_30px_rgb(var(--td-accent-rgb)/0.12)]"
        } ${
          compact
            ? "h-10 w-10"
            : "h-10 min-w-[118px] gap-2 px-3.5"
        }`}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-td-accent/50 to-transparent"
        />

        <span
          aria-hidden="true"
          className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent transition-transform duration-700 ${
            open
              ? "translate-x-0"
              : "-translate-x-full group-hover:translate-x-full"
          }`}
        />

        <span className="relative flex items-center justify-center">
          {compact ? (
            <Plus className="h-4 w-4" />
          ) : (
            <Sparkles
              className={`h-3.5 w-3.5 transition-transform duration-300 ${
                open
                  ? "rotate-12 scale-110"
                  : "group-hover:rotate-12 group-hover:scale-110"
              }`}
            />
          )}
        </span>

        {!compact ? (
          <>
            <span className="relative text-[11px] font-semibold">
              Create
            </span>

            <ChevronDown
              className={`relative h-3.5 w-3.5 text-td-accent-text/70 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </>
        ) : null}
      </button>

      {open ? (
        <QuickCreateMenu
          onClose={closeMenu}
          currentWorkspaceType={currentWorkspaceType}
        />
      ) : null}
    </div>
  );
}
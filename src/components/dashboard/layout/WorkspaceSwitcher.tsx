"use client";

import Link from "next/link";
import {
  Building2,
  Check,
  ChevronDown,
  Plus,
  Settings2,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Workspace,
  workspaces,
} from "@/components/dashboard/navigation/workspaces";

export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);

  const [currentWorkspace, setCurrentWorkspace] =
    useState<Workspace>(workspaces[0]);

  const containerRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClick,
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClick,
      );
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        onClick={() => setOpen(!open)}
        className="group flex h-11 min-w-[250px] items-center gap-3 rounded-xl border border-td-ink/[0.08] bg-td-ink/[0.03] px-3 transition-all duration-200 hover:border-td-accent/20 hover:bg-td-accent/[0.04]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-td-accent/20 bg-td-accent/[0.08] font-semibold text-td-accent-text">
          {currentWorkspace.initials}
        </div>

        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-[12px] font-semibold text-td-primary">
            {currentWorkspace.name}
          </p>

          <p className="truncate text-[11px] text-td-muted">
            {currentWorkspace.type}
          </p>
        </div>

        <ChevronDown
          className={`h-4 w-4 text-td-muted transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`absolute left-0 top-[calc(100%+10px)] z-50 w-[320px] overflow-hidden rounded-2xl border border-td-ink/[0.08] bg-td-surface/98 shadow-[0_30px_90px_rgb(var(--td-shadow-rgb)/calc(0.55*var(--td-shadow-strength))),0_0_45px_rgb(var(--td-accent-rgb)/0.08)] backdrop-blur-2xl transition-all duration-200 ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="border-b border-td-ink/[0.06] px-5 py-4">
          <p className="text-xs font-semibold text-td-primary">
            Workspaces
          </p>

          <p className="mt-1 text-[11px] text-td-muted">
            Switch between your collections,
            businesses, and stores.
          </p>
        </div>

        <div className="p-2">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => {
                setCurrentWorkspace(
                  workspace,
                );
                setOpen(false);
              }}
              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                workspace.id ===
                currentWorkspace.id
                  ? "bg-td-accent/[0.08]"
                  : "hover:bg-td-ink/[0.035]"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[11px] font-semibold ${
                  workspace.id ===
                  currentWorkspace.id
                    ? "border-td-accent/25 bg-td-accent/10 text-td-accent-text"
                    : "border-td-ink/[0.07] bg-td-ink/[0.025] text-td-secondary"
                }`}
              >
                {workspace.initials}
              </div>

              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[11px] font-medium text-td-primary">
                  {workspace.name}
                </p>

                <p className="text-[11px] text-td-muted">
                  {workspace.type}
                </p>
              </div>

              {workspace.id ===
              currentWorkspace.id ? (
                <Check className="h-4 w-4 text-td-accent-text" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="border-t border-td-ink/[0.06] p-2">
          <Link
            href="/dashboard/workspaces/new"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-td-secondary transition hover:bg-td-ink/[0.035] hover:text-td-primary"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-td-ink/[0.08] bg-td-ink/[0.025]">
              <Plus className="h-4 w-4" />
            </div>

            <span className="text-[11px]">
              Create Workspace
            </span>
          </Link>

          <Link
            href="/dashboard/workspaces"
            className="group mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-td-secondary transition hover:bg-td-ink/[0.035] hover:text-td-primary"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-td-ink/[0.08] bg-td-ink/[0.025]">
              <Settings2 className="h-4 w-4" />
            </div>

            <span className="text-[11px]">
              Manage Workspaces
            </span>
          </Link>
        </div>

        <div className="border-t border-td-ink/[0.06] bg-td-ink/[0.015] px-5 py-3">
          <div className="flex items-center gap-2 text-[11px] text-td-muted">
            <Building2 className="h-3.5 w-3.5" />
            Unlimited workspaces on Pro
          </div>
        </div>
      </div>
    </div>
  );
}
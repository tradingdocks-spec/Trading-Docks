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
        className="group flex h-11 min-w-[250px] items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 transition-all duration-200 hover:border-cyan-400/20 hover:bg-cyan-400/[0.04]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/[0.08] font-semibold text-cyan-200">
          {currentWorkspace.initials}
        </div>

        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-[12px] font-semibold text-white">
            {currentWorkspace.name}
          </p>

          <p className="truncate text-[9px] text-slate-500">
            {currentWorkspace.type}
          </p>
        </div>

        <ChevronDown
          className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`absolute left-0 top-[calc(100%+10px)] z-50 w-[320px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071017]/98 shadow-[0_30px_90px_rgba(0,0,0,0.55),0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-2xl transition-all duration-200 ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="border-b border-white/[0.06] px-5 py-4">
          <p className="text-xs font-semibold text-white">
            Workspaces
          </p>

          <p className="mt-1 text-[10px] text-slate-500">
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
                  ? "bg-cyan-400/[0.08]"
                  : "hover:bg-white/[0.035]"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[11px] font-semibold ${
                  workspace.id ===
                  currentWorkspace.id
                    ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-200"
                    : "border-white/[0.07] bg-white/[0.025] text-slate-400"
                }`}
              >
                {workspace.initials}
              </div>

              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[11px] font-medium text-white">
                  {workspace.name}
                </p>

                <p className="text-[9px] text-slate-500">
                  {workspace.type}
                </p>
              </div>

              {workspace.id ===
              currentWorkspace.id ? (
                <Check className="h-4 w-4 text-cyan-300" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="border-t border-white/[0.06] p-2">
          <Link
            href="/dashboard/workspaces/new"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 transition hover:bg-white/[0.035] hover:text-white"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025]">
              <Plus className="h-4 w-4" />
            </div>

            <span className="text-[11px]">
              Create Workspace
            </span>
          </Link>

          <Link
            href="/dashboard/workspaces"
            className="group mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 transition hover:bg-white/[0.035] hover:text-white"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025]">
              <Settings2 className="h-4 w-4" />
            </div>

            <span className="text-[11px]">
              Manage Workspaces
            </span>
          </Link>
        </div>

        <div className="border-t border-white/[0.06] bg-white/[0.015] px-5 py-3">
          <div className="flex items-center gap-2 text-[9px] text-slate-500">
            <Building2 className="h-3.5 w-3.5" />
            Unlimited workspaces on Pro
          </div>
        </div>
      </div>
    </div>
  );
}
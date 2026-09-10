"use client";

import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { type ReactNode } from "react";
import { useHydrated } from "@/hooks/use-hydrated";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      storageKey="trading-docks-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const mounted = useHydrated();
  return (
    <label className="td-theme-switch">
      <Moon size={16} aria-hidden="true" className="td-theme-dark-icon" />
      <Sun size={16} aria-hidden="true" className="td-theme-light-icon" />
      <select
        disabled={!mounted}
        aria-busy={!mounted}
        aria-label="Color theme"
        value={mounted ? (theme ?? "system") : "system"}
        onChange={(event) => setTheme(event.target.value)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}

export function ThemeCorner() {
  const pathname = usePathname();
  if (
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    ["/privacy", "/terms", "/security"].includes(pathname)
  )
    return null;
  return (
    <div className="td-theme-corner">
      <ThemePicker />
    </div>
  );
}

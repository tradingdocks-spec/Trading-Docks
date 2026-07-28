"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "trading-docks-sidebar-collapsed";

export function useSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    const savedState = window.localStorage.getItem(STORAGE_KEY);

    if (savedState !== null) {
      setIsCollapsed(savedState === "true");
    }

    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      String(isCollapsed),
    );
  }, [hasMounted, isCollapsed]);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((current) => !current);
  }, []);

  const openMobile = useCallback(() => {
    setIsMobileOpen(true);
  }, []);

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const toggleMobile = useCallback(() => {
    setIsMobileOpen((current) => !current);
  }, []);

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      const isShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "b";

      if (!isShortcut) {
        return;
      }

      event.preventDefault();
      toggleCollapsed();
    }

    window.addEventListener("keydown", handleKeyboardShortcut);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyboardShortcut,
      );
    };
  }, [toggleCollapsed]);

  return {
    isCollapsed,
    isMobileOpen,
    toggleCollapsed,
    toggleMobile,
    openMobile,
    closeMobile,
  };
}
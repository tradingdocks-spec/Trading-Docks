"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { AmbientGlow } from "./AmbientGlow";

import type {
  StartSystemActivityInput,
  SystemActivity,
  SystemContextValue,
  SystemTone,
  UpdateSystemActivityInput,
} from "./types";

export const SystemContext =
  createContext<SystemContextValue | null>(null);

type SystemProviderProps = {
  children: ReactNode;
};

const DEFAULT_TONE: SystemTone = "default";

function createActivityId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `system-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function clampProgress(progress?: number) {
  if (typeof progress !== "number") {
    return undefined;
  }

  return Math.min(Math.max(progress, 0), 100);
}

export function SystemProvider({
  children,
}: SystemProviderProps) {
  const [tone, setToneState] =
    useState<SystemTone>(DEFAULT_TONE);

  const [activity, setActivity] =
    useState<SystemActivity | null>(null);

  const [isOnline, setIsOnline] = useState(true);

  const resetTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimer = useCallback(() => {
    if (!resetTimerRef.current) {
      return;
    }

    clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
  }, []);

  const setTone = useCallback(
    (nextTone: SystemTone) => {
      clearResetTimer();
      setToneState(nextTone);
    },
    [clearResetTimer],
  );

  const clearActivity = useCallback(() => {
    clearResetTimer();
    setActivity(null);

    setToneState(
      typeof navigator !== "undefined" &&
        navigator.onLine === false
        ? "offline"
        : DEFAULT_TONE,
    );
  }, [clearResetTimer]);

  const startActivity = useCallback(
    (input: StartSystemActivityInput) => {
      clearResetTimer();

      const activityId =
        input.id ?? createActivityId();

      const nextActivity: SystemActivity = {
        id: activityId,
        title: input.title,
        description: input.description,
        tone: input.tone ?? "processing",
        progress: clampProgress(input.progress),
        indeterminate: input.indeterminate,
      };

      setActivity(nextActivity);
      setToneState(nextActivity.tone);

      return activityId;
    },
    [clearResetTimer],
  );

  const updateActivity = useCallback(
    (
      activityId: string,
      updates: UpdateSystemActivityInput,
    ) => {
      clearResetTimer();

      setActivity((currentActivity) => {
        if (
          !currentActivity ||
          currentActivity.id !== activityId
        ) {
          return currentActivity;
        }

        const nextActivity: SystemActivity = {
          ...currentActivity,
          ...updates,
          progress:
            updates.progress === undefined
              ? currentActivity.progress
              : clampProgress(updates.progress),
        };

        setToneState(nextActivity.tone);

        return nextActivity;
      });
    },
    [clearResetTimer],
  );

  const completeActivity = useCallback(
    (
      activityId: string,
      options?: {
        title?: string;
        description?: string;
        resetDelay?: number;
      },
    ) => {
      clearResetTimer();

      setActivity((currentActivity) => {
        if (
          !currentActivity ||
          currentActivity.id !== activityId
        ) {
          return currentActivity;
        }

        return {
          ...currentActivity,
          title:
            options?.title ??
            currentActivity.title,
          description:
            options?.description ??
            currentActivity.description,
          tone: "success",
          progress: 100,
          indeterminate: false,
        };
      });

      setToneState("success");

      resetTimerRef.current = setTimeout(() => {
        setActivity(null);

        setToneState(
          typeof navigator !== "undefined" &&
            navigator.onLine === false
            ? "offline"
            : DEFAULT_TONE,
        );

        resetTimerRef.current = null;
      }, options?.resetDelay ?? 2400);
    },
    [clearResetTimer],
  );

  const failActivity = useCallback(
    (
      activityId: string,
      options?: {
        title?: string;
        description?: string;
        critical?: boolean;
      },
    ) => {
      clearResetTimer();

      const failureTone: SystemTone =
        options?.critical
          ? "critical"
          : "warning";

      setActivity((currentActivity) => {
        if (
          !currentActivity ||
          currentActivity.id !== activityId
        ) {
          return currentActivity;
        }

        return {
          ...currentActivity,
          title:
            options?.title ??
            currentActivity.title,
          description:
            options?.description ??
            currentActivity.description,
          tone: failureTone,
          indeterminate: false,
        };
      });

      setToneState(failureTone);
    },
    [clearResetTimer],
  );

  const setOffline = useCallback(
    (description?: string) => {
      clearResetTimer();
      setIsOnline(false);
      setToneState("offline");

      setActivity({
        id: "system-offline",
        title: "Connection interrupted",
        description:
          description ??
          "Trading Docks will reconnect automatically when your connection returns.",
        tone: "offline",
        indeterminate: true,
      });
    },
    [clearResetTimer],
  );

  const setOnline = useCallback(() => {
    clearResetTimer();
    setIsOnline(true);

    setActivity((currentActivity) => {
      if (currentActivity?.id !== "system-offline") {
        return currentActivity;
      }

      return {
        id: "system-restored",
        title: "Connection restored",
        description:
          "Trading Docks is back online.",
        tone: "success",
        progress: 100,
        indeterminate: false,
      };
    });

    setToneState("success");

    resetTimerRef.current = setTimeout(() => {
      setActivity((currentActivity) =>
        currentActivity?.id === "system-restored"
          ? null
          : currentActivity,
      );

      setToneState(DEFAULT_TONE);
      resetTimerRef.current = null;
    }, 2200);
  }, [clearResetTimer]);

  useEffect(() => {
    const currentlyOnline =
      typeof navigator === "undefined"
        ? true
        : navigator.onLine;

    setIsOnline(currentlyOnline);

    if (!currentlyOnline) {
      setOffline();
    }

    function handleOffline() {
      setOffline();
    }

    function handleOnline() {
      setOnline();
    }

    window.addEventListener(
      "offline",
      handleOffline,
    );

    window.addEventListener(
      "online",
      handleOnline,
    );

    return () => {
      window.removeEventListener(
        "offline",
        handleOffline,
      );

      window.removeEventListener(
        "online",
        handleOnline,
      );
    };
  }, [setOffline, setOnline]);

  useEffect(() => {
    return () => {
      clearResetTimer();
    };
  }, [clearResetTimer]);

  const value = useMemo<SystemContextValue>(
    () => ({
      tone,
      activity,
      isOnline,
      setTone,
      startActivity,
      updateActivity,
      completeActivity,
      failActivity,
      clearActivity,
      setOffline,
      setOnline,
    }),
    [
      tone,
      activity,
      isOnline,
      setTone,
      startActivity,
      updateActivity,
      completeActivity,
      failActivity,
      clearActivity,
      setOffline,
      setOnline,
    ],
  );

  return (
    <SystemContext.Provider value={value}>
      <AmbientGlow
        tone={tone}
        activity={activity}
      />

      {children}
    </SystemContext.Provider>
  );
}
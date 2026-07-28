export type SystemTone =
  | "default"
  | "saving"
  | "syncing"
  | "importing"
  | "processing"
  | "success"
  | "warning"
  | "offline"
  | "critical";

export type SystemActivity = {
  id: string;
  title: string;
  description?: string;
  tone: SystemTone;
  progress?: number;
  indeterminate?: boolean;
};

export type SystemStatusState = {
  tone: SystemTone;
  activity: SystemActivity | null;
  isOnline: boolean;
};

export type StartSystemActivityInput = {
  id?: string;
  title: string;
  description?: string;
  tone?: SystemTone;
  progress?: number;
  indeterminate?: boolean;
};

export type UpdateSystemActivityInput = {
  title?: string;
  description?: string;
  tone?: SystemTone;
  progress?: number;
  indeterminate?: boolean;
};

export type SystemContextValue = SystemStatusState & {
  setTone: (tone: SystemTone) => void;

  startActivity: (
    activity: StartSystemActivityInput,
  ) => string;

  updateActivity: (
    activityId: string,
    updates: UpdateSystemActivityInput,
  ) => void;

  completeActivity: (
    activityId: string,
    options?: {
      title?: string;
      description?: string;
      resetDelay?: number;
    },
  ) => void;

  failActivity: (
    activityId: string,
    options?: {
      title?: string;
      description?: string;
      critical?: boolean;
    },
  ) => void;

  clearActivity: () => void;

  setOffline: (
    description?: string,
  ) => void;

  setOnline: () => void;
};
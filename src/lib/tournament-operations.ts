/**
 * Deterministic Swiss-round recommendation used by the dashboard preview and
 * mirrored by public.recommend_tournament_rounds in the operations migration.
 * The mapping is intentionally conservative and can be overridden per event.
 */
export function recommendedSwissRounds(playerCount: number) {
  if (!Number.isFinite(playerCount) || playerCount < 2) return 0;
  if (playerCount < 4) return 1;
  if (playerCount < 8) return 2;
  if (playerCount < 16) return 3;
  if (playerCount < 32) return 4;
  if (playerCount < 64) return 5;
  if (playerCount < 128) return 6;
  return 7;
}

export const TOURNAMENT_LIFECYCLE_STATUSES = [
  "draft",
  "published",
  "registration_closed",
  "ready",
  "in_progress",
  "top_cut",
  "completed",
  "cancelled",
] as const;

export type TournamentLifecycleStatus = (typeof TOURNAMENT_LIFECYCLE_STATUSES)[number];

export const TOURNAMENT_LIFECYCLE_LABELS: Record<TournamentLifecycleStatus, string> = {
  draft: "Draft",
  published: "Published",
  registration_closed: "Registration closed",
  ready: "Ready to start",
  in_progress: "In progress",
  top_cut: "Top cut",
  completed: "Completed",
  cancelled: "Cancelled",
};

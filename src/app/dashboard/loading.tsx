import { TDCard, TDLoadingState, TDScreen } from "@/components/design-system/td-primitives";

export default function DashboardLoading() {
  return (
    <TDScreen aria-label="Loading page" aria-live="polite">
      <TDLoadingState title="Loading workspace..." className="mb-5" />

      <div className="animate-pulse space-y-5">
        <TDCard variant="outlined" className="h-28" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <TDCard key={index} variant="outlined" className="h-28 rounded-[var(--td-radius-lg)]" />
          ))}
        </div>
        <TDCard variant="outlined" className="h-64" />
      </div>
    </TDScreen>
  );
}

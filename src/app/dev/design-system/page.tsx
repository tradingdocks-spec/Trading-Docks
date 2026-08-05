import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

import {
  TDBadge,
  TDButton,
  TDCard,
  TDDivider,
  TDEmptyState,
  TDErrorState,
  TDInput,
  TDLoadingState,
  TDScreen,
  TDSectionHeader,
  TDText,
} from "@/components/design-system/td-primitives";

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <TDScreen className="space-y-8">
      <div>
        <TDText variant="label" tone="info">Development only</TDText>
        <TDText as="h1" variant="display">Trading Docks design system</TDText>
        <TDText tone="secondary" className="max-w-2xl">
          Foundation primitives and semantic tokens for the first migration wave.
        </TDText>
      </div>

      <section className="space-y-3">
        <TDSectionHeader title="Buttons" />
        <TDCard className="flex flex-wrap gap-3">
          <TDButton icon={<ArrowRight className="h-4 w-4" />}>Primary</TDButton>
          <TDButton variant="secondary">Secondary</TDButton>
          <TDButton variant="ghost">Ghost</TDButton>
          <TDButton variant="danger">Danger</TDButton>
          <TDButton loading>Loading</TDButton>
          <TDButton disabled>Disabled</TDButton>
        </TDCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TDCard variant="elevated" className="space-y-4">
          <TDSectionHeader title="Inputs" />
          <TDInput label="Email" name="email" placeholder="collector@example.com" />
          <TDInput label="Error" name="error" defaultValue="bad-value" error="Use a valid value." />
          <TDInput label="Disabled" name="disabled" defaultValue="Locked" disabled />
        </TDCard>

        <TDCard variant="floating" className="space-y-4">
          <TDSectionHeader title="Badges and Type" />
          <div className="flex flex-wrap gap-2">
            <TDBadge>Neutral</TDBadge>
            <TDBadge tone="success">Success</TDBadge>
            <TDBadge tone="warning">Warning</TDBadge>
            <TDBadge tone="danger">Danger</TDBadge>
            <TDBadge tone="info">Info</TDBadge>
            <TDBadge tone="accent">Accent</TDBadge>
          </div>
          <TDDivider />
          <TDText variant="heading">Typography</TDText>
          <TDText tone="secondary">Semantic text variants preserve hierarchy without viewport-scaled type.</TDText>
          <TDText variant="caption" tone="muted">Caption text remains legible for operational metadata.</TDText>
        </TDCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <TDCard><TDLoadingState title="Loading inventory" message="Preparing the workspace shell." /></TDCard>
        <TDEmptyState title="No cards yet" message="Add inventory to populate this surface." />
        <TDErrorState title="Unable to load" message="The state component owns presentation, not retry behavior." />
      </section>
    </TDScreen>
  );
}

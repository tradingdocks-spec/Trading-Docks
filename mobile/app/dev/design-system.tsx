import { Redirect } from 'expo-router';
import { ScrollView, View } from 'react-native';

import {
  TDBadge,
  TDButton,
  TDCard,
  TDChip,
  TDEmptyState,
  TDErrorState,
  TDIconButton,
  TDInput,
  TDListRow,
  TDLoadingState,
  TDMetric,
  TDNavigationHeader,
  TDResultTray,
  TDScannerGuide,
  TDScreen,
  TDSectionHeader,
  TDSegmentedControl,
  TDSessionStrip,
  TDStatusIndicator,
  TDText,
  TDToast,
  TDDivider,
} from '@/components/design-system';
import { space } from '@/design';
import { MOBILE_PUBLIC_ENV_KEYS } from '@/services/mobile-release-config';
import { isMobileDevRouteEnabled } from '@/services/mobile-release-ux';

export default function DesignSystemShowcase() {
  const designSystemFlag = MOBILE_PUBLIC_ENV_KEYS.designSystemShowcase;
  if (!designSystemFlag || !isMobileDevRouteEnabled('/dev/design-system')) return <Redirect href="/(tabs)" />;

  return (
    <TDScreen>
      <ScrollView contentContainerStyle={{ gap: space.lg, paddingBottom: space.xxl }}>
        <TDNavigationHeader
          eyebrow="Development only"
          title="Trading Docks design system"
          subtitle="Primitive states, scanner surfaces, accessibility labels, and narrow-width wrapping samples."
          rightAction={<TDBadge tone="warning">Gated</TDBadge>}
        />

        <TDSectionHeader title="Buttons and icons" />
        <TDCard style={{ gap: space.sm }}>
          <TDButton label="Primary action" iconName="arrow-forward" />
          <TDButton label="Secondary action" variant="secondary" />
          <TDButton label="Loading action" loading />
          <TDButton label="Disabled action" disabled />
          <TDButton label="Destructive action" variant="danger" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            <TDIconButton label="Search example" iconName="search-outline" />
            <TDIconButton label="Selected example" iconName="checkmark-circle-outline" selected tone="primary" />
            <TDIconButton label="Disabled example" iconName="lock-closed-outline" disabled />
          </View>
        </TDCard>

        <TDSectionHeader title="Rows and selections" />
        <TDCard style={{ gap: space.sm }}>
          <TDListRow title="Normal row" description="Long values wrap and keep the right side readable." iconName="layers-outline" right={<TDBadge tone="info">Value</TDBadge>} />
          <TDListRow title="Selected row" description="Selected state is not color-only." iconName="checkmark-circle-outline" selected right={<TDStatusIndicator label="Selected" tone="success" />} />
          <TDSegmentedControl
            label="Segmented control"
            value="compact"
            onChange={() => undefined}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'wide', label: 'Wide' },
              { value: 'review', label: 'Review' },
            ]}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            <TDChip label="Normal" />
            <TDChip label="Selected" selected />
            <TDChip label="Disabled" disabled />
          </View>
        </TDCard>

        <TDSectionHeader title="Inputs and states" />
        <TDCard style={{ gap: space.sm }}>
          <TDInput label="Email" accessibilityLabel="Email address sample" placeholder="collector@example.com" leftIconName="mail-outline" />
          <TDInput label="Error" accessibilityLabel="Example input with error" value="bad-value" error="Use a valid value." />
          <TDInput label="Disabled" accessibilityLabel="Disabled example input" value="Locked" disabled />
          <TDToast message="Saved preference sample" tone="success" />
          <TDToast message="Action required sample" tone="warning" />
        </TDCard>

        <TDSectionHeader title="Metrics and typography" />
        <TDCard variant="floating" style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <TDMetric label="Count" value="12" tone="info" compact />
            <TDMetric label="Unavailable" value="Unavailable" compact />
            <TDMetric label="Review" value="3" tone="warning" compact />
          </View>
          <TDDivider />
          <TDText variant="heading">Dynamic type sample heading</TDText>
          <TDText tone="secondary">Body copy should wrap without clipping on narrow mobile widths or larger accessibility text.</TDText>
          <TDText variant="caption" tone="muted">Caption and metadata remain readable without becoming the hero.</TDText>
        </TDCard>

        <TDSectionHeader title="Scanner primitives" />
        <TDResultTray title="Likely match" subtitle="Top-three alternatives remain available." status="Review" tone="warning" />
        <TDScannerGuide tone="success" progress={0.72} />
        <TDSessionStrip summary="3 cards pending review" actionLabel="Review" tone="info" />

        <TDSectionHeader title="Feedback states" />
        <TDLoadingState title="Loading inventory" message="Preparing the workspace shell." />
        <TDEmptyState title="No cards yet" message="Add inventory to populate this surface." />
        <TDErrorState title="Unable to load" message="The state component owns presentation, not retry behavior." />
      </ScrollView>
    </TDScreen>
  );
}

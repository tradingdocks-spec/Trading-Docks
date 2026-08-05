import { ScrollView, View } from 'react-native';

import {
  TDBadge,
  TDButton,
  TDCard,
  TDEmptyState,
  TDErrorState,
  TDInput,
  TDLoadingState,
  TDScreen,
  TDSectionHeader,
  TDText,
  TDDivider,
} from '@/components/design-system';
import { space } from '@/design';

export default function DesignSystemShowcase() {
  if (process.env.EXPO_PUBLIC_ENABLE_DESIGN_SYSTEM_SHOWCASE !== 'true') return null;

  return (
    <TDScreen>
      <ScrollView contentContainerStyle={{ gap: space.lg, paddingBottom: space.xxl }}>
        <View>
          <TDText variant="label" tone="info">Development only</TDText>
          <TDText variant="display">Trading Docks design system</TDText>
          <TDText tone="secondary">Foundation primitives for Expo Web, iOS, and Android.</TDText>
        </View>

        <TDSectionHeader title="Buttons" />
        <TDCard style={{ gap: space.sm }}>
          <TDButton label="Primary action" iconName="arrow-forward" />
          <TDButton label="Secondary action" variant="secondary" />
          <TDButton label="Loading action" loading />
          <TDButton label="Disabled action" disabled />
          <TDButton label="Danger action" variant="danger" />
        </TDCard>

        <TDSectionHeader title="Inputs" />
        <TDCard style={{ gap: space.sm }}>
          <TDInput label="Email" accessibilityLabel="Email address" placeholder="collector@example.com" leftIconName="mail-outline" />
          <TDInput label="Error" accessibilityLabel="Example input with error" value="bad-value" error="Use a valid value." />
          <TDInput label="Disabled" accessibilityLabel="Disabled example input" value="Locked" disabled />
        </TDCard>

        <TDSectionHeader title="Cards and Badges" />
        <TDCard variant="floating" style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            <TDBadge>Neutral</TDBadge>
            <TDBadge tone="success">Success</TDBadge>
            <TDBadge tone="warning">Warning</TDBadge>
            <TDBadge tone="danger">Danger</TDBadge>
            <TDBadge tone="info">Info</TDBadge>
            <TDBadge tone="accent">Accent</TDBadge>
          </View>
          <TDDivider />
          <TDText variant="heading">Typography</TDText>
          <TDText tone="secondary">Body copy uses the semantic text token and the shared 8-point spacing scale.</TDText>
          <TDText variant="caption" tone="muted">Caption and metadata stay readable without becoming oversized.</TDText>
        </TDCard>

        <TDSectionHeader title="States" />
        <TDLoadingState title="Loading inventory" message="Preparing the workspace shell." />
        <TDEmptyState title="No cards yet" message="Add inventory to populate this surface." />
        <TDErrorState title="Unable to load" message="The state component owns presentation, not retry behavior." />
      </ScrollView>
    </TDScreen>
  );
}

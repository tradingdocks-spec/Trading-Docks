import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TDBadge,
  TDButton,
  TDCard,
  TDErrorState,
  TDInput,
  TDListRow,
  TDLoadingState,
  TDNavigationHeader,
  TDSectionHeader,
  TDSegmentedControl,
  TDStatusIndicator,
  TDText,
} from '@/components/design-system';
import { color, space } from '@/design';
import { useWorkSession } from '@/features/sessions/session-provider';
import {
  createDealDeskRenderState,
  currency,
  sessionNameForMode,
  sessionTypeForMode,
  type DealDeskMode,
} from '@/services/deal-desk';

const modes: { value: DealDeskMode; label: string; iconName: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'buy', label: 'Buy', iconName: 'cash-outline' },
  { value: 'trade', label: 'Trade', iconName: 'swap-horizontal-outline' },
  { value: 'sealed', label: 'Sealed', iconName: 'cube-outline' },
  { value: 'show', label: 'Show', iconName: 'ticket-outline' },
];

export default function DealDesk() {
  const insets = useSafeAreaInsets();
  const { ready, activeSession, startSession, pauseSession, endSession } = useWorkSession();
  const [mode, setMode] = useState<DealDeskMode>('buy');
  const [market, setMarket] = useState('');
  const [rate, setRate] = useState('65');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState<string | null>(null);

  const state = useMemo(() => createDealDeskRenderState({
    ready,
    activeSession,
    mode,
    market,
    rate,
    budget,
    error,
  }), [activeSession, budget, error, market, mode, rate, ready]);

  const begin = async () => {
    const name = sessionNameForMode(mode);
    try {
      setError(null);
      await startSession(sessionTypeForMode(mode), name);
      Alert.alert('Session started', `${name} is saved on this device and can be resumed.`);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Deal Desk could not start the session.');
    }
  };

  if (state.status === 'loading') {
    return <TDLoadingState title="Loading Deal Desk" message="Restoring your active transaction session." />;
  }

  return (
    <ScrollView style={s.page} contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 14, 34), paddingBottom: 112 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <TDNavigationHeader
        eyebrow="Deal Desk"
        title="Price the current deal"
        subtitle="Buying, trade, sealed, and show sessions stay local and resumable."
      />

      {state.status === 'error' ? (
        <TDErrorState title="Deal Desk needs attention" message={error ?? 'The current session could not be restored.'} />
      ) : null}

      {activeSession ? (
        <TDCard variant="elevated" style={s.activeSession}>
          <TDStatusIndicator label={activeSession.status === 'paused' ? 'Paused' : 'Active'} tone={activeSession.status === 'paused' ? 'warning' : 'success'} />
          <View style={s.flex}>
            <TDText variant="title">{activeSession.name}</TDText>
            <TDText variant="caption" tone="muted">{activeSession.status === 'paused' ? 'Saved locally' : 'Available offline'}</TDText>
          </View>
          <TDButton
            label={activeSession.status === 'paused' ? 'Resume' : 'Pause'}
            variant="secondary"
            size="sm"
            onPress={activeSession.status === 'paused' ? () => startSession(activeSession.type, activeSession.name) : pauseSession}
          />
          <TDButton label="End" variant="ghost" size="sm" onPress={endSession} />
        </TDCard>
      ) : null}

      <TDSegmentedControl label="Session type" options={modes} value={mode} onChange={setMode} />

      <TDCard variant="floating" style={s.hero}>
        <View style={s.heroTop}>
          <View style={s.flex}>
            <TDText variant="label" tone="info">Current offer</TDText>
            <TDText variant="display">{state.offerLabel}</TDText>
            <TDText variant="small" tone="muted">
              {state.missingPrice ? 'Enter market value to calculate a cash offer.' : `${rate || '0'}% of ${currency(Number(market || 0))} market value`}
            </TDText>
          </View>
          <TDBadge tone={state.missingPrice ? 'warning' : 'success'}>{state.missingPrice ? 'Needs value' : 'Calculated'}</TDBadge>
        </View>
        <View style={s.inputs}>
          <TDInput label="Market value" value={market} onChangeText={setMarket} keyboardType="decimal-pad" placeholder="$0.00" />
          <TDInput label="Cash rate" value={rate} onChangeText={setRate} keyboardType="numeric" placeholder="65" />
          <TDInput label="Budget" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" placeholder="Optional" />
        </View>
        <TDButton label={ctaForMode(mode)} iconName={iconForMode(mode)} disabled={state.missingPrice && mode === 'buy'} onPress={begin} />
      </TDCard>

      <View style={s.dealFacts}>
        <TDListRow
          title="Budget remaining"
          description={budget ? `$${state.budgetRemaining.toFixed(0)} left from the entered budget.` : 'Add a budget when you want a spend check.'}
          iconName="wallet-outline"
          right={<TDBadge tone={budget ? 'info' : 'neutral'}>{budget ? 'Ready' : 'Unavailable'}</TDBadge>}
        />
        <TDListRow
          title="Review and margin"
          description="Review counts and margin reporting require real priced session lines before they appear here."
          iconName="analytics-outline"
          right={<TDBadge tone="neutral">Unavailable</TDBadge>}
        />
      </View>

      <TDSectionHeader title="Mode details" />
      <TDCard variant="outlined" style={s.modeDetails}>
        <TDText variant="title">{modeTitle(mode)}</TDText>
        <TDText variant="small" tone="muted">{modeDescription(mode)}</TDText>
      </TDCard>
    </ScrollView>
  );
}

function ctaForMode(mode: DealDeskMode) {
  if (mode === 'trade') return 'Start trade session';
  if (mode === 'sealed') return 'Start sealed evaluation';
  if (mode === 'show') return 'Start show session';
  return 'Start buying session';
}

function iconForMode(mode: DealDeskMode): keyof typeof Ionicons.glyphMap {
  if (mode === 'trade') return 'swap-horizontal-outline';
  if (mode === 'sealed') return 'cube-outline';
  if (mode === 'show') return 'ticket-outline';
  return 'scan-outline';
}

function modeTitle(mode: DealDeskMode) {
  if (mode === 'trade') return 'Trade evaluation';
  if (mode === 'sealed') return 'Sealed buying';
  if (mode === 'show') return 'Card-show intake';
  return 'Collection purchase';
}

function modeDescription(mode: DealDeskMode) {
  if (mode === 'trade') return 'Trade-side comparison is planned. Start a session now and review cards from the scanner flow.';
  if (mode === 'sealed') return 'Sealed-product breakdown requires real product data before values are shown.';
  if (mode === 'show') return 'Show sessions keep intake resumable without inventing spend, market, or margin totals.';
  return 'Enter a real market value and cash rate before starting a buying session.';
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.canvas },
  content: { gap: space.md, paddingHorizontal: space.lg },
  activeSession: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  hero: { gap: space.md, padding: space.lg },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  inputs: { gap: space.sm },
  dealFacts: { gap: space.xs },
  modeDetails: { gap: space.xs },
});

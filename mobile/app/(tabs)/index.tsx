import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TDBadge,
  TDButton,
  TDCard,
  TDIconButton,
  TDListRow,
  TDMetric,
  TDNavigationHeader,
  TDSkeleton,
  TDStatusIndicator,
  TDText,
} from '@/components/design-system';
import { color, space } from '@/design';
import { useWorkSession } from '@/features/sessions/session-provider';
import { useAccount } from '@/providers/account';
import { loadCollectorCollectionPage } from '@/services/collector-data';
import { summarizeCollectionCards, type CollectionSummary } from '@/services/collector-workspace';
import { buildMobileHomeComposition, type HomeAction } from '@/services/mobile-home';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { accountType } = useAccount();
  const { activeSession } = useWorkSession();
  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let active = true;
    void loadCollectorCollectionPage()
      .then((result) => {
        if (!active) return;
        setSummary(summarizeCollectionCards(result.cards, accountType));
        setStale(result.stale);
        setUnavailableReason(result.unavailableReason ?? null);
      })
      .catch((error) => {
        if (!active) return;
        setSummary(null);
        setUnavailableReason(error instanceof Error ? error.message : 'Collection summary is unavailable.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accountType]);

  const composition = useMemo(
    () => buildMobileHomeComposition({
      accountType,
      summary,
      collectionUnavailable: Boolean(unavailableReason && !summary),
      stale,
      activeSession,
    }),
    [accountType, activeSession, stale, summary, unavailableReason],
  );

  const portfolioTone = composition.portfolioState === 'ready'
    ? 'success'
    : composition.portfolioState === 'stale'
      ? 'warning'
      : 'info';
  const primaryAction = composition.actions[0];
  const supportingActions = composition.actions.slice(1);

  return (
    <View style={s.page}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 14, 34), paddingBottom: getMobileScrollBottomInset(insets.bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        <TDNavigationHeader
          eyebrow="Trading Docks"
          title={composition.workspaceLabel}
          subtitle={composition.briefingTitle}
          rightAction={<TDIconButton label="Notifications unavailable" iconName="notifications-outline" onPress={tap} />}
        />

        <TDCard variant="floating" style={s.portfolioCard}>
          <View style={s.cardTop}>
            <View style={s.flex}>
              <TDText variant="label" tone="muted">{composition.portfolioTitle}</TDText>
              {loading ? (
                <TDSkeleton lines={2} style={s.heroSkeleton} />
              ) : (
                <TDText variant="heading" style={s.portfolioMessage}>{composition.portfolioMessage}</TDText>
              )}
            </View>
            <TDBadge tone={portfolioTone}>{composition.portfolioState}</TDBadge>
          </View>
          <View style={s.statStrip}>
            <TDMetric label="Cards" value={summary ? summary.totalOwnedCards.toLocaleString() : 'Unavailable'} tone="info" compact />
            <TDMetric label="Storage" value={summary ? String(summary.storageLocationCount) : 'Unavailable'} compact />
            <TDMetric label="Missing" value={summary ? String(summary.missingPriceCount) : 'Unavailable'} tone={summary?.missingPriceCount ? 'warning' : 'neutral'} compact />
          </View>
          {summary?.freeCardLimit ? (
            <TDStatusIndicator
              tone={summary.freeCardLimitExceeded ? 'danger' : 'info'}
              label={`Free limit ${summary.totalOwnedCards}/${summary.freeCardLimit}`}
            />
          ) : (
            <TDStatusIndicator tone={portfolioTone} label={composition.portfolioState === 'ready' ? 'Real saved collection data' : 'No invented metrics'} />
          )}
        </TDCard>

        <View style={s.primaryActionWrap}>
          <TDButton
            label={primaryAction.label}
            iconName={primaryAction.icon as keyof typeof Ionicons.glyphMap}
            accessibilityLabel={`${primaryAction.label}: ${primaryAction.helper}`}
            onPress={() => go(primaryAction)}
          />
        </View>

        <View style={s.actionList} accessibilityLabel="Workspace shortcuts">
          {supportingActions.map((action) => (
            <TDListRow
              key={action.key}
              title={action.label}
              description={action.helper}
              iconName={action.icon as keyof typeof Ionicons.glyphMap}
              right={<Ionicons name="chevron-forward" size={18} color={color.textMuted} />}
              accessibilityLabel={`${action.label}: ${action.helper}`}
              onPress={() => go(action)}
            />
          ))}
        </View>

        <TDListRow
          title={composition.briefingTitle}
          description={unavailableReason ?? composition.briefingMessage}
          iconName="sparkles-outline"
        />

        {composition.activeSessionVisible && activeSession ? (
          <TDListRow
            eyebrow="Active session"
            title={activeSession.name}
            description={`${activeSession.type} - ${activeSession.status} - ${activeSession.itemCount} items`}
            iconName="radio-button-on-outline"
            right={<Ionicons name="arrow-forward" size={20} color={color.primaryBright} />}
            accessibilityLabel={`Resume ${activeSession.name}`}
            onPress={() => {
              router.push(composition.activeSessionRoute);
            }}
            selected
          />
        ) : null}

        <TDListRow
          eyebrow="Status"
          title={composition.activityTitle}
          description={composition.activityMessage}
          iconName="time-outline"
          right={<TDBadge tone="neutral">quiet</TDBadge>}
        />
      </ScrollView>
    </View>
  );
}

function go(action: HomeAction) {
  tap();
  router.push(action.route);
}

function tap() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync();
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: space.lg, gap: space.md },
  portfolioCard: { gap: space.md, padding: space.lg, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  heroSkeleton: { marginTop: space.sm },
  portfolioMessage: { marginTop: space.xs },
  statStrip: { flexDirection: 'row', gap: space.xs },
  primaryActionWrap: { gap: space.xs },
  actionList: { gap: space.xs },
});

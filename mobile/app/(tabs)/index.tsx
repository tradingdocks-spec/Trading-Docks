import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TDBadge, TDCard, TDText } from '@/components/design-system';
import { color, elevation, radius, space } from '@/design';
import { useWorkSession } from '@/features/sessions/session-provider';
import { useAccount } from '@/providers/account';
import { loadCollectorCollectionPage } from '@/services/collector-data';
import { summarizeCollectionCards, type CollectionSummary } from '@/services/collector-workspace';
import { buildMobileHomeComposition, type HomeAction } from '@/services/mobile-home';

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

  return (
    <View style={s.page}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 14, 34), paddingBottom: 112 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header} accessibilityRole="header">
          <View style={s.identityMark} accessibilityLabel="Trading Docks">
            <View style={s.identityMarkInner} />
          </View>
          <View style={s.headerCopy}>
            <TDText variant="label" tone="info">Trading Docks</TDText>
            <TDText variant="title">{composition.workspaceLabel}</TDText>
          </View>
          <Pressable
            accessibilityLabel="Open notifications"
            accessibilityRole="button"
            style={({ pressed }) => [s.notification, pressed && s.pressed]}
            onPress={() => tap()}
          >
            <Ionicons name="notifications-outline" size={20} color={color.text} />
            <View style={s.notificationDot} accessibilityLabel="Notifications unavailable" />
          </Pressable>
        </View>

        <TDCard variant="floating" style={s.portfolioCard}>
          <View style={s.cardTop}>
            <View style={s.flex}>
              <TDText variant="label" tone="muted">{composition.portfolioTitle}</TDText>
              {loading ? (
                <View style={s.loadingLine}>
                  <ActivityIndicator size="small" color={color.primaryBright} />
                  <TDText variant="small" tone="muted">Loading saved collection...</TDText>
                </View>
              ) : (
                <TDText variant="heading" style={s.portfolioMessage}>{composition.portfolioMessage}</TDText>
              )}
            </View>
            <TDBadge tone={portfolioTone}>{composition.portfolioState}</TDBadge>
          </View>
          <View style={s.statStrip}>
            <MiniStat label="Cards" value={summary ? summary.totalOwnedCards.toLocaleString() : 'Unavailable'} />
            <MiniStat label="Storage" value={summary ? String(summary.storageLocationCount) : 'Unavailable'} />
            <MiniStat label="Prices missing" value={summary ? String(summary.missingPriceCount) : 'Unavailable'} />
          </View>
          <TDText variant="caption" tone="muted">
            Movement charts stay hidden until real market movement data is available.
          </TDText>
        </TDCard>

        <View style={s.actions} accessibilityLabel="Smart actions">
          {composition.actions.map((action) => (
            <ActionButton key={action.key} action={action} />
          ))}
        </View>

        <TDCard variant="default" style={s.briefingCard}>
          <View style={s.briefingIcon}>
            <Ionicons name="sparkles-outline" size={20} color={color.info} />
          </View>
          <View style={s.flex}>
            <TDText variant="title">{composition.briefingTitle}</TDText>
            <TDText variant="small" tone="muted" style={s.bodyCopy}>{unavailableReason ?? composition.briefingMessage}</TDText>
          </View>
        </TDCard>

        {composition.activeSessionVisible && activeSession ? (
          <Pressable
            accessibilityLabel={`Resume ${activeSession.name}`}
            accessibilityRole="button"
            onPress={() => {
              tap();
              router.push(composition.activeSessionRoute);
            }}
            style={({ pressed }) => pressed && s.pressed}
          >
            <TDCard variant="elevated" style={s.sessionCard}>
              <View style={s.sessionPulse} />
              <View style={s.flex}>
                <TDText variant="label" tone="success">Active session</TDText>
                <TDText variant="title">{activeSession.name}</TDText>
                <TDText variant="caption" tone="muted">{activeSession.type} - {activeSession.status} - {activeSession.itemCount} items</TDText>
              </View>
              <Ionicons name="arrow-forward" size={20} color={color.primaryBright} />
            </TDCard>
          </Pressable>
        ) : null}

        <TDCard variant="outlined" style={s.activityCard}>
          <View style={s.cardTop}>
            <TDText variant="title">{composition.activityTitle}</TDText>
            <TDBadge tone="neutral">quiet</TDBadge>
          </View>
          <TDText variant="small" tone="muted" style={s.bodyCopy}>{composition.activityMessage}</TDText>
        </TDCard>
      </ScrollView>
    </View>
  );
}

function ActionButton({ action }: { action: HomeAction }) {
  return (
    <Pressable
      accessibilityLabel={`${action.label}: ${action.helper}`}
      accessibilityRole="button"
      onPress={() => {
        tap();
        router.push(action.route);
      }}
      style={({ pressed }) => [s.actionButton, pressed && s.pressed]}
    >
      <View style={s.actionIcon}>
        <Ionicons name={action.icon as keyof typeof Ionicons.glyphMap} size={20} color={color.primaryBright} />
      </View>
      <TDText variant="small">{action.label}</TDText>
      <TDText variant="caption" tone="muted" style={s.actionHelper}>{action.helper}</TDText>
    </Pressable>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.miniStat}>
      <TDText variant="caption" tone="muted">{label}</TDText>
      <TDText variant="small">{value}</TDText>
    </View>
  );
}

function tap() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync();
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: space.lg, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  identityMark: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center', ...elevation.raised },
  identityMarkInner: { width: 18, height: 18, borderWidth: 4, borderColor: color.text, borderTopLeftRadius: 3, borderBottomRightRadius: 3, transform: [{ rotate: '45deg' }] },
  headerCopy: { flex: 1, minWidth: 0 },
  notification: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: color.textMuted },
  portfolioCard: { gap: space.md, padding: space.lg, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  loadingLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  portfolioMessage: { marginTop: space.xs },
  statStrip: { flexDirection: 'row', gap: space.xs },
  miniStat: { flex: 1, minHeight: 64, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.canvasRaised, paddingHorizontal: space.sm, paddingVertical: space.sm, justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: space.xs },
  actionButton: { flex: 1, minHeight: 104, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, backgroundColor: color.surface, padding: space.sm, justifyContent: 'space-between' },
  actionIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.primary + '20' },
  actionHelper: { minHeight: 30 },
  briefingCard: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.md },
  briefingIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.info + '16' },
  bodyCopy: { marginTop: space.xs },
  sessionCard: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  sessionPulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.success },
  activityCard: { gap: space.xs, padding: space.md },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});

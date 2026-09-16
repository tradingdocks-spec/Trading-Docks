import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CollectibleCard,
  DockAction,
  DockHeader,
  DockRail,
  DockSection,
  DockSurface,
  DockTray,
  TDBadge,
  TDSkeleton,
  TDText,
} from '@/components/design-system';
import { color, radius, space } from '@/design';
import { useWorkSession } from '@/features/sessions/session-provider';
import { useAccount } from '@/providers/account';
import { loadCollectorCollectionPage } from '@/services/collector-data';
import { summarizeCollectionCards, type CollectionCard, type CollectionSummary } from '@/services/collector-workspace';
import { buildMobileHomeComposition, type HomeAction, type HomeRecentCard } from '@/services/mobile-home';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { accountType } = useAccount();
  const { activeSession } = useWorkSession();
  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [recentCards, setRecentCards] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let active = true;
    void loadCollectorCollectionPage()
      .then((result) => {
        if (!active) return;
        setRecentCards(result.cards);
        setSummary(summarizeCollectionCards(result.cards, accountType));
        setStale(result.stale);
        setUnavailableReason(result.unavailableReason ?? null);
      })
      .catch((error) => {
        if (!active) return;
        setRecentCards([]);
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
      recentCards,
    }),
    [accountType, activeSession, stale, summary, unavailableReason, recentCards],
  );

  return (
    <View style={s.page}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 14, 34), paddingBottom: getMobileScrollBottomInset(insets.bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader workspaceLabel={composition.workspaceLabel} />

        <HomeHero
          loading={loading}
          eyebrow={composition.hero.eyebrow}
          title={composition.hero.title}
          value={composition.hero.value}
          supporting={unavailableReason ?? composition.hero.supporting}
          state={composition.hero.state}
        />

        <QuickActions actions={composition.actions} />

        {composition.recentAdds.length ? (
          <RecentAddsCarousel cards={composition.recentAdds} />
        ) : (
          <EmptyCollectionHero loading={loading} />
        )}

        <ActionableInsight
          title={composition.insight.title}
          message={composition.insight.message}
          tone={composition.insight.tone}
          activeSessionVisible={composition.activeSessionVisible}
          activeSessionRoute={composition.activeSessionRoute}
        />
      </ScrollView>
    </View>
  );
}

function HomeHeader({ workspaceLabel }: { workspaceLabel: string }) {
  return (
    <View style={s.header}>
      <View style={s.headerTitle}>
        <TDText variant="caption" tone="muted">Trading Docks</TDText>
        <TDText variant="title">{workspaceLabel}</TDText>
      </View>
      <TDBadge tone="info">Blue system</TDBadge>
    </View>
  );
}

function HomeHero({
  loading,
  eyebrow,
  title,
  value,
  supporting,
  state,
}: {
  loading: boolean;
  eyebrow: string;
  title: string;
  value: string;
  supporting: string;
  state: 'ready' | 'empty' | 'unavailable' | 'stale';
}) {
  const tone = state === 'ready' ? 'success' : state === 'stale' ? 'warning' : 'info';
  return (
    <View style={s.heroShell}>
      <View style={s.heroBackplate} />
      <DockSurface material="activeInstrument" level="raised" tone={state === 'ready' ? 'success' : state === 'stale' ? 'warning' : 'neutral'} style={s.hero}>
        <View style={s.heroLight} />
        <DockHeader
          eyebrow={eyebrow}
          title={title}
          right={<TDBadge tone={tone}>{heroStateLabel(state)}</TDBadge>}
        />
        <View style={s.instrumentFace}>
          {loading ? (
            <TDSkeleton lines={2} style={s.heroSkeleton} />
          ) : (
            <>
              <TDText variant="display" style={s.heroValue}>{value}</TDText>
              <TDText variant="small" tone="muted">{supporting}</TDText>
            </>
          )}
        </View>
      </DockSurface>
    </View>
  );
}

function QuickActions({ actions }: { actions: HomeAction[] }) {
  const primary = actions[0];
  const secondary = actions.slice(1);
  return (
    <DockSurface accessibilityLabel="Primary workspace actions" material="raisedControl" level="raised" style={s.quickActions}>
      <DockHeader
        eyebrow="Primary actions"
        title="Move fast"
        subtitle="Open the routes you use most without hunting through menus."
      />
      <DockAction
        label={primary.label}
        iconName={primary.icon as keyof typeof Ionicons.glyphMap}
        onPress={() => go(primary)}
        prominent
        style={s.scanAction}
      />
      <DockRail compact style={s.actionRail}>
        {secondary.map((action) => (
          <DockAction
            key={action.key}
            label={action.label}
            iconName={action.icon as keyof typeof Ionicons.glyphMap}
            onPress={() => go(action)}
          />
        ))}
      </DockRail>
    </DockSurface>
  );
}

function RecentAddsCarousel({ cards }: { cards: HomeRecentCard[] }) {
  return (
    <DockSection
      title="Recent cards"
      action={<TDText variant="caption" tone="muted">Latest inventory</TDText>}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recentList}>
        {cards.map((card) => (
          <CollectibleCard
            key={card.id}
            title={card.title}
            subtitle={card.subtitle}
            metadata={card.metadata}
            imageUrl={card.imageUrl}
            quantityLabel={card.quantityLabel}
            onPress={() => {
              tap();
              router.push(`/collection/${card.id}` as never);
            }}
            style={s.recentCard}
          >
            <TDText variant="caption" tone={card.price === 'Price unavailable' ? 'muted' : 'primary'} numberOfLines={1}>{card.price}</TDText>
          </CollectibleCard>
        ))}
      </ScrollView>
    </DockSection>
  );
}

function EmptyCollectionHero({ loading }: { loading: boolean }) {
  if (loading) return <TDSkeleton lines={3} style={s.emptySkeleton} />;
  return (
      <DockTray style={s.emptyCard}>
      <View style={s.emptyIcon}>
        <Ionicons name="scan-outline" size={24} color={color.primaryBright} />
      </View>
      <View style={s.flex}>
        <TDText variant="title">Start your collection</TDText>
        <TDText variant="small" tone="muted">Scan, review, then organize the first real card.</TDText>
      </View>
    </DockTray>
  );
}

function ActionableInsight({
  title,
  message,
  tone,
  activeSessionVisible,
  activeSessionRoute,
}: {
  title: string;
  message: string;
  tone: 'info' | 'warning' | 'success';
  activeSessionVisible: boolean;
  activeSessionRoute: '/(tabs)/scan' | '/deal-desk';
}) {
  const iconName = tone === 'warning' ? 'alert-circle-outline' : tone === 'success' ? 'checkmark-circle-outline' : 'sparkles-outline';
  const iconColor = tone === 'warning' ? color.warning : tone === 'success' ? color.success : color.primaryBright;
  return (
    <DockTray style={s.insight}>
      <View style={[s.insightIcon, tone === 'warning' && s.insightWarning, tone === 'success' && s.insightSuccess]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <View style={s.flex}>
        <TDText variant="small">{title}</TDText>
        <TDText variant="caption" tone="muted">{message}</TDText>
      </View>
      {activeSessionVisible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Resume active session"
          onPress={() => {
            tap();
            router.push(activeSessionRoute);
          }}
          style={({ pressed }) => [s.resumeButton, pressed && s.pressed]}
        >
          <TDText variant="caption" tone="info">Resume</TDText>
        </Pressable>
      ) : null}
    </DockTray>
  );
}

function go(action: HomeAction) {
  tap();
  router.push(action.route as never);
}

function tap() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync();
}

function heroStateLabel(state: 'ready' | 'empty' | 'unavailable' | 'stale') {
  if (state === 'ready') return 'Synced';
  if (state === 'empty') return 'Start';
  if (state === 'stale') return 'Cached';
  return 'Offline';
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: space.md, gap: space.lg },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  headerTitle: { flex: 1, minWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  heroShell: { minHeight: 212, justifyContent: 'center' },
  heroBackplate: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 16,
    bottom: 0,
    borderRadius: radius.xl,
    backgroundColor: color.canvasRaised,
    opacity: 0.74,
    transform: [{ translateY: 8 }],
  },
  hero: {
    gap: space.md,
    padding: space.md,
    overflow: 'hidden',
    borderTopColor: color.primaryBright + '44',
    borderBottomColor: '#00000088',
  },
  heroLight: {
    position: 'absolute',
    left: -40,
    right: 40,
    top: -80,
    height: 150,
    borderRadius: 150,
    backgroundColor: color.primaryBright + '1C',
  },
  instrumentFace: {
    minHeight: 110,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderTopColor: color.primaryBright + '28',
    borderLeftColor: color.border,
    borderRightColor: color.border,
    borderBottomColor: '#00000099',
    padding: space.md,
    justifyContent: 'center',
    backgroundColor: color.canvas + 'B8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
  },
  heroValue: { marginTop: space.xs, textShadowColor: color.primaryBright + '24', textShadowRadius: 18 },
  heroSkeleton: { marginTop: space.sm },
  quickActions: { gap: space.sm, padding: space.sm, overflow: 'hidden' },
  scanAction: { minHeight: 64, marginBottom: space.xs, borderBottomColor: '#00000088' },
  actionRail: { borderTopWidth: 1, borderTopColor: color.primaryBright + '16', paddingTop: space.xs },
  recentList: { gap: space.sm, paddingRight: space.md },
  recentCard: { width: 148 },
  emptySkeleton: { minHeight: 118 },
  emptyCard: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  emptyIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.primary + '18' },
  insight: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  insightIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.primary + '16' },
  insightWarning: { backgroundColor: color.warning + '18' },
  insightSuccess: { backgroundColor: color.success + '18' },
  resumeButton: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center', backgroundColor: color.canvasRaised, paddingHorizontal: space.md },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});

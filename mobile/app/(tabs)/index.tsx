import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TDBadge,
  TDButton,
  TDCard,
  TDIconButton,
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
        <TDText variant="label" tone="muted">Trading Docks</TDText>
        <TDText variant="title">{workspaceLabel}</TDText>
      </View>
      <TDIconButton label="Notifications unavailable" iconName="notifications-outline" onPress={tap} />
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
    <TDCard variant="floating" style={s.hero}>
      <View style={s.heroTop}>
        <View style={s.flex}>
          <TDText variant="label" tone="muted">{eyebrow}</TDText>
          <TDText variant="title">{title}</TDText>
        </View>
        <TDBadge tone={tone}>{state}</TDBadge>
      </View>
      {loading ? (
        <TDSkeleton lines={2} style={s.heroSkeleton} />
      ) : (
        <>
          <TDText variant="display" style={s.heroValue}>{value}</TDText>
          <TDText variant="small" tone="muted">{supporting}</TDText>
        </>
      )}
    </TDCard>
  );
}

function QuickActions({ actions }: { actions: HomeAction[] }) {
  const primary = actions[0];
  const secondary = actions.slice(1, 4);
  return (
    <View style={s.quickActions} accessibilityLabel="Primary workspace actions">
      <TDButton
        label={primary.label}
        iconName={primary.icon as keyof typeof Ionicons.glyphMap}
        accessibilityLabel={`${primary.label}: ${primary.helper}`}
        onPress={() => go(primary)}
        style={s.scanAction}
      />
      <View style={s.secondaryActions}>
        {secondary.map((action) => (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={`${action.label}: ${action.helper}`}
            onPress={() => go(action)}
            style={({ pressed }) => [s.quickAction, pressed && s.pressed]}
          >
            <Ionicons name={action.icon as keyof typeof Ionicons.glyphMap} size={20} color={color.primaryBright} />
            <TDText variant="caption" numberOfLines={1}>{action.label}</TDText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function RecentAddsCarousel({ cards }: { cards: HomeRecentCard[] }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <TDText variant="title">Recent Adds</TDText>
        <TDText variant="caption" tone="muted">Real saved cards</TDText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recentList}>
        {cards.map((card) => (
          <Pressable
            key={card.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${card.title}. ${card.subtitle}. ${card.metadata}. ${card.quantityLabel}`}
            onPress={() => {
              tap();
              router.push(`/collection/${card.id}` as never);
            }}
            style={({ pressed }) => [s.recentCard, pressed && s.pressed]}
          >
            <View style={s.cardImageFrame}>
              {card.imageUrl ? (
                <Image
                  source={{ uri: card.imageUrl }}
                  style={s.cardImage}
                  contentFit="cover"
                  transition={150}
                  accessibilityLabel={`${card.title} card image`}
                />
              ) : (
                <View style={s.imagePlaceholder}>
                  <Ionicons name="image-outline" size={22} color={color.textMuted} />
                  <TDText variant="caption" tone="muted" style={s.centerText}>No image</TDText>
                </View>
              )}
              <View style={s.quantityPill}>
                <TDText variant="caption">{card.quantityLabel}</TDText>
              </View>
            </View>
            <TDText variant="small" numberOfLines={1}>{card.title}</TDText>
            <TDText variant="caption" tone="muted" numberOfLines={1}>{card.subtitle}</TDText>
            <TDText variant="caption" tone="secondary" numberOfLines={1}>{card.metadata}</TDText>
            <TDText variant="caption" tone={card.price === 'Price unavailable' ? 'muted' : 'primary'} numberOfLines={1}>{card.price}</TDText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function EmptyCollectionHero({ loading }: { loading: boolean }) {
  if (loading) return <TDSkeleton lines={3} style={s.emptySkeleton} />;
  return (
    <TDCard variant="outlined" style={s.emptyCard}>
      <View style={s.emptyIcon}>
        <Ionicons name="scan-outline" size={24} color={color.primaryBright} />
      </View>
      <View style={s.flex}>
        <TDText variant="title">Start your collection</TDText>
        <TDText variant="small" tone="muted">Scan, review, then organize the first real card.</TDText>
      </View>
    </TDCard>
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
  activeSessionRoute: '/(tabs)/scan' | '/(tabs)/deal-desk';
}) {
  return (
    <TDCard variant="outlined" style={s.insight}>
      <View style={[s.insightIcon, tone === 'warning' && s.insightWarning, tone === 'success' && s.insightSuccess]}>
        <Ionicons name={tone === 'warning' ? 'alert-circle-outline' : tone === 'success' ? 'checkmark-circle-outline' : 'sparkles-outline'} size={20} color={tone === 'warning' ? color.warning : tone === 'success' ? color.success : color.primaryBright} />
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
          <Ionicons name="arrow-forward" size={18} color={color.primaryBright} />
        </Pressable>
      ) : null}
    </TDCard>
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
  content: { paddingHorizontal: space.md, gap: space.lg },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  headerTitle: { flex: 1, minWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  hero: { gap: space.md, padding: space.lg, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  heroValue: { marginTop: space.xs },
  heroSkeleton: { marginTop: space.sm },
  quickActions: { gap: space.sm },
  scanAction: { minHeight: 54 },
  secondaryActions: { flexDirection: 'row', gap: space.sm },
  quickAction: { flex: 1, minHeight: 72, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingHorizontal: space.xs, backgroundColor: color.surfaceFloating },
  section: { gap: space.sm },
  sectionHeader: { minHeight: 28, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  recentList: { gap: space.sm, paddingRight: space.md },
  recentCard: { width: 138, gap: 4, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.xs, backgroundColor: color.surfaceFloating },
  cardImageFrame: { height: 184, overflow: 'hidden', borderRadius: radius.sm, backgroundColor: color.surface },
  cardImage: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs, padding: space.xs },
  quantityPill: { position: 'absolute', right: 6, top: 6, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: color.canvas + 'D8' },
  emptySkeleton: { minHeight: 118 },
  emptyCard: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  emptyIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.primary + '18' },
  insight: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  insightIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.primary + '16' },
  insightWarning: { backgroundColor: color.warning + '18' },
  insightSuccess: { backgroundColor: color.success + '18' },
  resumeButton: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center', backgroundColor: color.canvasRaised },
  centerText: { textAlign: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});

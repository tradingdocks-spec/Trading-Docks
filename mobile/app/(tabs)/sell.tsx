import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DockHeader,
  DockMetric,
  DockRail,
  DockSurface,
  TDBadge,
  TDButton,
  TDListRow,
  TDNavigationHeader,
  TDSectionHeader,
  TDStatusIndicator,
  TDText,
} from '@/components/design-system';
import { color, space } from '@/design';
import { useWorkSession } from '@/features/sessions/session-provider';
import { useAccount } from '@/providers/account';
import { loadCollectorCollectionPage } from '@/services/collector-data';
import { displayFinish, displayStorageLocation, priceLabel, type CollectionCard } from '@/services/collector-workspace';

type IntelligenceSignal = {
  id: string;
  title: string;
  detail: string;
  tone: 'success' | 'warning' | 'info' | 'neutral';
  icon: keyof typeof Ionicons.glyphMap;
};

export default function Sell() {
  const insets = useSafeAreaInsets();
  const { accountType } = useAccount();
  const { activeSession } = useWorkSession();
  const workspaceLabel = accountType === 'store' ? 'Activity' : accountType === 'seller' ? 'Signals' : 'Signals';
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [staleReason, setStaleReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadCollectorCollectionPage({ limit: 100 })
      .then((result) => {
        if (!mounted) return;
        setCards(result.cards);
        setStaleReason(result.stale ? result.unavailableReason ?? 'Showing cached collection data.' : null);
        setError(null);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setCards([]);
        setError(loadError instanceof Error ? loadError.message : 'Collection intelligence is unavailable.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const intelligence = useMemo(() => buildCollectionIntelligence(cards), [cards]);

  return (
    <ScrollView style={s.page} contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 14, 34), paddingBottom: 112 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <TDNavigationHeader
        eyebrow={workspaceLabel}
        title={headlineForAccount(accountType)}
        subtitle={subtitleForAccount(accountType)}
      />

      <DockSurface level="raised" style={s.hero}>
        <View style={s.heroTop}>
          <DockHeader
            eyebrow="Today"
            title={activeSession ? activeSession.name : 'No active selling session'}
            subtitle={activeSession ? `${activeSession.status} - ${activeSession.itemCount} item${activeSession.itemCount === 1 ? '' : 's'}` : 'Start from the scanner, Deal Desk, or Collection when real work is ready.'}
            style={s.flex}
          />
          <TDBadge tone={activeSession ? 'success' : 'neutral'}>{activeSession ? 'Active' : 'Quiet'}</TDBadge>
        </View>
        <View style={s.signalGrid}>
          <DockMetric label="Cards loaded" value={loading ? '...' : String(cards.length)} tone={cards.length ? 'active' : 'neutral'} />
          <DockMetric label="Needs price" value={loading ? '...' : String(intelligence.missingPriceCount)} tone={intelligence.missingPriceCount ? 'warning' : 'success'} />
          <DockMetric label="Workspace" value={accountType === 'store' ? 'Store' : accountType === 'seller' ? 'Seller' : 'Collector'} />
        </View>
      </DockSurface>

      <TDSectionHeader title="Current signals" />
      <DockSurface style={s.actionDock}>
        {error ? (
          <TDStatusIndicator label="Reconnect to refresh collection intelligence" tone="warning" />
        ) : staleReason ? (
          <TDStatusIndicator label={staleReason} tone="warning" />
        ) : null}
        {loading ? (
          <TDStatusIndicator label="Loading collection intelligence" tone="info" />
        ) : intelligence.signals.length ? (
          intelligence.signals.map((signal) => (
            <TDListRow
              key={signal.id}
              title={signal.title}
              description={signal.detail}
              iconName={signal.icon}
              right={<TDBadge tone={signal.tone}>{signal.tone === 'warning' ? 'Review' : 'Ready'}</TDBadge>}
            />
          ))
        ) : (
          <TDListRow
            title="Add cards to unlock intelligence"
            description="Scan or add real collection records before Trading Docks summarizes duplicates, foils, wishlist overlap, or review needs."
            iconName="scan-outline"
            right={<Ionicons name="chevron-forward" size={20} color={color.textMuted} />}
            onPress={() => router.push('/(tabs)/scan' as never)}
          />
        )}
      </DockSurface>

      <TDSectionHeader title="Useful actions" />
      <DockSurface style={s.actionDock}>
        <TDListRow
          title="Open Deal Desk"
          description="Start or resume a buying, trade, sealed, or show session."
          iconName="swap-horizontal-outline"
          right={<Ionicons name="chevron-forward" size={20} color={color.textMuted} />}
          onPress={() => router.push('/(tabs)/deal-desk' as never)}
        />
        <DockRail compact>
          <TDButton
            label="Scan"
            size="sm"
            iconName="scan-outline"
            onPress={() => router.push('/(tabs)/scan' as never)}
          />
          <TDButton
            label={accountType === 'store' ? 'Inventory' : 'Collection'}
            size="sm"
            variant="secondary"
            iconName="layers-outline"
            onPress={() => router.push('/(tabs)/collection' as never)}
          />
        </DockRail>
      </DockSurface>
    </ScrollView>
  );
}

function headlineForAccount(accountType: string) {
  if (accountType === 'store') return 'Store activity and operations';
  if (accountType === 'seller') return 'Seller signals and workflow shortcuts';
  return 'Collection signals';
}

function subtitleForAccount(accountType: string) {
  if (accountType === 'store') return 'Current collection signals, storage gaps, and scanner review work.';
  if (accountType === 'seller') return 'Current inventory signals, trade markers, and scanner review work.';
  return 'Current collection signals from cards you have actually saved.';
}

function buildCollectionIntelligence(cards: CollectionCard[]): { missingPriceCount: number; signals: IntelligenceSignal[] } {
  const missingPriceCount = cards.filter((card) => card.marketPrice.amount === null).length;
  const foils = cards.filter((card) => displayFinish(card.printing.finish).toLowerCase().includes('foil')).length;
  const tradeMarked = cards.filter((card) => card.tradeBinderStatus !== 'not_for_trade' && card.tradeBinderStatus !== 'unknown').length;
  const wishlistOverlap = cards.filter((card) => card.wishlistStatus === 'wanted').length;
  const duplicates = cards.filter((card) => card.quantityOwned > 1).length;
  const unassigned = cards.filter((card) => !card.storageLocation).length;
  const valuable = [...cards]
    .filter((card) => card.marketPrice.amount !== null)
    .sort((a, b) => (b.marketPrice.amount ?? 0) - (a.marketPrice.amount ?? 0))[0];
  const newest = [...cards]
    .sort((a, b) => Date.parse(b.updatedAt ?? '') - Date.parse(a.updatedAt ?? ''))[0];
  const signals: IntelligenceSignal[] = [];

  if (valuable) {
    signals.push({
      id: 'valuable',
      title: 'Most valuable loaded card',
      detail: `${valuable.cardName} - ${priceLabel(valuable)} - ${displayStorageLocation(valuable)}`,
      tone: 'success',
      icon: 'diamond-outline',
    });
  }
  if (duplicates) {
    signals.push({
      id: 'duplicates',
      title: 'Duplicates ready to review',
      detail: `${duplicates} loaded printing${duplicates === 1 ? '' : 's'} have quantity above one.`,
      tone: 'info',
      icon: 'copy-outline',
    });
  }
  if (missingPriceCount) {
    signals.push({
      id: 'missing-prices',
      title: 'Missing prices',
      detail: `${missingPriceCount} loaded card${missingPriceCount === 1 ? '' : 's'} need pricing before value is complete.`,
      tone: 'warning',
      icon: 'pricetag-outline',
    });
  }
  if (unassigned) {
    signals.push({
      id: 'unassigned',
      title: 'Storage gaps',
      detail: `${unassigned} loaded card${unassigned === 1 ? '' : 's'} are not assigned to a storage location.`,
      tone: 'warning',
      icon: 'file-tray-stacked-outline',
    });
  }
  if (tradeMarked) {
    signals.push({
      id: 'trade',
      title: 'Trade-marked cards',
      detail: `${tradeMarked} loaded card${tradeMarked === 1 ? '' : 's'} are active in your Trade Binder.`,
      tone: 'success',
      icon: 'swap-horizontal-outline',
    });
  }
  if (wishlistOverlap) {
    signals.push({
      id: 'wishlist',
      title: 'Wishlist overlap',
      detail: `${wishlistOverlap} loaded card${wishlistOverlap === 1 ? '' : 's'} also appear on your wishlist.`,
      tone: 'info',
      icon: 'star-outline',
    });
  }
  if (foils) {
    signals.push({
      id: 'foils',
      title: 'Foils in collection',
      detail: `${foils} loaded card${foils === 1 ? '' : 's'} use foil or etched finishes.`,
      tone: 'info',
      icon: 'sparkles-outline',
    });
  }
  if (newest) {
    signals.push({
      id: 'recent',
      title: 'Most recent loaded card',
      detail: `${newest.cardName} - ${displayStorageLocation(newest)}`,
      tone: 'neutral',
      icon: 'time-outline',
    });
  }
  return { missingPriceCount, signals: signals.slice(0, 5) };
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.canvas },
  content: { gap: space.md, paddingHorizontal: space.lg },
  hero: { gap: space.md, padding: space.lg },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  signalGrid: { flexDirection: 'row', gap: space.xs },
  actionDock: { padding: space.sm },
  flex: { flex: 1, minWidth: 0 },
});

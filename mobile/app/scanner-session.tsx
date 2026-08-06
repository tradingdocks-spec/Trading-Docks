import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TDBadge, TDButton, TDChip, TDEmptyState, TDErrorState, TDIconButton, TDInput, TDListRow, TDLoadingState, TDMetric, TDNavigationHeader, TDSegmentedControl, TDScreen, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { supabase } from '@/lib/supabase';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';
import {
  buildContinuousScannerCsvRows,
  bulkConfirmReviewedCards,
  calculateSessionTotals,
  continuousScannerSessionKey,
  editScannerSessionLine,
  filterScannerSessionLines,
  removeScannerSessionLine,
  scannerModeLabel,
  serializeContinuousScannerCsv,
  undoMostRecentScan,
  type ContinuousConfidenceState,
  type ContinuousScannerSession,
  type ScannerSessionLine,
} from '@/services/continuous-offer-scanner';
import type { SupportedTcg } from '@/services/multi-tcg-scanner';
import { appStorage } from '@/services/storage/app-storage';

type StatusFilter = ScannerSessionLine['reviewStatus'] | 'all';
type GameFilter = SupportedTcg | 'all';
type ConfidenceFilter = ContinuousConfidenceState | 'all';

export default function ScannerSessionReview() {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<ContinuousScannerSession | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [gameFilter, setGameFilter] = useState<GameFilter>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');
  const [missingPriceOnly, setMissingPriceOnly] = useState(false);
  const [lastExportSummary, setLastExportSummary] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadUserSession()
      .then(({ loadedUserId, loadedSession }) => {
        if (!active) return;
        setUserId(loadedUserId);
        setSession(loadedSession);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Scanner session is unavailable.'))
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!userId || !session) return;
    void appStorage.setItem(continuousScannerSessionKey(userId), JSON.stringify(session));
  }, [session, userId]);

  const totals = useMemo(() => session ? calculateSessionTotals(session) : null, [session]);
  const visibleLines = useMemo(() => session ? filterScannerSessionLines(session.lines, {
    game: gameFilter,
    status: statusFilter,
    confidence: confidenceFilter,
    missingPrice: missingPriceOnly,
  }) : [], [confidenceFilter, gameFilter, missingPriceOnly, session, statusFilter]);

  const exportCsv = () => {
    if (!session) return;
    const rows = buildContinuousScannerCsvRows(session);
    const csv = serializeContinuousScannerCsv(rows);
    setLastExportSummary(`${rows.length} row${rows.length === 1 ? '' : 's'} prepared for explicit share/export (${csv.length} characters).`);
  };

  if (loading) return <TDScreen style={s.screen}><TDLoadingState title="Loading scanner session" message="Restoring the local user-scoped intake list." /></TDScreen>;
  if (error) return <TDScreen style={s.screen}><TDErrorState title="Session unavailable" message={error} action={<TDButton label="Back to scanner" variant="secondary" onPress={() => router.back()} />} /></TDScreen>;
  if (!session) return <TDScreen style={s.screen}><TDEmptyState title="No active scanner session" message="Start scanning to build an intake or offer list." action={<TDButton label="Open scanner" onPress={() => router.push('/(tabs)/scan' as never)} />} /></TDScreen>;

  return (
    <TDScreen style={s.screen}>
      <FlatList
        data={visibleLines}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[s.content, { paddingBottom: getMobileScrollBottomInset(insets.bottom) + 72 }]}
        ListHeaderComponent={(
          <View style={s.headerStack}>
            <TDNavigationHeader
              eyebrow="Session Review"
              title={session.name}
              subtitle={`${scannerModeLabel(session.mode)} review list`}
              leftAction={<TDIconButton label="Back to scanner" iconName="chevron-back" onPress={() => router.back()} />}
            />
            <View style={s.hero}>
              <View style={s.summary}>
                <TDMetric label="Cards" value={String(totals?.cardsScanned ?? 0)} compact tone="info" />
                <TDMetric label="Market" value={currency(totals?.marketValue)} compact />
                <TDMetric label="Cash" value={currency(totals?.cashOffer)} compact tone="success" />
                <TDMetric label="Trade" value={currency(totals?.tradeValue)} compact tone="accent" />
                <TDMetric label="Review" value={String(totals?.needsReview ?? 0)} compact tone={totals?.needsReview ? 'warning' : 'neutral'} />
                <TDMetric label="No price" value={String(totals?.missingPriceItems ?? 0)} compact tone={totals?.missingPriceItems ? 'warning' : 'neutral'} />
              </View>
              <TDButton label="Finalize reviewed cards" iconName="checkmark-done-outline" disabled={!session.lines.length} onPress={() => setSession(bulkConfirmReviewedCards(session))} />
            </View>
            <View style={s.filters}>
              <TDSegmentedControl label="Status" options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
              <ChipRow label="Game" options={['all', 'magic', 'pokemon', 'one_piece', 'lorcana', 'unknown']} value={gameFilter} onSelect={(value) => setGameFilter(value as GameFilter)} />
              <ChipRow label="Confidence" options={['all', 'high_confidence', 'likely', 'ambiguous', 'manual_review_required']} value={confidenceFilter} onSelect={(value) => setConfidenceFilter(value as ConfidenceFilter)} />
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: missingPriceOnly }} onPress={() => setMissingPriceOnly((value) => !value)} style={s.checkboxRow}>
                <Ionicons name={missingPriceOnly ? 'checkbox-outline' : 'square-outline'} size={22} color={color.primaryBright} />
                <TDText variant="small">Missing price only</TDText>
              </Pressable>
              <View style={s.actions}>
                <TDButton label="Undo recent" variant="secondary" disabled={!session.lines.length} onPress={() => setSession(undoMostRecentScan(session))} />
                <TDButton label="Export CSV" onPress={exportCsv} />
              </View>
              {lastExportSummary ? <TDBadge tone="success">{lastExportSummary}</TDBadge> : null}
            </View>
          </View>
        )}
        renderItem={({ item }) => <SessionLineCard line={item} onUpdate={(line) => setSession(editScannerSessionLine(session, item.id, line))} onRemove={() => setSession(removeScannerSessionLine(session, item.id))} />}
        ListEmptyComponent={<TDEmptyState title="No matching session cards" message="Adjust filters or return to the scanner to add cards." />}
      />
    </TDScreen>
  );
}

function SessionLineCard({ line, onUpdate, onRemove }: { line: ScannerSessionLine; onUpdate: (patch: Partial<ScannerSessionLine>) => void; onRemove: () => void }) {
  const [price, setPrice] = useState(line.marketPrice === null ? '' : String(line.marketPrice));
  const [rate, setRate] = useState(String(line.purchasePercentage));
  return (
    <View style={s.line}>
      <TDListRow
        title={line.cardName}
        eyebrow={line.reviewStatus.replaceAll('_', ' ')}
        description={`${line.game} - ${line.setCode ?? 'Set unavailable'} #${line.collectorNumber ?? '?'} - ${String(line.condition)} - ${String(line.finish)}`}
        iconName="scan-outline"
        right={<TDBadge tone={line.reviewStatus === 'confirmed' ? 'success' : line.reviewStatus === 'needs_review' ? 'warning' : 'info'}>x{line.quantity}</TDBadge>}
      />
      <View style={s.editGrid}>
        <TDInput label="Qty" value={String(line.quantity)} keyboardType="numeric" onChangeText={(value) => onUpdate({ quantity: Math.max(1, Number(value) || 1) })} />
        <TDInput label="Price" value={price} keyboardType="decimal-pad" placeholder="Unavailable" onChangeText={(value) => {
          setPrice(value);
          const parsed = Number(value.replace(/[$,]/g, ''));
          onUpdate({ marketPrice: Number.isFinite(parsed) && parsed >= 0 ? parsed : null });
        }} />
        <TDInput label="Cash %" value={rate} keyboardType="numeric" onChangeText={(value) => {
          setRate(value);
          const parsed = Number(value);
          onUpdate({ purchasePercentage: Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : line.purchasePercentage });
        }} />
      </View>
      <View style={s.lineFooter}>
        <TDText variant="small" tone="muted">{line.marketPrice === null ? 'Pricing unavailable; excluded from totals.' : `Cash ${currency(line.cashOffer)} - Trade ${currency(line.tradeValue)}`}</TDText>
        <View style={s.actions}>
          <TDButton label="Review" variant="secondary" onPress={() => onUpdate({ reviewStatus: line.reviewStatus === 'confirmed' ? 'needs_review' : 'confirmed' })} />
          <TDButton label="Remove" variant="danger" onPress={onRemove} />
        </View>
      </View>
    </View>
  );
}

function ChipRow({ label, options, value, onSelect }: { label: string; options: string[]; value: string; onSelect: (value: string) => void }) {
  return (
    <View style={s.chipGroup}>
      <TDText variant="label" tone="muted">{label}</TDText>
      <View style={s.chips}>
        {options.map((option) => <TDChip key={option} label={option.replaceAll('_', ' ')} selected={option === value} onPress={() => onSelect(option)} />)}
      </View>
    </View>
  );
}

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'suggested', label: 'Suggested' },
  { value: 'needs_review', label: 'Review' },
  { value: 'confirmed', label: 'Done' },
];

async function loadUserSession() {
  if (!supabase) return { loadedUserId: null, loadedSession: null };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in again to review scanner sessions.');
  const raw = await appStorage.getItem(continuousScannerSessionKey(data.user.id));
  if (!raw) return { loadedUserId: data.user.id, loadedSession: null };
  const parsed = JSON.parse(raw) as ContinuousScannerSession;
  return { loadedUserId: data.user.id, loadedSession: parsed.userId === data.user.id ? parsed : null };
}

function currency(value: number | null | undefined) {
  return value === null || value === undefined ? 'Unavailable' : `$${value.toFixed(2)}`;
}

const s = StyleSheet.create({
  screen: { paddingTop: 56 },
  content: { gap: space.md },
  headerStack: { gap: space.md },
  flex: { flex: 1 },
  hero: { gap: space.md },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  filters: { gap: space.md },
  chipGroup: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  checkboxRow: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  line: { gap: space.md },
  editGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  lineFooter: { gap: space.sm },
});

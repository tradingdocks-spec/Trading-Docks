import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { TDBadge, TDButton, TDCard, TDEmptyState, TDErrorState, TDInput, TDLoadingState, TDScreen, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { supabase } from '@/lib/supabase';
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
        contentContainerStyle={s.content}
        ListHeaderComponent={(
          <View style={s.headerStack}>
            <View style={s.header}>
              <Pressable accessibilityRole="button" accessibilityLabel="Back to scanner" onPress={() => router.back()} style={s.iconButton}>
                <Ionicons name="chevron-back" size={22} color={color.text} />
              </Pressable>
              <View style={s.flex}>
                <TDText variant="label" tone="info">Session Review</TDText>
                <TDText variant="heading">{session.name}</TDText>
                <TDText variant="small" tone="muted">{scannerModeLabel(session.mode)} - local and user-scoped</TDText>
              </View>
            </View>
            <TDCard style={s.summary}>
              <Metric label="Scanned" value={String(totals?.cardsScanned ?? 0)} />
              <Metric label="Review" value={String(totals?.needsReview ?? 0)} />
              <Metric label="Market" value={currency(totals?.marketValue)} />
              <Metric label="Cash" value={currency(totals?.cashOffer)} />
              <Metric label="Trade" value={currency(totals?.tradeValue)} />
              <Metric label="No price" value={String(totals?.missingPriceItems ?? 0)} />
            </TDCard>
            <TDCard style={s.filters}>
              <TDText variant="title">Filters</TDText>
              <ChipRow label="Status" options={['all', 'suggested', 'needs_review', 'confirmed']} value={statusFilter} onSelect={(value) => setStatusFilter(value as StatusFilter)} />
              <ChipRow label="Game" options={['all', 'magic', 'pokemon', 'one_piece', 'lorcana', 'unknown']} value={gameFilter} onSelect={(value) => setGameFilter(value as GameFilter)} />
              <ChipRow label="Confidence" options={['all', 'high_confidence', 'likely', 'ambiguous', 'manual_review_required']} value={confidenceFilter} onSelect={(value) => setConfidenceFilter(value as ConfidenceFilter)} />
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: missingPriceOnly }} onPress={() => setMissingPriceOnly((value) => !value)} style={s.checkboxRow}>
                <Ionicons name={missingPriceOnly ? 'checkbox-outline' : 'square-outline'} size={22} color={color.primaryBright} />
                <TDText variant="small">Missing price only</TDText>
              </Pressable>
              <View style={s.actions}>
                <TDButton label="Bulk confirm reviewed" variant="secondary" onPress={() => setSession(bulkConfirmReviewedCards(session))} />
                <TDButton label="Undo recent" variant="secondary" disabled={!session.lines.length} onPress={() => setSession(undoMostRecentScan(session))} />
                <TDButton label="Export CSV" onPress={exportCsv} />
              </View>
              {lastExportSummary ? <TDBadge tone="success">{lastExportSummary}</TDBadge> : null}
            </TDCard>
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
    <TDCard style={s.line}>
      <View style={s.lineHeader}>
        <View style={s.flex}>
          <TDText variant="title">{line.cardName}</TDText>
          <TDText variant="caption" tone="muted">{line.game} - {line.setCode ?? 'Set unavailable'} #{line.collectorNumber ?? '?'} - {String(line.finish)}</TDText>
        </View>
        <TDBadge tone={line.reviewStatus === 'confirmed' ? 'success' : line.reviewStatus === 'needs_review' ? 'warning' : 'info'}>{line.reviewStatus.replaceAll('_', ' ')}</TDBadge>
      </View>
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
    </TDCard>
  );
}

function ChipRow({ label, options, value, onSelect }: { label: string; options: string[]; value: string; onSelect: (value: string) => void }) {
  return (
    <View style={s.chipGroup}>
      <TDText variant="label" tone="muted">{label}</TDText>
      <View style={s.chips}>
        {options.map((option) => <Chip key={option} label={option.replaceAll('_', ' ')} selected={option === value} onPress={() => onSelect(option)} />)}
      </View>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.chip, selected && s.chipSelected]}>
      <TDText variant="caption" tone={selected ? 'primary' : 'muted'}>{label}</TDText>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metric}>
      <TDText variant="caption" tone="muted">{label}</TDText>
      <TDText variant="small">{value}</TDText>
    </View>
  );
}

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
  content: { gap: space.md, paddingBottom: 128 },
  headerStack: { gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  iconButton: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center', backgroundColor: color.canvasRaised },
  flex: { flex: 1 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  metric: { minWidth: 96, flexGrow: 1, borderRadius: radius.sm, borderWidth: 1, borderColor: color.border, padding: space.sm, backgroundColor: color.canvasRaised, gap: 2 },
  filters: { gap: space.md },
  chipGroup: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: { minHeight: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { borderColor: color.primaryBright, backgroundColor: color.primary + '30' },
  checkboxRow: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  line: { gap: space.md },
  lineHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  editGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  lineFooter: { gap: space.sm },
});

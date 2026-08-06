import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TDBadge, TDButton, TDEmptyState, TDErrorState, TDIconButton, TDInput, TDLoadingState, TDScreen, TDSegmentedControl, TDSheet, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { displayCondition, displayFinish } from '@/services/collector-workspace';
import { supabase } from '@/lib/supabase';
import {
  bulkConfirmReviewedCards,
  calculateSessionTotals,
  continuousScannerSessionKey,
  defaultSessionReviewFilters,
  editScannerSessionLine,
  filterSessionReviewLines,
  formatSessionReviewMoney,
  hasAdvancedSessionFilters,
  nextReviewLine,
  removeScannerSessionLine,
  reviewedProgressLabel,
  sessionFinalizeEligibility,
  sessionGameLabel,
  sessionReviewStatusLabel,
  type ContinuousScannerSession,
  type ScannerSessionLine,
  type SessionReviewFilterState,
  type SessionReviewStatusTab,
} from '@/services/continuous-offer-scanner';
import { appStorage } from '@/services/storage/app-storage';

export default function ScannerSessionReview() {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<ContinuousScannerSession | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SessionReviewFilterState>(() => defaultSessionReviewFilters());
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadUserSession()
      .then(({ loadedUserId, loadedSession }) => {
        if (!active) return;
        setUserId(loadedUserId);
        setSession(loadedSession);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Session could not be loaded.'))
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
  const visibleLines = useMemo(() => session ? filterSessionReviewLines(session.lines, filters) : [], [filters, session]);
  const selectedLine = useMemo(() => session?.lines.find((line) => line.id === selectedLineId) ?? null, [selectedLineId, session]);
  const finalize = useMemo(() => session ? sessionFinalizeEligibility(session) : null, [session]);
  const advancedFiltersActive = hasAdvancedSessionFilters(filters);
  const nextLine = session ? nextReviewLine(session.lines) : null;
  const syncNotice = session?.lines.some((line) => line.syncState === 'failed')
    ? 'Some changes need attention before they sync.'
    : session?.lines.some((line) => line.syncState === 'pending_sync')
      ? 'Changes are waiting to sync.'
      : null;

  const finalizeSession = () => {
    if (!session || !finalize?.canFinalize) return;
    const nextSession = bulkConfirmReviewedCards(session);
    setSession(nextSession);
  };

  if (loading) return <TDScreen style={s.screen}><TDLoadingState title="Loading scanner session" message="Restoring your intake list." /></TDScreen>;
  if (error) return <TDScreen style={s.screen}><TDErrorState title="Session could not be loaded." message={error} action={<TDButton label="Back to scanner" variant="secondary" onPress={() => router.back()} />} /></TDScreen>;
  if (!session) return <TDScreen style={s.screen}><SessionEmptyState kind="no_cards" onPrimary={() => router.push('/(tabs)/scan' as never)} /></TDScreen>;

  return (
    <TDScreen style={s.screen}>
      <View style={s.shell}>
        <FlatList
          data={visibleLines}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 10, 24), paddingBottom: insets.bottom + 148 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={(
            <View style={s.headerStack}>
              <SessionReviewHeader
                title={session.name}
                filtersActive={advancedFiltersActive}
                onBack={() => router.back()}
              />
              <SessionSummary cardCount={totals?.cardsScanned ?? 0} reviewCount={totals?.needsReview ?? 0} offerTotal={totals?.cashOffer ?? null} />
              {nextLine ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Review next card. ${reviewedProgressLabel(session)}`} onPress={() => setSelectedLineId(nextLine.id)} style={s.reviewNext}>
                  <View style={s.reviewNextIcon}><Ionicons name="arrow-forward" size={18} color={color.primaryBright} /></View>
                  <View style={s.flex}>
                    <TDText variant="small">Review next</TDText>
                    <TDText variant="caption" tone="muted">{reviewedProgressLabel(session)} • {nextLine.cardName}</TDText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={color.textMuted} />
                </Pressable>
              ) : null}
              <SessionStatusTabs
                value={filters.status}
                counts={statusCounts(session.lines)}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
              {syncNotice ? (
                <View style={s.syncNotice}>
                  <Ionicons name="cloud-offline-outline" size={18} color={color.info} />
                  <TDText variant="caption" tone="muted">{syncNotice}</TDText>
                </View>
              ) : null}
            </View>
          )}
          renderItem={({ item }) => <SessionCardRow line={item} onPress={() => setSelectedLineId(item.id)} />}
          ListEmptyComponent={(
            session.lines.length
              ? <SessionEmptyState kind={filters.status === 'needs_review' && !nextLine ? 'all_reviewed' : 'no_results'} onPrimary={() => setFilters(defaultSessionReviewFilters())} />
              : <SessionEmptyState kind="no_cards" onPrimary={() => router.push('/(tabs)/scan' as never)} />
          )}
        />
        <SessionFinalizeBar
          bottomInset={insets.bottom}
          canFinalize={Boolean(finalize?.canFinalize)}
          finalizeReason={finalize?.reason ?? ''}
          onFinalize={finalizeSession}
        />
      </View>
      <CardReviewSheet
        visible={Boolean(selectedLine)}
        line={selectedLine}
        onClose={() => setSelectedLineId(null)}
        onSave={(lineId, patch, advance) => {
          const nextSession = editScannerSessionLine(session, lineId, patch);
          setSession(nextSession);
          if (advance) {
            const next = nextReviewLine(nextSession.lines.filter((line) => line.id !== lineId));
            setSelectedLineId(next?.id ?? null);
          } else {
            setSelectedLineId(null);
          }
        }}
        onRemove={(lineId) => {
          setSession(removeScannerSessionLine(session, lineId));
          setSelectedLineId(null);
        }}
      />
    </TDScreen>
  );
}

function SessionReviewHeader({ title, filtersActive, onBack }: { title: string; filtersActive: boolean; onBack: () => void }) {
  return (
    <View style={s.header}>
      <TDIconButton label="Back to scanner" iconName="chevron-back" onPress={onBack} size="sm" />
      <View style={s.headerCopy}>
        <TDText variant="label" tone="muted">Session Review</TDText>
        <TDText variant="heading" numberOfLines={1}>{title}</TDText>
      </View>
      {filtersActive ? <TDBadge tone="info">Filtered</TDBadge> : null}
    </View>
  );
}

function SessionSummary({ cardCount, reviewCount, offerTotal }: { cardCount: number; reviewCount: number; offerTotal: number | null }) {
  return (
    <View style={s.summaryRow} accessibilityLabel={`${cardCount} cards, ${reviewCount} needs review, offer ${formatSessionReviewMoney(offerTotal)}`}>
      <SummaryItem label="Cards" value={String(cardCount)} />
      <SummaryItem label="Needs review" value={String(reviewCount)} tone={reviewCount ? 'warning' : 'muted'} />
      <SummaryItem label="Offer" value={formatSessionReviewMoney(offerTotal)} tone="success" />
    </View>
  );
}

function SummaryItem({ label, value, tone = 'muted' }: { label: string; value: string; tone?: 'muted' | 'warning' | 'success' }) {
  const valueTone = tone === 'muted' ? undefined : tone;
  return (
    <View style={s.summaryItem}>
      <TDText variant="caption" tone="muted" numberOfLines={1}>{label}</TDText>
      <TDText variant="small" tone={valueTone} numberOfLines={1}>{value}</TDText>
    </View>
  );
}

function SessionStatusTabs({ value, counts, onChange }: { value: SessionReviewStatusTab; counts: Record<SessionReviewStatusTab, number>; onChange: (value: SessionReviewStatusTab) => void }) {
  const options = statusOptions.map((option) => ({
    value: option.value,
    label: counts[option.value] > 0 && option.value !== 'all' ? `${option.label} ${counts[option.value]}` : option.label,
  }));
  return <TDSegmentedControl label="Status" options={options} value={value} onChange={onChange} />;
}

function SessionCardRow({ line, onPress }: { line: ScannerSessionLine; onPress: () => void }) {
  const imageUrl = line.recognition.topCandidate?.imageUrl ?? null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Review ${line.cardName}. ${sessionReviewStatusLabel(line.reviewStatus)}. Quantity ${line.quantity}.`} onPress={onPress} style={({ pressed }) => [s.cardRow, pressed && s.pressedRow]}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={s.cardImage} contentFit="cover" /> : <View style={s.cardImageMissing}><Ionicons name="image-outline" size={22} color={color.textMuted} /></View>}
      <View style={s.cardCopy}>
        <View style={s.cardTopLine}>
          <TDText variant="title" numberOfLines={2} style={s.cardName}>{line.cardName}</TDText>
          <Ionicons name="chevron-forward" size={18} color={color.textMuted} />
        </View>
        <TDText variant="caption" tone="muted" numberOfLines={1}>{sessionGameLabel(line.game)} • {line.setCode ?? 'Set unavailable'} #{line.collectorNumber ?? '?'}</TDText>
        <TDText variant="caption" tone="muted" numberOfLines={1}>{displayCondition(line.condition)} • {displayFinish(String(line.finish) as never)}</TDText>
        <View style={s.cardValues}>
          <ValuePair label="Market" value={formatSessionReviewMoney(line.marketPrice)} />
          <ValuePair label="Offer" value={formatSessionReviewMoney(line.cashOffer)} />
        </View>
        <View style={s.cardMetaRow}>
          <TDBadge tone={line.reviewStatus === 'confirmed' ? 'success' : line.reviewStatus === 'needs_review' ? 'warning' : 'info'}>{sessionReviewStatusLabel(line.reviewStatus)}</TDBadge>
          <TDText variant="caption" tone="muted">x{line.quantity}</TDText>
        </View>
      </View>
    </Pressable>
  );
}

function ValuePair({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.valuePair}>
      <TDText variant="caption" tone="muted">{label}</TDText>
      <TDText variant="small">{value}</TDText>
    </View>
  );
}

function CardReviewSheet({ visible, line, onClose, onSave, onRemove }: { visible: boolean; line: ScannerSessionLine | null; onClose: () => void; onSave: (lineId: string, patch: Partial<ScannerSessionLine>, advance: boolean) => void; onRemove: (lineId: string) => void }) {
  const [quantity, setQuantity] = useState('1');
  const [marketPrice, setMarketPrice] = useState('');
  const [purchasePercentage, setPurchasePercentage] = useState('70');
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

  useEffect(() => {
    if (!line) return;
    setQuantity(String(line.quantity));
    setMarketPrice(line.marketPrice === null ? '' : String(line.marketPrice));
    setPurchasePercentage(String(line.purchasePercentage));
    setMoreOptionsOpen(false);
  }, [line]);

  if (!line) return null;
  const imageUrl = line.recognition.topCandidate?.imageUrl ?? null;
  const parsedQuantity = Math.max(1, Number(quantity) || 1);
  const parsedPrice = parseOptionalMoney(marketPrice);
  const parsedRate = parseOptionalPercentage(purchasePercentage) ?? line.purchasePercentage;
  const nextOffer = parsedPrice === null ? null : Math.round(parsedPrice * parsedQuantity * (parsedRate / 100) * 100) / 100;

  const save = (markReviewed: boolean) => {
    onSave(line.id, {
      quantity: parsedQuantity,
      marketPrice: parsedPrice,
      purchasePercentage: parsedRate,
      reviewStatus: markReviewed ? 'confirmed' : line.reviewStatus,
    }, markReviewed);
  };

  const confirmRemove = () => {
    Alert.alert('Remove card?', 'This removes the card from this scanner session.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onRemove(line.id) },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalScrim}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheetDock}>
          <TDSheet title="Card review" onClose={onClose} style={s.modalSheet}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetScroll}>
              <View style={s.sheetIdentity}>
                {imageUrl ? <Image source={{ uri: imageUrl }} style={s.sheetImage} contentFit="cover" /> : <View style={s.sheetImageMissing}><Ionicons name="image-outline" size={28} color={color.textMuted} /></View>}
                <View style={s.flex}>
                  <TDText variant="heading" numberOfLines={2}>{line.cardName}</TDText>
                  <TDText variant="small" tone="muted">{sessionGameLabel(line.game)} - {line.setCode ?? 'Set unavailable'} #{line.collectorNumber ?? '?'}</TDText>
                  <TDText variant="caption" tone="muted">{plainReviewCopy(line)}</TDText>
                </View>
              </View>
              <View style={s.detailGrid}>
                <TDInput label="Quantity" value={quantity} keyboardType="numeric" onChangeText={setQuantity} />
                <TDInput label="Condition" value={displayCondition(line.condition)} editable={false} />
                <TDInput label="Finish" value={displayFinish(String(line.finish) as never)} editable={false} />
                <TDInput label="Market price" value={marketPrice} keyboardType="decimal-pad" placeholder="-" onChangeText={setMarketPrice} />
                <TDInput label="Cash percentage" value={purchasePercentage} keyboardType="numeric" onChangeText={setPurchasePercentage} />
              </View>
              <View style={s.offerPanel}>
                <ValuePair label="Offer" value={formatSessionReviewMoney(nextOffer)} />
              </View>
              <TDButton label="Choose another printing" variant="secondary" disabled onPress={undefined} />
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: moreOptionsOpen }} accessibilityLabel={moreOptionsOpen ? 'Hide more card options' : 'Show more card options'} onPress={() => setMoreOptionsOpen((open) => !open)} style={s.moreOptionsToggle}>
                <TDText variant="small">More options</TDText>
                <Ionicons name={moreOptionsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={color.textMuted} />
              </Pressable>
              {moreOptionsOpen ? (
                <View style={s.moreOptionsPanel}>
                  <TDInput label="Language" value={line.language ?? '-'} editable={false} />
                </View>
              ) : null}
              <TDButton label={line.reviewStatus === 'needs_review' ? 'Save and mark reviewed' : 'Save changes'} onPress={() => save(line.reviewStatus === 'needs_review')} />
              <View style={s.destructiveZone}>
                <TDButton label="Remove card" variant="danger" onPress={confirmRemove} />
              </View>
            </ScrollView>
          </TDSheet>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
function SessionFinalizeBar({ bottomInset, canFinalize, finalizeReason, onFinalize }: { bottomInset: number; canFinalize: boolean; finalizeReason: string; onFinalize: () => void }) {
  return (
    <View style={[s.finalizeBar, { paddingBottom: Math.max(bottomInset, space.sm) }]}>
      <View style={s.finalizeAction}>
        <TDButton label="Finalize" size="sm" disabled={!canFinalize} onPress={onFinalize} />
        <TDText variant="caption" tone={canFinalize ? 'success' : 'muted'} numberOfLines={1}>{finalizeReason}</TDText>
      </View>
    </View>
  );
}

function SessionEmptyState({ kind, onPrimary }: { kind: 'no_cards' | 'no_results' | 'all_reviewed'; onPrimary: () => void }) {
  if (kind === 'all_reviewed') {
    return <TDEmptyState title="Everything is ready" message="Use the sticky Finalize action when you are ready." action={<TDButton label="View all" variant="secondary" onPress={onPrimary} />} />;
  }
  if (kind === 'no_results') {
    return <TDEmptyState title="No cards match these filters" message="Clear filters to return to the full session." action={<TDButton label="Clear filters" variant="secondary" onPress={onPrimary} />} />;
  }
  return <TDEmptyState title="No scans yet" message="Return to scanner to add cards to this session." action={<TDButton label="Return to scanner" onPress={onPrimary} />} />;
}

const statusOptions: { value: SessionReviewStatusTab; label: string }[] = [
  { value: 'needs_review', label: 'Needs review' },
  { value: 'all', label: 'All' },
  { value: 'confirmed', label: 'Done' },
];

function statusCounts(lines: ScannerSessionLine[]): Record<SessionReviewStatusTab, number> {
  return {
    all: lines.length,
    needs_review: lines.filter((line) => line.reviewStatus === 'needs_review').length,
    suggested: lines.filter((line) => line.reviewStatus === 'suggested').length,
    confirmed: lines.filter((line) => line.reviewStatus === 'confirmed').length,
  };
}

function plainReviewCopy(line: ScannerSessionLine) {
  if (line.reviewStatus === 'confirmed') return 'Card is marked reviewed.';
  return 'Confirm the printing before finalizing.';
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

function parseOptionalMoney(value: string) {
  const clean = value.trim();
  if (!clean) return null;
  const parsed = Number(clean.replace(/[$,]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseOptionalPercentage(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
}

const s = StyleSheet.create({
  screen: { paddingTop: 0 },
  shell: { flex: 1 },
  content: { gap: space.md },
  headerStack: { gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  summaryRow: { minHeight: 56, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: color.canvasRaised },
  summaryItem: { flex: 1, minWidth: 0, gap: 2 },
  reviewNext: { minHeight: 60, borderRadius: radius.lg, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.surfaceFloating },
  reviewNextIcon: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.info + '14' },
  readyNotice: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.success + '10' },
  activeFilters: { minHeight: 42, borderRadius: radius.md, paddingHorizontal: space.sm, paddingVertical: space.xs, flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: color.canvasRaised },
  syncNotice: { borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, backgroundColor: color.info + '10' },
  cardRow: { minHeight: 132, flexDirection: 'row', gap: space.sm, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.border },
  pressedRow: { opacity: 0.82 },
  cardImage: { width: 58, height: 82, borderRadius: radius.sm, backgroundColor: color.surface },
  cardImageMissing: { width: 58, height: 82, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  cardCopy: { flex: 1, minWidth: 0, gap: space.xs },
  cardTopLine: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  cardName: { flex: 1, minWidth: 0 },
  cardValues: { flexDirection: 'row', gap: space.lg, paddingTop: space.xs },
  valuePair: { minWidth: 84, gap: 1 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  modalScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000080' },
  sheetDock: { justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '88%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  sheetScroll: { gap: space.md, paddingBottom: space.lg },
  filterGroup: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  checkboxRow: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  sheetIdentity: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  sheetImage: { width: 86, height: 120, borderRadius: radius.md, backgroundColor: color.surface },
  sheetImageMissing: { width: 86, height: 120, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  offerPanel: { gap: space.xs, borderRadius: radius.md, padding: space.md, backgroundColor: color.canvasRaised },
  moreOptionsToggle: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: color.surface },
  moreOptionsPanel: { gap: space.sm, borderRadius: radius.md, padding: space.md, backgroundColor: color.canvasRaised },
  destructiveZone: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: space.md },
  finalizeBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 76, borderTopWidth: 1, borderTopColor: color.borderStrong, paddingHorizontal: space.md, paddingTop: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.canvas + 'F4' },
  finalizeAction: { flex: 1, gap: 2 },
});

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TDBadge, TDButton, TDEmptyState, TDErrorState, TDIconButton, TDInput, TDLoadingState, TDScreen, TDSegmentedControl, TDSheet, TDText } from '@/components/design-system';
import { PrintingSelectorSheet } from '@/components/scanner/printing-selector-sheet';
import { color, radius, space } from '@/design';
import { useAccount } from '@/providers/account';
import { displayCondition, displayFinish } from '@/services/collector-workspace';
import { finishLabel, supportedVisibleFinishes } from '@/services/exact-printing-recognition';
import { supabase } from '@/lib/supabase';
import { addScannerCardsToMobileDeck, loadMobileDeckVault, type DeckRecord } from '@/services/mobile-deck-vault';
import {
  applyScannerDestinationPreference,
  buildScannerCollectionConfirmation,
  buildScannerDestinationPreference,
  bulkUpdateSessionLines,
  calculateSessionTotals,
  cardShowOfferPreview,
  continuousScannerSessionKey,
  defaultSessionReviewFilters,
  editScannerSessionLine,
  filterSessionReviewLines,
  formatSessionReviewMoney,
  readySessionLines,
  removeScannerSessionLine,
  scannerDestinationLabel,
  sessionFinalizeEligibility,
  sessionGameLabel,
  sessionReviewStatusLabel,
  destinationSyncStatusLabel,
  updateCardShowOfferRate,
  updateScannerSessionLineFinish,
  updateScannerSessionLinePrinting,
  updateSessionLineDestinationSync,
  type ContinuousScannerSession,
  type ScannerDestinationType,
  type ScannerSessionLine,
  type SessionReviewFilterState,
} from '@/services/continuous-offer-scanner';
import { loadScannerContext, saveScannerConfirmation } from '@/services/scanner-data';
import { selectScryfallScannerPrice } from '@/services/scanner-price-enrichment';
import { loadStorageLocationManager } from '@/services/storage-location-data';
import type { LocationSummary } from '@/services/storage-location-manager';
import { appStorage } from '@/services/storage/app-storage';

export default function ScannerSessionReview() {
  const insets = useSafeAreaInsets();
  const { accountType } = useAccount();
  const [session, setSession] = useState<ContinuousScannerSession | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SessionReviewFilterState>(() => defaultSessionReviewFilters());
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [decks, setDecks] = useState<DeckRecord[]>([]);
  const [storageLocations, setStorageLocations] = useState<LocationSummary[]>([]);
  const [destinationsLoading, setDestinationsLoading] = useState(true);
  const [destinationPicker, setDestinationPicker] = useState<null | { kind: 'deck' | 'storage_location'; lineIds: string[] }>(null);

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
    let active = true;
    void Promise.allSettled([loadMobileDeckVault(), loadStorageLocationManager()]).then(([deckResult, storageResult]) => {
      if (!active) return;
      if (deckResult.status === 'fulfilled') setDecks(deckResult.value.decks);
      if (storageResult.status === 'fulfilled') setStorageLocations(storageResult.value.summaries);
      setDestinationsLoading(false);
    });
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
  const readyCardCount = session ? readySessionLines(session.lines).reduce((sum, line) => sum + line.quantity, 0) : 0;
  const reviewCardCount = session ? session.lines.filter((line) => line.reviewStatus === 'needs_review').reduce((sum, line) => sum + line.quantity, 0) : 0;
  const destinationSummary = useMemo(() => session ? summarizeSessionDestinations(session.lines) : null, [session]);
  const syncNotice = session?.lines.some((line) => line.destinationSyncState === 'action_required')
    ? 'Some deck assignments need retry.'
    : session?.lines.some((line) => line.syncState === 'failed')
      ? 'Some changes need attention before they sync.'
    : session?.lines.some((line) => line.syncState === 'pending_sync')
      ? 'Changes are waiting to sync.'
      : null;
  const selectedLines = session?.lines.filter((line) => selectedLineIds.includes(line.id)) ?? [];
  const selectedCardCount = selectedLines.reduce((sum, line) => sum + line.quantity, 0);
  const selectedReadyCardCount = selectedLines.filter((line) => line.reviewStatus !== 'needs_review').reduce((sum, line) => sum + line.quantity, 0);

  const finalizeSession = async () => {
    if (!session || !finalize?.canFinalize || !userId || finalizing) return;
    setFinalizing(true);
    setSyncError(null);
    const confirmedSession: ContinuousScannerSession = {
      ...session,
      lines: session.lines.map((line) => line.reviewStatus === 'needs_review' ? line : { ...line, reviewStatus: 'confirmed' as const }),
    };
    setSession(confirmedSession);
    try {
      const context = await loadScannerContext();
      if (context.userId !== userId) throw new Error('Sign in again to sync this scanner session.');
      let runningTotal = context.currentTotalQuantity;
      let nextSession = confirmedSession;
      const deckFailures: string[] = [];
      const deckBatches = new Map<string, ScannerSessionLine[]>();
      for (const line of readySessionLines(confirmedSession.lines)) {
        const confirmation = buildScannerCollectionConfirmation(line, userId);
        if (!confirmation) continue;
        const result = await saveScannerConfirmation({
          confirmation,
          membershipTier: accountType,
          currentTotalQuantity: runningTotal,
        });
        if (!result.ok) {
          nextSession = updateSessionLineDestinationSync(nextSession, line.id, {
            syncState: 'failed',
            destinationSyncState: 'failed',
            destinationSyncError: result.error,
          });
          deckFailures.push(result.error);
          continue;
        }

        runningTotal += confirmation.quantity;
        nextSession = updateSessionLineDestinationSync(nextSession, line.id, {
          syncState: result.queued ? 'pending_sync' : 'synced',
          destinationSyncState: result.queued ? 'pending_sync' : 'synced',
          destinationSyncError: null,
        });

        if (line.destination === 'deck' && line.deckId && !result.queued) {
          const batch = deckBatches.get(line.deckId) ?? [];
          batch.push(line);
          deckBatches.set(line.deckId, batch);
        }
      }
      for (const [deckId, lines] of deckBatches) {
        const deckResult = await addScannerCardsToMobileDeck({
          deckId,
          deckName: lines[0]?.deckName ?? null,
          lines,
        });
        deckResult.forEach((outcome, index) => {
          const line = lines[index];
          if (!line) return;
          if (outcome.ok) {
            nextSession = updateSessionLineDestinationSync(nextSession, line.id, {
              destinationSyncState: 'synced',
              destinationSyncError: null,
            });
            return;
          }
          nextSession = updateSessionLineDestinationSync(nextSession, line.id, {
            destinationSyncState: 'action_required',
            destinationSyncError: outcome.error,
          });
          deckFailures.push(outcome.error);
        });
      }
      if (deckFailures.length) setSyncError(deckFailures.join(' '));
      setSession(nextSession);
    } catch (finalizeError) {
      setSyncError(finalizeError instanceof Error ? finalizeError.message : 'Scanner session sync failed.');
    } finally {
      setFinalizing(false);
    }
  };

  const clearSelection = () => setSelectedLineIds([]);
  const toggleSelectedLine = (lineId: string) => {
    setSelectedLineIds((current) => current.includes(lineId) ? current.filter((item) => item !== lineId) : [...current, lineId]);
  };
  const selectAllVisible = () => setSelectedLineIds(visibleLines.map((line) => line.id));

  const updateSelectedLines = (patch: Parameters<typeof bulkUpdateSessionLines>[2]) => {
    if (!session || !selectedLineIds.length) return;
    setSession(bulkUpdateSessionLines(session, selectedLineIds, patch));
  };

  const assignCollection = () => updateSelectedLines({
    destination: 'collection',
    storageLocationId: null,
    binderId: null,
    binderPage: null,
    binderSlot: null,
    deckId: null,
    deckName: null,
    condition: selectedLines[0]?.condition ?? 'near_mint',
    finish: selectedLines[0]?.finish ?? 'normal',
    tradeStatus: selectedLines[0]?.tradeStatus ?? 'not_for_trade',
  });
  const assignTradeBinder = () => updateSelectedLines({
    destination: 'trade_binder',
    storageLocationId: null,
    binderId: null,
    binderPage: null,
    binderSlot: null,
    deckId: null,
    deckName: null,
    condition: selectedLines[0]?.condition ?? 'near_mint',
    finish: selectedLines[0]?.finish ?? 'normal',
    tradeStatus: 'available',
  });

  if (loading) return <TDScreen style={s.screen}><TDLoadingState title="Loading scanner session" message="Restoring your intake list." /></TDScreen>;
  if (error) return <TDScreen style={s.screen}><TDErrorState title="Session could not be loaded." message={error} action={<TDButton label="Back to scanner" variant="secondary" onPress={() => router.back()} />} /></TDScreen>;
  if (!session) return <TDScreen style={s.screen}><SessionEmptyState kind="no_cards" onPrimary={() => router.push('/(tabs)/scan' as never)} /></TDScreen>;

  return (
    <TDScreen style={s.screen}>
      <View style={s.shell}>
        <FlatList
          data={visibleLines}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[s.content, { paddingTop: Math.max(insets.top + 10, 24), paddingBottom: insets.bottom + 164 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={(
            <View style={s.headerStack}>
              <SessionReviewHeader
                cardCount={totals?.cardsScanned ?? 0}
                readyCount={readyCardCount}
                reviewCount={reviewCardCount}
                selectedCount={selectedCardCount}
                onBack={() => router.back()}
                onSelectAll={selectAllVisible}
                onClearSelection={clearSelection}
              />
              <SessionSummary
                cardCount={totals?.cardsScanned ?? 0}
                readyCount={readyCardCount}
                reviewCount={reviewCardCount}
                offerTotal={totals?.cashOffer ?? null}
              />
              <SessionDestinationPanel
                session={session}
                onDestinationChange={(destination) => setSession(applyScannerDestinationPreference(session, buildScannerDestinationPreference({ destination })))}
                onOfferRateChange={(rate) => setSession(updateCardShowOfferRate(session, rate))}
              />
              <SessionStatusTabs value={filters.status} onChange={(status) => setFilters((current) => ({ ...current, status }))} />
              <SessionBatchActions
                selectedCount={selectedLineIds.length}
                totalCount={visibleLines.length}
                onAssignCollection={assignCollection}
                onAssignTradeBinder={assignTradeBinder}
                onAssignDeck={() => setDestinationPicker({ kind: 'deck', lineIds: selectedLineIds.slice() })}
                onAssignStorage={() => setDestinationPicker({ kind: 'storage_location', lineIds: selectedLineIds.slice() })}
                onSelectAll={selectAllVisible}
                onClear={clearSelection}
              />
              <SessionDestinationSummary summary={destinationSummary} reviewCount={reviewCardCount} readyCount={readyCardCount} />
              {syncNotice ? <SessionNotice tone="info" icon="cloud-offline-outline" message={syncNotice} /> : null}
              {syncError ? <SessionNotice tone="warning" icon="alert-circle-outline" message={syncError} /> : null}
            </View>
          )}
          renderItem={({ item }) => (
            <SessionCardRow
              line={item}
              storageLocations={storageLocations}
              selected={selectedLineIds.includes(item.id)}
              onPress={() => (selectedLineIds.length ? toggleSelectedLine(item.id) : setSelectedLineId(item.id))}
              onToggleSelect={() => toggleSelectedLine(item.id)}
            />
          )}
          ListEmptyComponent={(
            session.lines.length
              ? <SessionEmptyState kind="no_results" onPrimary={() => setSelectedLineIds([])} />
              : <SessionEmptyState kind="no_cards" onPrimary={() => router.push('/(tabs)/scan' as never)} />
          )}
        />
        {selectedLineIds.length > 0 ? (
          <SessionBulkBar
            count={selectedCardCount}
            readyCount={selectedReadyCardCount}
            onAssignCollection={assignCollection}
            onAssignTradeBinder={assignTradeBinder}
            onAssignDeck={() => setDestinationPicker({ kind: 'deck', lineIds: selectedLineIds.slice() })}
            onAssignStorage={() => setDestinationPicker({ kind: 'storage_location', lineIds: selectedLineIds.slice() })}
            onClear={clearSelection}
          />
        ) : null}
        <SessionFinalizeBar
          bottomInset={insets.bottom}
          canFinalize={Boolean(finalize?.canFinalize)}
          finalizeReason={finalize?.reason ?? ''}
          destinationSummary={destinationSummary}
          readyCount={readyCardCount}
          reviewCount={reviewCardCount}
          finalizing={finalizing}
          onFinalize={finalizeSession}
        />
      </View>
      <CardReviewSheet
        visible={Boolean(selectedLine)}
        line={selectedLine}
        onClose={() => setSelectedLineId(null)}
        onSave={(lineId, patch) => {
          if (!session) return;
          setSession(editScannerSessionLine(session, lineId, patch));
        }}
        onRemove={(lineId) => {
          if (!session) return;
          setSession(removeScannerSessionLine(session, lineId));
          setSelectedLineId(null);
        }}
      />
      <DestinationPickerSheet
        visible={Boolean(destinationPicker)}
        kind={destinationPicker?.kind ?? 'deck'}
        decks={decks}
        locations={storageLocations}
        loading={destinationsLoading}
        onClose={() => setDestinationPicker(null)}
        onDeckSelect={(deck) => {
          if (!session || !destinationPicker) return;
          setSession(bulkUpdateSessionLines(session, destinationPicker.lineIds, {
            destination: 'deck',
            storageLocationId: null,
            binderId: null,
            binderPage: null,
            binderSlot: null,
            deckId: deck.id,
            deckName: deck.name,
            condition: selectedLines[0]?.condition ?? 'near_mint',
            finish: selectedLines[0]?.finish ?? 'normal',
            tradeStatus: selectedLines[0]?.tradeStatus ?? 'not_for_trade',
          }));
          setDestinationPicker(null);
        }}
        onLocationSelect={(location) => {
          if (!session || !destinationPicker) return;
          setSession(bulkUpdateSessionLines(session, destinationPicker.lineIds, {
            destination: 'storage_location',
            storageLocationId: location.id,
            binderId: null,
            binderPage: null,
            binderSlot: null,
            deckId: null,
            deckName: null,
            condition: selectedLines[0]?.condition ?? 'near_mint',
            finish: selectedLines[0]?.finish ?? 'normal',
            tradeStatus: selectedLines[0]?.tradeStatus ?? 'not_for_trade',
          }));
          setDestinationPicker(null);
        }}
      />
    </TDScreen>
  );
}

function SessionReviewHeader({
  cardCount,
  readyCount,
  reviewCount,
  selectedCount,
  onBack,
  onSelectAll,
  onClearSelection,
}: {
  cardCount: number;
  readyCount: number;
  reviewCount: number;
  selectedCount: number;
  onBack: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}) {
  return (
    <View style={s.header}>
      <TDIconButton label="Back to scanner" iconName="chevron-back" onPress={onBack} size="sm" />
      <View style={s.headerCopy}>
        <TDText variant="heading" numberOfLines={1}>Scanner session</TDText>
        <TDText variant="small" tone="muted" numberOfLines={1}>{`Session • ${cardCount} cards`}</TDText>
      </View>
      {selectedCount > 0 ? <TDBadge tone="info">{selectedCount} selected</TDBadge> : <TDBadge tone={reviewCount ? 'warning' : 'success'}>{readyCount} ready</TDBadge>}
      <View style={s.headerActions}>
        <TDButton label="Select all" size="sm" variant="secondary" onPress={onSelectAll} />
        <TDButton label="Clear" size="sm" variant="secondary" onPress={onClearSelection} />
      </View>
    </View>
  );
}

function SessionSummary({
  cardCount,
  readyCount,
  reviewCount,
  offerTotal,
}: {
  cardCount: number;
  readyCount: number;
  reviewCount: number;
  offerTotal: number | null;
}) {
  return (
    <View style={s.summaryRow} accessibilityLabel={`${cardCount} cards, ${readyCount} ready, ${reviewCount} need review, offer ${formatSessionReviewMoney(offerTotal)}`}>
      <SummaryItem label="Cards" value={String(cardCount)} />
      <SummaryItem label="Ready" value={String(readyCount)} tone={readyCount ? 'success' : 'muted'} />
      <SummaryItem label="Review" value={String(reviewCount)} tone={reviewCount ? 'warning' : 'muted'} />
      <SummaryItem label="Offer" value={formatSessionReviewMoney(offerTotal)} tone="success" />
    </View>
  );
}

function SessionStatusTabs({
  value,
  onChange,
}: {
  value: SessionReviewFilterState['status'];
  onChange: (value: SessionReviewFilterState['status']) => void;
}) {
  return (
    <TDSegmentedControl
      label="Status"
      value={value}
      options={statusOptions}
      onChange={onChange}
    />
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

function SessionDestinationPanel({
  session,
  onDestinationChange,
  onOfferRateChange,
}: {
  session: ContinuousScannerSession;
  onDestinationChange: (destination: ScannerDestinationType) => void;
  onOfferRateChange: (rate: number) => void;
}) {
  const [rateText, setRateText] = useState(String(session.offerConfig.defaultCashPercentage));
  useEffect(() => setRateText(String(session.offerConfig.defaultCashPercentage)), [session.offerConfig.defaultCashPercentage]);
  const previewLine = session.lines.find((line) => line.marketPrice !== null) ?? session.lines[0] ?? null;
  const preview = cardShowOfferPreview({
    marketPrice: previewLine?.marketPrice ?? null,
    quantity: previewLine?.quantity ?? 1,
    offerRate: Number(rateText),
  });
  return (
    <View style={s.destinationPanel}>
      <View style={s.destinationHeader}>
        <View style={s.flex}>
          <TDText variant="small">Scan into: {scannerDestinationLabel(session.defaultDestination)}</TDText>
          <TDText variant="caption" tone="muted">New scans inherit this destination until changed.</TDText>
        </View>
        <TDBadge tone={session.mode === 'card_show_purchase' ? 'success' : 'info'}>{session.mode === 'card_show_purchase' ? 'Card Show' : 'Session'}</TDBadge>
      </View>
      <View style={s.destinationButtons}>
        {(['collection', 'trade_binder', 'deck', 'storage_location'] as ScannerDestinationType[]).map((destination) => (
          <TDButton
            key={destination}
            label={scannerDestinationLabel(destination)}
            size="sm"
            variant={session.defaultDestination === destination ? 'primary' : 'secondary'}
            onPress={() => onDestinationChange(destination)}
          />
        ))}
      </View>
      <View style={s.cardShowPanel}>
        <View style={s.flex}>
          <TDText variant="small">Card Show Mode</TDText>
          <TDText variant="caption" tone="muted">{preview.marketLabel} - Offer @ {preview.rate}%: {preview.offerLabel}</TDText>
        </View>
        <TDInput
          label="Offer %"
          value={rateText}
          keyboardType="numeric"
          onChangeText={(value) => {
            setRateText(value);
            const parsed = Number(value);
            if (Number.isFinite(parsed)) onOfferRateChange(parsed);
          }}
          containerStyle={s.rateInput}
        />
      </View>
    </View>
  );
}

function SessionBatchActions({
  selectedCount,
  totalCount,
  onAssignCollection,
  onAssignTradeBinder,
  onAssignDeck,
  onAssignStorage,
  onSelectAll,
  onClear,
}: {
  selectedCount: number;
  totalCount: number;
  onAssignCollection: () => void;
  onAssignTradeBinder: () => void;
  onAssignDeck: () => void;
  onAssignStorage: () => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  return (
    <View style={s.batchActions}>
      <TDText variant="caption" tone="muted">{selectedCount ? `${selectedCount} selected` : `${totalCount} visible`}</TDText>
      <View style={s.batchButtons}>
        <TDButton label="Select all" size="sm" variant="secondary" onPress={onSelectAll} />
        <TDButton label="Collection" size="sm" variant="secondary" onPress={onAssignCollection} />
        <TDButton label="Trade Binder" size="sm" variant="secondary" onPress={onAssignTradeBinder} />
        <TDButton label="Deck" size="sm" variant="secondary" onPress={onAssignDeck} />
        <TDButton label="Storage" size="sm" variant="secondary" onPress={onAssignStorage} />
        <TDButton label="Clear" size="sm" variant="secondary" onPress={onClear} />
      </View>
    </View>
  );
}

type SessionDestinationSummaryModel = {
  collection: number;
  tradeBinder: number;
  deck: number;
  storage: number;
};

function summarizeSessionDestinations(lines: ScannerSessionLine[]): SessionDestinationSummaryModel {
  return lines.reduce((summary, line) => {
    if (line.reviewStatus === 'needs_review') return summary;
    const quantity = Math.max(1, line.quantity);
    if (line.destination === 'collection') summary.collection += quantity;
    else if (line.destination === 'trade_binder') summary.tradeBinder += quantity;
    else if (line.destination === 'deck') summary.deck += quantity;
    else if (line.destination === 'storage_location') summary.storage += quantity;
    return summary;
  }, { collection: 0, tradeBinder: 0, deck: 0, storage: 0 });
}

function SessionCardRow({
  line,
  storageLocations,
  selected,
  onPress,
  onToggleSelect,
}: {
  line: ScannerSessionLine;
  storageLocations: LocationSummary[];
  selected: boolean;
  onPress: () => void;
  onToggleSelect: () => void;
}) {
  const imageUrl = line.recognition.topCandidate?.imageUrl ?? null;
  const destination = destinationLabelForLine(line, storageLocations);
  const destinationSyncTone = line.destinationSyncState === 'action_required' || line.destinationSyncState === 'failed'
    ? 'warning'
    : line.destinationSyncState === 'pending_sync'
      ? 'info'
      : 'success';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${line.cardName}. ${sessionReviewStatusLabel(line.reviewStatus)}. ${destination}. ${destinationSyncStatusLabel(line.destinationSyncState)}.`}
      onLongPress={onToggleSelect}
      onPress={onPress}
      style={({ pressed }) => [s.cardRow, selected && s.cardRowSelected, pressed && s.pressedRow]}
    >
      <View style={s.cardRowLead}>
        {selected ? <Ionicons name="checkbox" size={20} color={color.primaryBright} /> : <Ionicons name="square-outline" size={20} color={color.textMuted} />}
        {imageUrl ? <Image source={{ uri: imageUrl }} style={s.cardImage} contentFit="cover" /> : <View style={s.cardImageMissing}><Ionicons name="image-outline" size={22} color={color.textMuted} /></View>}
      </View>
      <View style={s.cardCopy}>
        <View style={s.cardTopLine}>
          <TDText variant="title" numberOfLines={1} style={s.cardName}>{line.cardName}</TDText>
          <View style={s.cardBadges}>
            <TDBadge tone="info">{destination}</TDBadge>
            {line.destinationSyncState !== 'local_only' ? <TDBadge tone={destinationSyncTone}>{destinationSyncStatusLabel(line.destinationSyncState)}</TDBadge> : null}
          </View>
        </View>
        <TDText variant="caption" tone="muted" numberOfLines={1}>{sessionGameLabel(line.game)} • {line.setCode ?? 'Set unavailable'} • #{line.collectorNumber ?? '?'}</TDText>
        <TDText variant="caption" tone="muted" numberOfLines={1}>{displayCondition(line.condition)} • {displayFinish(String(line.finish) as never)} • x{line.quantity}</TDText>
        <View style={s.cardValues}>
          <ValuePair label="Market" value={formatReviewLineMoney(line.marketPrice, line.priceSource)} />
          <ValuePair label="Offer" value={formatSessionReviewMoney(line.cashOffer)} />
          <ValuePair label="Status" value={sessionReviewStatusLabel(line.reviewStatus)} />
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

function SessionNotice({ tone, icon, message }: { tone: 'info' | 'warning'; icon: keyof typeof Ionicons.glyphMap; message: string }) {
  const iconColor = tone === 'warning' ? color.warning : color.info;
  return (
    <View style={s.syncNotice}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <TDText variant="caption" tone={tone === 'warning' ? 'warning' : 'muted'}>{message}</TDText>
    </View>
  );
}

function SessionBulkBar({
  count,
  readyCount,
  onAssignCollection,
  onAssignTradeBinder,
  onAssignDeck,
  onAssignStorage,
  onClear,
}: {
  count: number;
  readyCount: number;
  onAssignCollection: () => void;
  onAssignTradeBinder: () => void;
  onAssignDeck: () => void;
  onAssignStorage: () => void;
  onClear: () => void;
}) {
  return (
    <View style={s.bulkBar}>
      <TDText variant="small">{count} selected, {readyCount} ready</TDText>
      <View style={s.bulkBarActions}>
        <TDButton label="Collection" size="sm" variant="secondary" onPress={onAssignCollection} />
        <TDButton label="Trade Binder" size="sm" variant="secondary" onPress={onAssignTradeBinder} />
        <TDButton label="Deck" size="sm" variant="secondary" onPress={onAssignDeck} />
        <TDButton label="Storage" size="sm" variant="secondary" onPress={onAssignStorage} />
        <TDButton label="Clear" size="sm" variant="secondary" onPress={onClear} />
      </View>
    </View>
  );
}

function SessionDestinationSummary({
  summary,
  readyCount,
  reviewCount,
}: {
  summary: SessionDestinationSummaryModel | null;
  readyCount: number;
  reviewCount: number;
}) {
  if (!summary) return null;
  return (
    <View style={s.destinationSummary}>
      <TDText variant="small">{`${readyCount} cards ready`}</TDText>
      <View style={s.finalizeSummaryGrid}>
        <SummaryItem label="Collection" value={String(summary.collection)} />
        <SummaryItem label="Trade Binder" value={String(summary.tradeBinder)} />
        <SummaryItem label="Decks" value={String(summary.deck)} />
        <SummaryItem label="Storage" value={String(summary.storage)} />
        <SummaryItem label="Needs review" value={String(reviewCount)} tone={reviewCount ? 'warning' : 'muted'} />
      </View>
    </View>
  );
}

function SessionFinalizeBar({
  bottomInset,
  canFinalize,
  finalizeReason,
  destinationSummary,
  readyCount,
  reviewCount,
  finalizing,
  onFinalize,
}: {
  bottomInset: number;
  canFinalize: boolean;
  finalizeReason: string;
  destinationSummary: SessionDestinationSummaryModel | null;
  readyCount: number;
  reviewCount: number;
  finalizing: boolean;
  onFinalize: () => void;
}) {
  return (
    <View style={[s.finalizeBar, { paddingBottom: Math.max(bottomInset, space.sm) }]}>
      <View style={s.finalizeAction}>
        <TDText variant="small">{`${readyCount} ready cards`}</TDText>
        {destinationSummary ? (
          <View style={s.finalizeSummaryWrap}>
            <SessionDestinationSummary summary={destinationSummary} readyCount={readyCount} reviewCount={reviewCount} />
          </View>
        ) : null}
        <TDButton label={`Store ${readyCount} ready cards`} size="sm" loading={finalizing} disabled={!canFinalize || finalizing} onPress={onFinalize} />
        <TDText variant="caption" tone={canFinalize ? 'success' : 'muted'} numberOfLines={1}>{finalizeReason}</TDText>
      </View>
    </View>
  );
}

function SessionEmptyState({ kind, onPrimary }: { kind: 'no_cards' | 'no_results' | 'all_reviewed'; onPrimary: () => void }) {
  if (kind === 'all_reviewed') {
    return <TDEmptyState title="Everything is ready" message="Use Store ready cards to sync the ready subset." action={<TDButton label="View all" variant="secondary" onPress={onPrimary} />} />;
  }
  if (kind === 'no_results') {
    return <TDEmptyState title="No cards match these filters" message="Clear filters to return to the full session." action={<TDButton label="Clear filters" variant="secondary" onPress={onPrimary} />} />;
  }
  return <TDEmptyState title="No scans yet" message="Return to scanner to add cards to this session." action={<TDButton label="Return to scanner" onPress={onPrimary} />} />;
}

function DestinationPickerSheet({
  visible,
  kind,
  decks,
  locations,
  loading,
  onClose,
  onDeckSelect,
  onLocationSelect,
}: {
  visible: boolean;
  kind: 'deck' | 'storage_location';
  decks: DeckRecord[];
  locations: LocationSummary[];
  loading: boolean;
  onClose: () => void;
  onDeckSelect: (deck: DeckRecord) => void;
  onLocationSelect: (location: LocationSummary) => void;
}) {
  if (!visible) return null;
  return (
    <TDSheet title={kind === 'deck' ? 'Choose deck' : 'Choose storage'} onClose={onClose} style={s.modalSheet}>
      {loading ? <TDLoadingState title="Loading destinations" message="Fetching your saved decks and storage locations." /> : null}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetScroll}>
        {kind === 'deck' ? (
          decks.length ? decks.map((deck) => (
            <Pressable key={deck.id} accessibilityRole="button" onPress={() => onDeckSelect(deck)} style={({ pressed }) => [s.pickerRow, pressed && s.pressedRow]}>
              <View style={s.flex}>
                <TDText variant="small">{deck.name}</TDText>
                <TDText variant="caption" tone="muted">{deck.format ?? 'Format unavailable'} • {deck.cardCount} cards</TDText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={color.textMuted} />
            </Pressable>
          )) : <TDEmptyState title="No saved decks" message="Deck Vault must contain saved decks before you can assign one." />
        ) : (
          locations.length ? locations.map((location) => (
            <Pressable key={location.id} accessibilityRole="button" onPress={() => onLocationSelect(location)} style={({ pressed }) => [s.pickerRow, pressed && s.pressedRow]}>
              <View style={s.flex}>
                <TDText variant="small">{location.name}</TDText>
                <TDText variant="caption" tone="muted">{location.path.label} • {location.type}</TDText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={color.textMuted} />
            </Pressable>
          )) : <TDEmptyState title="No storage locations" message="Create storage locations before assigning scanned cards." />
        )}
      </ScrollView>
    </TDSheet>
  );
}

function CardReviewSheet({
  visible,
  line,
  onClose,
  onSave,
  onRemove,
}: {
  visible: boolean;
  line: ScannerSessionLine | null;
  onClose: () => void;
  onSave: (lineId: string, patch: Partial<ScannerSessionLine>) => void;
  onRemove: (lineId: string) => void;
}) {
  const [quantity, setQuantity] = useState('1');
  const [marketPrice, setMarketPrice] = useState('');
  const [purchasePercentage, setPurchasePercentage] = useState('70');
  const [printingSelectorOpen, setPrintingSelectorOpen] = useState(false);
  const [removeArmed, setRemoveArmed] = useState(false);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!line) return;
    setQuantity(String(line.quantity));
    setMarketPrice(line.marketPrice === null ? '' : String(line.marketPrice));
    setPurchasePercentage(String(line.purchasePercentage));
    setPrintingSelectorOpen(false);
    setRemoveArmed(false);
  }, [line]);

  if (!line) return null;
  const imageUrl = line.recognition.topCandidate?.imageUrl ?? null;
  const activeCandidate = line.recognition.topThree.find((candidate) => candidate.id === line.exactPrintingId) ?? line.recognition.topCandidate;
  const supportedFinishes = activeCandidate ? supportedVisibleFinishes(activeCandidate) : [];
  const parsedQuantity = Math.max(1, Number(quantity) || 1);
  const parsedPrice = parseOptionalMoney(marketPrice);
  const parsedRate = parseOptionalPercentage(purchasePercentage) ?? line.purchasePercentage;

  const save = (markReviewed: boolean) => {
    onSave(line.id, {
      quantity: parsedQuantity,
      marketPrice: parsedPrice,
      purchasePercentage: parsedRate,
      reviewStatus: markReviewed ? 'confirmed' : line.reviewStatus,
    });
  };

  const handleRemovePress = () => {
    if (removeArmed) {
      onRemove(line.id);
      return;
    }
    setRemoveArmed(true);
    if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    removeTimerRef.current = setTimeout(() => {
      setRemoveArmed(false);
      removeTimerRef.current = null;
    }, 1800);
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
                  <TDText variant="caption" tone="muted">{displayCondition(line.condition)}</TDText>
                  <View style={s.reviewPills}>
                    <TDBadge tone={line.reviewStatus === 'confirmed' ? 'success' : line.reviewStatus === 'needs_review' ? 'warning' : 'info'}>{sessionReviewStatusLabel(line.reviewStatus)}</TDBadge>
                    <TDBadge tone="info">x{line.quantity}</TDBadge>
                    <TDBadge tone="info">{displayFinish(String(line.finish) as never)}</TDBadge>
                  </View>
                </View>
              </View>
              <View style={s.detailGrid}>
                <TDInput label="Quantity" value={quantity} keyboardType="numeric" onChangeText={setQuantity} />
                <TDInput label="Market price" value={marketPrice} keyboardType="decimal-pad" onChangeText={setMarketPrice} />
                <TDInput label="Cash percentage" value={purchasePercentage} keyboardType="numeric" onChangeText={setPurchasePercentage} />
                <TDInput label="Condition" value={displayCondition(line.condition)} editable={false} />
              </View>
              {supportedFinishes.length ? (
                <View style={s.finishControlBlock}>
                  <TDText variant="caption" tone="muted">Finish</TDText>
                  <View style={s.finishControl}>
                    {supportedFinishes.map((finish) => (
                      <Pressable
                        key={finish}
                        accessibilityRole="button"
                        accessibilityState={{ selected: line.finish === finish }}
                        accessibilityLabel={`Use ${finishLabel(finish)} finish`}
                        onPress={() => {
                          const result = updateScannerSessionLineFinish(lineSessionShell(line), line.id, finish);
                          const updatedLine = result.session.lines[0];
                          setMarketPrice(updatedLine.marketPrice === null ? '' : String(updatedLine.marketPrice));
                          onSave(line.id, {
                            finish,
                            marketPrice: updatedLine.marketPrice,
                            priceSource: updatedLine.priceSource,
                            priceTimestamp: updatedLine.priceTimestamp,
                          });
                        }}
                        style={[s.finishButton, line.finish === finish && s.finishButtonActive]}
                      >
                        <TDText variant="caption" tone={line.finish === finish ? 'primary' : 'muted'}>{finishLabel(finish)}</TDText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              <View style={s.offerPanel}>
                <ValuePair label="Offer" value={formatSessionReviewMoney(parsedPrice === null ? null : Math.round(parsedPrice * parsedQuantity * (parsedRate / 100) * 100) / 100)} />
              </View>
              <TDButton label="View other printings" variant="secondary" disabled={!activeCandidate} onPress={() => setPrintingSelectorOpen(true)} />
              <TDButton label={line.reviewStatus === 'needs_review' ? 'Save and next' : 'Save changes'} onPress={() => save(line.reviewStatus === 'needs_review')} />
              <View style={s.compactDestructiveZone}>
                <TDButton label={removeArmed ? 'Tap again to remove' : 'Remove card'} variant="danger" onPress={handleRemovePress} />
              </View>
            </ScrollView>
          </TDSheet>
        </KeyboardAvoidingView>
      </View>
      <PrintingSelectorSheet
        visible={printingSelectorOpen}
        currentCandidate={activeCandidate ?? null}
        currentFinish={String(line.finish)}
        onClose={() => setPrintingSelectorOpen(false)}
        onSelect={(candidate, finish, fallbackMessage) => {
          const result = updateScannerSessionLinePrinting(lineSessionShell(line), line.id, candidate);
          const updatedLine = result.session.lines[0];
          const price = selectScryfallScannerPrice(candidate, finish);
          setMarketPrice(price === null ? '' : String(price));
          onSave(line.id, {
            cardName: candidate.name,
            setCode: candidate.setCode,
            collectorNumber: candidate.collectorNumber,
            exactPrintingId: candidate.id,
            language: candidate.language,
            finish,
            marketPrice: price,
            priceSource: price === null ? 'unavailable' : 'scryfall',
            priceTimestamp: candidate.marketPrice?.fetchedAt ?? updatedLine.priceTimestamp,
            reviewStatus: 'confirmed',
            confidence: 'likely',
            confidenceScore: updatedLine.confidenceScore,
            recognition: updatedLine.recognition,
            notes: updatedLine.notes,
          });
          setPrintingSelectorOpen(false);
        }}
      />
    </Modal>
  );
}

function destinationLabelForLine(line: ScannerSessionLine, storageLocations: LocationSummary[]) {
  if (line.destination === 'deck' && line.deckName) return `Deck: ${line.deckName}`;
  if (line.destination === 'storage_location') {
    const location = storageLocations.find((item) => item.id === line.storageLocationId) ?? null;
    if (location) return `Storage: ${location.name}`;
    return 'Storage location';
  }
  return scannerDestinationLabel(line.destination);
}

function lineSessionShell(line: ScannerSessionLine): ContinuousScannerSession {
  return {
    id: 'review-sheet',
    userId: 'review-sheet',
    name: 'Review',
    mode: 'collection_intake',
    createdAt: line.createdAt,
    updatedAt: line.createdAt,
    autoConfirm: 'suggest_only',
    offerConfig: {
      defaultCashPercentage: line.purchasePercentage,
      defaultTradePercentage: 80,
      minimumCardValue: null,
      rounding: 'nearest_cent',
      rules: [],
    },
    defaultDestination: line.destination,
    paused: false,
    lines: [line],
    undoneLines: [],
  };
}

function formatReviewLineMoney(value: number | null, source: string | null) {
  if (value === null && source === 'pricing_pending') return 'Pricing...';
  return formatSessionReviewMoney(value);
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

async function loadUserSession() {
  if (!supabase) return { loadedUserId: null, loadedSession: null };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in again to review scanner sessions.');
  const raw = await appStorage.getItem(continuousScannerSessionKey(data.user.id));
  if (!raw) return { loadedUserId: data.user.id, loadedSession: null };
  const parsed = JSON.parse(raw) as ContinuousScannerSession;
  return { loadedUserId: data.user.id, loadedSession: parsed.userId === data.user.id ? parsed : null };
}

const statusOptions: { value: SessionReviewFilterState['status']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'confirmed', label: 'Done' },
  { value: 'suggested', label: 'Suggested' },
];

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
  destinationPanel: { gap: space.sm, borderRadius: radius.lg, padding: space.sm, backgroundColor: color.canvasRaised },
  destinationHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  destinationButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  cardShowPanel: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, padding: space.sm, backgroundColor: color.surface },
  rateInput: { width: 92 },
  batchActions: { gap: space.xs, borderRadius: radius.lg, padding: space.sm, backgroundColor: color.surface },
  batchButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  syncNotice: { borderRadius: radius.md, padding: space.sm, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, backgroundColor: color.info + '10' },
  reviewNext: { minHeight: 60, borderRadius: radius.lg, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.surfaceFloating },
  reviewNextIcon: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.info + '14' },
  cardRow: { minHeight: 104, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.border },
  cardRowSelected: { backgroundColor: color.primaryBright + '10' },
  pressedRow: { opacity: 0.82 },
  cardRowLead: { width: 72, alignItems: 'flex-start', gap: 4 },
  cardImage: { width: 48, height: 68, borderRadius: radius.sm, backgroundColor: color.surface },
  cardImageMissing: { width: 48, height: 68, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  cardCopy: { flex: 1, minWidth: 0, gap: 4 },
  cardTopLine: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  cardName: { flex: 1, minWidth: 0 },
  cardBadges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4 },
  cardValues: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: 2 },
  valuePair: { minWidth: 74, gap: 1 },
  modalScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000080' },
  sheetDock: { justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '88%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  sheetScroll: { gap: space.md, paddingBottom: space.lg },
  sheetIdentity: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  sheetImage: { width: 86, height: 120, borderRadius: radius.md, backgroundColor: color.surface },
  sheetImageMissing: { width: 86, height: 120, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  finishControlBlock: { gap: space.xs },
  finishControl: { minHeight: 36, flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  finishButton: { minHeight: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  finishButtonActive: { borderColor: color.primaryBright, backgroundColor: color.primaryBright + '24' },
  offerPanel: { gap: space.xs, borderRadius: radius.md, padding: space.md, backgroundColor: color.canvasRaised },
  reviewPills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  compactDestructiveZone: { paddingTop: space.xs },
  pickerRow: { minHeight: 56, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.surface },
  bulkBar: { gap: space.xs, borderRadius: radius.lg, padding: space.sm, backgroundColor: color.canvasRaised },
  bulkBarActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  finalizeBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 92, borderTopWidth: 1, borderTopColor: color.borderStrong, paddingHorizontal: space.md, paddingTop: space.sm, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, backgroundColor: color.canvas + 'F4' },
  finalizeAction: { flex: 1, gap: 4 },
  finalizeSummaryWrap: { gap: 2 },
  destinationSummary: { gap: 4 },
  finalizeSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});

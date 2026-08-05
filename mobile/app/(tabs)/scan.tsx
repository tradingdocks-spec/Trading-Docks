import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { TDBadge, TDButton, TDCard, TDEmptyState, TDErrorState, TDInput, TDLoadingState, TDScreen, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { useAccount } from '@/providers/account';
import { CARD_CONDITION_OPTIONS, TRADE_BINDER_STATUS_OPTIONS } from '@/services/collector-mutations';
import { displayCondition, displayFinish } from '@/services/collector-workspace';
import { loadScannerContext, loadScannerDraft, saveScannerConfirmation, saveScannerDraft, searchScannerPrintings } from '@/services/scanner-data';
import {
  createInterruptedScanDraft,
  resetAfterRapidScan,
  resolveScannerPermissionState,
  scannerPrivacySummary,
  tradeStatusForScanner,
  unavailableCameraProvider,
  type ScannerCardCandidate,
  type ScannerConfirmation,
  type ScannerPermissionState,
} from '@/services/scanner-foundation';
import { listScannerQueuedAdds, retryQueuedScannerAdds, type ScannerQueuedAdd } from '@/services/scanner-replay';
import type { StorageLocation } from '@/services/storage-location-manager';

type ScannerContext = { userId: string; locations: StorageLocation[]; currentTotalQuantity: number };

export default function Scan() {
  const { accountType } = useAccount();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [context, setContext] = useState<ScannerContext | null>(null);
  const [permission, setPermission] = useState<ScannerPermissionState>('not_requested');
  const [cameraActive, setCameraActive] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<ScannerCardCandidate[]>([]);
  const [selected, setSelected] = useState<ScannerCardCandidate | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState(CARD_CONDITION_OPTIONS[0]);
  const [finish, setFinish] = useState<'normal' | 'foil' | 'etched'>('normal');
  const [language, setLanguage] = useState('en');
  const [storageLocationId, setStorageLocationId] = useState<string | null>(null);
  const [tradeStatus, setTradeStatus] = useState(tradeStatusForScanner('not_for_trade'));
  const [addToWishlist, setAddToWishlist] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [queuedAdds, setQueuedAdds] = useState<ScannerQueuedAdd[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const cameraAvailable = Platform.OS !== 'web' || typeof navigator !== 'undefined';
  const privacy = scannerPrivacySummary();

  useEffect(() => {
    let active = true;
    void loadScannerContext()
      .then(async (result) => {
        if (!active) return;
        setContext(result);
        const draft = await loadScannerDraft(result.userId);
        if (draft) {
          setQuery(draft.query);
          setStorageLocationId(draft.confirmation?.storageLocationId ?? null);
        }
        setQueuedAdds(await listScannerQueuedAdds(result.userId));
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Scanner context is unavailable.'))
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!context) return;
    void saveScannerDraft(createInterruptedScanDraft({
      userId: context.userId,
      query,
      selectedCandidateId: selected?.id ?? null,
      confirmation: selected ? { quantity, condition, finish, language, storageLocationId, tradeStatus, addToWishlist } : null,
    }));
  }, [addToWishlist, condition, context, finish, language, quantity, query, selected, storageLocationId, tradeStatus]);

  const selectedFinishes = useMemo(() => selected?.finishes.filter((candidateFinish) => candidateFinish === 'normal' || candidateFinish === 'foil' || candidateFinish === 'etched') ?? ['normal'], [selected]);

  useEffect(() => {
    const next = resolveScannerPermissionState({
      cameraAvailable,
      permissionGranted: cameraPermission?.granted,
      permissionDenied: cameraPermission ? !cameraPermission.granted && !cameraPermission.canAskAgain : false,
      requested: Boolean(cameraPermission),
    });
    setPermission(next);
    setCameraActive(next === 'granted');
  }, [cameraAvailable, cameraPermission]);

  const requestCamera = async () => {
    setError(null);
    if (!cameraAvailable) {
      setPermission('unavailable');
      setError('Camera capture is unavailable on this platform. Use manual search.');
      return;
    }
    const result = await requestCameraPermission();
    const next = resolveScannerPermissionState({
      cameraAvailable,
      permissionGranted: result.granted,
      permissionDenied: !result.granted && !result.canAskAgain,
      requested: true,
    });
    setPermission(next);
    if (next !== 'granted') setError('Camera permission is not available. Manual search still works.');
  };

  const captureStill = async () => {
    setError(null);
    setSuccess(null);
    if (!cameraRef.current || permission !== 'granted') {
      setError('Camera is not ready. Grant permission or use manual search.');
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, skipProcessing: false });
      setCapturedFrame(`${photo.width} x ${photo.height}`);
      setSuccess('Still captured for local confirmation. Recognition providers are not benchmarked yet, so choose the exact printing below.');
      setCameraActive(false);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : 'Could not capture the card image.');
    }
  };

  const runSearch = async () => {
    setSearching(true);
    setError(null);
    setSuccess(null);
    const result = await searchScannerPrintings(query, true);
    if (result.ok) {
      setCandidates(result.candidates);
      if (!result.candidates.length) setError('No printings found. Try the exact card name.');
      else if (result.warning) setError(result.warning);
    } else {
      setCandidates([]);
      setError(result.reason);
    }
    setSearching(false);
  };

  const selectCandidate = (candidate: ScannerCardCandidate) => {
    setSelected(candidate);
    setFinish((candidate.finishes.find((candidateFinish) => candidateFinish === 'normal' || candidateFinish === 'foil' || candidateFinish === 'etched') ?? 'normal') as 'normal' | 'foil' | 'etched');
    setLanguage(candidate.language ?? 'en');
  };

  const save = async () => {
    if (!context || !selected) return;
    setSaving(true);
    setError(null);
    const confirmation: ScannerConfirmation = {
      userId: context.userId,
      candidate: selected,
      quantity,
      condition,
      finish,
      language,
      storageLocationId,
      tradeStatus,
      addToWishlist,
    };
    const result = await saveScannerConfirmation({ confirmation, membershipTier: accountType, currentTotalQuantity: context.currentTotalQuantity });
    if (!result.ok) {
      setError(result.error);
    } else {
      setSuccess(result.queued ? 'Scan queued for sync.' : 'Card added to Collection.');
      setContext({ ...context, currentTotalQuantity: context.currentTotalQuantity + quantity });
      setQueuedAdds(await listScannerQueuedAdds(context.userId));
      const reset = resetAfterRapidScan();
      setQuery(reset.query);
      setSelected(null);
      setCandidates([]);
      setQuantity(1);
      setTradeStatus('not_for_trade');
      setAddToWishlist(false);
    }
    setSaving(false);
  };

  const retryQueue = async () => {
    if (!context) return;
    setSyncingQueue(true);
    setError(null);
    const result = await retryQueuedScannerAdds({ userId: context.userId, membershipTier: accountType, trigger: 'manual_retry' });
    setQueuedAdds(await listScannerQueuedAdds(context.userId));
    setSuccess(result.succeeded ? `${result.succeeded} queued scan${result.succeeded === 1 ? '' : 's'} synced.` : null);
    if (result.failed) setError(`${result.failed} queued scan${result.failed === 1 ? '' : 's'} still need attention.`);
    setSyncingQueue(false);
  };

  if (loading) return <TDScreen style={s.screen}><TDLoadingState title="Loading scanner" message="Preparing collection, storage, and confirmation options." /></TDScreen>;

  return (
    <TDScreen style={s.screen}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TDText variant="label" tone="info">Scanner</TDText>
          <TDText variant="display">Scan a card</TDText>
          <TDText variant="small" tone="muted">Capture is assisted in this sprint: confirm exact printing before anything enters Collection.</TDText>
        </View>

        <TDCard style={s.cameraCard}>
          {permission === 'granted' && cameraActive ? (
            <View style={s.cameraPreview}>
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torchEnabled} animateShutter autofocus="on" />
              <View pointerEvents="none" style={s.cardGuide}>
                <View style={s.guideCorner} />
                <TDText variant="caption" tone="info">Align card edges</TDText>
              </View>
              <View style={s.cameraControls}>
                <TDButton label={torchEnabled ? 'Torch off' : 'Torch on'} variant="secondary" onPress={() => setTorchEnabled((value) => !value)} />
                <TDButton label="Capture still" onPress={captureStill} />
              </View>
            </View>
          ) : (
            <View style={s.cameraFrame}>
              <Ionicons name={permission === 'denied' ? 'camera-outline' : 'scan-outline'} size={42} color={color.textMuted} />
              <TDText variant="title">{permissionTitle(permission)}</TDText>
              <TDText variant="small" tone="muted" style={s.centerText}>{permissionMessage(permission, Platform.OS)}</TDText>
              <View style={s.syncActions}>
                <TDButton label={permission === 'granted' ? 'Open camera' : 'Check camera'} variant="secondary" onPress={permission === 'granted' ? () => setCameraActive(true) : requestCamera} />
                {capturedFrame ? <TDButton label="Retake" variant="secondary" onPress={() => setCameraActive(true)} /> : null}
              </View>
              {capturedFrame ? <TDBadge tone="info">Last still {capturedFrame}</TDBadge> : null}
            </View>
          )}
          <TDBadge tone={permission === 'granted' ? 'info' : 'warning'}>{permission === 'granted' ? 'Camera capture enabled' : unavailableCameraProvider.label}</TDBadge>
        </TDCard>

        <TDCard variant="outlined" style={s.noticeCard}>
          <TDBadge tone="info">Privacy</TDBadge>
          <TDText variant="small" tone="muted">{privacy.message}</TDText>
        </TDCard>

        {error ? <TDErrorState title="Scanner notice" message={error} /> : null}
        {success ? <TDCard accessibilityRole="alert" style={s.noticeCard}><TDBadge tone="success">Success</TDBadge><TDText variant="small">{success}</TDText></TDCard> : null}
        {queuedAdds.length ? (
          <TDCard style={s.syncCard}>
            <View style={s.syncHeader}>
              <View style={s.flex}>
                <TDText variant="title">Scanner sync</TDText>
                <TDText variant="small" tone="muted">{scannerSyncSummary(queuedAdds)}</TDText>
              </View>
              <TDBadge tone={queuedAdds.some((entry) => entry.syncState === 'action_required') ? 'warning' : 'info'}>
                {queuedAdds.length} queued
              </TDBadge>
            </View>
            <View style={s.syncActions}>
              <TDButton label="Retry" variant="secondary" loading={syncingQueue} onPress={retryQueue} />
              <TDButton label="Review" variant="secondary" onPress={() => router.push('/scanner-recovery' as never)} />
            </View>
          </TDCard>
        ) : null}

        <TDCard style={s.section}>
          <TDText variant="title">Manual search fallback</TDText>
          <TDText variant="small" tone="muted">Search Scryfall printings by card name. Images are not uploaded, retained, or required.</TDText>
          <TDInput label="Card name" value={query} onChangeText={setQuery} leftIconName="search-outline" placeholder="Rhystic Study" returnKeyType="search" onSubmitEditing={runSearch} />
          <TDButton label="Search printings" loading={searching} disabled={query.trim().length < 2} onPress={runSearch} />
        </TDCard>

        {searching ? <TDLoadingState title="Searching printings" message="Looking up exact paper printings." /> : null}
        {!searching && candidates.length ? (
          <View style={s.section}>
            <TDText variant="title">Likely matches</TDText>
            {candidates.map((candidate) => (
              <Pressable key={candidate.id} accessibilityRole="button" accessibilityState={{ selected: selected?.id === candidate.id }} onPress={() => selectCandidate(candidate)} style={[s.candidate, selected?.id === candidate.id && s.candidateSelected]}>
                {candidate.imageUrl ? <Image source={{ uri: candidate.imageUrl }} style={s.cardImage} contentFit="cover" /> : <View style={s.imageFallback}><Ionicons name="image-outline" size={22} color={color.textMuted} /></View>}
                <View style={s.flex}>
                  <TDText variant="small">{candidate.name}</TDText>
                  <TDText variant="caption" tone="muted">{candidate.setCode ?? 'Set unavailable'} #{candidate.collectorNumber ?? '?'} - {candidate.language ?? 'language unavailable'}</TDText>
                  <TDText variant="caption" tone="muted">Finishes: {candidate.finishes.map(displayFinish).join(', ')}</TDText>
                </View>
                <TDBadge tone={selected?.id === candidate.id ? 'success' : 'info'}>{Math.round(candidate.confidence * 100)}%</TDBadge>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!searching && query && !candidates.length && !error ? <TDEmptyState title="No printings yet" message="Run a search to select an exact printing." /> : null}

        {selected ? (
          <TDCard style={s.section}>
            <TDText variant="title">Confirm exact printing</TDText>
            <TDText variant="small" tone="muted">{selected.name} - {selected.setCode ?? 'Set unavailable'} #{selected.collectorNumber ?? '?'}</TDText>
            <View style={s.quantityRow}>
              <TDButton label="-" variant="secondary" disabled={quantity <= 1} onPress={() => setQuantity((value) => Math.max(1, value - 1))} />
              <TDBadge tone="info">Qty {quantity}</TDBadge>
              <TDButton label="+" variant="secondary" onPress={() => setQuantity((value) => value + 1)} />
            </View>
            <OptionRow label="Condition" options={CARD_CONDITION_OPTIONS} value={condition} display={displayCondition} onSelect={setCondition} />
            <OptionRow label="Finish" options={selectedFinishes as ('normal' | 'foil' | 'etched')[]} value={finish} display={displayFinish} onSelect={setFinish} />
            <TDInput label="Language" value={language} onChangeText={setLanguage} placeholder="en" />
            <OptionRow label="Storage" options={['none', ...(context?.locations.map((location) => location.id) ?? [])]} value={storageLocationId ?? 'none'} display={(id) => id === 'none' ? 'Unassigned' : context?.locations.find((location) => location.id === id)?.name ?? 'Unavailable'} onSelect={(id) => setStorageLocationId(id === 'none' ? null : id)} />
            <OptionRow label="Trade Binder" options={TRADE_BINDER_STATUS_OPTIONS} value={tradeStatus} display={(status) => status.replaceAll('_', ' ')} onSelect={setTradeStatus} />
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: addToWishlist }} onPress={() => setAddToWishlist((value) => !value)} style={s.checkboxRow}>
              <Ionicons name={addToWishlist ? 'checkbox-outline' : 'square-outline'} size={22} color={color.primaryBright} />
              <TDText variant="small">Also add this exact card target to Wishlist</TDText>
            </Pressable>
            <TDButton label="Add to Collection" loading={saving} onPress={save} />
          </TDCard>
        ) : null}
      </ScrollView>
    </TDScreen>
  );
}

function OptionRow<T extends string>({ label, options, value, display, onSelect }: { label: string; options: T[]; value: T; display: (value: T) => string; onSelect: (value: T) => void }) {
  return (
    <View style={s.optionGroup}>
      <TDText variant="label" tone="muted">{label}</TDText>
      <View style={s.chips}>
        {options.map((option) => <Chip key={option} label={display(option)} selected={option === value} onPress={() => onSelect(option)} />)}
      </View>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.chip, selected && s.chipSelected]}><TDText variant="caption" tone={selected ? 'primary' : 'muted'}>{label}</TDText></Pressable>;
}

function permissionTitle(permission: ScannerPermissionState) {
  if (permission === 'granted') return 'Camera ready';
  if (permission === 'denied') return 'Camera permission denied';
  if (permission === 'unavailable') return 'Camera unavailable';
  return 'Camera permission not requested';
}

function permissionMessage(permission: ScannerPermissionState, platform: string) {
  if (permission === 'unavailable') return `Camera capture is unavailable in ${platform === 'web' ? 'this browser' : 'this Expo build'}.`;
  if (permission === 'denied') return 'Enable camera permission in system settings, or continue with manual search.';
  if (permission === 'granted') return 'Capture is local-first. Recognition providers are architectural until benchmarked.';
  return 'Manual search works now. Camera capture requires camera permission.';
}

function scannerSyncSummary(entries: ScannerQueuedAdd[]) {
  const actionRequired = entries.filter((entry) => entry.syncState === 'action_required').length;
  const failed = entries.filter((entry) => entry.syncState === 'failed').length;
  if (actionRequired) return `${actionRequired} queued scan${actionRequired === 1 ? '' : 's'} need action before sync can finish.`;
  if (failed) return `${failed} queued scan${failed === 1 ? '' : 's'} failed replay and can be retried.`;
  return 'Queued scanner adds will sync on reconnect, app resume, or manual retry.';
}

const s = StyleSheet.create({
  screen: { paddingTop: 56 },
  content: { gap: space.md, paddingBottom: 128 },
  header: { gap: space.xs },
  cameraCard: { gap: space.md },
  cameraFrame: { minHeight: 300, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg, backgroundColor: color.canvasRaised },
  cameraPreview: { minHeight: 360, overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, backgroundColor: color.canvasRaised },
  cardGuide: { position: 'absolute', top: 42, right: 28, bottom: 92, left: 28, borderRadius: radius.md, borderWidth: 2, borderColor: color.primaryBright, alignItems: 'center', justifyContent: 'flex-end', padding: space.sm },
  guideCorner: { position: 'absolute', top: -2, left: -2, width: 42, height: 42, borderTopWidth: 4, borderLeftWidth: 4, borderColor: color.info, borderTopLeftRadius: radius.md },
  cameraControls: { position: 'absolute', right: space.sm, bottom: space.sm, left: space.sm, flexDirection: 'row', gap: space.sm, justifyContent: 'center', flexWrap: 'wrap' },
  centerText: { textAlign: 'center' },
  noticeCard: { gap: space.sm },
  syncCard: { gap: space.md },
  syncHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  syncActions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  section: { gap: space.md },
  candidate: { minHeight: 112, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.canvasRaised },
  candidateSelected: { borderColor: color.primaryBright, backgroundColor: color.primary + '24' },
  cardImage: { width: 58, height: 82, borderRadius: radius.sm, backgroundColor: color.surface },
  imageFallback: { width: 58, height: 82, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  flex: { flex: 1 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  optionGroup: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: { minHeight: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { borderColor: color.primaryBright, backgroundColor: color.primary + '30' },
  checkboxRow: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm },
});

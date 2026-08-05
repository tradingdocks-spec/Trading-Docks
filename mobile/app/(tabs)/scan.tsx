import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TDBadge, TDButton, TDCard, TDChip, TDEmptyState, TDErrorState, TDInput, TDLoadingState, TDMetricTile, TDScreen, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { useAccount } from '@/providers/account';
import { CARD_CONDITION_OPTIONS, TRADE_BINDER_STATUS_OPTIONS } from '@/services/collector-mutations';
import {
  DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS,
  SCANNER_SESSION_MODES,
  addRecognitionToSession,
  buildContinuousScannerCsvRows,
  buildScannerCollectionConfirmation,
  bulkConfirmReviewedCards,
  calculateCardGuideLayout,
  calculateSessionTotals,
  continuousScannerSessionKey,
  createContinuousScannerRuntime,
  createContinuousScannerSession,
  createRecognitionPipelineReport,
  markCaptureStarted,
  markScanResult,
  scannerModeLabel,
  scannerModeUsesOfferWorkspace,
  serializeContinuousScannerCsv,
  type ContinuousScannerMode,
  type ContinuousScannerSession,
} from '@/services/continuous-offer-scanner';
import { displayCondition, displayFinish } from '@/services/collector-workspace';
import { classifyMagicRecognition, recognizeMagicCard, type MagicRecognitionResult } from '@/services/magic-recognition-provider';
import { recognizeMagicStillCapture, type MagicStillScanResult } from '@/services/magic-ocr-pipeline';
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
import type { RecognitionCandidate } from '@/services/scanner-intelligence';
import { listScannerQueuedAdds, retryQueuedScannerAdds, type ScannerQueuedAdd } from '@/services/scanner-replay';
import {
  NO_NATIVE_VISUAL_SIGNALS,
  applyScannerCalibrationToGuide,
  buildGuideCropMapping,
  canAutoCaptureNative,
  diagnosticsFromFrameAnalysis,
  isScannerDiagnosticsEnabled,
  nativeScannerCalibrationKey,
  normalizeScannerCalibrationPreferences,
  summarizeFoilDiagnostics,
  type PreviewDimensions,
  type ScannerCalibrationPreferences,
  type ScannerCaptureState,
  type ScannerDiagnosticsSnapshot,
} from '@/services/native-scanner-calibration';
import { appStorage } from '@/services/storage/app-storage';
import type { StorageLocation } from '@/services/storage-location-manager';

type ScannerContext = { userId: string; locations: StorageLocation[]; currentTotalQuantity: number };
type ScanRecognitionStage = 'idle' | 'reading_title' | 'finding_card' | 'review_ready' | 'failed';
const INITIAL_SESSION_MODE: ContinuousScannerMode = 'card_show_purchase';

export default function Scan() {
  const { accountType } = useAccount();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [context, setContext] = useState<ScannerContext | null>(null);
  const [sessionMode, setSessionMode] = useState<ContinuousScannerMode>(INITIAL_SESSION_MODE);
  const [session, setSession] = useState<ContinuousScannerSession | null>(null);
  const [autoScanner, setAutoScanner] = useState(() => createContinuousScannerRuntime({ scanId: createScanId() }));
  const [permission, setPermission] = useState<ScannerPermissionState>('not_requested');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [previewDimensions, setPreviewDimensions] = useState<PreviewDimensions | null>(null);
  const [captureState, setCaptureState] = useState<ScannerCaptureState>('idle');
  const [recognitionStage, setRecognitionStage] = useState<ScanRecognitionStage>('idle');
  const [sessionInsertionResult, setSessionInsertionResult] = useState<ScannerDiagnosticsSnapshot['sessionInsertionResult']>('not_attempted');
  const [scannerCalibration, setScannerCalibration] = useState<ScannerCalibrationPreferences>(() => normalizeScannerCalibrationPreferences());
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<ScannerCardCandidate[]>([]);
  const [magicRecognition, setMagicRecognition] = useState<MagicRecognitionResult | null>(null);
  const [magicStillScan, setMagicStillScan] = useState<MagicStillScanResult | null>(null);
  const [showMagicWhy, setShowMagicWhy] = useState(false);
  const [selected, setSelected] = useState<ScannerCardCandidate | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState(CARD_CONDITION_OPTIONS[0]);
  const [finish, setFinish] = useState<'normal' | 'foil' | 'etched'>('normal');
  const [language, setLanguage] = useState('en');
  const [storageLocationId, setStorageLocationId] = useState<string | null>(null);
  const [tradeStatus, setTradeStatus] = useState(tradeStatusForScanner('not_for_trade'));
  const [addToWishlist, setAddToWishlist] = useState(false);
  const [marketPrice, setMarketPrice] = useState('');
  const [purchaseRate, setPurchaseRate] = useState('70');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [queuedAdds, setQueuedAdds] = useState<ScannerQueuedAdd[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const cameraAvailable = Platform.OS !== 'web' || typeof navigator !== 'undefined';
  const diagnosticsEnabled = isScannerDiagnosticsEnabled();
  const privacy = scannerPrivacySummary();
  const previewWidth = Math.min(width - 32, 520);
  const baseGuideLayout = useMemo(() => calculateCardGuideLayout({
    containerWidth: previewWidth,
    containerHeight: 440,
    safeTop: insets.top,
    safeBottom: 0,
    reservedVerticalSpace: 120,
  }), [insets.top, previewWidth]);
  const guideLayout = useMemo(
    () => applyScannerCalibrationToGuide(baseGuideLayout, previewWidth, scannerCalibration),
    [baseGuideLayout, previewWidth, scannerCalibration],
  );
  const autoCaptureDecision = useMemo(() => canAutoCaptureNative({
    cameraReady,
    signalAvailability: NO_NATIVE_VISUAL_SIGNALS,
    analysis: null,
  }), [cameraReady]);
  const diagnosticsSnapshot = useMemo(() => diagnosticsFromFrameAnalysis({
    cameraReady,
    previewDimensions,
    guideDimensions: guideLayout,
    analysis: null,
    captureState,
    duplicateFingerprintStatus: autoScanner.duplicateProtection.awaitingCardRemoval ? 'awaiting_removal' : 'unavailable',
    recognitionStage: recognitionStage === 'review_ready' ? 'recognized' : recognitionStage === 'failed' ? 'failed' : capturedFrame ? 'capture_only' : 'not_started',
    recognitionLatencyMs: magicStillScan?.ok ? magicStillScan.ocr.latencyMs + magicStillScan.lookupLatencyMs : null,
    sessionInsertionResult,
    signalAvailability: NO_NATIVE_VISUAL_SIGNALS,
  }), [autoScanner.duplicateProtection.awaitingCardRemoval, cameraReady, capturedFrame, captureState, guideLayout, magicStillScan, previewDimensions, recognitionStage, sessionInsertionResult]);
  const guideCropMapping = useMemo(
    () => previewDimensions ? buildGuideCropMapping(previewDimensions, guideLayout) : null,
    [guideLayout, previewDimensions],
  );
  const foilDiagnostics = useMemo(() => summarizeFoilDiagnostics([]), []);
  const sessionTotals = useMemo(() => session ? calculateSessionTotals(session) : null, [session]);
  const offerWorkspace = scannerModeUsesOfferWorkspace(sessionMode);
  const acceptedOcrCandidate = magicStillScan?.ok ? magicStillScan.selected : null;

  useEffect(() => {
    let active = true;
    void loadScannerContext()
      .then(async (result) => {
        if (!active) return;
        const draft = await loadScannerDraft(result.userId);
        if (draft) {
          setQuery(draft.query);
          setStorageLocationId(draft.confirmation?.storageLocationId ?? null);
        }
        if (isScannerDiagnosticsEnabled()) {
          const rawCalibration = await appStorage.getItem(nativeScannerCalibrationKey(result.userId));
          if (rawCalibration) {
            try {
              setScannerCalibration(normalizeScannerCalibrationPreferences(JSON.parse(rawCalibration) as Partial<ScannerCalibrationPreferences>));
            } catch {
              setScannerCalibration(normalizeScannerCalibrationPreferences());
            }
          }
        }
        setContext(result);
        const savedSession = await loadContinuousSession(result.userId);
        setSession(savedSession ?? createContinuousScannerSession({
          id: createScanId(),
          userId: result.userId,
          name: scannerModeLabel(INITIAL_SESSION_MODE),
          mode: INITIAL_SESSION_MODE,
          defaultDestination: 'purchase_intake',
        }));
        setQueuedAdds(await listScannerQueuedAdds(result.userId));
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Scanner context is unavailable.'))
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!context || !diagnosticsEnabled) return;
    void appStorage.setItem(nativeScannerCalibrationKey(context.userId), JSON.stringify(scannerCalibration));
  }, [context, diagnosticsEnabled, scannerCalibration]);

  useEffect(() => {
    if (!context || !session) return;
    void appStorage.setItem(continuousScannerSessionKey(context.userId), JSON.stringify(session));
  }, [context, session]);

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
  const magicPresentation = useMemo(() => {
    if (!magicRecognition?.ok) return null;
    return classifyMagicRecognition(magicRecognition.confidence, magicRecognition.candidates.length);
  }, [magicRecognition]);

  useEffect(() => {
    const next = resolveScannerPermissionState({
      cameraAvailable,
      permissionGranted: cameraPermission?.granted,
      permissionDenied: cameraPermission ? !cameraPermission.granted && !cameraPermission.canAskAgain : false,
      requested: Boolean(cameraPermission),
    });
    setPermission(next);
    setCameraActive(next === 'granted');
    if (next !== 'granted') {
      setCameraReady(false);
      setCaptureState(next === 'unavailable' ? 'failed' : 'idle');
    }
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
    if (next === 'granted') {
      setCameraReady(false);
      setCaptureState('camera_not_ready');
    } else {
      setError('Camera permission is not available. Manual search still works.');
    }
  };

  const captureStill = async () => {
    setError(null);
    setSuccess(null);
    setSessionInsertionResult('not_attempted');
    if (!cameraRef.current || permission !== 'granted') {
      setCaptureState('camera_not_ready');
      setError('Camera is not ready. Grant permission or use manual search.');
      return;
    }
    if (!cameraReady) {
      setCaptureState('camera_not_ready');
      setError('Camera is warming up. Hold the card in the guide and try again in a moment.');
      return;
    }
    try {
      setCaptureState('capturing');
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, skipProcessing: false });
      const frameLabel = `${photo.width} x ${photo.height}`;
      setCapturedFrame(frameLabel);
      setCaptureState('captured');
      setRecognitionStage('reading_title');
      setAutoScanner((current) => markCaptureStarted(current));
      const scan = await recognizeMagicStillCapture({
        imageUri: photo.uri,
        preview: previewDimensions ?? { width: previewWidth, height: 440 },
        image: { width: photo.width, height: photo.height },
        guide: guideLayout,
        online: true,
        cachedCandidates: candidates.map(scannerCandidateToRecognitionCandidate),
        onStage: setRecognitionStage,
      });
      setMagicStillScan(scan);
      if (scan.ok) {
        setCandidates(scan.candidates);
        setSelected(scan.selected);
        setMagicRecognition(scan.recognition);
        setQuery(scan.signals.normalizedTitle ?? query);
        setSessionInsertionResult('not_attempted');
        setRecognitionStage('review_ready');
        setSuccess(scan.selected
          ? `${scan.selected.name} is ready to confirm. Temporary capture ${scan.cleanup.ok && scan.cleanup.deleted ? 'deleted' : 'cleanup needs review'}.`
          : 'OCR finished, but no Magic printing was selected. Use manual search.');
      } else {
        setMagicRecognition(scan.ocr?.ok === false ? { ok: false, reason: scan.reason, offline: false } : null);
        setSessionInsertionResult('failed');
        setRecognitionStage('failed');
        setError(`${scan.reason} Manual search is still available.`);
      }
      setAutoScanner((current) => markScanResult(current, {
        fingerprint: frameLabel,
        now: Date.now(),
        scanId: createScanId(),
      }));
      setCameraActive(false);
    } catch (captureError) {
      setCaptureState('failed');
      setRecognitionStage('failed');
      setSessionInsertionResult('failed');
      setError(captureError instanceof Error ? captureError.message : 'Could not capture the card image.');
    }
  };

  const updateCalibration = (patch: Partial<ScannerCalibrationPreferences>) => {
    setScannerCalibration((current) => normalizeScannerCalibrationPreferences({ ...current, ...patch }));
  };

  const handlePreviewLayout = (event: LayoutChangeEvent) => {
    const { width: previewLayoutWidth, height: previewLayoutHeight } = event.nativeEvent.layout;
    setPreviewDimensions({ width: previewLayoutWidth, height: previewLayoutHeight });
  };

  const runSearch = async () => {
    setSearching(true);
    setError(null);
    setSuccess(null);
    const result = await searchScannerPrintings(query, true);
    if (result.ok) {
      setCandidates(result.candidates);
      setMagicStillScan(null);
      const recognition = await recognizeMagicCard({
        nameObservation: { regionType: 'name', text: query, confidence: 72 },
        online: false,
        cachedCandidates: result.candidates.map(scannerCandidateToRecognitionCandidate),
      });
      setMagicRecognition(recognition);
      if (!result.candidates.length) setError('No printings found. Try the exact card name.');
      else if (result.warning) setError(result.warning);
    } else {
      setCandidates([]);
      setMagicRecognition(null);
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
    if (!context || !selected || !session) return;
    setSaving(true);
    setError(null);
    const recognitionReport = createRecognitionPipelineReport({
      detectedGame: 'magic',
      candidates: [selected, ...candidates.filter((candidate) => candidate.id !== selected.id)],
      confidence: magicRecognition?.ok ? magicRecognition.confidence : {
        overall: Math.round(selected.confidence * 100),
        threshold: 82,
        requiresConfirmation: true,
        conflicts: ['Manual search requires exact-printing confirmation.'],
        signals: [],
      },
      recognitionMethod: selected.recognitionMode === 'manual_search' ? 'manual_search' : 'metadata_assisted',
    });
    const price = parseOptionalMoney(marketPrice);
    const rate = parseOptionalPercentage(purchaseRate) ?? session.offerConfig.defaultCashPercentage;
    const sessionWithRate = {
      ...session,
      offerConfig: { ...session.offerConfig, defaultCashPercentage: rate },
    };
    const nextSession = addRecognitionToSession(sessionWithRate, {
      stableScanId: createScanId(),
      candidate: selected,
      recognition: recognitionReport,
      quantity,
      condition,
      finish,
      language,
      marketPrice: price,
      priceSource: price === null ? null : 'manual',
      priceTimestamp: price === null ? null : new Date().toISOString(),
      storageLocationId,
      tradeStatus,
      destination: sessionWithRate.defaultDestination,
      notes: price === null ? 'Pricing unavailable; excluded from offer totals until manually priced.' : '',
    });
    setSession(nextSession);
    setAutoScanner((current) => markScanResult(current, {
      printingId: selected.id,
      fingerprint: capturedFrame,
      now: Date.now(),
      scanId: createScanId(),
    }));

    if (sessionMode !== 'collection_intake') {
      setSuccess(`${selected.name} added to ${scannerModeLabel(sessionMode)} session for review.`);
      resetScannerForm();
      setSaving(false);
      return;
    }

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
      setMagicRecognition(null);
      setShowMagicWhy(false);
      setQuantity(1);
      setTradeStatus('not_for_trade');
      setAddToWishlist(false);
      setMarketPrice('');
    }
    setSaving(false);
  };

  const commitConfirmedCollectionLines = async () => {
    if (!context || !session) return;
    setSaving(true);
    setError(null);
    const confirmedSession = bulkConfirmReviewedCards(session);
    let saved = 0;
    let failed = 0;
    let runningTotal = context.currentTotalQuantity;
    for (const line of confirmedSession.lines.filter((entry) => entry.destination === 'collection' || entry.destination === 'trade_binder' || entry.destination === 'storage_location')) {
      const confirmation = buildScannerCollectionConfirmation({ ...line, reviewStatus: 'confirmed' }, context.userId);
      if (!confirmation) continue;
      const result = await saveScannerConfirmation({ confirmation, membershipTier: accountType, currentTotalQuantity: runningTotal });
      if (result.ok) {
        saved += 1;
        runningTotal += confirmation.quantity;
      } else {
        failed += 1;
        setError(result.error);
      }
    }
    setContext({ ...context, currentTotalQuantity: runningTotal });
    setSession({ ...confirmedSession, lines: confirmedSession.lines.map((line) => line.destination === 'collection' || line.destination === 'trade_binder' || line.destination === 'storage_location' ? { ...line, syncState: failed ? line.syncState : 'pending_sync' } : line) });
    setQueuedAdds(await listScannerQueuedAdds(context.userId));
    setSuccess(saved ? `${saved} confirmed session item${saved === 1 ? '' : 's'} queued or saved to Collection.` : null);
    if (failed) setError(`${failed} confirmed item${failed === 1 ? '' : 's'} could not be saved.`);
    setSaving(false);
  };

  const resetScannerForm = () => {
    const reset = resetAfterRapidScan();
    setQuery(reset.query);
    setSelected(null);
    setCandidates([]);
    setMagicRecognition(null);
    setMagicStillScan(null);
    setShowMagicWhy(false);
    setQuantity(1);
    setTradeStatus('not_for_trade');
    setAddToWishlist(false);
    setMarketPrice('');
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
          <TDText variant="display">Continuous intake</TDText>
          <TDText variant="small" tone="muted">Captured stills are read locally with iOS Apple Vision, then matched against Scryfall. Exact-printing confirmation is still required.</TDText>
        </View>

        <TDCard style={s.sessionCard}>
          <View style={s.syncHeader}>
            <View style={s.flex}>
              <TDText variant="title">{session?.name ?? scannerModeLabel(sessionMode)}</TDText>
              <TDText variant="small" tone="muted">{sessionTotals?.cardsScanned ?? 0} cards scanned - {sessionTotals?.needsReview ?? 0} need review - {sessionTotals?.missingPriceItems ?? 0} missing prices</TDText>
            </View>
            <TDBadge tone={offerWorkspace ? 'accent' : 'info'}>{offerWorkspace ? 'Offer workspace' : 'Intake'}</TDBadge>
          </View>
          <View style={s.chips}>
            {SCANNER_SESSION_MODES.map((mode) => (
              <TDChip key={mode.id} label={mode.label} selected={sessionMode === mode.id} tone="accent" onPress={() => {
                if (!context) return;
                setSessionMode(mode.id);
                setSession(createContinuousScannerSession({
                  id: createScanId(),
                  userId: context.userId,
                  name: mode.label,
                  mode: mode.id,
                  defaultDestination: mode.id === 'collection_intake' ? 'collection' : undefined,
                }));
              }} />
            ))}
          </View>
          {offerWorkspace ? (
            <View style={s.offerGrid}>
              <TDMetricTile label="Market" value={currency(sessionTotals?.marketValue)} compact />
              <TDMetricTile label="Cash offer" value={currency(sessionTotals?.cashOffer)} compact tone="success" />
              <TDMetricTile label="Trade value" value={currency(sessionTotals?.tradeValue)} compact tone="accent" />
              <TDInput label="Cash %" value={purchaseRate} onChangeText={setPurchaseRate} keyboardType="numeric" />
            </View>
          ) : null}
        </TDCard>

        <TDCard style={s.cameraCard}>
          {permission === 'granted' && cameraActive ? (
            <View style={s.cameraPreview} onLayout={handlePreviewLayout}>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torchEnabled}
                animateShutter
                autofocus="on"
                onCameraReady={() => {
                  setCameraReady(true);
                  setCaptureState('ready');
                }}
              />
              <View pointerEvents="none" style={[s.cardGuide, { width: guideLayout.width, height: guideLayout.height, left: guideLayout.left, top: guideLayout.top }]}>
                <View style={s.guideCorner} />
                <View style={[s.guideCorner, s.guideCornerRight]} />
                <View style={[s.guideCorner, s.guideCornerBottom]} />
                <View style={[s.guideCorner, s.guideCornerBottomRight]} />
                <TDText variant="caption" tone="info">63 x 88 mm guide - {autoScanner.lastGuidance}</TDText>
              </View>
              <View style={s.liveStatus}>
                <TDBadge tone="warning">Manual fallback active</TDBadge>
                <TDText variant="caption" tone="muted">{recognitionStageLabel(recognitionStage, autoCaptureDecision.reason)}</TDText>
              </View>
              <View style={s.cameraControls}>
                <TDButton label={torchEnabled ? 'Torch off' : 'Torch on'} variant="secondary" onPress={() => setTorchEnabled((value) => !value)} />
                <TDButton label={cameraReady ? 'Capture still' : 'Camera warming'} disabled={!cameraReady} onPress={captureStill} />
              </View>
            </View>
          ) : (
            <View style={s.cameraFrame}>
              <Ionicons name={permission === 'denied' ? 'camera-outline' : 'scan-outline'} size={42} color={color.textMuted} />
              <TDText variant="title">{permissionTitle(permission)}</TDText>
              <TDText variant="small" tone="muted" style={s.centerText}>{permissionMessage(permission, Platform.OS)}</TDText>
              <View style={s.syncActions}>
                <TDButton
                  label={permission === 'granted' ? 'Open camera' : 'Check camera'}
                  variant="secondary"
                  onPress={permission === 'granted' ? () => {
                    setCameraReady(false);
                    setCaptureState('camera_not_ready');
                    setCameraActive(true);
                  } : requestCamera}
                />
                {capturedFrame ? <TDButton label="Retake" variant="secondary" onPress={() => {
                  setCameraReady(false);
                  setCaptureState('camera_not_ready');
                  setCameraActive(true);
                }} /> : null}
              </View>
              {capturedFrame ? <TDBadge tone="info">Last still {capturedFrame}</TDBadge> : null}
            </View>
          )}
          <View style={s.statusRow}>
            <TDBadge tone={permission === 'granted' ? 'info' : 'warning'}>{permission === 'granted' ? 'Camera capture enabled' : unavailableCameraProvider.label}</TDBadge>
            <TDBadge tone="neutral">{autoScanner.state.replaceAll('_', ' ')}</TDBadge>
            <TDBadge tone="neutral">{DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS.requiredStabilityMs} ms stable</TDBadge>
          </View>
          {diagnosticsEnabled ? (
            <View style={s.diagnosticsCard}>
              <View style={s.syncHeader}>
                <View style={s.flex}>
                  <TDText variant="title">Scanner diagnostics</TDText>
                  <TDText variant="small" tone="muted">Development-only. No source images are logged or exported.</TDText>
                </View>
                <TDBadge tone={cameraReady ? 'success' : 'warning'}>{cameraReady ? 'Camera ready' : 'Camera pending'}</TDBadge>
              </View>
              <View style={s.signalGrid}>
                <DiagnosticCell label="Preview" value={previewDimensions ? `${Math.round(previewDimensions.width)} x ${Math.round(previewDimensions.height)}` : 'unavailable'} />
                <DiagnosticCell label="Guide" value={`${guideLayout.width} x ${guideLayout.height}`} />
                <DiagnosticCell label="Guide ratio" value={diagnosticsSnapshot.guideAspectRatio.toFixed(3)} />
                <DiagnosticCell label="Crop" value={guideCropMapping ? `${Math.round(guideCropMapping.normalizedCrop.width * 100)}% x ${Math.round(guideCropMapping.normalizedCrop.height * 100)}%` : 'unavailable'} />
                <DiagnosticCell label="Corners" value={`${diagnosticsSnapshot.cardCornersVisible}/4 unavailable`} />
                <DiagnosticCell label="Fill" value={diagnosticsSnapshot.fillPercentage === null ? 'unavailable' : `${diagnosticsSnapshot.fillPercentage}%`} />
                <DiagnosticCell label="Blur" value={formatDiagnosticScore(diagnosticsSnapshot.blurScore)} />
                <DiagnosticCell label="Motion" value={formatDiagnosticScore(diagnosticsSnapshot.motionScore)} />
                <DiagnosticCell label="Lighting" value={formatDiagnosticScore(diagnosticsSnapshot.lightingScore)} />
                <DiagnosticCell label="Glare" value={formatDiagnosticScore(diagnosticsSnapshot.glareScore)} />
                <DiagnosticCell label="Capture" value={diagnosticsSnapshot.captureState.replaceAll('_', ' ')} />
                <DiagnosticCell label="Duplicate" value={diagnosticsSnapshot.duplicateFingerprintStatus.replaceAll('_', ' ')} />
                <DiagnosticCell label="Recognition" value={diagnosticsSnapshot.recognitionStage.replaceAll('_', ' ')} />
                <DiagnosticCell label="Session" value={diagnosticsSnapshot.sessionInsertionResult.replaceAll('_', ' ')} />
                <DiagnosticCell label="OCR stage" value={recognitionStage.replaceAll('_', ' ')} />
                <DiagnosticCell label="OCR latency" value={magicStillScan?.ok ? `${magicStillScan.ocr.latencyMs} ms` : 'unavailable'} />
                <DiagnosticCell label="Scryfall" value={magicStillScan?.ok ? `${magicStillScan.lookupLatencyMs} ms` : 'unavailable'} />
                <DiagnosticCell label="Cleanup" value={cleanupDiagnostic(magicStillScan)} />
              </View>
              {magicStillScan?.ok ? (
                <View style={s.optionGroup}>
                  <TDText variant="caption" tone="muted">Raw title: {magicStillScan.signals.rawTitle ?? 'unavailable'}</TDText>
                  <TDText variant="caption" tone="muted">Normalized title: {magicStillScan.signals.normalizedTitle ?? 'unavailable'}</TDText>
                  <TDText variant="caption" tone="muted">Collector OCR: {magicStillScan.signals.rawCollectorText ?? 'unavailable'}</TDText>
                  <TDText variant="caption" tone="muted">Parsed: {magicStillScan.signals.collectorInfo?.setCode ?? 'set ?'} #{magicStillScan.signals.collectorInfo?.collectorNumber ?? '?'}</TDText>
                  <TDText variant="caption" tone="muted">Top three: {magicStillScan.candidates.slice(0, 3).map((candidate) => `${candidate.name} ${candidate.setCode ?? '?'} #${candidate.collectorNumber ?? '?'}`).join(' | ') || 'unavailable'}</TDText>
                </View>
              ) : null}
              <View style={s.diagnosticsControls}>
                <TDButton label="Scale -" variant="secondary" onPress={() => updateCalibration({ guideScale: scannerCalibration.guideScale - 0.02 })} />
                <TDButton label="Scale +" variant="secondary" onPress={() => updateCalibration({ guideScale: scannerCalibration.guideScale + 0.02 })} />
                <TDButton label="Guide up" variant="secondary" onPress={() => updateCalibration({ verticalOffset: scannerCalibration.verticalOffset - 8 })} />
                <TDButton label="Guide down" variant="secondary" onPress={() => updateCalibration({ verticalOffset: scannerCalibration.verticalOffset + 8 })} />
                <TDButton label="Reset" variant="secondary" onPress={() => updateCalibration(normalizeScannerCalibrationPreferences())} />
              </View>
              <TDText variant="caption" tone="muted">Foil test mode: {foilDiagnostics.status}; {foilDiagnostics.frameCount} frames. Finish remains manually editable.</TDText>
            </View>
          ) : null}
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
        {recognitionStage === 'reading_title' ? <TDLoadingState title="Reading title" message="Apple Vision is reading local guide regions." /> : null}
        {recognitionStage === 'finding_card' ? <TDLoadingState title="Finding card" message="Matching OCR observations against Scryfall printings." /> : null}
        {!searching && magicRecognition?.ok && magicRecognition.selected ? (
          <TDCard style={s.section}>
            <View style={s.syncHeader}>
              <View style={s.flex}>
                <TDText variant="title">Magic recognition</TDText>
                <TDText variant="small" tone="muted">{magicRecognition.selected.name} - {magicRecognition.selected.setCode ?? 'Set unavailable'} #{magicRecognition.selected.collectorNumber ?? '?'}</TDText>
              </View>
              <TDBadge tone={magicPresentation?.tone ?? 'warning'}>
                {magicPresentation?.label ?? 'Manual review required'} - {magicRecognition.confidence.overall}%
              </TDBadge>
            </View>
            <TDText variant="small" tone="muted">{magicPresentation?.description ?? 'Assisted by Scryfall metadata. Confirm the exact printing before saving.'}</TDText>
            <TDText variant="caption" tone="muted">Signal source: {magicStillScan?.ok ? 'Apple Vision title/collector OCR plus Scryfall metadata. Artwork and finish remain unavailable.' : 'Scryfall metadata and supplied scanner observations. Visual certainty is not benchmarked yet.'}</TDText>
            {magicStillScan?.ok ? (
              <View style={s.optionGroup}>
                <TDText variant="caption" tone="muted">Raw OCR title: {magicStillScan.signals.rawTitle ?? 'Unavailable'}</TDText>
                <TDText variant="caption" tone="muted">Normalized title: {magicStillScan.signals.normalizedTitle ?? 'Unavailable'}</TDText>
                <TDText variant="caption" tone="muted">Collector OCR: {magicStillScan.signals.rawCollectorText ?? 'Unavailable'}</TDText>
              </View>
            ) : null}
            <View style={s.signalGrid}>
              {magicRecognition.confidence.signals.map((signal) => (
                <View key={signal.key} style={s.signalCell}>
                  <TDText variant="caption" tone="muted">{signal.label}</TDText>
                  <TDText variant="small">{signal.score === null ? 'Missing' : `${signal.score}%`}</TDText>
                </View>
              ))}
            </View>
            {magicRecognition.candidates.length > 1 ? (
              <View style={s.optionGroup}>
                <TDText variant="label" tone="muted">Top alternatives</TDText>
                {magicRecognition.candidates.slice(1).map((candidate) => (
                  <TDText key={candidate.id} variant="caption" tone="muted">{candidate.name} - {candidate.setCode ?? 'Set unavailable'} #{candidate.collectorNumber ?? '?'}</TDText>
                ))}
              </View>
            ) : null}
            <TDButton label={showMagicWhy ? 'Hide match details' : 'Why this match?'} variant="secondary" onPress={() => setShowMagicWhy((value) => !value)} />
            <View style={s.syncActions}>
              <TDButton label="Accept top match" disabled={!acceptedOcrCandidate} onPress={() => acceptedOcrCandidate ? selectCandidate(acceptedOcrCandidate) : undefined} />
              <TDButton label="Retake" variant="secondary" onPress={() => {
                setCameraReady(false);
                setCaptureState('camera_not_ready');
                setRecognitionStage('idle');
                setCameraActive(true);
              }} />
              <TDButton label="Manual search" variant="secondary" onPress={() => setMagicStillScan(null)} />
            </View>
            {showMagicWhy ? (
              <View style={s.optionGroup}>
                {magicRecognition.explanation.map((line) => <TDText key={line} variant="caption" tone="muted">{line}</TDText>)}
              </View>
            ) : null}
          </TDCard>
        ) : null}
        {!searching && magicRecognition && !magicRecognition.ok ? (
          <TDCard style={s.noticeCard}>
            <TDBadge tone={magicRecognition.offline ? 'warning' : 'info'}>Magic recognition</TDBadge>
            <TDText variant="small" tone="muted">{magicRecognition.reason}</TDText>
          </TDCard>
        ) : null}
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
            {offerWorkspace ? (
              <TDInput label="Market price" value={marketPrice} onChangeText={setMarketPrice} keyboardType="decimal-pad" placeholder="Pricing unavailable" />
            ) : null}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: addToWishlist }} onPress={() => setAddToWishlist((value) => !value)} style={s.checkboxRow}>
              <Ionicons name={addToWishlist ? 'checkbox-outline' : 'square-outline'} size={22} color={color.primaryBright} />
              <TDText variant="small">Also add this exact card target to Wishlist</TDText>
            </Pressable>
            <TDButton label={sessionMode === 'collection_intake' ? 'Add to Collection' : 'Add to session'} loading={saving} onPress={save} />
          </TDCard>
        ) : null}

        {session?.lines.length ? (
          <TDCard style={s.section}>
            <View style={s.syncHeader}>
              <View style={s.flex}>
                <TDText variant="title">Recent scans</TDText>
                <TDText variant="small" tone="muted">Session is saved locally by user. Missing prices are not counted as zero.</TDText>
              </View>
              <TDButton label="Review" variant="secondary" onPress={() => router.push('/scanner-session' as never)} />
            </View>
            {session.lines.slice(-4).reverse().map((line) => (
              <View key={line.id} style={s.sessionLine}>
                <View style={s.flex}>
                  <TDText variant="small">{line.cardName}</TDText>
                  <TDText variant="caption" tone="muted">{line.game} - {line.setCode ?? 'Set unavailable'} #{line.collectorNumber ?? '?'} - {String(line.finish)}</TDText>
                </View>
                <TDBadge tone={line.reviewStatus === 'confirmed' ? 'success' : line.reviewStatus === 'needs_review' ? 'warning' : 'info'}>{line.reviewStatus.replaceAll('_', ' ')}</TDBadge>
                <TDText variant="small">{line.cashOffer === null ? 'No price' : `$${line.cashOffer.toFixed(2)}`}</TDText>
              </View>
            ))}
            <View style={s.syncActions}>
              <TDButton label="Confirm Collection lines" variant="secondary" loading={saving} onPress={commitConfirmedCollectionLines} />
              <TDButton label="Export CSV" variant="secondary" onPress={() => setSuccess(`${serializeContinuousScannerCsv(buildContinuousScannerCsvRows(session)).split('\n').length - 1} rows ready for explicit share/export.`)} />
            </View>
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
        {options.map((option) => <TDChip key={option} label={display(option)} selected={option === value} onPress={() => onSelect(option)} />)}
      </View>
    </View>
  );
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

function recognitionStageLabel(stage: ScanRecognitionStage, autoCaptureReason?: string) {
  if (stage === 'reading_title') return 'Reading title from the local captured still';
  if (stage === 'finding_card') return 'Finding card in Scryfall';
  if (stage === 'review_ready') return 'Review the top match and alternatives';
  if (stage === 'failed') return 'OCR needs manual search fallback';
  return `Auto-capture unavailable: ${autoCaptureReason ?? 'manual still capture is active'}`;
}

function cleanupDiagnostic(scan: MagicStillScanResult | null) {
  if (!scan?.cleanup) return 'unavailable';
  if (scan.cleanup.ok && scan.cleanup.deleted) return 'deleted';
  if (scan.cleanup.ok) return scan.cleanup.reason.replaceAll('_', ' ');
  return 'failed';
}

function scannerCandidateToRecognitionCandidate(candidate: ScannerCardCandidate): RecognitionCandidate {
  return {
    ...candidate,
    legalFinishes: candidate.finishes,
    layout: null,
    colorIdentity: [],
  };
}

function DiagnosticCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.signalCell}>
      <TDText variant="caption" tone="muted">{label}</TDText>
      <TDText variant="small">{value}</TDText>
    </View>
  );
}

async function loadContinuousSession(userId: string) {
  const raw = await appStorage.getItem(continuousScannerSessionKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ContinuousScannerSession;
    return parsed.userId === userId ? parsed : null;
  } catch {
    return null;
  }
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

function currency(value: number | null | undefined) {
  return value === null || value === undefined ? 'Pricing unavailable' : `$${value.toFixed(2)}`;
}

function formatDiagnosticScore(value: number | null) {
  return value === null ? 'unavailable' : value.toFixed(2);
}

function createScanId() {
  return globalThis.crypto?.randomUUID?.() ?? `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const s = StyleSheet.create({
  screen: { paddingTop: 56 },
  content: { gap: space.md, paddingBottom: 128 },
  header: { gap: space.xs },
  cameraCard: { gap: space.md },
  sessionCard: { gap: space.md },
  cameraFrame: { minHeight: 300, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg, backgroundColor: color.canvasRaised },
  cameraPreview: { minHeight: 360, overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, backgroundColor: color.canvasRaised },
  cardGuide: { position: 'absolute', top: 42, borderRadius: radius.md, borderWidth: 2, borderColor: color.primaryBright, alignItems: 'center', justifyContent: 'flex-end', padding: space.sm },
  guideCorner: { position: 'absolute', top: -2, left: -2, width: 42, height: 42, borderTopWidth: 4, borderLeftWidth: 4, borderColor: color.info, borderTopLeftRadius: radius.md },
  guideCornerRight: { left: undefined, right: -2, borderLeftWidth: 0, borderRightWidth: 4, borderTopRightRadius: radius.md },
  guideCornerBottom: { top: undefined, bottom: -2, borderTopWidth: 0, borderBottomWidth: 4, borderBottomLeftRadius: radius.md },
  guideCornerBottomRight: { top: undefined, left: undefined, right: -2, bottom: -2, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: radius.md },
  liveStatus: { position: 'absolute', top: space.sm, right: space.sm, left: space.sm, gap: space.xs },
  cameraControls: { position: 'absolute', right: space.sm, bottom: space.sm, left: space.sm, flexDirection: 'row', gap: space.sm, justifyContent: 'center', flexWrap: 'wrap' },
  statusRow: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  diagnosticsCard: { gap: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.md, backgroundColor: color.canvasRaised },
  diagnosticsControls: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  centerText: { textAlign: 'center' },
  noticeCard: { gap: space.sm },
  syncCard: { gap: space.md },
  syncHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  syncActions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  section: { gap: space.md },
  offerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sessionLine: { minHeight: 64, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.canvasRaised },
  candidate: { minHeight: 112, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.canvasRaised },
  candidateSelected: { borderColor: color.primaryBright, backgroundColor: color.primary + '24' },
  cardImage: { width: 58, height: 82, borderRadius: radius.sm, backgroundColor: color.surface },
  imageFallback: { width: 58, height: 82, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  flex: { flex: 1 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  signalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  signalCell: { minWidth: 116, flexGrow: 1, borderRadius: radius.sm, borderWidth: 1, borderColor: color.border, padding: space.sm, backgroundColor: color.canvasRaised },
  optionGroup: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  checkboxRow: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm },
});

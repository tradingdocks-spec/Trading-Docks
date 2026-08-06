import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentProps, type RefObject } from 'react';
import { AccessibilityInfo, AppState, Platform, Pressable, Share, StyleSheet, View, useWindowDimensions, type AppStateStatus, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TDBadge,
  TDButton,
  TDCard,
  TDChip,
  TDEmptyState,
  TDErrorState,
  TDIconButton,
  TDInput,
  TDLoadingState,
  TDScreen,
  TDSessionStrip as TDSessionStripPrimitive,
  TDText,
} from '@/components/design-system';
import { color, radius, space } from '@/design';
import { useAccount } from '@/providers/account';
import { CARD_CONDITION_OPTIONS, TRADE_BINDER_STATUS_OPTIONS } from '@/services/collector-mutations';
import {
  SCANNER_SESSION_MODES,
  addRecognitionToSession,
  batchScannerInstructionForState,
  batchScannerNoticeForLine,
  batchScannerReviewChipModel,
  batchScannerTimingSummary,
  calculateCardGuideLayout,
  calculateSessionTotals,
  continuousScannerSessionKey,
  createContinuousScannerRuntime,
  createContinuousScannerSession,
  createRecognitionPipelineReport,
  markCaptureStarted,
  markScanResult,
  scannerModeLabel,
  shouldAddRecognitionToBatch,
  undoMostRecentScan,
  type ContinuousScannerMode,
  type ContinuousScannerSession,
  type BatchScannerNoticeModel,
  type BatchScannerTimingSnapshot,
} from '@/services/continuous-offer-scanner';
import { displayCondition, displayFinish } from '@/services/collector-workspace';
import { recognizeMagicCard, type MagicRecognitionResult } from '@/services/magic-recognition-provider';
import { deleteCapturedStill, recognizeMagicStillCapture, type CropRect, type MagicStillScanResult } from '@/services/magic-ocr-pipeline';
import { getVisionOcrRuntimeDiagnostics, type NativeOcrRuntimeDiagnostics } from '@/modules/trading-docks-vision-ocr';
import { loadScannerContext, loadScannerDraft, saveScannerDraft, searchScannerPrintings } from '@/services/scanner-data';
import {
  createInterruptedScanDraft,
  resetAfterRapidScan,
  resolveScannerPermissionState,
  scannerPrivacySummary,
  tradeStatusForScanner,
  type ScannerCardCandidate,
  type ScannerPermissionState,
} from '@/services/scanner-foundation';
import type { RecognitionCandidate } from '@/services/scanner-intelligence';
import { listScannerQueuedAdds, retryQueuedScannerAdds, type ScannerQueuedAdd } from '@/services/scanner-replay';
import { enrichScannerSessionLinePrice } from '@/services/scanner-price-enrichment';
import {
  appendScannerPerformanceSample,
  buildScannerPerformanceReport,
  createScannerPerformanceSample,
  serializeScannerPerformanceReport,
  type ScannerPerformanceSample,
} from '@/services/scanner-performance-instrumentation';
import {
  scannerCameraFraming,
  scannerCameraViewQualityProps,
  scannerCaptureOptions,
} from '@/services/scanner-camera-quality';
import {
  NO_NATIVE_VISUAL_SIGNALS,
  applyScannerCalibrationToGuide,
  buildGuideCropMapping,
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
import {
  buildPremiumResultTray,
  dominantScannerSurface,
  guidePresentationForPipeline,
  highVolumeCardShowDefaults,
  resolvePremiumScannerPipeline,
  resolveScanner2InteractionState,
  scanner2HeaderModel,
  scanner2MainControls,
  scanner2MotionForState,
  shouldBlockScannerCapture,
  shouldHideScannerPrimaryControls,
  shouldScannerCameraRender,
  shouldShowScannerResumeAction,
  shouldRenderDiagnosticsInline,
  resolveScanner2CameraLifecycle,
  type PremiumScannerGuidePresentation,
  type PremiumResultTrayKind,
  type Scanner2CameraLifecycleState,
} from '@/services/premium-scanner-experience';
import { appStorage } from '@/services/storage/app-storage';
import type { StorageLocation } from '@/services/storage-location-manager';

type ScannerContext = { userId: string; locations: StorageLocation[]; currentTotalQuantity: number };
type ScanRecognitionStage = 'idle' | 'reading_title' | 'finding_card' | 'review_ready' | 'failed';
const INITIAL_SESSION_MODE: ContinuousScannerMode = 'card_show_purchase';

export default function Scan() {
  const { accountType } = useAccount();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cameraRef = useRef<CameraView | null>(null);
  const mountedRef = useRef(true);
  const activeCaptureIdRef = useRef<string | null>(null);
  const activeSearchIdRef = useRef<string | null>(null);
  const scryfallSearchCacheRef = useRef(new Map<string, ScannerCardCandidate[]>());
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [context, setContext] = useState<ScannerContext | null>(null);
  const [sessionMode, setSessionMode] = useState<ContinuousScannerMode>(INITIAL_SESSION_MODE);
  const [session, setSession] = useState<ContinuousScannerSession | null>(null);
  const [autoScanner, setAutoScanner] = useState(() => createContinuousScannerRuntime({ scanId: createScanId() }));
  const [permission, setPermission] = useState<ScannerPermissionState>('not_requested');
  const [cameraActive, setCameraActive] = useState(false);
  const [userPausedCamera, setUserPausedCamera] = useState(false);
  const [appForegrounded, setAppForegrounded] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [previewDimensions, setPreviewDimensions] = useState<PreviewDimensions | null>(null);
  const [captureState, setCaptureState] = useState<ScannerCaptureState>('idle');
  const [recognitionStage, setRecognitionStage] = useState<ScanRecognitionStage>('idle');
  const [sessionInsertionResult, setSessionInsertionResult] = useState<ScannerDiagnosticsSnapshot['sessionInsertionResult']>('not_attempted');
  const [scannerCalibration, setScannerCalibration] = useState<ScannerCalibrationPreferences>(() => normalizeScannerCalibrationPreferences());
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [lastCaptureId, setLastCaptureId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<ScannerCardCandidate[]>([]);
  const [magicRecognition, setMagicRecognition] = useState<MagicRecognitionResult | null>(null);
  const [magicStillScan, setMagicStillScan] = useState<MagicStillScanResult | null>(null);
  const [diagnosticCaptureUri, setDiagnosticCaptureUri] = useState<string | null>(null);
  const [ocrRuntimeDiagnostics, setOcrRuntimeDiagnostics] = useState<NativeOcrRuntimeDiagnostics | null>(null);
  const [selected, setSelected] = useState<ScannerCardCandidate | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState(CARD_CONDITION_OPTIONS[0]);
  const [finish, setFinish] = useState<'normal' | 'foil' | 'etched'>('normal');
  const [language, setLanguage] = useState('en');
  const [storageLocationId, setStorageLocationId] = useState<string | null>(null);
  const [tradeStatus, setTradeStatus] = useState(tradeStatusForScanner('not_for_trade'));
  const [purchaseRate, setPurchaseRate] = useState('70');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [queuedAdds, setQueuedAdds] = useState<ScannerQueuedAdd[]>([]);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showManualSearchSheet, setShowManualSearchSheet] = useState(false);
  const [showDiagnosticsSheet, setShowDiagnosticsSheet] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [batchNotice, setBatchNotice] = useState<(BatchScannerNoticeModel & { lineId: string }) | null>(null);
  const [scanTimings, setScanTimings] = useState<BatchScannerTimingSnapshot[]>([]);
  const [scannerPerformanceSamples, setScannerPerformanceSamples] = useState<ScannerPerformanceSample[]>([]);
  const [scannerPerformanceJsonSummary, setScannerPerformanceJsonSummary] = useState<string | null>(null);
  const batchNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cameraAvailable = Platform.OS !== 'web' || typeof navigator !== 'undefined';
  const diagnosticsEnabled = isScannerDiagnosticsEnabled();
  const privacy = scannerPrivacySummary();
  const cameraFraming = useMemo(() => scannerCameraFraming({
    viewportWidth: width,
    viewportHeight: height,
    safeTop: insets.top,
    safeBottom: insets.bottom,
  }), [height, insets.bottom, insets.top, width]);
  const cameraStageHeight = cameraFraming.cameraStageHeight;
  const previewWidth = width;
  const baseGuideLayout = useMemo(
    () => calculateCardGuideLayout(cameraFraming.guideLayoutInput),
    [cameraFraming],
  );
  const guideLayout = useMemo(
    () => applyScannerCalibrationToGuide(baseGuideLayout, previewWidth, scannerCalibration),
    [baseGuideLayout, previewWidth, scannerCalibration],
  );
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
  const scannerPipeline = useMemo(() => resolvePremiumScannerPipeline({
    permissionGranted: permission === 'granted',
    cameraReady,
    cameraActive,
    captureState,
    recognitionStage,
    selectedCandidate: selected,
    hasError: Boolean(error && recognitionStage !== 'failed'),
    awaitingCardRemoval: autoScanner.duplicateProtection.awaitingCardRemoval,
    justAdded: Boolean(batchNotice),
  }), [autoScanner.duplicateProtection.awaitingCardRemoval, batchNotice, cameraActive, cameraReady, captureState, error, permission, recognitionStage, selected]);
  const scannerProcessing = recognitionStage === 'reading_title' || recognitionStage === 'finding_card' || captureState === 'capturing' || captureState === 'captured';
  const cameraLifecycle = useMemo(() => resolveScanner2CameraLifecycle({
    permission,
    cameraAvailable,
    cameraReady,
    userPaused: userPausedCamera,
    appForegrounded,
    processing: scannerProcessing,
    hasCameraError: captureState === 'failed' && Boolean(error),
  }), [appForegrounded, cameraAvailable, cameraReady, captureState, error, permission, scannerProcessing, userPausedCamera]);
  const guidePresentation = useMemo(
    () => guidePresentationForPipeline(scannerPipeline, autoScanner.lastGuidance),
    [autoScanner.lastGuidance, scannerPipeline],
  );
  const failedResultTray = useMemo(() => buildPremiumResultTray({
    selectedCandidate: null,
    topCandidate: null,
    candidateCount: 0,
    confidenceLabel: null,
    confidenceScore: null,
    failedReason: recognitionStage === 'failed'
      ? error ?? (!magicRecognition?.ok ? magicRecognition?.reason : null) ?? 'Recognition did not complete.'
      : null,
    marketPrice: null,
    cashOffer: null,
  }), [error, magicRecognition, recognitionStage]);
  const highVolumeDefaults = useMemo(
    () => highVolumeCardShowDefaults({ defaultCondition: condition, defaultFinish: finish, defaultLanguage: language, cashOfferRate: parseOptionalPercentage(purchaseRate) ?? 70 }),
    [condition, finish, language, purchaseRate],
  );
  const renderDiagnosticsInline = shouldRenderDiagnosticsInline(diagnosticsEnabled);
  const visibleSurface = dominantScannerSurface({
    hasResultTray: Boolean(failedResultTray),
    isReading: recognitionStage === 'reading_title',
    isSearching: recognitionStage === 'finding_card' || searching,
    hasCameraPrompt: permission !== 'granted' || !cameraActive,
  });
  const scanner2State = resolveScanner2InteractionState({
    loading,
    permission,
    cameraActive,
    cameraReady,
    captureState,
    recognitionStage,
    trayKind: null,
    awaitingCardRemoval: autoScanner.duplicateProtection.awaitingCardRemoval,
    justAdded: Boolean(batchNotice),
    offline: Boolean(magicRecognition && !magicRecognition.ok && magicRecognition.offline),
    hasCameraError: captureState === 'camera_not_ready' && Boolean(error),
  });
  const guideMotion = scanner2MotionForState(scanner2State, reduceMotion);
  const scannerInstruction = batchScannerInstructionForState(
    scanner2State === 'capturing' ? 'capturing'
      : scanner2State === 'reading' ? 'reading'
        : scanner2State === 'searching' ? 'matching'
          : scanner2State === 'added' ? 'added'
            : scanner2State === 'remove_card' ? 'remove_card'
              : scanner2State === 'failed' ? 'failed'
                : scanner2State === 'paused' ? 'paused'
                  : scanner2State === 'offline' ? 'offline'
                    : scanner2State === 'camera_error' ? 'camera_error'
                      : 'ready',
  );
  const scannerHeader = scanner2HeaderModel({
    modeLabel: scannerModeLabel(sessionMode),
    cardCount: sessionTotals?.cardsScanned ?? 0,
    marketTotal: sessionTotals?.marketValue ?? null,
    offerTotal: sessionTotals?.cashOffer ?? null,
    reviewCount: sessionTotals?.needsReview ?? 0,
  });
  const sessionStrip = batchScannerReviewChipModel({
    cardCount: sessionTotals?.cardsScanned ?? 0,
    reviewCount: sessionTotals?.needsReview ?? 0,
  });
  const scannerPerformanceReport = useMemo(
    () => buildScannerPerformanceReport(scannerPerformanceSamples),
    [scannerPerformanceSamples],
  );
  const sheetOpen = showSettingsSheet || showManualSearchSheet || showDiagnosticsSheet;
  const hideMainControls = shouldHideScannerPrimaryControls({
    processing: scannerProcessing,
    saving: false,
    sheetOpen,
    state: scanner2State,
  });
  const showAddedOverlay = scanner2State === 'added' || scanner2State === 'remove_card';

  useEffect(() => {
    mountedRef.current = true;
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
      mountedRef.current = false;
      activeCaptureIdRef.current = null;
      activeSearchIdRef.current = null;
      if (batchNoticeTimerRef.current) clearTimeout(batchNoticeTimerRef.current);
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const foregrounded = nextState === 'active';
      setAppForegrounded(foregrounded);
      if (!foregrounded) {
        activeCaptureIdRef.current = null;
        setCameraActive(false);
        return;
      }
      if (permission === 'granted' && !userPausedCamera) setCameraActive(true);
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [permission, userPausedCamera]);

  useEffect(() => () => {
    if (diagnosticCaptureUri) void deleteCapturedStill(diagnosticCaptureUri);
  }, [diagnosticCaptureUri]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (!cameraPermission) return;
    const nextPermission = resolveScannerPermissionState({
      cameraAvailable,
      permissionGranted: cameraPermission.granted,
      permissionDenied: cameraPermission.status === 'denied',
      requested: cameraPermission.status !== 'undetermined',
    });
    setPermission(nextPermission);
    if (nextPermission === 'granted') {
      if (!userPausedCamera && appForegrounded) setCameraActive(true);
      return;
    }
    if (nextPermission === 'not_requested') {
      void requestCameraPermission();
    }
  }, [appForegrounded, cameraAvailable, cameraPermission, requestCameraPermission, userPausedCamera]);

  useEffect(() => {
    if (!context || !diagnosticsEnabled) return;
    void appStorage.setItem(nativeScannerCalibrationKey(context.userId), JSON.stringify(scannerCalibration));
  }, [context, diagnosticsEnabled, scannerCalibration]);

  useEffect(() => {
    if (!diagnosticsEnabled) return;
    void getVisionOcrRuntimeDiagnostics().then(setOcrRuntimeDiagnostics);
  }, [diagnosticsEnabled]);

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
      confirmation: selected ? { quantity, condition, finish, language, storageLocationId, tradeStatus, addToWishlist: false } : null,
    }));
  }, [condition, context, finish, language, quantity, query, selected, storageLocationId, tradeStatus]);

  useEffect(() => {
    const next = resolveScannerPermissionState({
      cameraAvailable,
      permissionGranted: cameraPermission?.granted,
      permissionDenied: cameraPermission ? !cameraPermission.granted && !cameraPermission.canAskAgain : false,
      requested: Boolean(cameraPermission),
    });
    setPermission(next);
    setCameraActive(next === 'granted' && !userPausedCamera && appForegrounded);
    if (next !== 'granted') {
      setCameraReady(false);
      setCaptureState(next === 'unavailable' ? 'failed' : 'idle');
    }
  }, [appForegrounded, cameraAvailable, cameraPermission, userPausedCamera]);

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

  const cleanupDiagnosticCapture = async () => {
    const uri = diagnosticCaptureUri;
    setDiagnosticCaptureUri(null);
    if (uri) await deleteCapturedStill(uri);
  };

  const showBatchNotice = (notice: BatchScannerNoticeModel & { lineId: string }) => {
    if (batchNoticeTimerRef.current) clearTimeout(batchNoticeTimerRef.current);
    setBatchNotice(notice);
    batchNoticeTimerRef.current = setTimeout(() => {
      setBatchNotice(null);
      batchNoticeTimerRef.current = null;
    }, 2400);
  };

  const addCandidateToBatch = (input: {
    candidate: ScannerCardCandidate;
    recognition: MagicRecognitionResult | null;
    stableScanId: string;
    source: 'assisted_capture' | 'manual_search';
    fingerprint?: string | null;
    timing?: Partial<BatchScannerTimingSnapshot>;
    captureResolution?: { width: number; height: number } | null;
  }) => {
    if (!session) return null;
    const startedAt = scannerNow();
    const recognitionReport = createRecognitionPipelineReport({
      detectedGame: 'magic',
      candidates: [input.candidate, ...candidates.filter((candidate) => candidate.id !== input.candidate.id)],
      confidence: input.recognition?.ok ? input.recognition.confidence : {
        overall: Math.round(input.candidate.confidence * 100),
        threshold: 82,
        requiresConfirmation: true,
        conflicts: input.source === 'manual_search' ? ['Manual search entries require review in the list.'] : ['Assisted capture requires review.'],
        signals: [],
      },
      recognitionMethod: input.source === 'manual_search' ? 'manual_search' : 'metadata_assisted',
    });
    if (!shouldAddRecognitionToBatch({
      candidateCount: recognitionReport.topThree.length,
      confidenceState: recognitionReport.confidenceState,
    })) return null;
    const rate = parseOptionalPercentage(purchaseRate) ?? session.offerConfig.defaultCashPercentage;
    const candidateFinish = (input.candidate.finishes.find((candidateFinishOption) => candidateFinishOption === finish) ?? input.candidate.finishes.find((candidateFinishOption) => candidateFinishOption === 'normal' || candidateFinishOption === 'foil' || candidateFinishOption === 'etched') ?? finish) as 'normal' | 'foil' | 'etched';
    const sessionWithRate = {
      ...session,
      offerConfig: { ...session.offerConfig, defaultCashPercentage: rate },
    };
    const nextSession = addRecognitionToSession(sessionWithRate, {
      stableScanId: input.stableScanId,
      candidate: input.candidate,
      recognition: recognitionReport,
      quantity,
      condition,
      finish: candidateFinish,
      language: input.candidate.language ?? language,
      marketPrice: null,
      priceSource: null,
      priceTimestamp: null,
      storageLocationId,
      tradeStatus,
      destination: sessionWithRate.defaultDestination,
      notes: 'Pricing and final card decisions are handled in the Review List.',
    });
    const addedLine = nextSession.lines[nextSession.lines.length - 1];
    setSession(nextSession);
    setSessionInsertionResult('inserted');
    setAutoScanner((current) => markScanResult(current, {
      printingId: input.candidate.id,
      fingerprint: input.fingerprint ?? capturedFrame,
      now: scannerNow(),
      scanId: input.stableScanId,
    }));
    const timingSummary = batchScannerTimingSummary({
      ...input.timing,
      sessionWriteMs: scannerNow() - startedAt,
    });
    setScanTimings((current) => [timingSummary, ...current].slice(0, 5));
    if (diagnosticsEnabled) {
      setScannerPerformanceSamples((current) => appendScannerPerformanceSample(current, createScannerPerformanceSample({
        previousSamples: current,
        source: input.source,
        timing: timingSummary,
        cameraFps: null,
        previewResolution: previewDimensions,
        captureResolution: input.captureResolution ?? null,
      })));
    }
    showBatchNotice({ ...batchScannerNoticeForLine(addedLine), lineId: addedLine.id });
    void Promise.resolve().then(() => {
      setSession((current) => {
        if (!current) return current;
        const enrichment = enrichScannerSessionLinePrice({
          session: current,
          lineId: addedLine.id,
          stableScanId: addedLine.stableScanId,
          candidate: input.candidate,
          finish: candidateFinish,
        });
        return enrichment.session;
      });
    });
    resetScannerForm({ preserveNotice: true });
    return addedLine;
  };

  const toggleCameraPause = () => {
    setCameraActive((active) => {
      const nextActive = !active;
      setUserPausedCamera(!nextActive);
      return nextActive;
    });
  };

  const retakeScan = () => {
    activeCaptureIdRef.current = null;
    activeSearchIdRef.current = null;
    setLastCaptureId(null);
    setCapturedFrame(null);
    void cleanupDiagnosticCapture();
    setMagicStillScan(null);
    setMagicRecognition(null);
    setCandidates([]);
    setSelected(null);
    setError(null);
    setSuccess(null);
    setSessionInsertionResult('not_attempted');
    setRecognitionStage('idle');
    setCaptureState(cameraReady ? 'ready' : 'camera_not_ready');
    setUserPausedCamera(false);
    setCameraActive(appForegrounded);
  };

  const captureStill = async () => {
    if (shouldBlockScannerCapture({ lifecycle: cameraLifecycle, captureState, recognitionStage })) return;
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
      const captureStartedAt = scannerNow();
      if (diagnosticCaptureUri) void cleanupDiagnosticCapture();
      const captureId = createScanId();
      activeCaptureIdRef.current = captureId;
      setLastCaptureId(captureId);
      setCaptureState('capturing');
      const cameraCaptureStartedAt = scannerNow();
      const photo = await cameraRef.current.takePictureAsync(scannerCaptureOptions());
      const cameraCaptureMs = scannerNow() - cameraCaptureStartedAt;
      if (!mountedRef.current || activeCaptureIdRef.current !== captureId) return;
      const frameLabel = `${photo.width} x ${photo.height}`;
      setCapturedFrame(frameLabel);
      setCaptureState('captured');
      setRecognitionStage('reading_title');
      setAutoScanner((current) => markCaptureStarted(current));
      const scan = await recognizeMagicStillCapture({
        imageUri: photo.uri,
        preview: previewDimensions ?? { width: previewWidth, height: cameraStageHeight },
        image: { width: photo.width, height: photo.height },
        guide: guideLayout,
        online: true,
        cachedCandidates: candidates.map(scannerCandidateToRecognitionCandidate),
        deferCleanup: diagnosticsEnabled,
        onStage: (stage) => {
          if (mountedRef.current && activeCaptureIdRef.current === captureId) setRecognitionStage(stage);
        },
      });
      if (!mountedRef.current || activeCaptureIdRef.current !== captureId) return;
      if (diagnosticsEnabled) setDiagnosticCaptureUri(photo.uri);
      setMagicStillScan(scan);
      if (scan.ok) {
        setCaptureState('ready');
        setCandidates(scan.candidates);
        const batchCandidate = scan.selected ?? scan.candidates[0] ?? null;
        setSelected(batchCandidate);
        setMagicRecognition(scan.recognition);
        setQuery(scan.signals.normalizedTitle ?? query);
        if (batchCandidate) {
          addCandidateToBatch({
            candidate: batchCandidate,
            recognition: scan.recognition,
            stableScanId: captureId,
            source: 'assisted_capture',
            fingerprint: frameLabel,
            captureResolution: { width: photo.width, height: photo.height },
            timing: {
              captureMs: cameraCaptureMs,
              cropMs: scan.cropDiagnostics ? null : null,
              ocrMs: scan.ocr.latencyMs,
              scryfallMs: scan.lookupLatencyMs,
              totalMs: scannerNow() - captureStartedAt,
              fallbackCount: Math.max(0, scan.signals.titleAttempts.length - 1),
            },
          });
          setRecognitionStage('idle');
        } else {
          setSessionInsertionResult('failed');
          setRecognitionStage('failed');
          setError('No Magic printing was selected. Retake or search manually.');
        }
      } else {
        setCaptureState('ready');
        setMagicRecognition(scan.ocr?.ok === false ? { ok: false, reason: scan.reason, offline: false } : null);
        setSessionInsertionResult('failed');
        setRecognitionStage('failed');
        setError(`${scan.reason} Manual search is still available.`);
      }
      activeCaptureIdRef.current = null;
      if (!userPausedCamera && appForegrounded) setCameraActive(true);
    } catch (captureError) {
      activeCaptureIdRef.current = null;
      if (!userPausedCamera && appForegrounded) setCameraActive(true);
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
    const searchId = createScanId();
    const searchQuery = query.trim();
    const cacheKey = searchQuery.toLowerCase();
    activeSearchIdRef.current = searchId;
    setSearching(true);
    setError(null);
    setSuccess(null);
    try {
      const cachedCandidates = scryfallSearchCacheRef.current.get(cacheKey);
      const result = cachedCandidates
        ? { ok: true as const, candidates: cachedCandidates, assisted: false }
        : await searchScannerPrintings(searchQuery, true);
      if (!mountedRef.current || activeSearchIdRef.current !== searchId) return;
      if (result.ok) {
        if (!cachedCandidates) scryfallSearchCacheRef.current.set(cacheKey, result.candidates);
        setCandidates(result.candidates);
        setMagicStillScan(null);
        const recognition = await recognizeMagicCard({
          nameObservation: { regionType: 'name', text: query, confidence: 72 },
          online: false,
          cachedCandidates: result.candidates.map(scannerCandidateToRecognitionCandidate),
        });
        if (!mountedRef.current || activeSearchIdRef.current !== searchId) return;
        setMagicRecognition(recognition);
        if (!result.candidates.length) setError('No printings found. Try the exact card name.');
        else if (result.warning) setError(result.warning);
      } else {
        setCandidates([]);
        setMagicRecognition(null);
        setError(result.reason);
      }
    } catch (searchError) {
      if (mountedRef.current && activeSearchIdRef.current === searchId) setError(searchError instanceof Error ? searchError.message : 'Search failed. Try again.');
    } finally {
      if (mountedRef.current && activeSearchIdRef.current === searchId) {
        activeSearchIdRef.current = null;
        setSearching(false);
      }
    }
  };

  const selectCandidate = (candidate: ScannerCardCandidate) => {
    setSelected(candidate);
    setFinish((candidate.finishes.find((candidateFinish) => candidateFinish === 'normal' || candidateFinish === 'foil' || candidateFinish === 'etched') ?? 'normal') as 'normal' | 'foil' | 'etched');
    setLanguage(candidate.language ?? 'en');
  };

  const resetScannerForm = (options: { preserveNotice?: boolean } = {}) => {
    const reset = resetAfterRapidScan();
    setQuery(reset.query);
    setSelected(null);
    setCandidates([]);
    setMagicRecognition(null);
    setMagicStillScan(null);
    setQuantity(1);
    setTradeStatus('not_for_trade');
    if (!options.preserveNotice) setBatchNotice(null);
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

  const exportScannerPerformanceJson = async () => {
    const json = serializeScannerPerformanceReport(scannerPerformanceReport);
    setScannerPerformanceJsonSummary(`${scannerPerformanceReport.sampleCount} sample${scannerPerformanceReport.sampleCount === 1 ? '' : 's'} ready (${json.length} characters).`);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(json);
        setSuccess('Scanner performance JSON copied.');
        return;
      }
      await Share.share({ title: 'Scanner performance diagnostics', message: json });
      setSuccess('Scanner performance JSON opened for export.');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Scanner performance export failed.');
    }
  };

  if (loading) return <TDScreen style={s.screen}><TDLoadingState title="Loading scanner" message="Preparing collection, storage, and confirmation options." /></TDScreen>;

  return (
    <View style={s.immersiveScannerShell}>
      <ScannerViewport
        cameraRef={cameraRef}
        permission={permission}
        cameraActive={cameraActive}
        cameraLifecycle={cameraLifecycle}
        cameraReady={cameraReady}
        cameraStageHeight={cameraStageHeight}
        torchEnabled={torchEnabled}
        guideLayout={guideLayout}
        guidePresentation={guidePresentation}
        guideMotion={guideMotion}
        instruction={scannerInstruction}
        platform={Platform.OS}
        latestResultKind={failedResultTray?.kind ?? null}
        onPreviewLayout={handlePreviewLayout}
        onCameraReady={() => {
          setCameraReady(true);
          setCaptureState('ready');
        }}
        onToggleTorch={() => setTorchEnabled((value) => !value)}
        onCapture={captureStill}
        onRequestCamera={requestCamera}
        hideControls={hideMainControls}
      />

      <ScannerHud
        header={scannerHeader}
        topInset={insets.top}
        onClose={() => router.back()}
        onSettings={() => setShowSettingsSheet(true)}
      />

      <View pointerEvents="box-none" style={s.overlayLayer}>
        {error && visibleSurface !== 'result_tray' && !showAddedOverlay ? <TDErrorState title="Scanner notice" message={error} /> : null}
        {success && visibleSurface !== 'result_tray' && !showAddedOverlay ? <ScannerToast tone="success" title="Scanner sync" message={success} /> : null}
        {batchNotice ? (
          <ScannerToast
            tone={batchNotice.tone}
            title={batchNotice.title}
            message={scanner2State === 'remove_card' ? `${batchNotice.message} Remove card to rearm.` : batchNotice.message}
            actions={[
              { label: batchNotice.undoLabel, onPress: () => {
                setSession((current) => current ? undoMostRecentScan(current) : current);
                setBatchNotice(null);
              } },
              { label: batchNotice.correctLabel, onPress: () => router.push('/scanner-session' as never) },
            ]}
          />
        ) : null}

        {visibleSurface === 'progress' && searching ? <TDLoadingState title="Searching printings" message="Looking up exact paper printings." /> : null}
        {visibleSurface === 'progress' && recognitionStage === 'reading_title' ? <TDLoadingState title="Reading card" message="Reading card details on this device." /> : null}
        {visibleSurface === 'progress' && recognitionStage === 'finding_card' ? <TDLoadingState title="Finding match" message="Checking Magic printings." /> : null}

        {failedResultTray && !showAddedOverlay ? <ScannerFailureOverlay tray={failedResultTray} onRetake={retakeScan} onManualSearch={() => setShowManualSearchSheet(true)} /> : null}

        {queuedAdds.length ? (
          <TDCard style={s.syncCard}>
            <View style={s.syncHeader}>
              <View style={s.flex}>
                <TDText variant="title">Scanner sync</TDText>
                <TDText variant="small" tone="muted">{scannerSyncSummary(queuedAdds)}</TDText>
              </View>
              <TDBadge tone={queuedAdds.some((entry) => entry.syncState === 'action_required') ? 'warning' : 'info'}>{queuedAdds.length} queued</TDBadge>
            </View>
            <View style={s.syncActions}>
              <TDButton label="Retry" variant="secondary" loading={syncingQueue} onPress={retryQueue} />
              <TDButton label="Review" variant="secondary" onPress={() => router.push('/scanner-recovery' as never)} />
            </View>
          </TDCard>
        ) : null}

        {showSettingsSheet ? (
          <TDCard style={s.sheet}>
            <SheetHeader title="Scanner settings" onClose={() => setShowSettingsSheet(false)} />
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
            <TDInput label="Cash offer %" value={purchaseRate} onChangeText={setPurchaseRate} keyboardType="numeric" />
            <TDButton label={cameraActive ? 'Pause scanner' : 'Resume scanner'} variant="secondary" onPress={toggleCameraPause} />
            <TDButton label="Manual search" variant="secondary" iconName="search-outline" onPress={() => {
              setShowSettingsSheet(false);
              setShowManualSearchSheet(true);
            }} />
            <OptionRow label="Default condition" options={CARD_CONDITION_OPTIONS} value={condition} display={displayCondition} onSelect={setCondition} />
            <OptionRow label="Default finish" options={['normal', 'foil', 'etched']} value={finish} display={displayFinish} onSelect={setFinish} />
            <TDInput label="Default language" value={language} onChangeText={setLanguage} placeholder="en" />
            <OptionRow label="Destination" options={['collection', 'purchase_intake', 'trade_evaluation', 'export_only']} value={session?.defaultDestination ?? 'purchase_intake'} display={(value) => value.replaceAll('_', ' ')} onSelect={(value) => session ? setSession({ ...session, defaultDestination: value }) : undefined} />
            <OptionRow label="Storage" options={['none', ...(context?.locations.map((location) => location.id) ?? [])]} value={storageLocationId ?? 'none'} display={(id) => id === 'none' ? 'Unassigned' : context?.locations.find((location) => location.id === id)?.name ?? 'Unavailable'} onSelect={(id) => setStorageLocationId(id === 'none' ? null : id)} />
            <OptionRow label="Trade Binder" options={TRADE_BINDER_STATUS_OPTIONS} value={tradeStatus} display={(status) => status.replaceAll('_', ' ')} onSelect={setTradeStatus} />
            <TDBadge tone="info">High-volume defaults: {highVolumeDefaults.autoAddHighConfidence ? 'auto-add enabled' : 'suggest only'}</TDBadge>
            {diagnosticsEnabled ? <TDButton label="Scanner diagnostics" variant="secondary" onPress={() => {
              setShowSettingsSheet(false);
              setShowDiagnosticsSheet(true);
            }} /> : null}
            <TDText variant="caption" tone="muted">{privacy.message}</TDText>
          </TDCard>
        ) : null}

        {showManualSearchSheet ? (
          <TDCard style={s.sheet}>
            <SheetHeader title="Manual search" onClose={() => setShowManualSearchSheet(false)} />
            <TDInput label="Card name" value={query} onChangeText={setQuery} leftIconName="search-outline" placeholder="Rhystic Study" returnKeyType="search" onSubmitEditing={runSearch} />
            <TDButton label="Search printings" loading={searching} disabled={query.trim().length < 2} onPress={runSearch} />
            {!searching && query && !candidates.length && !error ? <TDEmptyState title="No printings yet" message="Run a search to select an exact printing." /> : null}
            {candidates.map((candidate) => (
              <Pressable key={candidate.id} accessibilityRole="button" accessibilityLabel={`Select ${candidate.name}`} accessibilityState={{ selected: selected?.id === candidate.id }} onPress={() => {
                selectCandidate(candidate);
                addCandidateToBatch({
                  candidate,
                  recognition: magicRecognition,
                  stableScanId: createScanId(),
                  source: 'manual_search',
                  timing: { fallbackCount: 1 },
                });
                setShowManualSearchSheet(false);
              }} style={[s.candidate, selected?.id === candidate.id && s.candidateSelected]}>
                {candidate.imageUrl ? <Image source={{ uri: candidate.imageUrl }} style={s.cardImage} contentFit="cover" /> : <View style={s.imageFallback}><Ionicons name="image-outline" size={20} color={color.textMuted} /></View>}
                <View style={s.flex}>
                  <TDText variant="small">{candidate.name}</TDText>
                  <TDText variant="caption" tone="muted">{candidate.setCode ?? 'Set unavailable'} #{candidate.collectorNumber ?? '?'} - {candidate.finishes.map(displayFinish).join(', ')}</TDText>
                </View>
              </Pressable>
            ))}
          </TDCard>
        ) : null}

        {diagnosticsEnabled && showDiagnosticsSheet && !renderDiagnosticsInline ? (
          <TDCard style={s.sheet}>
            <SheetHeader title="Scanner diagnostics" onClose={() => {
              setShowDiagnosticsSheet(false);
              void cleanupDiagnosticCapture();
            }} />
            <TDText variant="small" tone="muted">Development-only. No source images are logged or exported.</TDText>
            <View style={s.signalGrid}>
              <DiagnosticCell label="Preview" value={previewDimensions ? `${Math.round(previewDimensions.width)} x ${Math.round(previewDimensions.height)}` : 'unavailable'} />
              <DiagnosticCell label="Guide" value={`${guideLayout.width} x ${guideLayout.height}`} />
              <DiagnosticCell label="Guide ratio" value={diagnosticsSnapshot.guideAspectRatio.toFixed(3)} />
              <DiagnosticCell label="Crop" value={guideCropMapping ? `${Math.round(guideCropMapping.normalizedCrop.width * 100)}% x ${Math.round(guideCropMapping.normalizedCrop.height * 100)}%` : 'unavailable'} />
              <DiagnosticCell label="Capture" value={diagnosticsSnapshot.captureState.replaceAll('_', ' ')} />
              <DiagnosticCell label="Capture ID" value={lastCaptureId ?? 'unavailable'} />
              <DiagnosticCell label="Pipeline" value={scannerPipeline.replaceAll('_', ' ')} />
              <DiagnosticCell label="Camera state" value={cameraLifecycle.replaceAll('_', ' ')} />
              <DiagnosticCell label="OCR stage" value={recognitionStage.replaceAll('_', ' ')} />
              <DiagnosticCell label="OCR latency" value={magicStillScan?.ok ? `${magicStillScan.ocr.latencyMs} ms` : 'unavailable'} />
              <DiagnosticCell label="Scryfall" value={magicStillScan?.ok ? `${magicStillScan.lookupLatencyMs} ms` : 'unavailable'} />
              <DiagnosticCell label="Cleanup" value={cleanupDiagnostic(magicStillScan)} />
              <DiagnosticCell label="OCR module" value={ocrRuntimeDiagnostics ? `${ocrRuntimeDiagnostics.moduleLinked ? 'linked' : 'unavailable'} ${ocrRuntimeDiagnostics.nativeModuleVersion}` : 'checking'} />
              <DiagnosticCell label="OCR runtime" value={ocrRuntimeDiagnostics ? `${ocrRuntimeDiagnostics.runtimeModuleName} ${ocrRuntimeDiagnostics.platform}` : 'checking'} />
              <DiagnosticCell label="OCR title" value={magicStillScan?.lookupDiagnostics?.rawOcrTitle ?? 'unavailable'} />
              <DiagnosticCell label="Normalized title" value={magicStillScan?.lookupDiagnostics?.normalizedOcrTitle ?? 'unavailable'} />
              <DiagnosticCell label="Title attempt" value={magicStillScan?.cropDiagnostics?.selectedTitleAttemptId ?? 'unavailable'} />
              <DiagnosticCell label="Image fit" value={magicStillScan?.cropDiagnostics ? `${magicStillScan.cropDiagnostics.previewContentFit}; raw ${magicStillScan.cropDiagnostics.rawImage.width} x ${magicStillScan.cropDiagnostics.rawImage.height}; normalized ${magicStillScan.cropDiagnostics.normalizedImage.width} x ${magicStillScan.cropDiagnostics.normalizedImage.height}` : 'unavailable'} />
              <DiagnosticCell label="Title px" value={magicStillScan?.cropDiagnostics ? rectSummary(magicStillScan.cropDiagnostics.titleCropPixels) : 'unavailable'} />
              <DiagnosticCell label="Collector px" value={magicStillScan?.cropDiagnostics ? rectSummary(magicStillScan.cropDiagnostics.collectorCropPixels) : 'unavailable'} />
              <DiagnosticCell label="Title alternatives" value={magicStillScan?.lookupDiagnostics?.titleAlternatives.join(' | ') || 'unavailable'} />
              <DiagnosticCell label="OCR attempts" value={magicStillScan?.signals?.titleAttempts.map((attempt) => `${attempt.id}:${attempt.reason}:${attempt.confidence}`).join(' | ') || 'unavailable'} />
              <DiagnosticCell label="Scryfall query" value={magicStillScan?.lookupDiagnostics?.scryfallQueryString ?? 'unavailable'} />
              <DiagnosticCell label="Scryfall status" value={magicStillScan?.lookupDiagnostics?.httpStatus ? String(magicStillScan.lookupDiagnostics.httpStatus) : 'unavailable'} />
              <DiagnosticCell label="Scryfall items" value={magicStillScan?.lookupDiagnostics?.responseItemCount === null || magicStillScan?.lookupDiagnostics?.responseItemCount === undefined ? 'unavailable' : String(magicStillScan.lookupDiagnostics.responseItemCount)} />
              <DiagnosticCell label="Lookup code" value={magicStillScan?.lookupDiagnostics?.lookupErrorCode ?? 'none'} />
              <DiagnosticCell label="Lookup latency" value={magicStillScan?.lookupDiagnostics ? `${magicStillScan.lookupDiagnostics.lookupLatencyMs} ms` : 'unavailable'} />
              <DiagnosticCell label="Top three" value={magicStillScan?.lookupDiagnostics?.topThreeCandidateNames.join(' | ') || 'unavailable'} />
              <DiagnosticCell label="Avg scan" value={performanceMs(scannerPerformanceReport.averages.averageScanTimeMs)} />
              <DiagnosticCell label="Avg OCR" value={performanceMs(scannerPerformanceReport.averages.averageOcrTimeMs)} />
              <DiagnosticCell label="Avg Scryfall" value={performanceMs(scannerPerformanceReport.averages.averageScryfallLookupTimeMs)} />
              <DiagnosticCell label="Avg to session" value={performanceMs(scannerPerformanceReport.averages.averageTotalUntilSessionInsertionMs)} />
              <DiagnosticCell label="Camera FPS" value={performanceFps(scannerPerformanceReport.averages.averageCameraFps)} />
              <DiagnosticCell label="Preview resolution" value={resolutionSummary(scannerPerformanceReport.latest?.previewResolution ?? null)} />
              <DiagnosticCell label="Capture resolution" value={resolutionSummary(scannerPerformanceReport.latest?.captureResolution ?? null)} />
              <DiagnosticCell label="Batch timing" value={scanTimingSummary(scanTimings[0])} />
            </View>
            {diagnosticCaptureUri && magicStillScan?.cropDiagnostics ? (
              <View style={s.cropProofGrid}>
                <CropProof imageUri={diagnosticCaptureUri} label="Full captured image" crop={{ x: 0, y: 0, width: 1, height: 1 }} imageSize={magicStillScan.cropDiagnostics.normalizedImage} />
                <CropProof imageUri={diagnosticCaptureUri} label="Card crop proof" crop={magicStillScan.cropDiagnostics.cardCrop} imageSize={magicStillScan.cropDiagnostics.normalizedImage} />
                <CropProof imageUri={diagnosticCaptureUri} label="Primary title crop" crop={magicStillScan.cropDiagnostics.titleCrops.title_primary} imageSize={magicStillScan.cropDiagnostics.normalizedImage} />
                <CropProof imageUri={diagnosticCaptureUri} label="Expanded title crop" crop={magicStillScan.cropDiagnostics.titleCrops.title_expanded} imageSize={magicStillScan.cropDiagnostics.normalizedImage} />
                <CropProof imageUri={diagnosticCaptureUri} label="Lower title crop" crop={magicStillScan.cropDiagnostics.titleCrops.title_lower} imageSize={magicStillScan.cropDiagnostics.normalizedImage} />
                <CropProof imageUri={diagnosticCaptureUri} label="Wide title crop" crop={magicStillScan.cropDiagnostics.titleCrops.title_wide} imageSize={magicStillScan.cropDiagnostics.normalizedImage} />
                <CropProof imageUri={diagnosticCaptureUri} label="Collector crop proof" crop={magicStillScan.cropDiagnostics.collectorCrop} imageSize={magicStillScan.cropDiagnostics.normalizedImage} />
              </View>
            ) : null}
            {magicStillScan?.ok ? (
              <View style={s.optionGroup}>
                <TDText variant="caption" tone="muted">Raw title: {magicStillScan.signals.rawTitle ?? 'unavailable'}</TDText>
                <TDText variant="caption" tone="muted">Normalized title: {magicStillScan.signals.normalizedTitle ?? 'unavailable'}</TDText>
                <TDText variant="caption" tone="muted">Collector OCR: {magicStillScan.signals.rawCollectorText ?? 'unavailable'}</TDText>
                <TDText variant="caption" tone="muted">Top three: {magicStillScan.candidates.slice(0, 3).map((candidate) => `${candidate.name} ${candidate.setCode ?? '?'} #${candidate.collectorNumber ?? '?'}`).join(' | ') || 'unavailable'}</TDText>
              </View>
            ) : null}
            <View style={s.diagnosticsControls}>
              <TDButton label="Copy JSON" variant="secondary" disabled={!scannerPerformanceReport.sampleCount} onPress={exportScannerPerformanceJson} />
              <TDButton label="Scale -" variant="secondary" onPress={() => updateCalibration({ guideScale: scannerCalibration.guideScale - 0.02 })} />
              <TDButton label="Scale +" variant="secondary" onPress={() => updateCalibration({ guideScale: scannerCalibration.guideScale + 0.02 })} />
              <TDButton label="Guide up" variant="secondary" onPress={() => updateCalibration({ verticalOffset: scannerCalibration.verticalOffset - 8 })} />
              <TDButton label="Guide down" variant="secondary" onPress={() => updateCalibration({ verticalOffset: scannerCalibration.verticalOffset + 8 })} />
              <TDButton label="Reset" variant="secondary" onPress={() => updateCalibration(normalizeScannerCalibrationPreferences())} />
            </View>
            {scannerPerformanceJsonSummary ? <TDText variant="caption" tone="muted">{scannerPerformanceJsonSummary}</TDText> : null}
            <TDText variant="caption" tone="muted">Foil test mode: {foilDiagnostics.status}; {foilDiagnostics.frameCount} frames. Finish remains manually editable.</TDText>
          </TDCard>
        ) : null}
      </View>
      <ScannerSessionStrip
        bottomInset={insets.bottom}
        model={sessionStrip}
        onReviewSession={() => router.push('/scanner-session' as never)}
      />
    </View>
  );
}

function ScannerHud({
  header,
  topInset,
  onClose,
  onSettings,
}: {
  header: ReturnType<typeof scanner2HeaderModel>;
  topInset: number;
  onClose: () => void;
  onSettings: () => void;
}) {
  return (
    <View style={[s.topHud, { paddingTop: Math.max(topInset, 10) }]}>
      <HeaderIconControl label="Close scanner" icon="close-outline" onPress={onClose} />
      <View style={s.hudTextStack}>
        <View style={s.hudLine}>
          <TDText variant="small" numberOfLines={1} style={s.hudMode}>{header.line1.mode}</TDText>
          <TDText variant="caption" tone="muted" numberOfLines={1}>{header.line1.cards}</TDText>
        </View>
        {header.line2.length ? (
          <View style={s.hudMetricLine}>
            {header.line2.map((item) => (
              <TDText key={item.id} variant="caption" tone={item.id === 'offer' ? 'success' : 'muted'} numberOfLines={1} style={s.hudMetric}>
                {item.label} {item.value}
              </TDText>
            ))}
          </View>
        ) : null}
      </View>
      <View style={s.hudActions}>
        <HeaderIconControl label="Scanner settings" icon="options-outline" onPress={onSettings} />
      </View>
    </View>
  );
}

function ScannerViewport({
  cameraRef,
  permission,
  cameraActive,
  cameraLifecycle,
  cameraReady,
  cameraStageHeight,
  torchEnabled,
  guideLayout,
  guidePresentation,
  guideMotion,
  instruction,
  platform,
  latestResultKind,
  onPreviewLayout,
  onCameraReady,
  onToggleTorch,
  onCapture,
  onRequestCamera,
  hideControls,
}: {
  cameraRef: RefObject<CameraView | null>;
  permission: ScannerPermissionState;
  cameraActive: boolean;
  cameraLifecycle: Scanner2CameraLifecycleState;
  cameraReady: boolean;
  cameraStageHeight: number;
  torchEnabled: boolean;
  guideLayout: ReturnType<typeof calculateCardGuideLayout>;
  guidePresentation: PremiumScannerGuidePresentation;
  guideMotion: ReturnType<typeof scanner2MotionForState>;
  instruction: string;
  platform: string;
  latestResultKind: PremiumResultTrayKind | null;
  onPreviewLayout: (event: LayoutChangeEvent) => void;
  onCameraReady: () => void;
  onToggleTorch: () => void;
  onCapture: () => void;
  onRequestCamera: () => void;
  hideControls: boolean;
}) {
  const showCamera = permission === 'granted' && cameraActive && shouldScannerCameraRender(cameraLifecycle);
  const showResume = shouldShowScannerResumeAction(cameraLifecycle);
  return (
    <View style={[s.cameraStage, { height: cameraStageHeight }]}>
      {showCamera ? (
        <View style={s.cameraViewport} onLayout={onPreviewLayout}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torchEnabled}
            {...scannerCameraViewQualityProps()}
            onCameraReady={onCameraReady}
          />
          <ScannerGuide guideLayout={guideLayout} guidePresentation={guidePresentation} guideMotion={guideMotion} />
        </View>
      ) : (
        <View style={s.cameraEmptyState}>
          <Ionicons name={permission === 'denied' ? 'camera-outline' : 'scan-outline'} size={42} color={color.textMuted} />
          <TDText variant="title">{cameraLifecycleTitle(cameraLifecycle, permission)}</TDText>
          <TDText variant="small" tone="muted" style={s.centerText}>{cameraLifecycleMessage(cameraLifecycle, permission, platform)}</TDText>
          {showResume ? <TDText variant="small" tone="muted">Use the header play control to resume.</TDText> : null}
          {permission !== 'granted' && cameraLifecycle !== 'unavailable' ? <TDButton label="Enable camera" onPress={onRequestCamera} /> : null}
        </View>
      )}

      {latestResultKind !== 'failed' ? <ScannerStatus instruction={instruction} /> : null}
      <ScannerControls
        torchEnabled={torchEnabled}
        cameraReady={cameraReady}
        permission={permission}
        onToggleTorch={onToggleTorch}
        onCapture={onCapture}
        hidden={hideControls}
      />
    </View>
  );
}

function ScannerGuide({
  guideLayout,
  guidePresentation,
  guideMotion,
}: {
  guideLayout: ReturnType<typeof calculateCardGuideLayout>;
  guidePresentation: PremiumScannerGuidePresentation;
  guideMotion: ReturnType<typeof scanner2MotionForState>;
}) {
  return (
    <View pointerEvents="none" style={[s.premiumGuide, { width: guideLayout.width, height: guideLayout.height, left: guideLayout.left, top: guideLayout.top }, guideMotion.pulse && s.guidePulse]}>
      <View style={[s.guideBracket, guideToneStyle(guidePresentation.tone)]} />
      <View style={[s.guideBracket, s.guideBracketRight, guideToneStyle(guidePresentation.tone)]} />
      <View style={[s.guideBracket, s.guideBracketBottom, guideToneStyle(guidePresentation.tone)]} />
      <View style={[s.guideBracket, s.guideBracketBottomRight, guideToneStyle(guidePresentation.tone)]} />
      {guideMotion.progress ? <View style={[s.guideProgress, { width: `${Math.round(guidePresentation.progress * 100)}%` }]} /> : null}
      {guideMotion.flash ? <View style={s.captureFlash} /> : null}
    </View>
  );
}

function ScannerStatus({ instruction }: { instruction: string }) {
  return (
    <View style={s.cameraScrimTop}>
      <TDText variant="title" style={s.guideMessage}>{instruction}</TDText>
    </View>
  );
}

function ScannerControls({
  torchEnabled,
  cameraReady,
  permission,
  onToggleTorch,
  onCapture,
  hidden,
}: {
  torchEnabled: boolean;
  cameraReady: boolean;
  permission: ScannerPermissionState;
  onToggleTorch: () => void;
  onCapture: () => void;
  hidden: boolean;
}) {
  const controls = scanner2MainControls();
  if (hidden) return null;
  return (
    <View style={s.cameraControls}>
      {controls.map((control) => {
        if (control === 'torch') return <IconControl key={control} label={torchEnabled ? 'Turn torch off' : 'Turn torch on'} icon={torchEnabled ? 'flash' : 'flash-outline'} onPress={onToggleTorch} />;
        if (control === 'capture') return <IconControl key={control} label="Capture card" icon="radio-button-on-outline" disabled={!cameraReady || permission !== 'granted'} prominent onPress={onCapture} />;
        return null;
      })}
    </View>
  );
}

function ScannerFailureOverlay({ onRetake, onManualSearch }: { tray: NonNullable<ReturnType<typeof buildPremiumResultTray>>; onRetake: () => void; onManualSearch: () => void }) {
  return (
    <View accessibilityRole="alert" style={[s.scannerToast, s.failureOverlay]}>
      <Ionicons name="alert-circle-outline" size={22} color={color.warning} />
      <View style={s.flex}>
        <TDText variant="small">Could not identify card</TDText>
      </View>
      <View style={s.toastActions}>
        <TDButton label="Retake" variant="secondary" onPress={onRetake} />
        <TDButton label="Search" variant="secondary" onPress={onManualSearch} />
      </View>
    </View>
  );
}

function ScannerSessionStrip({ bottomInset, model, onReviewSession }: { bottomInset: number; model: ReturnType<typeof batchScannerReviewChipModel>; onReviewSession: () => void }) {
  return (
    <TDSessionStripPrimitive
      summary={model.summary}
      actionLabel={model.reviewLabel}
      onPress={onReviewSession}
      bottomInset={bottomInset}
      tone={model.tone}
      style={s.sessionChip}
    />
  );
}

function ScannerToast({ title, message, tone, actions = [] }: { title: string; message: string; tone: 'success' | 'warning' | 'info'; actions?: { label: string; onPress: () => void }[] }) {
  const iconName: ComponentProps<typeof Ionicons>['name'] = tone === 'success' ? 'checkmark-circle-outline' : tone === 'warning' ? 'alert-circle-outline' : 'information-circle-outline';
  const iconColor = tone === 'success' ? color.success : tone === 'warning' ? color.warning : color.info;
  return (
    <View accessibilityRole="alert" style={s.scannerToast}>
      <Ionicons name={iconName} size={22} color={iconColor} />
      <View style={s.flex}>
        <TDText variant="small">{title}</TDText>
        <TDText variant="caption" tone="muted">{message}</TDText>
      </View>
      {actions.length ? (
        <View style={s.toastActions}>
          {actions.map((action) => <TDButton key={action.label} label={action.label} variant="secondary" onPress={action.onPress} />)}
        </View>
      ) : null}
    </View>
  );
}

function IconControl({
  label,
  icon,
  prominent,
  disabled,
  onPress,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  prominent?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TDIconButton
      label={label}
      iconName={icon}
      disabled={disabled}
      onPress={onPress}
      tone={prominent ? 'primary' : 'neutral'}
      size={prominent ? 'lg' : 'md'}
    />
  );
}

function HeaderIconControl({ label, icon, onPress }: { label: string; icon: ComponentProps<typeof Ionicons>['name']; onPress: () => void }) {
  return <TDIconButton label={label} iconName={icon} onPress={onPress} size="sm" />;
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={s.sheetHeader}>
      <TDText variant="title">{title}</TDText>
      <TDIconButton label={`Close ${title}`} iconName="close-outline" onPress={onClose} />
    </View>
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

function guideToneStyle(tone: 'neutral' | 'cyan' | 'blue' | 'emerald' | 'amber' | 'danger') {
  if (tone === 'emerald') return s.guideToneSuccess;
  if (tone === 'amber') return s.guideToneWarning;
  if (tone === 'danger') return s.guideToneDanger;
  if (tone === 'blue') return s.guideToneBlue;
  return s.guideToneInfo;
}

function cameraLifecycleTitle(lifecycle: Scanner2CameraLifecycleState, permission: ScannerPermissionState) {
  if (lifecycle === 'user_paused') return 'Scanner paused';
  if (lifecycle === 'backgrounded') return 'Scanner paused in background';
  if (lifecycle === 'starting') return 'Starting camera';
  if (lifecycle === 'processing_paused') return 'Reading card';
  if (lifecycle === 'ready') return 'Camera ready';
  if (lifecycle === 'permission_pending') return 'Camera permission';
  if (lifecycle === 'error') return 'Camera permission denied';
  return permissionTitle(permission);
}

function cameraLifecycleMessage(lifecycle: Scanner2CameraLifecycleState, permission: ScannerPermissionState, platform: string) {
  if (lifecycle === 'user_paused') return 'Resume when you are ready to scan again.';
  if (lifecycle === 'backgrounded') return 'Scanning will resume when the app is active.';
  if (lifecycle === 'starting') return 'Hold the card inside the guide while the camera warms up.';
  if (lifecycle === 'processing_paused') return 'Keep the card visible while Trading Docks reads the capture.';
  if (lifecycle === 'permission_pending') return 'Manual search works now. Camera capture requires camera permission.';
  return permissionMessage(permission, platform);
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
  if (permission === 'granted') return 'Place the card inside the guide, then capture or search manually.';
  return 'Manual search works now. Camera capture requires camera permission.';
}

function scannerSyncSummary(entries: ScannerQueuedAdd[]) {
  const actionRequired = entries.filter((entry) => entry.syncState === 'action_required').length;
  const failed = entries.filter((entry) => entry.syncState === 'failed').length;
  if (actionRequired) return `${actionRequired} queued scan${actionRequired === 1 ? '' : 's'} need action before sync can finish.`;
  if (failed) return `${failed} queued scan${failed === 1 ? '' : 's'} failed replay and can be retried.`;
  return 'Queued scanner adds will sync on reconnect, app resume, or manual retry.';
}

function cleanupDiagnostic(scan: MagicStillScanResult | null) {
  if (!scan?.cleanup) return 'unavailable';
  if (scan.cleanup.ok && scan.cleanup.deleted) return 'deleted';
  if (scan.cleanup.ok) return scan.cleanup.reason.replaceAll('_', ' ');
  return 'failed';
}

function scanTimingSummary(timing: BatchScannerTimingSnapshot | undefined) {
  if (!timing) return 'unavailable';
  return `capture ${timing.captureMs ?? '?'} ms; OCR ${timing.ocrMs ?? '?'} ms; Scryfall ${timing.scryfallMs ?? '?'} ms; session ${timing.sessionWriteMs ?? '?'} ms; total ${timing.totalMs ?? '?'} ms; fallback ${timing.fallbackCount}`;
}

function performanceMs(value: number | null) {
  return value === null ? 'unavailable' : `${value} ms`;
}

function performanceFps(value: number | null) {
  return value === null ? 'unavailable' : `${value} fps`;
}

function resolutionSummary(value: { width: number; height: number } | null) {
  return value ? `${value.width} x ${value.height}` : 'unavailable';
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

function CropProof({ imageUri, label, crop, imageSize }: { imageUri: string; label: string; crop: CropRect; imageSize: { width: number; height: number } }) {
  return (
    <View style={s.cropProof}>
      <TDText variant="caption" tone="muted">{label}</TDText>
      <View style={[s.cropProofImageFrame, { aspectRatio: imageSize.width / imageSize.height }]}>
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="contain" />
        <View
          pointerEvents="none"
          style={[
            s.cropProofOverlay,
            {
              left: `${Math.round(crop.x * 100)}%`,
              top: `${Math.round(crop.y * 100)}%`,
              width: `${Math.round(crop.width * 100)}%`,
              height: `${Math.round(crop.height * 100)}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

function rectSummary(rect: { x: number; y: number; width: number; height: number }) {
  return `${rect.x},${rect.y} ${rect.width}x${rect.height}`;
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

function parseOptionalPercentage(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
}

function scannerNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function createScanId() {
  return globalThis.crypto?.randomUUID?.() ?? `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const s = StyleSheet.create({
  immersiveScannerShell: { flex: 1, backgroundColor: '#010711', overflow: 'hidden' },
  scannerShell: { flex: 1, backgroundColor: color.canvas },
  overlayLayer: { position: 'absolute', left: space.md, right: space.md, bottom: 92, zIndex: 50, gap: space.sm },
  topHud: { position: 'absolute', top: 0, left: space.sm, right: space.sm, zIndex: 60, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingBottom: space.xs, borderRadius: radius.lg, backgroundColor: color.canvas + 'D8' },
  hudTextStack: { flex: 1, minWidth: 0, gap: 2 },
  hudLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hudMode: { flex: 1, minWidth: 0 },
  hudMetricLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hudMetric: { minWidth: 0, flexShrink: 1 },
  hudActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  headerIconControl: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.border, backgroundColor: color.surfaceFloating + 'CC' },
  hudRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  hudMetricRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  modePill: { flex: 1, minHeight: 36, minWidth: 0, borderRadius: radius.pill, borderWidth: 1, borderColor: color.borderStrong, paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: color.surfaceFloating + 'E8' },
  compactStat: { minHeight: 36, minWidth: 62, maxWidth: 132, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.sm, justifyContent: 'center', backgroundColor: color.surfaceFloating + 'D8' },
  compactStatNarrow: { flex: 1, minWidth: 0 },
  compactStatSuccess: { borderColor: color.success + '88' },
  compactStatWarning: { borderColor: color.warning + '88' },
  compactStatInfo: { borderColor: color.info + '88' },
  cameraStage: { ...StyleSheet.absoluteFillObject, minHeight: 340, backgroundColor: '#010711', overflow: 'hidden', justifyContent: 'center', zIndex: 1 },
  cameraViewport: { flex: 1, backgroundColor: '#010711' },
  cameraEmptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.lg, backgroundColor: '#010711' },
  cameraScrimTop: { position: 'absolute', top: '34%', left: space.md, right: space.md, alignItems: 'center', gap: space.xs, padding: space.sm, borderRadius: radius.lg, backgroundColor: color.canvas + '44', zIndex: 20 },
  guideMessage: { textAlign: 'center' },
  premiumGuide: { position: 'absolute' },
  guidePulse: { opacity: 0.96 },
  guideBracket: { position: 'absolute', top: 0, left: 0, width: 52, height: 52, borderTopWidth: 4, borderLeftWidth: 4, borderColor: color.info, borderTopLeftRadius: radius.md },
  guideBracketRight: { left: undefined, right: 0, borderLeftWidth: 0, borderRightWidth: 4, borderTopRightRadius: radius.md },
  guideBracketBottom: { top: undefined, bottom: 0, borderTopWidth: 0, borderBottomWidth: 4, borderBottomLeftRadius: radius.md },
  guideBracketBottomRight: { top: undefined, left: undefined, right: 0, bottom: 0, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: radius.md },
  guideToneInfo: { borderColor: color.info },
  guideToneBlue: { borderColor: color.primaryBright },
  guideToneSuccess: { borderColor: color.success },
  guideToneWarning: { borderColor: color.warning },
  guideToneDanger: { borderColor: color.danger },
  guideProgress: { position: 'absolute', left: 0, bottom: -10, height: 3, borderRadius: radius.pill, backgroundColor: color.primaryBright },
  captureFlash: { ...StyleSheet.absoluteFillObject, borderRadius: radius.md, backgroundColor: '#FFFFFF22' },
  iconControl: { width: 46, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceFloating + 'CC' },
  iconControlPrimary: { width: 58, height: 58, borderRadius: radius.lg, borderColor: color.primaryBright, backgroundColor: color.primaryBright },
  iconControlDisabled: { opacity: 0.42 },
  iconControlPressed: { transform: [{ scale: 0.97 }], backgroundColor: color.surfaceRaised },
  scannerContent: { gap: space.md, padding: space.md },
  resultTray: { gap: space.sm, borderColor: color.borderStrong, backgroundColor: color.surfaceFloating + 'F2' },
  resultTrayFailed: { borderColor: color.warning },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  resultText: { flex: 1, minWidth: 0, gap: 2 },
  failedTray: { gap: space.md },
  failedHeader: { minHeight: 72, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  failureIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.warning + '18' },
  trayImage: { width: 54, height: 76, borderRadius: radius.sm, backgroundColor: color.surface },
  trayImageFallback: { width: 54, height: 76, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  trayMoneyRow: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  trayActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  correctionPanel: { gap: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.md, backgroundColor: color.canvasRaised },
  sheet: { maxHeight: 520, gap: space.md, borderColor: color.borderStrong, backgroundColor: color.surfaceFloating },
  sheetHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  closeButton: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center', backgroundColor: color.canvasRaised },
  bottomSessionBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingTop: space.sm, paddingHorizontal: space.md, borderTopWidth: 1, borderColor: color.borderStrong, backgroundColor: color.canvas + 'F8' },
  bottomSessionBarCompact: { opacity: 0.92 },
  bottomSessionSummary: { flex: 1, minWidth: 0 },
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
  cameraControls: { position: 'absolute', right: space.sm, bottom: 108, left: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'center', zIndex: 30 },
  scroller: { flex: 1 },
  statusRow: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  diagnosticsCard: { gap: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.md, backgroundColor: color.canvasRaised },
  diagnosticsControls: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  centerText: { textAlign: 'center' },
  noticeCard: { gap: space.sm },
  scannerToast: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: color.borderStrong, paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: color.canvas + 'E8' },
  toastActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  failureOverlay: { borderColor: color.warning },
  sessionChip: { position: 'absolute', left: space.md, right: space.md, bottom: 0, zIndex: 55, borderTopWidth: 0, borderWidth: 1, borderColor: color.borderStrong, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: color.canvas + 'E8' },
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
  cropProofGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cropProof: { flex: 1, minWidth: 150, gap: space.xs },
  cropProofImageFrame: { height: 180, overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: color.borderStrong, backgroundColor: '#010711' },
  cropProofOverlay: { position: 'absolute', borderWidth: 2, borderColor: color.primaryBright, backgroundColor: color.primaryBright + '18' },
  optionGroup: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  checkboxRow: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm },
});

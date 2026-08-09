import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type RefObject } from 'react';
import { AccessibilityInfo, AppState, Platform, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions, type AppStateStatus, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TDBadge,
  TDButton,
  TDCard,
  TDChip,
  TDEmptyState,
  TDIconButton,
  TDInput,
  TDLoadingState,
  TDScreen,
  TDSessionStrip as TDSessionStripPrimitive,
  TDText,
} from '@/components/design-system';
import { ScannerCamera, type ScannerCameraFrame, type ScannerCameraHandle, type ScannerCameraSessionSummary } from '@/components/scanner-camera';
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
  nextContinuousScannerRuntime,
  scannerDestinationLabel,
  scannerModeLabel,
  shouldAddRecognitionToBatch,
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
  resolveScannerPermissionState,
  scannerPrivacySummary,
  tradeStatusForScanner,
  type ScannerCardCandidate,
  type ScannerPermissionState,
} from '@/services/scanner-foundation';
import type { RecognitionCandidate } from '@/services/scanner-intelligence';
import { listScannerQueuedAdds, retryQueuedScannerAdds, type ScannerQueuedAdd } from '@/services/scanner-replay';
import { enrichScannerSessionLinePrice, type ScannerPricingTrace } from '@/services/scanner-price-enrichment';
import { runScannerParallelEnrichment } from '@/services/scanner-parallel-enrichment';
import {
  appendScannerPerformanceSample,
  buildScannerPerformanceReport,
  createScannerPerformanceSample,
  serializeScannerBenchmarkSummary,
  serializeScannerPerformanceReport,
  type ScannerPerformanceSample,
} from '@/services/scanner-performance-instrumentation';
import {
  scannerCameraFraming,
} from '@/services/scanner-camera-quality';
import {
  SCANNER_CAMERA_LENS_LABELS,
  appendScannerCameraEvent,
  convertPreviewTapToCameraPoint,
  normalizeScannerCameraLensMode,
  normalizeScannerCameraSelectionMode,
  resolveAutoCaptureReadiness,
  resolveScannerFocusRequest,
  scannerCameraPreferenceKey,
  scannerFocusReticleDuration,
  shouldIgnoreFrameAfterLensSwitch,
  shouldWarnAboutTorchThrash,
  shouldTriggerAutomaticCapture,
  type ScannerCameraDeviceSummary,
  type ScannerCameraLensSelection,
  type ScannerCameraLensMode,
  type ScannerCameraLensOption,
  type ScannerCameraPoint,
  type ScannerCameraQualityProfile,
  type ScannerCameraRuntimeEvent,
  type ScannerFocusConversion,
  type ScannerTorchState,
  type ScannerTorchTransition,
} from '@/services/scanner-camera-controls';
import { shouldEmitReadyHaptic } from '@/services/scanner-readiness';
import {
  NATIVE_FRAME_VISUAL_SIGNALS,
  NO_NATIVE_VISUAL_SIGNALS,
  applyScannerCalibrationToGuide,
  buildGuideCropMapping,
  canAutoCaptureNative,
  diagnosticsFromFrameAnalysis,
  isScannerDiagnosticsEnabled,
  nativeScannerCalibrationKey,
  normalizeScannerCalibrationPreferences,
  scaleScannerGuideLayoutForFrame,
  summarizeFoilDiagnostics,
  type PreviewDimensions,
  type ScannerCalibrationPreferences,
  type ScannerCaptureState,
  type ScannerDiagnosticsSnapshot,
} from '@/services/native-scanner-calibration';
import {
  DEFAULT_SCANNER_VISION_CONFIG,
  createScannerVisionEngine,
  type ScannerVisionConfig,
  type ScannerVisionResult,
} from '@/services/scanner-vision-engine';
import {
  buildPremiumResultTray,
  dominantScannerSurface,
  guidePresentationForPipeline,
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

export default function AutomaticScannerScreen() {
  const { accountType } = useAccount();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cameraRef = useRef<ScannerCameraHandle | null>(null);
  const mountedRef = useRef(true);
  const activeCaptureIdRef = useRef<string | null>(null);
  const activeSearchIdRef = useRef<string | null>(null);
  const autoCaptureInFlightRef = useRef(false);
  const lastLiveFrameAcceptedAtRef = useRef(0);
  const visionEngineRef = useRef<ReturnType<typeof createScannerVisionEngine> | null>(null);
  const visionEngineKeyRef = useRef<string | null>(null);
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
  const [previewSourceDimensions, setPreviewSourceDimensions] = useState<PreviewDimensions | null>(null);
  const [captureState, setCaptureState] = useState<ScannerCaptureState>('idle');
  const [recognitionStage, setRecognitionStage] = useState<ScanRecognitionStage>('idle');
  const [sessionInsertionResult, setSessionInsertionResult] = useState<ScannerDiagnosticsSnapshot['sessionInsertionResult']>('not_attempted');
  const [scannerCalibration, setScannerCalibration] = useState<ScannerCalibrationPreferences>(() => normalizeScannerCalibrationPreferences());
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchState, setTorchState] = useState<ScannerTorchState | null>(null);
  const [cameraLensMode, setCameraLensMode] = useState<ScannerCameraLensMode>('auto');
  const [rawCameraDeviceId, setRawCameraDeviceId] = useState<string | null>(null);
  const [cameraLensOptions, setCameraLensOptions] = useState<ScannerCameraLensOption[]>([
    { mode: 'auto', label: 'Auto', shortLabel: 'Auto', supported: true, deviceId: null, effectiveZoom: null, mappingReason: 'Waiting for native camera discovery.' },
  ]);
  const [cameraInventory, setCameraInventory] = useState<ScannerCameraLensSelection | null>(null);
  const [cameraDeviceDiagnostics, setCameraDeviceDiagnostics] = useState<ScannerCameraDeviceSummary | null>(null);
  const [cameraQualityProfile, setCameraQualityProfile] = useState<ScannerCameraQualityProfile | null>(null);
  const [cameraSessionSummary, setCameraSessionSummary] = useState<ScannerCameraSessionSummary | null>(null);
  const [focusDiagnostics, setFocusDiagnostics] = useState<{
    requestedPoint: ScannerCameraPoint;
    convertedPoint: ScannerFocusConversion['normalizedPoint'];
    supportsFocus: boolean;
    outcome: 'focused' | 'blocked' | 'failed';
    latencyMs: number | null;
    error: string | null;
  } | null>(null);
  const [focusReticle, setFocusReticle] = useState<ScannerCameraPoint | null>(null);
  const [cameraLifecycleDiagnostics, setCameraLifecycleDiagnostics] = useState({
    mounts: 0,
    unmounts: 0,
    previewStarts: 0,
    previewStops: 0,
    deviceChanges: 0,
    isActiveTransitions: 0,
  });
  const [lastCameraSwitchDurationMs, setLastCameraSwitchDurationMs] = useState<number | null>(null);
  const [torchWarning, setTorchWarning] = useState<string | null>(null);
  const [cameraEvents, setCameraEvents] = useState<ScannerCameraRuntimeEvent[]>([]);
  const [liveFrameCount, setLiveFrameCount] = useState(0);
  const [firstLiveFrameAt, setFirstLiveFrameAt] = useState<number | null>(null);
  const [latestLiveFrameAt, setLatestLiveFrameAt] = useState<number | null>(null);
  const [cameraLensSwitching, setCameraLensSwitching] = useState(false);
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
  const [binderLocationId, setBinderLocationId] = useState<string | null>(null);
  const [binderPage, setBinderPage] = useState('1');
  const [binderSlot, setBinderSlot] = useState('');
  const [tradeStatus, setTradeStatus] = useState(tradeStatusForScanner('not_for_trade'));
  const [purchaseRate, setPurchaseRate] = useState('70');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [queuedAdds, setQueuedAdds] = useState<ScannerQueuedAdd[]>([]);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showManualSearchSheet, setShowManualSearchSheet] = useState(false);
  const [showDiagnosticsSheet, setShowDiagnosticsSheet] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showModeSelectionSheet, setShowModeSelectionSheet] = useState(false);
  const [showCameraSelectionSheet, setShowCameraSelectionSheet] = useState(false);
  const [showCameraInspectorSheet, setShowCameraInspectorSheet] = useState(false);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [batchNotice, setBatchNotice] = useState<(BatchScannerNoticeModel & { lineId: string }) | null>(null);
  const [scanTimings, setScanTimings] = useState<BatchScannerTimingSnapshot[]>([]);
  const [scannerPerformanceSamples, setScannerPerformanceSamples] = useState<ScannerPerformanceSample[]>([]);
  const [scannerPerformanceJsonSummary, setScannerPerformanceJsonSummary] = useState<string | null>(null);
  const [lastPricingTrace, setLastPricingTrace] = useState<ScannerPricingTrace | null>(null);
  const [liveVisionResult, setLiveVisionResult] = useState<ScannerVisionResult | null>(null);
  const batchNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusReticleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraLensSwitchStartedAtRef = useRef<number | null>(null);
  const activeCameraDeviceIdRef = useRef<string | null>(null);
  const cameraIsActiveRef = useRef(false);
  const torchTransitionsRef = useRef<ScannerTorchTransition[]>([]);

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
  const liveFrameAnalysis = useMemo(() => liveVisionResult ? {
    frameId: liveVisionResult.frameId,
    observation: liveVisionResult.observation,
    guidance: liveVisionResult.guidance,
    readyForAutoCapture: liveVisionResult.readyForAutoCapture,
    aspectRatio: liveVisionResult.detection.aspectRatio,
    aspectRatioOk: liveVisionResult.detection.aspectRatio !== null && Math.abs(liveVisionResult.detection.aspectRatio - guideLayout.ratio) <= DEFAULT_SCANNER_VISION_CONFIG.aspectRatioTolerance,
    crop: liveVisionResult.crop,
  } : null, [guideLayout.ratio, liveVisionResult]);
  const visualSignals = liveVisionResult ? NATIVE_FRAME_VISUAL_SIGNALS : NO_NATIVE_VISUAL_SIGNALS;
  const diagnosticsSnapshot = useMemo(() => diagnosticsFromFrameAnalysis({
    cameraReady,
    previewDimensions,
    guideDimensions: guideLayout,
    analysis: liveFrameAnalysis,
    captureState,
    duplicateFingerprintStatus: autoScanner.duplicateProtection.awaitingCardRemoval ? 'awaiting_removal' : liveVisionResult ? 'clear' : 'unavailable',
    recognitionStage: recognitionStage === 'review_ready' ? 'recognized' : recognitionStage === 'failed' ? 'failed' : capturedFrame ? 'capture_only' : 'not_started',
    recognitionLatencyMs: magicStillScan?.ok ? magicStillScan.ocr.latencyMs + magicStillScan.lookupLatencyMs : null,
    sessionInsertionResult,
    signalAvailability: visualSignals,
  }), [autoScanner.duplicateProtection.awaitingCardRemoval, cameraReady, capturedFrame, captureState, guideLayout, liveFrameAnalysis, liveVisionResult, magicStillScan, previewDimensions, recognitionStage, sessionInsertionResult, visualSignals]);
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
  const scannerHeader = scanner2HeaderModel({
    modeLabel: autoCaptureEnabled ? 'Auto Scan On' : 'Auto Scan Off',
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
  const autoCaptureReadiness = useMemo(() => resolveAutoCaptureReadiness({
    frameCount: liveFrameCount,
    firstFrameAt: firstLiveFrameAt,
    latestFrameAt: latestLiveFrameAt,
    cardPresence: Boolean(liveVisionResult?.detection.cardPresent),
    cornersVisible: diagnosticsSnapshot.cardCornersVisible,
    guideFill: diagnosticsSnapshot.fillPercentage === null ? null : diagnosticsSnapshot.fillPercentage / 100,
    aspectRatio: liveVisionResult?.detection.aspectRatio ?? null,
    centerOffset: liveVisionResult?.detection.centerOffset.normalized ?? null,
    blur: diagnosticsSnapshot.blurScore,
    motion: diagnosticsSnapshot.motionScore,
    lighting: diagnosticsSnapshot.lightingScore,
    glare: diagnosticsSnapshot.glareScore,
    stableDurationMs: diagnosticsSnapshot.stabilityMs,
    removalState: autoScanner.duplicateProtection.awaitingCardRemoval ? 'awaiting_removal' : 'clear',
    processing: scannerProcessing,
    duplicateBlocked: autoScanner.duplicateProtection.awaitingCardRemoval,
    cameraReady,
    cameraSwitching: cameraLensSwitching,
  }), [
    autoScanner.duplicateProtection.awaitingCardRemoval,
    cameraReady,
    cameraLensSwitching,
    diagnosticsSnapshot.blurScore,
    diagnosticsSnapshot.cardCornersVisible,
    diagnosticsSnapshot.fillPercentage,
    diagnosticsSnapshot.glareScore,
    diagnosticsSnapshot.lightingScore,
    diagnosticsSnapshot.motionScore,
    diagnosticsSnapshot.stabilityMs,
    firstLiveFrameAt,
    latestLiveFrameAt,
    liveFrameCount,
    liveVisionResult,
    scannerProcessing,
  ]);
  const guidePresentation = useMemo(
    () => guidePresentationForPipeline(
      scannerPipeline,
      autoCaptureReadiness.instruction ?? liveVisionResult?.guidance ?? autoScanner.lastGuidance,
      autoCaptureReadiness.visualState,
    ),
    [autoCaptureReadiness.instruction, autoCaptureReadiness.visualState, autoScanner.lastGuidance, liveVisionResult?.guidance, scannerPipeline],
  );
  const scannerInstruction = scanner2State === 'added' || scanner2State === 'remove_card' || scanner2State === 'failed'
    ? batchScannerInstructionForState(
      scanner2State === 'added' ? 'added'
        : scanner2State === 'remove_card' ? 'remove_card'
          : 'failed',
    )
    : autoCaptureReadiness.instruction;
  const sheetOpen = showSettingsSheet || showManualSearchSheet || showDiagnosticsSheet || showModeSelectionSheet || showCameraSelectionSheet || showCameraInspectorSheet;
  const hideMainControls = shouldHideScannerPrimaryControls({
    processing: scannerProcessing,
    saving: false,
    sheetOpen,
    state: scanner2State,
  });
  const showAddedOverlay = scanner2State === 'added' || scanner2State === 'remove_card';
  const logCameraEvent = useCallback((event: Omit<ScannerCameraRuntimeEvent, 'id'>) => {
    setCameraEvents((current) => appendScannerCameraEvent(current, event));
  }, []);
  const previousProcessingRef = useRef(scannerProcessing);
  const previousAutoCaptureRef = useRef(autoCaptureEnabled);
  const previousReadinessStateRef = useRef(autoCaptureReadiness.visualState);
  useEffect(() => {
    if (previousProcessingRef.current === scannerProcessing) return;
    logCameraEvent({
      at: scannerNow(),
      type: 'processing_change',
      oldValue: previousProcessingRef.current ? 'processing' : 'idle',
      newValue: scannerProcessing ? 'processing' : 'idle',
      reason: 'processing',
    });
    previousProcessingRef.current = scannerProcessing;
  }, [logCameraEvent, scannerProcessing]);
  useEffect(() => {
    if (previousAutoCaptureRef.current === autoCaptureEnabled) return;
    logCameraEvent({
      at: scannerNow(),
      type: 'auto_capture_change',
      oldValue: previousAutoCaptureRef.current ? 'enabled' : 'disabled',
      newValue: autoCaptureEnabled ? 'enabled' : 'disabled',
      reason: 'auto_capture',
    });
    previousAutoCaptureRef.current = autoCaptureEnabled;
  }, [autoCaptureEnabled, logCameraEvent]);
  useEffect(() => {
    if (
      hapticsEnabled
      && Platform.OS !== 'web'
      && shouldEmitReadyHaptic(previousReadinessStateRef.current, autoCaptureReadiness.visualState)
    ) {
      void Haptics.selectionAsync();
    }
    previousReadinessStateRef.current = autoCaptureReadiness.visualState;
  }, [autoCaptureReadiness.visualState, hapticsEnabled]);

  const showBatchNotice = useCallback((notice: BatchScannerNoticeModel & { lineId: string }) => {
    if (batchNoticeTimerRef.current) clearTimeout(batchNoticeTimerRef.current);
    setBatchNotice(notice);
    batchNoticeTimerRef.current = setTimeout(() => {
      setBatchNotice(null);
      batchNoticeTimerRef.current = null;
    }, 2400);
  }, []);

  const handleLiveFrame = useCallback((frame: ScannerCameraFrame) => {
    if (!mountedRef.current || !context || frame.userId !== context.userId || !previewDimensions) return;
    if (shouldIgnoreFrameAfterLensSwitch({
      frameCapturedAt: frame.capturedAt,
      switchStartedAt: cameraLensSwitchStartedAtRef.current,
      cameraReady,
    })) return;
    setLiveFrameCount((count) => count + 1);
    setFirstLiveFrameAt((current) => current ?? frame.capturedAt);
    setLatestLiveFrameAt(frame.capturedAt);
    setPreviewSourceDimensions((current) => (
      current?.width === frame.previewResolution.width && current.height === frame.previewResolution.height
        ? current
        : frame.previewResolution
    ));
    const now = Date.now();
    if (now - lastLiveFrameAcceptedAtRef.current < 90) return;
    lastLiveFrameAcceptedAtRef.current = now;
    const frameGuide = scaleScannerGuideLayoutForFrame(guideLayout, previewDimensions, frame);
    const engineKey = [
      frame.width,
      frame.height,
      frameGuide.left,
      frameGuide.top,
      frameGuide.width,
      frameGuide.height,
    ].join(':');
    if (visionEngineKeyRef.current !== engineKey || !visionEngineRef.current) {
      const config: ScannerVisionConfig = {
        ...DEFAULT_SCANNER_VISION_CONFIG,
        guide: frameGuide,
      };
      visionEngineRef.current = createScannerVisionEngine({
        config,
        initialState: {
          lastFrameAt: null,
          stableSince: null,
          awaitingRemoval: autoScanner.duplicateProtection.awaitingCardRemoval,
        },
      });
      visionEngineKeyRef.current = engineKey;
    }
    const result = visionEngineRef.current.analyzeFrame(frame);
    setLiveVisionResult(result);
    setAutoScanner((current) => nextContinuousScannerRuntime(
      current,
      result.observation,
      DEFAULT_SCANNER_VISION_CONFIG.thresholds,
      result.observedAt,
    ));
  }, [autoScanner.duplicateProtection.awaitingCardRemoval, cameraReady, context, guideLayout, previewDimensions]);

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
          setBinderPage(draft.confirmation?.binderPage ? String(draft.confirmation.binderPage) : '1');
          setBinderSlot(draft.confirmation?.binderSlot ?? '');
        }
        const rawCameraPreferences = await appStorage.getItem(scannerCameraPreferenceKey(result.userId));
        if (rawCameraPreferences) {
          try {
            const parsed = JSON.parse(rawCameraPreferences) as { lensMode?: unknown; rawDeviceId?: unknown; autoCaptureEnabled?: unknown };
            const mode = normalizeScannerCameraSelectionMode(parsed.lensMode);
            if (mode === 'raw' && typeof parsed.rawDeviceId === 'string') {
              setCameraLensMode('auto');
              setRawCameraDeviceId(parsed.rawDeviceId);
            } else {
              setCameraLensMode(normalizeScannerCameraLensMode(parsed.lensMode));
              setRawCameraDeviceId(null);
            }
            if (typeof parsed.autoCaptureEnabled === 'boolean') {
              setAutoCaptureEnabled(parsed.autoCaptureEnabled);
            }
          } catch {
            setCameraLensMode('auto');
            setRawCameraDeviceId(null);
          }
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
      if (focusReticleTimerRef.current) clearTimeout(focusReticleTimerRef.current);
      autoCaptureInFlightRef.current = false;
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const foregrounded = nextState === 'active';
      logCameraEvent({
        at: scannerNow(),
        type: 'app_state_change',
        oldValue: appForegrounded ? 'active' : 'background',
        newValue: foregrounded ? 'active' : 'background',
        reason: 'app_state',
      });
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
  }, [appForegrounded, logCameraEvent, permission, userPausedCamera]);

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
    void appStorage.setItem(scannerCameraPreferenceKey(context.userId), JSON.stringify(rawCameraDeviceId
      ? { lensMode: 'raw', rawDeviceId: rawCameraDeviceId, autoCaptureEnabled }
      : { lensMode: cameraLensMode, autoCaptureEnabled }));
  }, [autoCaptureEnabled, cameraLensMode, context, rawCameraDeviceId]);

  useEffect(() => {
    if (torchState?.torchEnabled && !torchState.torchSupported) {
      setTorchEnabled(false);
      setTorchWarning('Torch is unavailable on the selected camera.');
    }
  }, [torchState]);

  useEffect(() => {
    const wasActive = cameraIsActiveRef.current;
    if (wasActive !== cameraActive) {
      cameraIsActiveRef.current = cameraActive;
      setCameraLifecycleDiagnostics((current) => ({
        ...current,
        isActiveTransitions: current.isActiveTransitions + 1,
      }));
      logCameraEvent({
        at: scannerNow(),
        type: 'is_active_change',
        oldValue: wasActive ? 'active' : 'inactive',
        newValue: cameraActive ? 'active' : 'inactive',
        reason: 'lifecycle',
      });
    }
  }, [cameraActive, logCameraEvent]);

  useEffect(() => {
    if (!context) return;
    void saveScannerDraft(createInterruptedScanDraft({
      userId: context.userId,
      query,
      selectedCandidateId: selected?.id ?? null,
      confirmation: selected ? { quantity, condition, finish, language, storageLocationId, binderPage: parseDestinationPage(binderPage), binderSlot: binderSlot.trim() || null, tradeStatus, addToWishlist: false } : null,
    }));
  }, [binderPage, binderSlot, condition, context, finish, language, quantity, query, selected, storageLocationId, tradeStatus]);

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

  const cleanupDiagnosticCapture = useCallback(async () => {
    const uri = diagnosticCaptureUri;
    setDiagnosticCaptureUri(null);
    if (uri) await deleteCapturedStill(uri);
  }, [diagnosticCaptureUri]);

  const resetScannerForm = useCallback((options: { preserveNotice?: boolean } = {}) => {
    setQuery('');
    setSelected(null);
    setCandidates([]);
    setMagicRecognition(null);
    setMagicStillScan(null);
    setQuantity(1);
    setTradeStatus('not_for_trade');
    if (!options.preserveNotice) setBatchNotice(null);
  }, []);

  const addCandidateToBatch = useCallback((input: {
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
    const effectiveStorageLocationId = sessionWithRate.defaultDestination === 'binder' ? binderLocationId : storageLocationId;
    const nextSession: ContinuousScannerSession = addRecognitionToSession(sessionWithRate, {
      stableScanId: input.stableScanId,
      candidate: input.candidate,
      recognition: recognitionReport,
      quantity,
      condition,
      finish: candidateFinish,
      language: input.candidate.language ?? language,
      marketPrice: null,
      priceSource: input.candidate.marketPrice ? 'pricing_pending' : null,
      priceTimestamp: null,
      storageLocationId: effectiveStorageLocationId,
      binderId: sessionWithRate.defaultDestination === 'binder' ? binderLocationId : null,
      binderPage: sessionWithRate.defaultDestination === 'binder' ? parseDestinationPage(binderPage) : null,
      binderSlot: sessionWithRate.defaultDestination === 'binder' ? binderSlot.trim() || null : null,
      tradeStatus,
      destination: sessionWithRate.defaultDestination,
      notes: recognitionReport.confidenceState === 'high_confidence'
        ? 'Pricing and final card decisions are handled in the Review List.'
        : 'Confirm printing. Pricing and final card decisions are handled in the Review List.',
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
    void Promise.resolve().then(async () => {
      const pricingStartedAt = scannerNow();
      const enrichment = await runScannerParallelEnrichment({
        session: nextSession,
        lineId: addedLine.id,
        stableScanId: addedLine.stableScanId,
        tasks: [{
          name: 'pricing',
          run: ({ session: enrichmentSession }) => {
            const pricing = enrichScannerSessionLinePrice({
              session: enrichmentSession,
              lineId: addedLine.id,
              stableScanId: addedLine.stableScanId,
              candidate: input.candidate,
              finish: candidateFinish,
              startedAt: pricingStartedAt,
              now: scannerNow,
            });
            if (diagnosticsEnabled) setLastPricingTrace(pricing.trace);
            return pricing.session;
          },
        }],
      });
      setSession((latest) => {
        if (!latest) return latest;
        const currentLine = latest.lines.find((line) => line.id === addedLine.id);
        if (!currentLine || currentLine.stableScanId !== addedLine.stableScanId || currentLine.exactPrintingId !== input.candidate.id) return latest;
        const enrichedLine = enrichment.session.lines.find((line) => line.id === addedLine.id);
        if (!enrichedLine) return latest;
        return {
          ...latest,
          lines: latest.lines.map((line) => line.id === addedLine.id ? enrichedLine : line),
        };
      });
    });
    resetScannerForm({ preserveNotice: true });
    return addedLine;
  }, [
    binderLocationId,
    binderPage,
    binderSlot,
    candidates,
    capturedFrame,
    condition,
    diagnosticsEnabled,
    finish,
    language,
    previewDimensions,
    purchaseRate,
    quantity,
    resetScannerForm,
    session,
    showBatchNotice,
    storageLocationId,
    tradeStatus,
  ]);

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

  const captureStill = useCallback(async () => {
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
      const photo = await cameraRef.current.capturePhoto();
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
  }, [
    addCandidateToBatch,
    appForegrounded,
    cameraLifecycle,
    cameraReady,
    cameraStageHeight,
    candidates,
    captureState,
    cleanupDiagnosticCapture,
    diagnosticCaptureUri,
    diagnosticsEnabled,
    guideLayout,
    permission,
    previewDimensions,
    previewWidth,
    query,
    recognitionStage,
    userPausedCamera,
  ]);
  const captureStillRef = useRef(captureStill);

  useEffect(() => {
    captureStillRef.current = captureStill;
  }, [captureStill]);

  useEffect(() => {
    const decision = canAutoCaptureNative({
      cameraReady,
      signalAvailability: visualSignals,
      analysis: liveFrameAnalysis,
    });
    if (!shouldTriggerAutomaticCapture({
      autoCaptureEnabled,
      nativeDecisionOk: decision.ok,
      readinessReady: autoCaptureReadiness.ready,
      visionShouldCapture: liveVisionResult?.shouldCapture,
      inFlight: autoCaptureInFlightRef.current,
      processing: scannerProcessing,
      permissionGranted: permission === 'granted',
      cameraActive,
    })) return;
    autoCaptureInFlightRef.current = true;
    void captureStillRef.current().finally(() => {
      setTimeout(() => {
        autoCaptureInFlightRef.current = false;
      }, 900);
    });
  }, [
    autoCaptureEnabled,
    autoCaptureReadiness.ready,
    cameraActive,
    cameraReady,
    liveVisionResult?.shouldCapture,
    liveFrameAnalysis,
    permission,
    scannerProcessing,
    visualSignals,
  ]);

  const updateCalibration = (patch: Partial<ScannerCalibrationPreferences>) => {
    setScannerCalibration((current) => normalizeScannerCalibrationPreferences({ ...current, ...patch }));
  };

  const handleCameraReady = useCallback(() => {
    const readyAt = scannerNow();
    if (cameraLensSwitchStartedAtRef.current !== null) {
      setLastCameraSwitchDurationMs(Math.round(readyAt - cameraLensSwitchStartedAtRef.current));
      cameraLensSwitchStartedAtRef.current = null;
    }
    setCameraLensSwitching(false);
    setCameraLifecycleDiagnostics((current) => ({
      ...current,
      previewStarts: current.previewStarts + 1,
    }));
    logCameraEvent({
      at: readyAt,
      type: 'frame_processor_change',
      oldValue: 'initializing',
      newValue: 'ready',
      reason: 'frame_processor',
    });
    setCameraReady(true);
    setCaptureState('ready');
  }, [logCameraEvent]);

  const handleCameraPreviewStopped = useCallback(() => {
    setCameraLifecycleDiagnostics((current) => ({
      ...current,
      previewStops: current.previewStops + 1,
    }));
    logCameraEvent({
      at: scannerNow(),
      type: 'frame_processor_change',
      oldValue: 'ready',
      newValue: 'stopped',
      reason: 'frame_processor',
    });
  }, [logCameraEvent]);

  const handleCameraDeviceDiagnostics = useCallback((summary: ScannerCameraDeviceSummary | null) => {
    const previousDeviceId = activeCameraDeviceIdRef.current;
    setCameraDeviceDiagnostics(summary);
    if (previousDeviceId !== summary?.id) {
      if (previousDeviceId !== null || summary?.id) {
        setCameraLifecycleDiagnostics((current) => ({
          ...current,
          deviceChanges: current.deviceChanges + 1,
        }));
      }
      logCameraEvent({
        at: scannerNow(),
        type: 'device_change',
        oldValue: previousDeviceId ?? 'none',
        newValue: summary?.id ?? 'none',
        reason: 'device_change',
      });
      activeCameraDeviceIdRef.current = summary?.id ?? null;
    }
  }, [logCameraEvent]);

  const handleCameraMounted = useCallback(() => {
    setCameraLifecycleDiagnostics((current) => ({
      ...current,
      mounts: current.mounts + 1,
    }));
    logCameraEvent({
      at: scannerNow(),
      type: 'camera_mount',
      oldValue: 'unmounted',
      newValue: 'mounted',
      reason: 'lifecycle',
    });
  }, [logCameraEvent]);

  const handleCameraUnmounted = useCallback(() => {
    setCameraLifecycleDiagnostics((current) => ({
      ...current,
      unmounts: current.unmounts + 1,
    }));
    logCameraEvent({
      at: scannerNow(),
      type: 'camera_unmount',
      oldValue: 'mounted',
      newValue: 'unmounted',
      reason: 'lifecycle',
    });
  }, [logCameraEvent]);

  const handleTorchStateChange = useCallback((nextTorchState: ScannerTorchState) => {
    setTorchState(nextTorchState);
    const previous = torchTransitionsRef.current[0];
    if (previous?.state !== nextTorchState.torchProp) {
      const transition: ScannerTorchTransition = {
        at: scannerNow(),
        state: nextTorchState.torchProp,
        reason: 'lifecycle',
      };
      const nextTransitions = [transition, ...torchTransitionsRef.current].slice(0, 8);
      torchTransitionsRef.current = nextTransitions;
      if (shouldWarnAboutTorchThrash(nextTransitions, transition.at)) {
        setTorchWarning('Torch changed repeatedly without a user action. Check camera lifecycle diagnostics.');
      }
      logCameraEvent({
        at: transition.at,
        type: 'torch_change',
        oldValue: previous?.state ?? 'unknown',
        newValue: nextTorchState.torchProp,
        reason: transition.reason,
      });
    }
  }, [logCameraEvent]);

  const updateCameraLensOptions = useCallback((options: ScannerCameraLensOption[]) => {
    setCameraLensOptions(options);
    if (!rawCameraDeviceId && !options.some((option) => option.mode === cameraLensMode && option.supported)) {
      setCameraLensMode('auto');
    }
  }, [cameraLensMode, rawCameraDeviceId]);

  const handleCameraInventoryChange = useCallback((selection: ScannerCameraLensSelection) => {
    setCameraInventory(selection);
  }, []);

  const selectCameraLens = useCallback((mode: ScannerCameraLensMode) => {
    const option = cameraLensOptions.find((candidateOption) => candidateOption.mode === mode);
    if (!option?.supported) {
      setShowCameraSelectionSheet(false);
      return;
    }
    if (!rawCameraDeviceId && mode === cameraLensMode) {
      setShowCameraSelectionSheet(false);
      return;
    }
    cameraLensSwitchStartedAtRef.current = scannerNow();
    logCameraEvent({
      at: cameraLensSwitchStartedAtRef.current,
      type: 'device_change',
      oldValue: rawCameraDeviceId ?? cameraLensMode,
      newValue: mode,
      reason: 'device_change',
    });
    activeCaptureIdRef.current = null;
    activeSearchIdRef.current = null;
    autoCaptureInFlightRef.current = false;
    setCameraLensSwitching(true);
    setCameraReady(false);
    setCaptureState('camera_not_ready');
    setLiveVisionResult(null);
    setFocusReticle(null);
    setLastCameraSwitchDurationMs(null);
    setRawCameraDeviceId(null);
    setCameraLensMode(mode);
    setShowCameraSelectionSheet(false);
  }, [cameraLensMode, cameraLensOptions, logCameraEvent, rawCameraDeviceId]);

  const selectRawCameraDevice = useCallback((deviceId: string) => {
    cameraLensSwitchStartedAtRef.current = scannerNow();
    logCameraEvent({
      at: cameraLensSwitchStartedAtRef.current,
      type: 'device_change',
      oldValue: rawCameraDeviceId ?? cameraLensMode,
      newValue: deviceId,
      reason: 'device_change',
    });
    activeCaptureIdRef.current = null;
    activeSearchIdRef.current = null;
    autoCaptureInFlightRef.current = false;
    setCameraLensSwitching(true);
    setCameraReady(false);
    setCaptureState('camera_not_ready');
    setLiveVisionResult(null);
    setFocusReticle(null);
    setLastCameraSwitchDurationMs(null);
    setRawCameraDeviceId(deviceId);
    setShowCameraInspectorSheet(false);
    setShowCameraSelectionSheet(false);
  }, [cameraLensMode, logCameraEvent, rawCameraDeviceId]);

  const cycleSupportedCameraLens = useCallback(() => {
    const options = cameraLensOptions.filter((option) => option.supported);
    const modes = options.map((option) => option.mode);
    if (!modes.length) return;
    const currentIndex = modes.indexOf(cameraLensMode);
    const nextMode = modes[(currentIndex + 1) % modes.length] ?? 'auto';
    const previousDevice = cameraDeviceDiagnostics?.id ?? rawCameraDeviceId ?? 'unavailable';
    const nextOption = options.find((option) => option.mode === nextMode);
    logCameraEvent({
      at: scannerNow(),
      type: 'device_change',
      oldValue: `${cameraLensMode}:${previousDevice}`,
      newValue: `${nextMode}:${nextOption?.deviceId ?? 'pending'}`,
      reason: 'device_change',
    });
    selectCameraLens(nextMode);
  }, [cameraDeviceDiagnostics?.id, cameraLensMode, cameraLensOptions, logCameraEvent, rawCameraDeviceId, selectCameraLens]);

  const handlePreviewFocusTap = useCallback(async (event: GestureResponderEvent) => {
    const requestedPoint = {
      x: event.nativeEvent.locationX,
      y: event.nativeEvent.locationY,
    };
    logCameraEvent({
      at: scannerNow(),
      type: 'focus_request',
      oldValue: focusDiagnostics?.outcome ?? 'none',
      newValue: `${Math.round(requestedPoint.x)},${Math.round(requestedPoint.y)}`,
      reason: 'user',
    });
    const supportsFocus = Boolean(cameraDeviceDiagnostics?.supportsFocus);
    const focusRequest = resolveScannerFocusRequest({
      active: permission === 'granted' && cameraActive && shouldScannerCameraRender(cameraLifecycle),
      appForegrounded,
      processing: scannerProcessing,
      supportsFocus,
    });
    const conversion = convertPreviewTapToCameraPoint({
      point: requestedPoint,
      view: previewDimensions ?? { width: previewWidth, height: cameraStageHeight },
      source: previewSourceDimensions,
      resizeMode: 'cover',
      mirrored: false,
    });
    if (!focusRequest.allowed || !conversion.insidePreview || !conversion.viewPoint) {
      setFocusDiagnostics({
        requestedPoint,
        convertedPoint: conversion.normalizedPoint,
        supportsFocus,
        outcome: 'blocked',
        latencyMs: null,
        error: focusRequest.reason ?? (conversion.insidePreview ? null : 'outside_preview'),
      });
      return;
    }
    const startedAt = scannerNow();
    setFocusReticle(requestedPoint);
    if (focusReticleTimerRef.current) clearTimeout(focusReticleTimerRef.current);
    focusReticleTimerRef.current = setTimeout(() => {
      setFocusReticle(null);
      focusReticleTimerRef.current = null;
    }, scannerFocusReticleDuration(reduceMotion));
    if (hapticsEnabled && Platform.OS !== 'web') void Haptics.selectionAsync();
    try {
      if (!cameraRef.current) throw new Error('Camera focus target is unavailable.');
      await cameraRef.current.focusAt(conversion.viewPoint);
      setFocusDiagnostics({
        requestedPoint,
        convertedPoint: conversion.normalizedPoint,
        supportsFocus,
        outcome: 'focused',
        latencyMs: Math.round(scannerNow() - startedAt),
        error: null,
      });
    } catch (focusError) {
      setFocusDiagnostics({
        requestedPoint,
        convertedPoint: conversion.normalizedPoint,
        supportsFocus,
        outcome: 'failed',
        latencyMs: Math.round(scannerNow() - startedAt),
        error: focusError instanceof Error ? focusError.message : 'Focus failed.',
      });
    }
  }, [
    appForegrounded,
    cameraActive,
    cameraDeviceDiagnostics?.supportsFocus,
    cameraLifecycle,
    cameraRef,
    cameraStageHeight,
    focusDiagnostics?.outcome,
    hapticsEnabled,
    logCameraEvent,
    permission,
    previewDimensions,
    previewSourceDimensions,
    previewWidth,
    reduceMotion,
    scannerProcessing,
  ]);

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

  const toggleTorch = useCallback(() => {
    const nextRequested = !torchEnabled;
    const transition: ScannerTorchTransition = {
      at: scannerNow(),
      state: nextRequested ? 'on' : 'off',
      reason: 'user',
    };
    torchTransitionsRef.current = [transition, ...torchTransitionsRef.current].slice(0, 8);
    setTorchWarning(null);
    setTorchEnabled(nextRequested);
  }, [torchEnabled]);

  const exportScannerPerformanceJson = async () => {
    const json = serializeScannerPerformanceReport(scannerPerformanceReport);
    const summary = serializeScannerBenchmarkSummary(scannerPerformanceReport);
    const exportText = `${summary}\n\n${json}`;
    setScannerPerformanceJsonSummary(`${scannerPerformanceReport.sampleCount} sample${scannerPerformanceReport.sampleCount === 1 ? '' : 's'} ready (${exportText.length} characters).`);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(exportText);
        setSuccess('Scanner benchmark report copied.');
        return;
      }
      await Share.share({ title: 'Scanner performance diagnostics', message: exportText });
      setSuccess('Scanner benchmark report opened for export.');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Scanner performance export failed.');
    }
  };

  if (loading) return <TDScreen style={s.screen}><TDLoadingState title="Loading scanner" message="Preparing collection, storage, and confirmation options." /></TDScreen>;

  const supportedCameraLensOptions = cameraLensOptions.filter((option) => option.supported);
  const selectedCameraLensLabel = rawCameraDeviceId
    ? `Raw ${cameraInventory?.rearDevices.find((device) => device.id === rawCameraDeviceId)?.name ?? 'camera'}`
    : supportedCameraLensOptions.find((option) => option.mode === cameraLensMode)?.label
    ?? SCANNER_CAMERA_LENS_LABELS[cameraLensMode].label;

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
        torchSupported={torchState?.torchSupported ?? true}
        cameraLensMode={cameraLensMode}
        rawCameraDeviceId={rawCameraDeviceId}
        appForegrounded={appForegrounded}
        scannerProcessing={scannerProcessing}
        focusReticle={focusReticle}
        guideLayout={guideLayout}
        guidePresentation={guidePresentation}
        guideMotion={guideMotion}
        instruction={scannerInstruction}
        platform={Platform.OS}
        latestResultKind={failedResultTray?.kind ?? null}
        userId={context?.userId ?? 'scanner-user'}
        onPreviewLayout={handlePreviewLayout}
        onCameraReady={handleCameraReady}
        onCameraPreviewStopped={handleCameraPreviewStopped}
        onLiveFrame={handleLiveFrame}
        onToggleTorch={toggleTorch}
        onCapture={captureStill}
        onRequestCamera={requestCamera}
        onPreviewFocusTap={handlePreviewFocusTap}
        onLensOptionsChange={updateCameraLensOptions}
        onCameraInventoryChange={handleCameraInventoryChange}
        onDeviceDiagnosticsChange={handleCameraDeviceDiagnostics}
        onQualityProfileChange={setCameraQualityProfile}
        onSessionConfigChange={setCameraSessionSummary}
        onTorchStateChange={handleTorchStateChange}
        onCameraMounted={handleCameraMounted}
        onCameraUnmounted={handleCameraUnmounted}
        autoCaptureEnabled={autoCaptureEnabled}
        hideControls={hideMainControls}
      />

      <ScannerHud
        header={scannerHeader}
        sessionName={scannerModeLabel(sessionMode)}
        topInset={insets.top}
        autoCaptureEnabled={autoCaptureEnabled}
        onClose={() => router.back()}
        onToggleAutoCapture={() => setAutoCaptureEnabled((value) => !value)}
        onSettings={() => setShowSettingsSheet(true)}
      />

      <View pointerEvents="box-none" style={s.overlayLayer}>
        {diagnosticsEnabled ? (
          <AutoScanDiagnosticsOverlay
            cardPresent={Boolean(liveVisionResult?.detection.cardPresent)}
            stable={autoCaptureReadiness.primaryReason !== 'motion' && diagnosticsSnapshot.stabilityMs !== null}
            ready={autoCaptureReadiness.ready}
            captureArmed={autoCaptureEnabled && autoCaptureReadiness.ready}
            captureFired={scannerProcessing || captureState !== 'idle'}
            processing={scannerProcessing}
            awaitingRemoval={autoScanner.duplicateProtection.awaitingCardRemoval}
            removed={!autoScanner.duplicateProtection.awaitingCardRemoval && autoScanner.duplicateProtection.lastCaptureAt !== null}
            rearmed={!autoScanner.duplicateProtection.awaitingCardRemoval && autoCaptureEnabled}
            timings={scanTimings[0]}
            frameDeltaMs={diagnosticsSnapshot.stabilityMs}
          />
        ) : null}
        {error && visibleSurface !== 'result_tray' && !showAddedOverlay ? <ScannerToast tone="warning" title="Scanner notice" message={error} /> : null}
        {success && visibleSurface !== 'result_tray' && !showAddedOverlay ? null : null}
        {batchNotice ? (
          <ScannerToast
            tone={batchNotice.tone}
            title={batchNotice.title}
            message={batchNotice.message}
          />
        ) : null}

        {visibleSurface === 'progress' && searching ? null : null}
        {visibleSurface === 'progress' && recognitionStage === 'reading_title' ? null : null}
        {visibleSurface === 'progress' && recognitionStage === 'finding_card' ? null : null}

        {failedResultTray && !showAddedOverlay ? <ScannerFailureOverlay tray={failedResultTray} onRetake={retakeScan} onManualSearch={() => setShowManualSearchSheet(true)} /> : null}
        {showSettingsSheet ? (
          <TDCard style={s.sheet}>
            <SheetHeader title="Scanner settings" onClose={() => setShowSettingsSheet(false)} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.sheetScroll, { paddingBottom: insets.bottom + 92 }]}>
              <SettingsRow label="Mode" value={scannerModeLabel(sessionMode)} onPress={() => setShowModeSelectionSheet(true)} />
              <SettingsRow label="Camera" value={selectedCameraLensLabel} onPress={() => setShowCameraSelectionSheet(true)} />
              <ToggleRow label="Auto Scan" enabled={autoCaptureEnabled} onToggle={() => setAutoCaptureEnabled((value) => !value)} />
              <OptionRow label="Default condition" options={CARD_CONDITION_OPTIONS} value={condition} display={displayCondition} onSelect={setCondition} compact />
              <TDInput label="Cash Offer" value={purchaseRate} onChangeText={setPurchaseRate} keyboardType="numeric" />
              <ToggleRow label="Sound" enabled={soundEnabled} onToggle={() => setSoundEnabled((value) => !value)} />
              <ToggleRow label="Haptics" enabled={hapticsEnabled} onToggle={() => setHapticsEnabled((value) => !value)} />
              {torchWarning ? <TDText variant="caption" tone="danger">{torchWarning}</TDText> : null}
              <SettingsRow label="Advanced Settings" value={showAdvancedSettings ? 'Hide' : 'Show'} onPress={() => setShowAdvancedSettings((value) => !value)} />
              {showAdvancedSettings ? (
                <View style={s.advancedSettings}>
                  <OptionRow label="Stable duration" options={['normal', 'long']} value="normal" display={(value) => value === 'normal' ? 'Standard' : 'Long'} onSelect={() => undefined} compact />
                  <OptionRow label="Default finish" options={['normal', 'foil', 'etched']} value={finish} display={displayFinish} onSelect={setFinish} compact />
                  <TDInput label="Default language" value={language} onChangeText={setLanguage} placeholder="en" />
                  <OptionRow<ContinuousScannerSession['defaultDestination']> label="Destination" options={['collection', 'storage_location', 'binder', 'trade_binder']} value={scannerSettingsDestination(session)} display={scannerDestinationLabel} onSelect={(value) => session ? setSession({ ...session, defaultDestination: value }) : undefined} compact />
                  <OptionRow label="Trade Binder" options={TRADE_BINDER_STATUS_OPTIONS} value={tradeStatus} display={(status) => status.replaceAll('_', ' ')} onSelect={setTradeStatus} compact />
                  {session?.defaultDestination === 'storage_location' ? (
                    <OptionRow label="Storage" options={['none', ...(context?.locations.map((location) => location.id) ?? [])]} value={storageLocationId ?? 'none'} display={(id) => id === 'none' ? 'Unassigned' : context?.locations.find((location) => location.id === id)?.name ?? 'Unavailable'} onSelect={(id) => setStorageLocationId(id === 'none' ? null : id)} compact />
                  ) : null}
                  {session?.defaultDestination === 'binder' ? (
                    <>
                      <OptionRow label="Binder" options={['none', ...(context?.locations.filter((location) => location.type === 'binder').map((location) => location.id) ?? [])]} value={binderLocationId ?? 'none'} display={(id) => id === 'none' ? 'Choose binder' : context?.locations.find((location) => location.id === id)?.name ?? 'Unavailable'} onSelect={(id) => setBinderLocationId(id === 'none' ? null : id)} compact />
                      <View style={s.destinationCoordinateRow}>
                        <TDInput label="Page" value={binderPage} keyboardType="numeric" onChangeText={setBinderPage} containerStyle={s.destinationCoordinateInput} />
                        <TDInput label="Slot" value={binderSlot} autoCapitalize="characters" onChangeText={setBinderSlot} containerStyle={s.destinationCoordinateInput} />
                      </View>
                    </>
                  ) : null}
                  <TDButton label={cameraActive ? 'Pause scanner' : 'Resume scanner'} variant="secondary" onPress={toggleCameraPause} />
                  <TDButton label="Manual search" variant="secondary" iconName="search-outline" onPress={() => {
                    setShowSettingsSheet(false);
                    setShowManualSearchSheet(true);
                  }} />
                  {queuedAdds.length ? <TDButton label="Scanner recovery" variant="secondary" loading={syncingQueue} onPress={retryQueue} /> : null}
                  {diagnosticsEnabled ? <TDButton label="Scanner diagnostics" variant="secondary" onPress={() => {
                    setShowSettingsSheet(false);
                    setShowDiagnosticsSheet(true);
                  }} /> : null}
                  {diagnosticsEnabled ? <TDButton label="Camera QA" variant="secondary" onPress={() => {
                    setShowSettingsSheet(false);
                    router.push('/dev/camera-qa' as never);
                  }} /> : null}
                  {diagnosticsEnabled ? <TDButton label="Cycle cameras" variant="secondary" onPress={cycleSupportedCameraLens} /> : null}
                  <TDText variant="caption" tone="muted">{privacy.message}</TDText>
                </View>
              ) : null}
            </ScrollView>
          </TDCard>
        ) : null}

        {showCameraSelectionSheet ? (
          <TDCard style={s.sheet}>
            <SheetHeader title="Camera" onClose={() => setShowCameraSelectionSheet(false)} />
            <TDText variant="small" tone="muted">Auto chooses the best available camera for card scanning.</TDText>
            <View style={s.lensOptionList}>
              {supportedCameraLensOptions.map((option) => (
                <Pressable
                  key={option.mode}
                  accessibilityRole="button"
                  accessibilityState={{ selected: cameraLensMode === option.mode }}
                  accessibilityLabel={`${option.label}${cameraLensMode === option.mode ? ', selected' : ''}`}
                  onPress={() => selectCameraLens(option.mode)}
                  style={({ pressed }) => [s.lensOption, cameraLensMode === option.mode && s.lensOptionSelected, pressed && s.settingsRowPressed]}
                >
                  <View style={s.flex}>
                    <TDText variant="small">{option.label}</TDText>
                    {option.warning ? <TDText variant="caption" tone="danger">{option.warning}</TDText> : null}
                  </View>
                  {cameraLensMode === option.mode ? <Ionicons name="checkmark-circle" size={20} color={color.primaryBright} /> : null}
                </Pressable>
              ))}
              {diagnosticsEnabled ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open raw camera inspector"
                  onPress={() => {
                    setShowCameraSelectionSheet(false);
                    setShowCameraInspectorSheet(true);
                  }}
                  style={({ pressed }) => [s.lensOption, pressed && s.settingsRowPressed]}
                >
                  <View style={s.flex}>
                    <TDText variant="small">Raw cameras</TDText>
                    <TDText variant="caption" tone="muted">Development-only hardware comparison.</TDText>
                  </View>
                  <Ionicons name="construct-outline" size={20} color={color.warning} />
                </Pressable>
              ) : null}
            </View>
          </TDCard>
        ) : null}

        {diagnosticsEnabled && showCameraInspectorSheet ? (
          <TDCard style={s.sheet}>
            <SheetHeader title="Camera Inspector" onClose={() => setShowCameraInspectorSheet(false)} />
            <TDText variant="small" tone="muted">Development-only. Raw device IDs are hidden from normal scanner settings.</TDText>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.sheetScroll, { paddingBottom: insets.bottom + 92 }]}>
              {(cameraInventory?.rearDevices ?? []).map((device, index) => (
                <Pressable
                  key={device.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: rawCameraDeviceId === device.id || cameraDeviceDiagnostics?.id === device.id }}
                  accessibilityLabel={`Select raw camera ${index + 1}`}
                  onPress={() => selectRawCameraDevice(device.id)}
                  style={({ pressed }) => [s.rawCameraCard, rawCameraDeviceId === device.id && s.lensOptionSelected, pressed && s.settingsRowPressed]}
                >
                  <View style={s.rawCameraHeader}>
                    <TDText variant="small">Camera {index + 1}</TDText>
                    <TDBadge tone={device.hasTorch ? 'success' : 'neutral'}>{device.hasTorch ? 'Torch' : 'No torch'}</TDBadge>
                  </View>
                  <TDText variant="caption" tone="muted">{device.name}</TDText>
                  <TDText variant="caption" tone="muted">ID {device.id}</TDText>
                  <TDText variant="caption" tone="muted">Physical {device.physicalDevices.join(' | ') || 'unavailable'}</TDText>
                  <TDText variant="caption" tone="muted">Focus {device.supportsFocus ? 'yes' : 'no'}; min focus {device.minFocusDistance ?? 'not exposed'}</TDText>
                  <TDText variant="caption" tone="muted">Zoom {device.minZoom ?? '?'} / {device.neutralZoom ?? 'n/a'} / {device.maxZoom ?? '?'}</TDText>
                  <TDText variant="caption" tone="muted">Max photo {resolutionSummary(device.maxPhotoResolution)}; max video {resolutionSummary(device.maxVideoResolution)}</TDText>
                  <TDText variant="caption" tone="muted">FPS {device.fpsRanges.map((range) => `${range.min}-${range.max}`).join(', ') || 'unavailable'}</TDText>
                </Pressable>
              ))}
              {cameraInventory?.rearDevices.length ? null : <TDEmptyState title="No rear cameras discovered" message="VisionCamera has not returned camera devices yet." />}
            </ScrollView>
          </TDCard>
        ) : null}

        {showModeSelectionSheet ? (
          <TDCard style={s.sheet}>
            <SheetHeader title="Mode" onClose={() => setShowModeSelectionSheet(false)} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.sheetScroll, { paddingBottom: insets.bottom + 92 }]}>
              {SCANNER_SESSION_MODES.map((mode) => (
                <SettingsRow key={mode.id} label={mode.label} value={sessionMode === mode.id ? 'Selected' : ''} onPress={() => {
                  if (!context) return;
                  setSessionMode(mode.id);
                  setSession(createContinuousScannerSession({
                    id: createScanId(),
                    userId: context.userId,
                    name: mode.label,
                    mode: mode.id,
                    defaultDestination: mode.id === 'collection_intake' ? 'collection' : undefined,
                  }));
                  setShowModeSelectionSheet(false);
                }} />
              ))}
            </ScrollView>
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
              <DiagnosticCell label="Camera lens" value={selectedCameraLensLabel} />
              <DiagnosticCell label="Device ID" value={cameraDeviceDiagnostics?.id ?? 'unavailable'} />
              <DiagnosticCell label="Device name" value={cameraDeviceDiagnostics?.name ?? 'unavailable'} />
              <DiagnosticCell label="Position" value={cameraDeviceDiagnostics?.position ?? 'unavailable'} />
              <DiagnosticCell label="Physical devices" value={cameraDeviceDiagnostics?.physicalDevices.join(' | ') || 'unavailable'} />
              <DiagnosticCell label="Formats count" value={cameraDeviceDiagnostics?.formatsCount === null ? 'not exposed by VisionCamera 5' : String(cameraDeviceDiagnostics?.formatsCount ?? 'unavailable')} />
              <DiagnosticCell label="Selected format" value={cameraSessionSummary?.selectedFormat ?? cameraQualityProfile?.selectedFormatLabel ?? 'unavailable'} />
              <DiagnosticCell label="Photo target" value={resolutionSummary(cameraQualityProfile?.photoResolution ?? null)} />
              <DiagnosticCell label="Frame target" value={resolutionSummary(cameraQualityProfile?.frameResolution ?? null)} />
              <DiagnosticCell label="Actual photo" value={resolutionSummary(cameraSessionSummary?.photoResolution ?? null)} />
              <DiagnosticCell label="Actual video" value={resolutionSummary(cameraSessionSummary?.videoResolution ?? null)} />
              <DiagnosticCell label="FPS target" value={cameraQualityProfile ? `${cameraQualityProfile.targetFps} fps` : 'unavailable'} />
              <DiagnosticCell label="FPS actual" value={cameraSessionSummary?.fps ? `${cameraSessionSummary.fps} fps` : 'unavailable'} />
              <DiagnosticCell label="Zoom range" value={cameraDeviceDiagnostics ? `${cameraDeviceDiagnostics.minZoom ?? '?'} / ${cameraDeviceDiagnostics.neutralZoom ?? 'n/a'} / ${cameraDeviceDiagnostics.maxZoom ?? '?'}` : 'unavailable'} />
              <DiagnosticCell label="Default zoom" value={cameraQualityProfile?.defaultZoom === null || cameraQualityProfile?.defaultZoom === undefined ? 'unavailable' : String(cameraQualityProfile.defaultZoom)} />
              <DiagnosticCell label="Min focus distance" value={cameraDeviceDiagnostics?.minFocusDistance === null ? 'not exposed by VisionCamera' : String(cameraDeviceDiagnostics?.minFocusDistance ?? 'unavailable')} />
              <DiagnosticCell label="Supports focus" value={cameraDeviceDiagnostics?.supportsFocus ? 'yes' : 'no'} />
              <DiagnosticCell label="Has torch" value={cameraDeviceDiagnostics?.hasTorch ? 'yes' : 'no'} />
              <DiagnosticCell label="Torch requested" value={torchEnabled ? 'on' : 'off'} />
              <DiagnosticCell label="Torch actual" value={torchState?.torchProp ?? 'unavailable'} />
              <DiagnosticCell label="Photo flash" value={torchState?.photoFlashMode ?? 'off'} />
              <DiagnosticCell label="Focus point" value={focusDiagnostics ? `${Math.round(focusDiagnostics.requestedPoint.x)},${Math.round(focusDiagnostics.requestedPoint.y)} -> ${focusDiagnostics.convertedPoint ? `${focusDiagnostics.convertedPoint.x.toFixed(3)},${focusDiagnostics.convertedPoint.y.toFixed(3)}` : 'unavailable'}` : 'unavailable'} />
              <DiagnosticCell label="Focus age" value={focusDiagnostics?.latencyMs === null || focusDiagnostics?.latencyMs === undefined ? 'unavailable' : `${focusDiagnostics.latencyMs} ms`} />
              <DiagnosticCell label="Focus outcome" value={focusDiagnostics ? `${focusDiagnostics.outcome}${focusDiagnostics.latencyMs === null ? '' : ` ${focusDiagnostics.latencyMs} ms`}${focusDiagnostics.error ? ` ${focusDiagnostics.error}` : ''}` : 'unavailable'} />
              <DiagnosticCell label="Switch duration" value={lastCameraSwitchDurationMs === null ? 'unavailable' : `${lastCameraSwitchDurationMs} ms`} />
              <DiagnosticCell label="Camera mounts" value={`${cameraLifecycleDiagnostics.mounts} / ${cameraLifecycleDiagnostics.unmounts}`} />
              <DiagnosticCell label="Preview starts" value={`${cameraLifecycleDiagnostics.previewStarts} / ${cameraLifecycleDiagnostics.previewStops}`} />
              <DiagnosticCell label="Device changes" value={String(cameraLifecycleDiagnostics.deviceChanges)} />
              <DiagnosticCell label="Active transitions" value={String(cameraLifecycleDiagnostics.isActiveTransitions)} />
              <DiagnosticCell label="Frame count" value={String(liveFrameCount)} />
              <DiagnosticCell label="Effective FPS" value={autoCaptureReadiness.effectiveFps === null ? 'unavailable' : `${autoCaptureReadiness.effectiveFps} fps`} />
              <DiagnosticCell label="Readiness state" value={autoCaptureReadiness.visualState.replaceAll('_', ' ')} />
              <DiagnosticCell label="Readiness reason" value={autoCaptureReadiness.primaryReason.replaceAll('_', ' ')} />
              <DiagnosticCell label="Readiness copy" value={autoCaptureReadiness.instruction} />
              <DiagnosticCell label="Auto capture" value={autoCaptureReadiness.label} />
              <DiagnosticCell label="Auto blocked by" value={autoCaptureReadiness.reasons.join(' | ') || 'ready'} />
              <DiagnosticCell label="Card presence" value={liveVisionResult?.detection.cardPresent ? 'present' : 'unavailable'} />
              <DiagnosticCell label="Corners" value={String(diagnosticsSnapshot.cardCornersVisible)} />
              <DiagnosticCell label="Fill" value={diagnosticsSnapshot.fillPercentage === null ? 'unavailable' : diagnosticsSnapshot.fillPercentage.toFixed(2)} />
              <DiagnosticCell label="Center offset" value={liveVisionResult?.detection.centerOffset ? liveVisionResult.detection.centerOffset.normalized.toFixed(2) : 'unavailable'} />
              <DiagnosticCell label="Blur" value={diagnosticsSnapshot.blurScore === null ? 'unavailable' : diagnosticsSnapshot.blurScore.toFixed(2)} />
              <DiagnosticCell label="Motion" value={diagnosticsSnapshot.motionScore === null ? 'unavailable' : diagnosticsSnapshot.motionScore.toFixed(2)} />
              <DiagnosticCell label="Lighting" value={diagnosticsSnapshot.lightingScore === null ? 'unavailable' : diagnosticsSnapshot.lightingScore.toFixed(2)} />
              <DiagnosticCell label="Glare" value={diagnosticsSnapshot.glareScore === null ? 'unavailable' : diagnosticsSnapshot.glareScore.toFixed(2)} />
              <DiagnosticCell label="Stable" value={diagnosticsSnapshot.stabilityMs === null ? 'unavailable' : `${diagnosticsSnapshot.stabilityMs} ms`} />
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
              <DiagnosticCell label="Pricing outcome" value={lastPricingTrace?.pricingOutcome ?? 'unavailable'} />
              <DiagnosticCell label="Pricing capture" value={lastPricingTrace?.captureId ?? 'unavailable'} />
              <DiagnosticCell label="Pricing row" value={lastPricingTrace?.sessionRowId ?? 'unavailable'} />
              <DiagnosticCell label="Scryfall card" value={lastPricingTrace?.scryfallCardId ?? 'unavailable'} />
              <DiagnosticCell label="Oracle ID" value={lastPricingTrace?.oracleId ?? 'unavailable'} />
              <DiagnosticCell label="Price identity" value={lastPricingTrace ? `${lastPricingTrace.cardName} ${lastPricingTrace.setCode ?? '?'} #${lastPricingTrace.collectorNumber ?? '?'}` : 'unavailable'} />
              <DiagnosticCell label="Price finish" value={lastPricingTrace?.finish ?? 'unavailable'} />
              <DiagnosticCell label="prices.usd" value={priceTraceValue(lastPricingTrace?.pricesUsd)} />
              <DiagnosticCell label="prices.usd_foil" value={priceTraceValue(lastPricingTrace?.pricesUsdFoil)} />
              <DiagnosticCell label="prices.usd_etched" value={priceTraceValue(lastPricingTrace?.pricesUsdEtched)} />
              <DiagnosticCell label="Selected price" value={lastPricingTrace?.selectedPriceField ?? 'unavailable'} />
              <DiagnosticCell label="Parsed price" value={priceTraceValue(lastPricingTrace?.parsedValue)} />
              <DiagnosticCell label="Enrichment target" value={lastPricingTrace?.enrichmentTargetRowId ?? 'unavailable'} />
              <DiagnosticCell label="Persist result" value={lastPricingTrace?.persistenceResult ?? 'unavailable'} />
              <DiagnosticCell label="Offer recalc" value={lastPricingTrace?.offerRecalculationResult ?? 'unavailable'} />
              <DiagnosticCell label="Pricing latency" value={performanceMs(lastPricingTrace?.pricingLatencyMs ?? null)} />
            </View>
            <View style={s.eventLog}>
              <TDText variant="label" tone="muted">Camera event log</TDText>
              {cameraEvents.slice(0, 12).map((event) => (
                <TDText key={event.id} variant="caption" tone="muted">
                  {Math.round(event.at)} {event.type}: {event.oldValue} -&gt; {event.newValue} ({event.reason})
                </TDText>
              ))}
              {cameraEvents.length ? null : <TDText variant="caption" tone="muted">No camera events recorded yet.</TDText>}
            </View>
            {diagnosticCaptureUri && magicStillScan?.cropDiagnostics ? (
              <View style={s.cropProofGrid}>
                <CropProof imageUri={diagnosticCaptureUri} label="Full captured image" crop={{ x: 0, y: 0, width: 1, height: 1 }} imageSize={magicStillScan.cropDiagnostics.normalizedImage} />
                <CropProof imageUri={diagnosticCaptureUri} label="Card crop proof" crop={magicStillScan.cropDiagnostics.cardCrop} imageSize={magicStillScan.cropDiagnostics.normalizedImage} />
                <CropProof imageUri={diagnosticCaptureUri} label="Primary title crop" crop={magicStillScan.cropDiagnostics.titleCrops.title_primary} imageSize={magicStillScan.cropDiagnostics.normalizedImage} />
                <CropProof imageUri={diagnosticCaptureUri} label="Expanded title crop" crop={magicStillScan.cropDiagnostics.titleCrops.title_expanded} imageSize={magicStillScan.cropDiagnostics.normalizedImage} />
                <CropProof imageUri={diagnosticCaptureUri} label="Upper-card title fallback" crop={magicStillScan.cropDiagnostics.titleCrops.upper_card} imageSize={magicStillScan.cropDiagnostics.normalizedImage} />
                <CropProof imageUri={diagnosticCaptureUri} label="Full-card fallback" crop={magicStillScan.cropDiagnostics.titleCrops.full_card} imageSize={magicStillScan.cropDiagnostics.normalizedImage} />
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
  sessionName,
  topInset,
  autoCaptureEnabled,
  onClose,
  onToggleAutoCapture,
  onSettings,
}: {
  header: ReturnType<typeof scanner2HeaderModel>;
  sessionName: string;
  topInset: number;
  autoCaptureEnabled: boolean;
  onClose: () => void;
  onToggleAutoCapture: () => void;
  onSettings: () => void;
}) {
  return (
    <View style={[s.topHud, { paddingTop: Math.max(topInset, 10) }]}>
      <HeaderIconControl label="Close scanner" icon="close-outline" onPress={onClose} />
      <Pressable accessibilityRole="button" accessibilityLabel="Open scanner settings" onPress={onSettings} style={({ pressed }) => [s.hudTextStack, pressed && s.settingsRowPressed]}>
        <View style={s.hudLine}>
          <TDText variant="title" numberOfLines={1} style={s.hudMode}>Scanner</TDText>
          <TDText variant="caption" tone="muted" numberOfLines={1}>{header.line1.cards} scanned</TDText>
        </View>
        <TDText variant="caption" tone="muted" numberOfLines={1}>{sessionName}</TDText>
      </Pressable>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Auto Scan"
        accessibilityState={{ checked: autoCaptureEnabled }}
        onPress={onToggleAutoCapture}
        style={({ pressed }) => [
          s.headerAutoToggle,
          autoCaptureEnabled && s.headerAutoToggleOn,
          pressed && s.settingsRowPressed,
        ]}
      >
        <TDText variant="caption" style={[s.headerAutoToggleLabel, autoCaptureEnabled && s.headerAutoToggleLabelOn]}>
          Auto
        </TDText>
        <TDText variant="caption" style={[s.headerAutoToggleValue, autoCaptureEnabled && s.headerAutoToggleValueOn]}>
          {autoCaptureEnabled ? 'On' : 'Off'}
        </TDText>
      </Pressable>
      <HeaderIconControl label="Open scanner settings" icon="settings-outline" onPress={onSettings} />
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
  torchSupported,
  cameraLensMode,
  rawCameraDeviceId,
  appForegrounded,
  scannerProcessing,
  focusReticle,
  guideLayout,
  guidePresentation,
  guideMotion,
  instruction,
  platform,
  latestResultKind,
  userId,
  onPreviewLayout,
  onCameraReady,
  onCameraPreviewStopped,
  onLiveFrame,
  onToggleTorch,
  onCapture,
  onRequestCamera,
  onPreviewFocusTap,
  onLensOptionsChange,
  onCameraInventoryChange,
  onDeviceDiagnosticsChange,
  onQualityProfileChange,
  onSessionConfigChange,
  onTorchStateChange,
  onCameraMounted,
  onCameraUnmounted,
  autoCaptureEnabled,
  hideControls,
}: {
  cameraRef: RefObject<ScannerCameraHandle | null>;
  permission: ScannerPermissionState;
  cameraActive: boolean;
  cameraLifecycle: Scanner2CameraLifecycleState;
  cameraReady: boolean;
  cameraStageHeight: number;
  torchEnabled: boolean;
  torchSupported: boolean;
  cameraLensMode: ScannerCameraLensMode;
  rawCameraDeviceId: string | null;
  appForegrounded: boolean;
  scannerProcessing: boolean;
  focusReticle: ScannerCameraPoint | null;
  guideLayout: ReturnType<typeof calculateCardGuideLayout>;
  guidePresentation: PremiumScannerGuidePresentation;
  guideMotion: ReturnType<typeof scanner2MotionForState>;
  instruction: string;
  platform: string;
  latestResultKind: PremiumResultTrayKind | null;
  userId: string;
  onPreviewLayout: (event: LayoutChangeEvent) => void;
  onCameraReady: () => void;
  onCameraPreviewStopped: () => void;
  onLiveFrame: (frame: ScannerCameraFrame) => void;
  onToggleTorch: () => void;
  onCapture: () => void;
  onRequestCamera: () => void;
  onPreviewFocusTap: (event: GestureResponderEvent) => void;
  onLensOptionsChange: (options: ScannerCameraLensOption[]) => void;
  onCameraInventoryChange: (selection: ScannerCameraLensSelection) => void;
  onDeviceDiagnosticsChange: (summary: ScannerCameraDeviceSummary | null) => void;
  onQualityProfileChange: (profile: ScannerCameraQualityProfile | null) => void;
  onSessionConfigChange: (summary: ScannerCameraSessionSummary | null) => void;
  onTorchStateChange: (state: ScannerTorchState) => void;
  onCameraMounted: () => void;
  onCameraUnmounted: () => void;
  autoCaptureEnabled: boolean;
  hideControls: boolean;
}) {
  const showCamera = permission === 'granted' && cameraActive && shouldScannerCameraRender(cameraLifecycle);
  const showResume = shouldShowScannerResumeAction(cameraLifecycle);
  return (
    <View style={[s.cameraStage, { height: cameraStageHeight }]}>
      {showCamera ? (
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Scanner camera preview. Double tap or tap the card to focus."
          style={s.cameraViewport}
          onLayout={onPreviewLayout}
          onTouchEnd={onPreviewFocusTap}
        >
          <ScannerCamera
            ref={cameraRef}
            active={showCamera}
            torchEnabled={torchEnabled}
            lensMode={cameraLensMode}
            rawDeviceId={rawCameraDeviceId}
            appForegrounded={appForegrounded}
            focusEnabled={!scannerProcessing}
            userId={userId}
            onReady={onCameraReady}
            onPreviewStopped={onCameraPreviewStopped}
            onFrameAnalysis={onLiveFrame}
            onLensOptionsChange={onLensOptionsChange}
            onCameraInventoryChange={onCameraInventoryChange}
            onDeviceDiagnosticsChange={onDeviceDiagnosticsChange}
            onQualityProfileChange={onQualityProfileChange}
            onSessionConfigChange={onSessionConfigChange}
            onTorchStateChange={onTorchStateChange}
          />
          <ScannerGuide guideLayout={guideLayout} guidePresentation={guidePresentation} guideMotion={guideMotion} />
          {focusReticle ? <FocusReticle point={focusReticle} /> : null}
          <CameraMountTracker onMount={onCameraMounted} onUnmount={onCameraUnmounted} />
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
        torchSupported={torchSupported}
        cameraReady={cameraReady}
        permission={permission}
        onToggleTorch={onToggleTorch}
        onCapture={onCapture}
        autoCaptureEnabled={autoCaptureEnabled}
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

function FocusReticle({ point }: { point: ScannerCameraPoint }) {
  return (
    <View
      pointerEvents="none"
      style={[
        s.focusReticle,
        {
          left: point.x - 20,
          top: point.y - 20,
        },
      ]}
    />
  );
}

function CameraMountTracker({ onMount, onUnmount }: { onMount: () => void; onUnmount: () => void }) {
  useEffect(() => {
    onMount();
    return onUnmount;
  }, [onMount, onUnmount]);
  return null;
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
  torchSupported,
  cameraReady,
  permission,
  onToggleTorch,
  onCapture,
  autoCaptureEnabled,
  hidden,
}: {
  torchEnabled: boolean;
  torchSupported: boolean;
  cameraReady: boolean;
  permission: ScannerPermissionState;
  onToggleTorch: () => void;
  onCapture: () => void;
  autoCaptureEnabled: boolean;
  hidden: boolean;
}) {
  const controls = scanner2MainControls();
  if (hidden) return null;
  return (
    <View style={s.cameraControls}>
      {controls.map((control) => {
        if (control === 'torch') return <IconControl key={control} label={torchSupported ? (torchEnabled ? 'Turn torch off' : 'Turn torch on') : 'Torch unavailable on this camera'} icon={torchEnabled ? 'flash' : 'flash-outline'} disabled={!torchSupported} onPress={onToggleTorch} />;
        if (control === 'capture' && autoCaptureEnabled) return null;
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
        <TDText variant="small">{"Couldn't identify"}</TDText>
        <TDText variant="caption" tone="muted">Retake the card or search manually.</TDText>
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

function SettingsRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${value}`} onPress={onPress} style={({ pressed }) => [s.settingsRow, pressed && s.settingsRowPressed]}>
      <TDText variant="small">{label}</TDText>
      <View style={s.settingsRowValue}>
        {value ? <TDText variant="small" tone="muted" numberOfLines={1}>{value}</TDText> : null}
        <Ionicons name="chevron-forward" size={18} color={color.textMuted} />
      </View>
    </Pressable>
  );
}

function ToggleRow({ label, enabled, disabled = false, onToggle }: { label: string; enabled: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: enabled, disabled }} accessibilityLabel={label} disabled={disabled} onPress={onToggle} style={({ pressed }) => [s.settingsRow, disabled && s.settingsRowDisabled, pressed && s.settingsRowPressed]}>
      <TDText variant="small">{label}</TDText>
      <View style={[s.switchTrack, enabled && s.switchTrackOn]}>
        <View style={[s.switchThumb, enabled && s.switchThumbOn]} />
      </View>
    </Pressable>
  );
}

function OptionRow<T extends string>({ label, options, value, display, onSelect, compact = false }: { label: string; options: readonly T[]; value: T; display: (value: T) => string; onSelect: (value: T) => void; compact?: boolean }) {
  return (
    <View style={[s.optionGroup, compact && s.optionGroupCompact]}>
      <TDText variant="label" tone="muted">{label}</TDText>
      <View style={s.chips}>
        {options.map((option) => <TDChip key={option} label={display(option)} selected={option === value} onPress={() => onSelect(option)} />)}
      </View>
    </View>
  );
}

function scannerSettingsDestination(session: ContinuousScannerSession | null): ContinuousScannerSession['defaultDestination'] {
  const destination = session?.defaultDestination;
  return destination === 'storage_location' || destination === 'binder' || destination === 'trade_binder' ? destination : 'collection';
}

function parseDestinationPage(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function AutoScanDiagnosticsOverlay({
  cardPresent,
  stable,
  ready,
  captureArmed,
  captureFired,
  processing,
  awaitingRemoval,
  removed,
  rearmed,
  timings,
  frameDeltaMs,
}: {
  cardPresent: boolean;
  stable: boolean;
  ready: boolean;
  captureArmed: boolean;
  captureFired: boolean;
  processing: boolean;
  awaitingRemoval: boolean;
  removed: boolean;
  rearmed: boolean;
  timings?: BatchScannerTimingSnapshot;
  frameDeltaMs: number | null;
}) {
  const flags = [
    ['cardPresent', cardPresent],
    ['stable', stable],
    ['ready', ready],
    ['captureArmed', captureArmed],
    ['captureFired', captureFired],
    ['processing', processing],
    ['awaitingRemoval', awaitingRemoval],
    ['removed', removed],
    ['rearmed', rearmed],
  ] as const;
  return (
    <View pointerEvents="none" style={s.autoDiagnosticsOverlay}>
      <TDText variant="caption" tone="info">Auto Scan QA</TDText>
      <View style={s.autoDiagnosticsFlags}>
        {flags.map(([label, value]) => (
          <View key={label} style={[s.autoDiagnosticsFlag, value && s.autoDiagnosticsFlagOn]}>
            <TDText variant="caption" tone={value ? 'success' : 'muted'}>{label}</TDText>
          </View>
        ))}
      </View>
      <TDText variant="caption" tone="muted">
        frame {performanceMs(frameDeltaMs)} · capture {performanceMs(timings?.captureMs ?? null)} · OCR {performanceMs(timings?.ocrMs ?? null)}
      </TDText>
      <TDText variant="caption" tone="muted">
        lookup {performanceMs(timings?.scryfallMs ?? null)} · result {performanceMs(timings?.totalMs ?? null)} · rearm {awaitingRemoval ? 'waiting' : 'ready'}
      </TDText>
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

function priceTraceValue(value: number | null | undefined) {
  return typeof value === 'number' ? `$${value.toFixed(2)}` : 'unavailable';
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
  topHud: { position: 'absolute', top: 0, left: space.sm, right: space.sm, zIndex: 60, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs, paddingBottom: space.xs, backgroundColor: color.canvas + 'B8' },
  hudTextStack: { flex: 1, minWidth: 0, gap: 2 },
  hudLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hudMode: { flex: 1, minWidth: 0 },
  hudMetricLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hudMetric: { minWidth: 0, flexShrink: 1 },
  hudActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  headerIconControl: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.border, backgroundColor: color.surfaceFloating + 'CC' },
  headerAutoToggle: { minHeight: 38, minWidth: 72, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceFloating + 'CC' },
  headerAutoToggleOn: { borderColor: color.primaryBright, backgroundColor: color.primary + '2E' },
  headerAutoToggleLabel: { color: color.textMuted, lineHeight: 13 },
  headerAutoToggleLabelOn: { color: color.primaryBright },
  headerAutoToggleValue: { color: color.text, lineHeight: 14 },
  headerAutoToggleValueOn: { color: color.text },
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
  cameraScrimTop: { position: 'absolute', top: '23%', left: space.lg, right: space.lg, alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.md, backgroundColor: color.canvas + '22', zIndex: 20 },
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
  focusReticle: { position: 'absolute', zIndex: 25, width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: color.primaryBright, backgroundColor: color.primaryBright + '12' },
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
  sheet: { maxHeight: 520, gap: space.sm, borderColor: color.borderStrong, backgroundColor: color.surfaceFloating },
  sheetScroll: { gap: space.sm },
  sheetHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  settingsRow: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, backgroundColor: color.canvasRaised },
  settingsRowDisabled: { opacity: 0.48 },
  settingsRowPressed: { opacity: 0.82 },
  settingsRowValue: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space.xs },
  lensOptionList: { gap: space.sm },
  lensOption: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.sm, paddingVertical: space.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, backgroundColor: color.canvasRaised },
  lensOptionSelected: { borderColor: color.primaryBright, backgroundColor: color.primary + '24' },
  rawCameraCard: { minHeight: 124, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, gap: 4, backgroundColor: color.canvasRaised },
  rawCameraHeader: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  switchTrack: { width: 42, height: 24, borderRadius: radius.pill, padding: 3, justifyContent: 'center', backgroundColor: color.borderStrong },
  switchTrackOn: { backgroundColor: color.primaryBright },
  switchThumb: { width: 18, height: 18, borderRadius: radius.pill, backgroundColor: color.text },
  switchThumbOn: { alignSelf: 'flex-end', backgroundColor: color.canvas },
  advancedSettings: { gap: space.sm },
  destinationCoordinateRow: { flexDirection: 'row', gap: space.sm },
  destinationCoordinateInput: { flex: 1 },
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
  autoDiagnosticsOverlay: {
    position: 'absolute',
    left: space.sm,
    right: space.sm,
    top: 96,
    gap: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.primaryBright + '26',
    padding: space.xs,
    backgroundColor: color.canvas + 'D8',
  },
  autoDiagnosticsFlags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  autoDiagnosticsFlag: { borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: color.surface },
  autoDiagnosticsFlagOn: { backgroundColor: color.success + '18' },
  centerText: { textAlign: 'center' },
  noticeCard: { gap: space.sm },
  scannerToast: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: color.borderStrong, paddingHorizontal: space.sm, paddingVertical: space.xs, backgroundColor: color.canvas + 'D8' },
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
  eventLog: { gap: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: color.border, padding: space.sm, backgroundColor: color.canvasRaised },
  cropProofGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cropProof: { flex: 1, minWidth: 150, gap: space.xs },
  cropProofImageFrame: { height: 180, overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: color.borderStrong, backgroundColor: '#010711' },
  cropProofOverlay: { position: 'absolute', borderWidth: 2, borderColor: color.primaryBright, backgroundColor: color.primaryBright + '18' },
  optionGroup: { gap: space.xs },
  optionGroupCompact: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  checkboxRow: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm },
});

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCameraPermissions } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useAudioPlayer } from 'expo-audio';

import ScanbotSDK, { SdkConfiguration, ScanbotDocumentScannerView, type DocumentDetectionResult, type ImageRef as ScanbotImageRef, type ScanbotDocumentScannerViewHandle } from 'react-native-scanbot-sdk';

import { TDButton, TDCard, TDBadge, TDIconButton, TDSessionStrip, TDSkeleton, TDText, TDToast } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { addRecognitionToSession, createContinuousScannerSession, createRecognitionPipelineReport, continuousScannerSessionKey, removeScannerSessionLine, scannerDestinationLabel, type ContinuousScannerSession, type ScannerSessionLine } from '@/services/continuous-offer-scanner';
import { displayCondition, displayFinish } from '@/services/collector-workspace';
import {
  PREBUILT_SCANBOT_ACCEPTED_ANGLE_SCORE,
  PREBUILT_SCANBOT_ACCEPTED_SIZE_SCORE,
  PREBUILT_SCANBOT_AUTO_SNAPPING_DELAY_SECONDS,
  PREBUILT_SCANBOT_AUTO_SNAPPING_ENABLED,
  PREBUILT_SCANBOT_AUTO_SNAPPING_SENSITIVITY,
  PREBUILT_SCANBOT_PHOTO_QUALITY_PRIORITIZATION,
} from '@/services/prebuilt-scanbot-config';
import { isCardSightScannerEnabled } from '@/services/cardsight-scan-provider';
import type { GuideCropMapping } from '@/services/magic-ocr-pipeline';
import { loadScannerContext } from '@/services/scanner-data';
import { enrichScannerSessionLinePrice, selectScryfallScannerPrice } from '@/services/scanner-price-enrichment';
import { isScannerDiagnosticsEnabled } from '@/services/native-scanner-calibration';
import { runPrebuiltScannerBakeoff, type PrebuiltScannerBakeoffReport } from '@/services/scanner-prebuilt-bakeoff';
import { DEFAULT_SCANNER_FEEDBACK_PREFERENCES, loadScannerFeedbackPreferences, type ScannerFeedbackPreferences } from '@/services/scanner-feedback-preferences';
import { playScannerSuccessTone, shouldPlayScannerSuccessTone } from '@/services/scanner-audio-feedback';
import { appStorage } from '@/services/storage/app-storage';
import type { ScannerCardCandidate } from '@/services/scanner-foundation';
import { PrintingSelectorSheet } from '@/components/scanner/printing-selector-sheet';
import { updateScannerSessionLinePrinting } from '@/services/continuous-offer-scanner';
import { scanCardSightImageOnce, scanCardSightWithFallback, type CardSightAttemptTrace, type CardSightMobileScanResult } from '@/services/cardsight-scan-provider';

type ScannerStage = 'initializing' | 'ready' | 'capturing' | 'processing' | 'error';
type ProductionScanPhase = 'initializing' | 'ready' | 'detected' | 'capturing' | 'identifying' | 'accepted' | 'waiting_for_card_change' | 'error';
type ScannerMode = 'bakeoff' | 'production';
type PrebuiltScannerDiagnosticsEvent = {
  scanbotDetected?: string | null;
  scanbotCaptured?: string | null;
  cardsightRequest?: string | null;
  cardsightResult?: string | null;
  cardIntelligenceResult?: string | null;
  sessionAppend?: string | null;
};

type ScannerImageArtifact = {
  path: string | null;
  size: { width: number; height: number };
  bytes: number;
  mimeType: 'image/jpeg';
  orientation: 'portrait' | 'landscape';
};

type CardsightPreviewArtifact = ScannerImageArtifact & {
  source: 'raw' | 'cropped';
  candidate: string | null;
};

type CardsightTraceSummary = {
  authenticated: boolean;
  imageSource: 'raw' | 'cropped';
  width: number | null;
  height: number | null;
  bytes: number | null;
  mimeType: 'image/jpeg';
  requestStarted: boolean;
  httpStatus: number | null;
  latencyMs: number | null;
};

type CardsightResultSummary = {
  httpStatus: number | null;
  latencyMs: number | null;
  candidateCount: number;
  topCandidateName: string | null;
  topCandidateSet: string | null;
  topCandidateCollectorNumber: string | null;
  topCandidateConfidence: number | null;
  rawProviderConfidence: number | null;
  parsingSucceeded: boolean;
};

type CardIntelligenceSummary = {
  canonicalCardId: string | null;
  printingId: string | null;
  name: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  confidence: number | null;
  requiresConfirmation: boolean;
  accepted: boolean;
  rejectionReason: string | null;
};

type CardsightDiagnosticsSnapshot = {
  image: CardsightPreviewArtifact | null;
  request: CardsightTraceSummary | null;
  result: CardsightResultSummary | null;
  intelligence: CardIntelligenceSummary | null;
};

type ProductionScanResult = {
  name: string;
  cardSightId: string | null;
  canonicalCardId: string | null;
  printingId: string | null;
  imageUrl: string | null;
  setName: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  language: string | null;
  finish: string | null;
  availableFinishes: string[];
  condition: string | null;
  quantity: number;
  destination: string | null;
  marketPrice: number | null;
  priceSource: string | null;
  confidence: number | null;
  oracleIdVerified: boolean;
  exactPrintingResolved: boolean;
  requiresPrintingReview: boolean;
  candidate: ScannerCardCandidate;
  sessionLineId: string | null;
};

type ProductionScanFeedback = {
  outcome: 'success' | 'review' | 'duplicate' | 'error';
  message: string;
  cardName: string | null;
  audioEventKey?: string | null;
  actionLabel?: string;
  onAction?: () => void;
};

const SCANBOT_LICENSE_KEY = process.env.EXPO_PUBLIC_SCANBOT_LICENSE_KEY?.trim() ?? '';
const SCANNER_SUCCESS_SOUND = require('../../assets/audio/scanner-success-ding.wav');

type ScanbotInitResult =
  | { ok: true; licenseLabel: 'configured' | 'trial'; error: null }
  | { ok: false; licenseLabel: 'missing'; error: string };

let scanbotInitPromise: Promise<ScanbotInitResult> | null = null;

export default function PrebuiltScannerBakeoffScreen({
  mode = 'bakeoff',
}: {
  mode?: ScannerMode;
} = {}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const isCompactProductionLayout = windowHeight < 720;
  const isLargeProductionLayout = windowHeight >= 900;
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scannerRef = useRef<ScanbotDocumentScannerViewHandle | null>(null);
  const [stage, setStage] = useState<ScannerStage>('initializing');
  const [cameraReady, setCameraReady] = useState(false);
  const [detection, setDetection] = useState<DocumentDetectionResult | null>(null);
  const [report, setReport] = useState<PrebuiltScannerBakeoffReport | null>(null);
  const [session, setSession] = useState<ContinuousScannerSession | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkLicenseLabel, setSdkLicenseLabel] = useState<'configured' | 'trial' | 'missing'>('missing');
  const [capturedCount, setCapturedCount] = useState(0);
  const [captureArtifacts, setCaptureArtifacts] = useState<{ raw: ScannerImageArtifact; cropped: ScannerImageArtifact | null } | null>(null);
  const [cardsightPreview, setCardsightPreview] = useState<CardsightPreviewArtifact | null>(null);
  const [cardsightDiagnostics, setCardsightDiagnostics] = useState<CardsightDiagnosticsSnapshot | null>(null);
  const [cardsightProbe, setCardsightProbe] = useState<CardsightDiagnosticsSnapshot | null>(null);
  const [productionResult, setProductionResult] = useState<ProductionScanResult | null>(null);
  const [productionFlashVisible, setProductionFlashVisible] = useState(false);
  const [scanPhase, setScanPhase] = useState<ProductionScanPhase>('initializing');
  const [scanFeedback, setScanFeedback] = useState<ProductionScanFeedback | null>(null);
  const [scannerPreferences, setScannerPreferences] = useState<ScannerFeedbackPreferences>(DEFAULT_SCANNER_FEEDBACK_PREFERENCES);
  const [printingSelectorCandidate, setPrintingSelectorCandidate] = useState<ScannerCardCandidate | null>(null);
  const [printingSelectorOpen, setPrintingSelectorOpen] = useState(false);
  const lastAcceptedIdentityRef = useRef<string | null>(null);
  const lastAcceptedAtRef = useRef(0);
  const lastPlayedAudioEventKeyRef = useRef<string | null>(null);
  const lastSessionLineIdRef = useRef<string | null>(null);
  const captureInFlightRef = useRef(false);
  const lastDetectionStatusRef = useRef<string | null>(null);
  const lastDetectionSignatureRef = useRef<string | null>(null);
  const lastAcceptedDetectionSignatureRef = useRef<string | null>(null);
  const waitingForCardChangeRef = useRef(false);
  const productionFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productionFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTonePlayer = useAudioPlayer(SCANNER_SUCCESS_SOUND, { keepAudioSessionActive: true });

  useEffect(() => {
    return () => {
      if (productionFeedbackTimerRef.current) {
        clearTimeout(productionFeedbackTimerRef.current);
        productionFeedbackTimerRef.current = null;
      }
      if (productionFlashTimerRef.current) {
        clearTimeout(productionFlashTimerRef.current);
        productionFlashTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    void loadScannerFeedbackPreferences().then((preferences) => {
      if (!active) return;
      setScannerPreferences(preferences);
    });
    return () => {
      active = false;
    };
  }, []);

  const testCurrentCardSightImage = useCallback(async () => {
    const currentImage = cardsightPreview
      ?? cardsightDiagnostics?.image
      ?? (captureArtifacts ? {
        path: captureArtifacts.cropped?.path ?? captureArtifacts.raw.path,
        size: captureArtifacts.cropped?.path ? captureArtifacts.cropped.size : captureArtifacts.raw.size,
        bytes: captureArtifacts.cropped?.path ? captureArtifacts.cropped.bytes : captureArtifacts.raw.bytes,
        mimeType: 'image/jpeg' as const,
        orientation: (captureArtifacts.cropped?.path ? captureArtifacts.cropped.size : captureArtifacts.raw.size).width >= (captureArtifacts.cropped?.path ? captureArtifacts.cropped.size : captureArtifacts.raw.size).height ? 'landscape' as const : 'portrait' as const,
        source: captureArtifacts.cropped?.path ? 'cropped' as const : 'raw' as const,
        candidate: null,
      } : null);
    if (!currentImage?.path) return;
    setCardsightProbe(null);
    setError(null);
    const result = await scanCardSightImageOnce({
      imageUri: currentImage.path,
      mapping: fullImageMapping(currentImage.size),
      mode: 'raw',
      online: true,
      allowUnconfirmedCandidate: true,
    });
    const topCandidate = result.ok ? result.candidates[0] ?? null : null;
    const probeIntelligence: CardIntelligenceSummary = topCandidate
      ? {
        canonicalCardId: topCandidate.oracleId ?? null,
        printingId: topCandidate.id ?? null,
        name: topCandidate.name ?? null,
        setCode: topCandidate.setCode ?? null,
        collectorNumber: topCandidate.collectorNumber ?? null,
        confidence: topCandidate.confidence ?? (result.ok ? result.topConfidence : null) ?? null,
        requiresConfirmation: result.fallbackRecommended,
        accepted: true,
        rejectionReason: null,
      }
      : {
        canonicalCardId: null,
        printingId: null,
        name: null,
        setCode: null,
        collectorNumber: null,
        confidence: result.ok ? result.topConfidence ?? null : null,
        requiresConfirmation: false,
        accepted: false,
        rejectionReason: result.ok ? 'CardSight did not return a candidate.' : result.reason,
      };
    setCardsightProbe(buildCardsightDiagnosticsSnapshot({
      image: currentImage,
      attempt: result,
      intelligence: probeIntelligence,
    }));
  }, [captureArtifacts, cardsightDiagnostics?.image, cardsightPreview]);

  const emitScanFeedback = useCallback((feedback: ProductionScanFeedback) => {
    setScanFeedback(feedback);
    if (productionFeedbackTimerRef.current) {
      clearTimeout(productionFeedbackTimerRef.current);
    }
    productionFeedbackTimerRef.current = setTimeout(() => {
      setScanFeedback(null);
      productionFeedbackTimerRef.current = null;
    }, feedback.outcome === 'success' ? 760 : 520);

    if (scannerPreferences.hapticConfirmation) {
      if (feedback.outcome === 'success') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (feedback.outcome === 'review') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (feedback.outcome === 'error') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        void Haptics.selectionAsync();
      }
    }
    if (shouldPlayScannerSuccessTone({
      outcome: feedback.outcome,
      audioConfirmation: scannerPreferences.audioConfirmation,
      audioEventKey: feedback.audioEventKey ?? null,
      lastPlayedAudioEventKey: lastPlayedAudioEventKeyRef.current,
    })) {
      lastPlayedAudioEventKeyRef.current = feedback.audioEventKey ?? null;
      void playScannerSuccessTone(successTonePlayer);
    }
  }, [scannerPreferences.audioConfirmation, scannerPreferences.hapticConfirmation, successTonePlayer]);

  const removeProductionSessionLine = useCallback((lineId: string | null) => {
    if (!lineId || !session || !sessionUserId) return;
    const nextSession = removeScannerSessionLine(session, lineId);
    const removedLine = session.lines.find((line) => line.id === lineId) ?? null;
    setSession(nextSession);
    setCapturedCount(nextSession.lines.length);
    lastSessionLineIdRef.current = null;
    lastAcceptedIdentityRef.current = null;
    lastAcceptedAtRef.current = 0;
    lastAcceptedDetectionSignatureRef.current = null;
    waitingForCardChangeRef.current = false;
    setProductionResult(null);
    setProductionFlashVisible(false);
    setScanPhase('ready');
    setSuccess(removedLine ? `Removed ${removedLine.cardName}` : 'Removed card');
    setTimeout(() => {
      setSuccess(null);
    }, 650);
    if (productionFlashTimerRef.current) {
      clearTimeout(productionFlashTimerRef.current);
      productionFlashTimerRef.current = null;
    }
    void appStorage.setItem(continuousScannerSessionKey(sessionUserId), JSON.stringify(nextSession));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [session, sessionUserId]);

  const handleOpenPrintingSelector = useCallback((candidate: ScannerCardCandidate) => {
    if (__DEV__) {
      console.info('TD_PRINTING_IDENTITY', {
      cardName: candidate.name,
      cardSightId: stringId(candidate.providerIds?.cardsight),
      canonicalCardId: candidate.oracleId ?? null,
      oracleId: candidate.oracleId ?? null,
      printingId: candidate.id ?? null,
      scryfallId: stringId(candidate.providerIds?.scryfall),
    });
  }
    setPrintingSelectorCandidate(candidate);
    setPrintingSelectorOpen(true);
  }, []);

  const diagnosticsEnabled = isScannerDiagnosticsEnabled();
  const permissionGranted = Boolean(cameraPermission?.granted);

  useEffect(() => {
    let active = true;
    void ensureScanbotSdkInitialized().then((result) => {
      if (!active) return;
      if (!result) return;
      setSdkReady(result.ok);
      setSdkLicenseLabel(result.licenseLabel);
      setStage(result.ok ? 'ready' : 'error');
      setError(result.ok ? null : result.error);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'production') return;
    let mounted = true;
    void loadScannerContext().then(async (context) => {
      if (!mounted) return;
      setSessionUserId(context.userId);
      const raw = await appStorage.getItem(continuousScannerSessionKey(context.userId));
      if (!mounted) return;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as ContinuousScannerSession;
          if (parsed.userId === context.userId) {
            setSession(parsed);
            setCapturedCount(parsed.lines.length);
            return;
          }
        } catch {
          // fall through to create a fresh session
        }
      }
      const nextSession = createContinuousScannerSession({
        id: `prebuilt-scanner-${context.userId}`,
        userId: context.userId,
        name: 'Scanner session',
        mode: 'collection_intake',
      });
      setSession(nextSession);
      setCapturedCount(0);
    }).catch((loadError) => {
      if (!mounted) return;
      setError(loadError instanceof Error ? loadError.message : 'Scanner context is unavailable.');
      setStage('error');
    });
    return () => {
      mounted = false;
    };
  }, [mode]);

  const stageCopy = useMemo(() => {
    if (success) return success;
    if (mode === 'production' && error && stage === 'ready') return error;
    if (!sdkReady) return 'Preparing scanner...';
    if (stage === 'capturing') return 'Capturing...';
    if (stage === 'processing') return 'Checking card...';
    if (report) return 'Captured. Compare the provider results below.';
    if (mode === 'production') {
      if (!sessionUserId) return 'Preparing session...';
      if (detection && detection.status !== 'NOT_ACQUIRED') return 'Card detected';
      return cameraReady ? 'Detecting card...' : 'Waiting for camera...';
    }
    return cameraReady ? 'Place the card roughly in view.' : 'Waiting for camera...';
  }, [cameraReady, detection, error, mode, report, sdkReady, sessionUserId, stage, success]);

  const productionStageCopy = useMemo(() => {
    if (success) return success;
    if (error && stage === 'ready') return error;
    if (!sdkReady || !cameraReady || scanPhase === 'initializing') return 'Preparing camera...';
    if (scanPhase === 'capturing') return 'Capturing...';
    if (scanPhase === 'identifying') return 'Matching printing...';
    if (scanPhase === 'accepted') {
      if (productionResult?.exactPrintingResolved) return 'Matched';
      if (productionResult?.requiresPrintingReview) return 'Printing review needed';
      return 'Added';
    }
    if (scanPhase === 'waiting_for_card_change') {
      if (scanFeedback?.outcome === 'duplicate') return scanFeedback.message;
      return 'Waiting for next card';
    }
    if (scanPhase === 'detected') return 'Reading...';
    if (productionResult?.exactPrintingResolved) return 'Matched';
    if (productionResult?.requiresPrintingReview) return 'Printing review needed';
    return 'Looking for card';
  }, [cameraReady, error, productionResult?.exactPrintingResolved, productionResult?.requiresPrintingReview, scanFeedback?.message, scanFeedback?.outcome, scanPhase, sdkReady, stage, success]);

  const productionStageTone = useMemo<'muted' | 'info' | 'warning' | 'success'>(() => {
    if (error && stage === 'ready') return 'warning';
    if (!sdkReady || !cameraReady || scanPhase === 'initializing') return 'info';
    if (scanPhase === 'capturing' || scanPhase === 'identifying' || scanPhase === 'detected') return 'info';
    if (scanPhase === 'waiting_for_card_change') return 'warning';
    if (scanPhase === 'accepted' && productionResult?.exactPrintingResolved) return 'success';
    if (scanPhase === 'accepted' && productionResult?.requiresPrintingReview) return 'warning';
    if (productionResult?.exactPrintingResolved) return 'success';
    if (productionResult?.requiresPrintingReview) return 'warning';
    return 'muted';
  }, [cameraReady, error, productionResult?.exactPrintingResolved, productionResult?.requiresPrintingReview, scanPhase, sdkReady, stage]);

  const productionSessionLine = useMemo(() => {
    if (!productionResult?.sessionLineId || !session) return null;
    return session.lines.find((line) => line.id === productionResult.sessionLineId) ?? null;
  }, [productionResult, session]);

  const sessionTotalMarketValue = useMemo(() => {
    if (!session) return null;
    const total = session.lines.reduce((sum, line) => sum + (line.marketPrice ?? 0) * line.quantity, 0);
    return total > 0 ? total : null;
  }, [session]);

  const sessionProgress = useMemo(() => {
    const totals = { ready: 0, review: 0 };
    for (const line of session?.lines ?? []) {
      const quantity = line.quantity ?? 1;
      if (line.reviewStatus === 'needs_review') totals.review += quantity;
      else totals.ready += quantity;
    }
    return totals;
  }, [session]);

  const sessionStripSummary = useMemo(() => {
    const parts = [`Session • ${capturedCount} cards`];
    if (sessionProgress.review > 0) {
      parts.push(`${sessionProgress.review} review`);
    }
    if (sessionTotalMarketValue !== null) {
      parts.push(`$${sessionTotalMarketValue.toFixed(2)} total`);
    }
    return parts.join(' • ');
  }, [capturedCount, sessionProgress.review, sessionTotalMarketValue]);

  const showDiagnosticsPanel = mode === 'bakeoff' && __DEV__ && diagnosticsEnabled;

  useEffect(() => {
    if (!__DEV__ || mode !== 'production' || !sdkReady) return;
    console.info('TD_SCANNER_ENGINE', {
      cameraEngine: 'scanbot',
      recognitionProvider: 'cardsight',
      legacyScannerActive: false,
      tcgtrackingActive: false,
    });
  }, [mode, sdkReady]);

  const handleFrameDetectionResult = useCallback((result: DocumentDetectionResult) => {
    setCameraReady(true);
    setDetection(result);
    setStage((current) => current === 'initializing' ? 'ready' : current);
    const signature = detectionSignature(result);
    lastDetectionSignatureRef.current = signature;
    if (__DEV__ && result.status !== lastDetectionStatusRef.current) {
      lastDetectionStatusRef.current = result.status;
      logPrebuiltScannerDiagnostics({ scanbotDetected: result.status });
    }
    if (captureInFlightRef.current || scanPhase === 'capturing' || scanPhase === 'identifying') return;
    const changedCard = Boolean(waitingForCardChangeRef.current && (
      result.status === 'NOT_ACQUIRED' || signature !== lastAcceptedDetectionSignatureRef.current
    ));
    if (changedCard) {
      waitingForCardChangeRef.current = false;
    }
    if (waitingForCardChangeRef.current) {
      setScanPhase('waiting_for_card_change');
      return;
    }
    setScanPhase(result.status === 'NOT_ACQUIRED' ? 'ready' : 'detected');
  }, [scanPhase]);

  const handleSnappedDocumentResult = useCallback(async (originalImage: ScanbotImageRef, documentImage?: ScanbotImageRef) => {
    if (captureInFlightRef.current || scanPhase === 'capturing' || scanPhase === 'identifying') return;
    if (mode === 'production' && scannerPreferences.blockDuplicateScans && waitingForCardChangeRef.current) {
      emitScanFeedback({
        outcome: 'duplicate',
        message: 'Duplicate skipped',
        cardName: productionResult?.name ?? null,
      });
      setError(null);
      setScanPhase('waiting_for_card_change');
      return;
    }
    captureInFlightRef.current = true;
    setStage('capturing');
    setScanPhase('capturing');
    setSuccess(null);
    setReport(null);
    setError(null);
    setProductionResult(null);
    setProductionFlashVisible(false);
    setPrintingSelectorCandidate(null);
    setPrintingSelectorOpen(false);
    setCaptureArtifacts(null);
    setCardsightPreview(null);
    setCardsightDiagnostics(null);
    setCardsightProbe(null);
    if (productionFlashTimerRef.current) {
      clearTimeout(productionFlashTimerRef.current);
      productionFlashTimerRef.current = null;
    }
    logPrebuiltScannerDiagnostics({ scanbotCaptured: 'capturing' });
    scannerRef.current?.freezeCamera();
    try {
      const raw = await persistImageRef(originalImage, 'scanbot-raw');
      const cropped = documentImage ? await persistImageRef(documentImage, 'scanbot-cropped') : null;
      if (!raw.path) {
        throw new Error('The scanner did not return a usable image.');
      }
      setCaptureArtifacts({ raw, cropped });
      logPrebuiltScannerDiagnostics({ scanbotCaptured: `${raw.size.width}x${raw.size.height}` });
      setStage('processing');
      setScanPhase('identifying');
      if (mode === 'production') {
        const productionOutcome = await runProductionScannerCapture({
          rawImageUri: raw.path,
          croppedImageUri: cropped?.path ?? null,
          rawImageSize: raw.size,
          croppedImageSize: cropped?.size ?? null,
          rawImageBytes: raw.bytes,
          croppedImageBytes: cropped?.bytes ?? null,
          currentDetectionSignature: lastDetectionSignatureRef.current,
          session,
          sessionUserId,
          preferences: scannerPreferences,
          onSessionUpdate: setSession,
          onCapturedCountChange: setCapturedCount,
          onSuccess: setSuccess,
          onPrebuiltDiagnostics: logPrebuiltScannerDiagnostics,
          onCardsightPreview: setCardsightPreview,
          onCardsightDiagnostics: setCardsightDiagnostics,
          onProductionResult: setProductionResult,
          onFeedback: emitScanFeedback,
          lastAcceptedIdentityRef,
          lastAcceptedAtRef,
          lastAcceptedDetectionSignatureRef,
          waitingForCardChangeRef,
        });
        if (productionOutcome.ok) {
          lastSessionLineIdRef.current = productionOutcome.sessionLineId;
          const nextPhase = (scannerPreferences.requireCardChangeBeforeRearm || productionOutcome.needsCardChange) ? 'waiting_for_card_change' : 'ready';
          waitingForCardChangeRef.current = scannerPreferences.requireCardChangeBeforeRearm || productionOutcome.needsCardChange;
          setScanPhase('accepted');
          setProductionFlashVisible(scannerPreferences.visualConfirmation);
          if (productionFlashTimerRef.current) {
            clearTimeout(productionFlashTimerRef.current);
          }
          productionFlashTimerRef.current = setTimeout(() => {
            setProductionFlashVisible(false);
            setScanPhase(nextPhase);
            productionFlashTimerRef.current = null;
          }, scannerPreferences.visualConfirmation ? 700 : 0);
          if (!scannerPreferences.visualConfirmation) {
            setScanPhase(nextPhase);
          }
          return;
        }
        if (productionOutcome.outcome === 'duplicate') {
          setError(null);
          setScanPhase('waiting_for_card_change');
          return;
        }
        setError(productionOutcome.message);
        setScanPhase('ready');
        return;
      }
      const nextReport = await runPrebuiltScannerBakeoff({
        rawImageUri: raw.path,
        croppedImageUri: cropped?.path ?? null,
        rawImageSize: raw.size,
        croppedImageSize: cropped?.size ?? null,
        online: true,
      });
      setReport(nextReport);
      logDiagnostics(nextReport);
      setScanPhase('ready');
      setStage('ready');
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'The scanner could not process the capture.';
      setError(message);
      setScanPhase('error');
      setStage('error');
    } finally {
      captureInFlightRef.current = false;
      scannerRef.current?.unfreezeCamera();
    }
  }, [emitScanFeedback, mode, productionResult?.name, scanPhase, scannerPreferences, session, sessionUserId]);

  if (mode === 'bakeoff' && !diagnosticsEnabled) {
    return (
      <View style={styles.screenGuard}>
        <TDText variant="title">Scanner bakeoff unavailable</TDText>
        <TDText tone="muted">Enable scanner diagnostics to use the native prebuilt scanner route.</TDText>
        <TDButton label="Go back" onPress={() => router.back()} />
      </View>
    );
  }

  if (mode === 'production' && stage === 'error' && error) {
    return (
      <View style={styles.screenGuard}>
        <Ionicons name="warning-outline" size={36} color={color.textMuted} />
        <TDText variant="title">Scanner unavailable</TDText>
        <TDText tone="muted">{error}</TDText>
        <TDButton label="Go back" onPress={() => router.back()} />
      </View>
    );
  }

  if (!permissionGranted) {
    return (
      <View style={styles.screenGuard}>
        <Ionicons name="camera-outline" size={36} color={color.textMuted} />
        <TDText variant="title">Camera permission required</TDText>
        <TDButton label="Grant camera access" onPress={requestCameraPermission} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.cameraStage, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + (isCompactProductionLayout ? space.sm : space.md) }]}>
        <ScanbotDocumentScannerView
          ref={scannerRef}
          style={StyleSheet.absoluteFill}
          acceptedAngleScore={PREBUILT_SCANBOT_ACCEPTED_ANGLE_SCORE}
          acceptedSizeScore={PREBUILT_SCANBOT_ACCEPTED_SIZE_SCORE}
          autoSnappingEnabled={PREBUILT_SCANBOT_AUTO_SNAPPING_ENABLED}
          autoSnappingSensitivity={PREBUILT_SCANBOT_AUTO_SNAPPING_SENSITIVITY}
          autoSnappingDelay={PREBUILT_SCANBOT_AUTO_SNAPPING_DELAY_SECONDS}
          detectDocumentAfterSnap
          touchToFocusEnabled
          finderEnabled
          finderAspectRatio={{ width: 63, height: 88 }}
          polygonEnabled
          cameraModule="BACK"
          cameraPreviewMode="FILL_IN"
          photoQualityPrioritization={PREBUILT_SCANBOT_PHOTO_QUALITY_PRIORITIZATION}
          onFrameDetectionResult={handleFrameDetectionResult}
          onSnappedDocumentResult={handleSnappedDocumentResult}
          onError={(scanbotError) => {
            setError(scanbotError.message);
            setStage('error');
          }}
        />

        <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
          <View style={styles.topTextGroup}>
            <TDText variant="label">Scanner</TDText>
            <View style={styles.topMetaRow}>
              <TDText variant="caption" tone="muted" numberOfLines={1}>{mode === 'production' ? `Session • ${capturedCount}` : 'Camera QA / Scanner Diagnostics'}</TDText>
              {mode === 'production' ? <TDBadge tone="info">Auto</TDBadge> : null}
              {mode === 'production' && sessionTotalMarketValue !== null ? <TDBadge tone="success">${sessionTotalMarketValue.toFixed(2)}</TDBadge> : null}
            </View>
          </View>
          <View style={styles.topActions}>
            {mode === 'production' ? (
              <TDIconButton label="Open scanner settings" iconName="settings-outline" onPress={() => router.push('/settings' as never)} size="sm" />
            ) : null}
            <TDIconButton label="Close scanner" iconName="close-outline" onPress={() => router.back()} size="sm" />
          </View>
        </View>

        {mode === 'production' && !cameraReady ? (
          <View style={[styles.startupOverlay, { top: isCompactProductionLayout ? '42%' : '44%' }]} pointerEvents="none">
            <ActivityIndicator color={color.primaryBright} />
            <TDText variant="small" tone="muted" numberOfLines={1}>Trading Docks Scanner</TDText>
            <TDText variant="caption" tone="info" numberOfLines={1}>Preparing camera...</TDText>
            <TDText variant="caption" tone="muted" numberOfLines={2} style={styles.startupOverlayCopy}>{stageCopy}</TDText>
          </View>
        ) : null}

        {mode === 'production' && cameraReady ? (
          <View
            pointerEvents="none"
            style={[
              styles.cameraLiveStatus,
              productionStageTone === 'success' && styles.cameraLiveStatusSuccess,
              productionStageTone === 'warning' && styles.cameraLiveStatusWarning,
              productionStageTone === 'info' && styles.cameraLiveStatusInfo,
              productionStageTone === 'muted' && styles.cameraLiveStatusMuted,
            ]}
          >
            {productionStageTone === 'success' ? <Ionicons name="checkmark-circle-outline" size={16} color={color.success} /> : null}
            {productionStageTone === 'warning' ? <Ionicons name="alert-circle-outline" size={16} color={color.warning} /> : null}
            {(stage === 'capturing' || stage === 'processing' || (!sdkReady && !cameraReady)) ? <ActivityIndicator size="small" color={color.primaryBright} /> : null}
            <TDText variant="caption" tone="muted" numberOfLines={1} style={styles.cameraLiveHeadline}>{productionStageCopy}</TDText>
          </View>
        ) : null}

        <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + (isCompactProductionLayout ? space.xs : space.sm) }]}>
          {mode === 'production' ? (
            <>
              {productionResult ? (
                <ProductionResultCard
                  result={productionResult}
                  line={productionSessionLine}
                  visible={productionFlashVisible}
                  compact={isCompactProductionLayout}
                  isLarge={isLargeProductionLayout}
                  onOtherPrintings={() => {
                    handleOpenPrintingSelector(productionResult.candidate);
                  }}
                  onUndo={productionResult.sessionLineId ? () => removeProductionSessionLine(productionResult.sessionLineId) : undefined}
                />
              ) : null}
              {scanFeedback && scanFeedback.outcome !== 'success' ? (
                <TDToast
                  message={scanFeedback.message}
                  tone={scanFeedback.outcome === 'error' ? 'danger' : scanFeedback.outcome === 'duplicate' ? 'warning' : 'info'}
                  action={scanFeedback.actionLabel && scanFeedback.onAction ? (
                    <TDButton
                      label={scanFeedback.actionLabel}
                      size="sm"
                      variant="secondary"
                      onPress={scanFeedback.onAction}
                    />
                  ) : null}
                />
              ) : null}
              <TDSessionStrip
                summary={sessionStripSummary}
                actionLabel="Open"
                onPress={() => router.push('/scanner-session' as never)}
                bottomInset={0}
                tone={productionResult?.requiresPrintingReview ? 'warning' : 'info'}
                style={styles.sessionStrip}
              />
              {error ? <TDText variant="caption" tone="danger" style={styles.productionError}>{error}</TDText> : null}
              {showDiagnosticsPanel && captureArtifacts ? (
                  <View style={styles.devDiagnostics}>
                    <View style={styles.previewGrid}>
                      <View style={styles.previewBlock}>
                        <TDText variant="label" tone="muted">Raw Scanbot capture</TDText>
                        <Image source={{ uri: captureArtifacts.raw.path ?? undefined }} style={styles.previewImage} contentFit="cover" />
                        <TDText variant="caption" tone="muted">
                          {captureArtifacts.raw.size.width} × {captureArtifacts.raw.size.height} • {formatBytes(captureArtifacts.raw.bytes)} • {captureArtifacts.raw.mimeType} • {captureArtifacts.raw.orientation}
                        </TDText>
                      </View>
                      <View style={styles.previewBlock}>
                        <TDText variant="label" tone="muted">Normalized Scanbot capture</TDText>
                        {captureArtifacts.cropped?.path ? (
                          <Image source={{ uri: captureArtifacts.cropped.path }} style={styles.previewImage} contentFit="cover" />
                        ) : (
                          <View style={styles.previewPlaceholder}>
                            <TDText variant="caption" tone="muted">Not returned</TDText>
                          </View>
                        )}
                        <TDText variant="caption" tone="muted">
                          {captureArtifacts.cropped ? `${captureArtifacts.cropped.size.width} × ${captureArtifacts.cropped.size.height} • ${formatBytes(captureArtifacts.cropped.bytes)} • ${captureArtifacts.cropped.mimeType} • ${captureArtifacts.cropped.orientation}` : 'not returned'}
                        </TDText>
                      </View>
                    </View>
                    {cardsightDiagnostics?.image ? (
                      <View style={styles.previewBlock}>
                        <TDText variant="label" tone="muted">CardSight image</TDText>
                        <Image source={{ uri: cardsightDiagnostics.image.path ?? undefined }} style={styles.previewImage} contentFit="cover" />
                        <TDText variant="caption" tone="muted">
                          {cardsightDiagnostics.image.source} • {cardsightDiagnostics.image.size.width} × {cardsightDiagnostics.image.size.height} • {formatBytes(cardsightDiagnostics.image.bytes)} • {cardsightDiagnostics.image.mimeType} • {cardsightDiagnostics.image.orientation}
                          {cardsightDiagnostics.image.candidate ? ` • ${cardsightDiagnostics.image.candidate}` : ''}
                        </TDText>
                      </View>
                    ) : null}
                    {cardsightDiagnostics ? (
                      <View style={styles.previewBlock}>
                        <TDText variant="label" tone="muted">CardSight request</TDText>
                        <TDText variant="caption" tone="muted">
                          {cardsightDiagnostics.request
                            ? `auth=${cardsightDiagnostics.request.authenticated ? 'true' : 'false'} • source=${cardsightDiagnostics.request.imageSource} • ${cardsightDiagnostics.request.width ?? 0} × ${cardsightDiagnostics.request.height ?? 0} • ${formatBytes(cardsightDiagnostics.request.bytes ?? 0)} • ${cardsightDiagnostics.request.mimeType} • status=${cardsightDiagnostics.request.httpStatus ?? 'n/a'} • ${cardsightDiagnostics.request.latencyMs ?? 'n/a'} ms`
                            : 'no request trace'}
                        </TDText>
                        <TDText variant="label" tone="muted">CardSight result</TDText>
                        <TDText variant="caption" tone="muted">
                          {cardsightDiagnostics.result
                            ? `${cardsightDiagnostics.result.candidateCount} candidates • ${cardsightDiagnostics.result.topCandidateName ?? 'none'}${cardsightDiagnostics.result.topCandidateSet ? ` • ${cardsightDiagnostics.result.topCandidateSet}` : ''}${cardsightDiagnostics.result.topCandidateCollectorNumber ? ` • ${cardsightDiagnostics.result.topCandidateCollectorNumber}` : ''} • conf ${formatConfidence(cardsightDiagnostics.result.topCandidateConfidence)} • raw ${formatConfidence(cardsightDiagnostics.result.rawProviderConfidence)} • ${cardsightDiagnostics.result.parsingSucceeded ? 'parsed' : 'unparsed'}`
                            : 'no result trace'}
                        </TDText>
                        <TDText variant="label" tone="muted">Card Intelligence</TDText>
                        <TDText variant="caption" tone="muted">
                          {cardsightDiagnostics.intelligence
                            ? `${cardsightDiagnostics.intelligence.accepted ? 'accepted' : 'rejected'}${cardsightDiagnostics.intelligence.name ? ` • ${cardsightDiagnostics.intelligence.name}` : ''}${cardsightDiagnostics.intelligence.setCode ? ` • ${cardsightDiagnostics.intelligence.setCode}` : ''}${cardsightDiagnostics.intelligence.collectorNumber ? ` • ${cardsightDiagnostics.intelligence.collectorNumber}` : ''}${cardsightDiagnostics.intelligence.requiresConfirmation ? ' • needs review' : ''}${cardsightDiagnostics.intelligence.rejectionReason ? ` • ${cardsightDiagnostics.intelligence.rejectionReason}` : ''}`
                            : 'no intelligence trace'}
                        </TDText>
                      </View>
                    ) : null}
                    <View style={styles.row}>
                      <TDButton
                        label="Test current image with CardSight"
                        variant="secondary"
                        onPress={() => {
                          void testCurrentCardSightImage();
                        }}
                        disabled={!cardsightPreview?.path && !captureArtifacts?.raw.path}
                      />
                    </View>
                    {cardsightProbe ? (
                      <View style={styles.previewBlock}>
                        <TDText variant="label" tone="muted">Probe result</TDText>
                        <TDText variant="caption" tone="muted">
                          {cardsightProbe.request
                            ? `HTTP ${cardsightProbe.request.httpStatus ?? 'n/a'} • ${cardsightProbe.intelligence?.name ?? cardsightProbe.result?.topCandidateName ?? 'no candidate'} • conf ${formatConfidence(cardsightProbe.intelligence?.confidence ?? cardsightProbe.result?.topCandidateConfidence ?? null)} • ${cardsightProbe.request.latencyMs ?? 'n/a'} ms`
                            : 'no probe result'}
                        </TDText>
                      </View>
                    ) : null}
                  </View>
              ) : null}
            </>
          ) : (
              <>
                <TDText variant="label" tone="muted">Scanner status</TDText>
                <TDText variant="small">Stage: {stage}</TDText>
                <TDText variant="caption" tone="muted">Scanbot SDK: {sdkLicenseLabel}</TDText>
                {detection ? <TDText variant="caption" tone="muted">Card detected</TDText> : null}
                {error ? <TDText variant="caption" tone="danger">{error}</TDText> : null}
                <View style={styles.row}>
                  <TDButton label="Retake" variant="secondary" onPress={() => {
                    setReport(null);
                    setError(null);
                    setStage('ready');
                    scannerRef.current?.unfreezeCamera();
                  }} />
                  <TDButton label="Capture now" onPress={() => scannerRef.current?.snapDocument(true)} />
                </View>
              </>
            )}
          {mode === 'bakeoff' && report ? (
            <View style={styles.results}>
              <ResultCard title="Local pipeline" summary={report.summary.local} />
              <ResultCard title="CardSight" summary={report.summary.cardsight} />
              <ResultCard title="TCGTracking" summary={report.summary.tcgtracking} />
            </View>
          ) : null}
        </View>
        <PrintingSelectorSheet
          visible={printingSelectorOpen}
          currentCandidate={printingSelectorCandidate}
          currentFinish={(productionSessionLine?.finish ?? productionResult?.finish ?? 'nonfoil') as never}
          onClose={() => {
            setPrintingSelectorOpen(false);
            setPrintingSelectorCandidate(null);
          }}
          onSelect={(candidate, finish, fallbackMessage) => {
            if (!session || !productionResult?.sessionLineId) return;
            const result = updateScannerSessionLinePrinting(session, productionResult.sessionLineId, candidate);
            const selectedPrice = selectScryfallScannerPrice(candidate, finish);
            setSession(result.session);
            setProductionResult((current) => current ? {
              ...current,
              cardSightId: stringId(candidate.providerIds?.cardsight) ?? current.cardSightId,
              printingId: candidate.id,
              imageUrl: candidate.imageUrl ?? current.imageUrl,
              setName: candidate.setName ?? current.setName,
              setCode: candidate.setCode ?? current.setCode,
              collectorNumber: candidate.collectorNumber ?? current.collectorNumber,
              language: candidate.language ?? current.language,
              finish,
              availableFinishes: candidate.finishes,
              marketPrice: selectedPrice,
              priceSource: selectedPrice === null ? current.priceSource : 'scryfall',
              oracleIdVerified: Boolean(candidate.identityAuthority === 'provider_confirmed' && candidate.oracleId),
              exactPrintingResolved: true,
              requiresPrintingReview: false,
              candidate,
            } : current);
            setSuccess(fallbackMessage ? `✓ ${candidate.name}\n${fallbackMessage}` : `✓ ${candidate.name}\n${candidate.setCode ?? 'Set'} • ${candidate.collectorNumber ?? '?'}`);
            setPrintingSelectorOpen(false);
            setPrintingSelectorCandidate(null);
          }}
        />
      </View>
    </View>
  );
}

function ResultCard({ title, summary }: { title: string; summary: PrebuiltScannerBakeoffReport['summary']['local'] }) {
  return (
    <TDCard style={styles.resultCard}>
      <TDText variant="label" tone="muted">{title}</TDText>
      <TDText variant="small">Raw: {summary.raw.topCandidate ?? 'no candidate'} ({summary.raw.status})</TDText>
      <TDText variant="small">Crop: {summary.cropped.topCandidate ?? 'no candidate'} ({summary.cropped.status})</TDText>
      <TDText variant="caption" tone="muted">Winner: {summary.winner ?? 'none'} | Conf: {formatConfidence(summary.raw.confidence)} / {formatConfidence(summary.cropped.confidence)}</TDText>
    </TDCard>
  );
}

function ProductionResultCard({
  result,
  line,
  visible,
  compact,
  isLarge,
  onOtherPrintings,
  onUndo,
}: {
  result: ProductionScanResult;
  line: ScannerSessionLine | null;
  visible: boolean;
  compact: boolean;
  isLarge: boolean;
  onOtherPrintings: () => void;
  onUndo?: () => void;
}) {
  const finishLabel = displayFinish((line?.finish ?? result.finish ?? 'nonfoil') as never);
  const conditionLabel = displayCondition((line?.condition ?? result.condition ?? 'near_mint') as never);
  const destinationLabel = line?.destination ? scannerDestinationLabel(line.destination) : result.destination ?? 'Session';
  const marketLabel = result.exactPrintingResolved && result.marketPrice !== null ? `$${result.marketPrice.toFixed(2)}` : null;
  if (!visible && !result.requiresPrintingReview) return null;
  if (!visible && result.requiresPrintingReview) {
    return (
      <TDCard style={[styles.reviewReminder, compact && styles.reviewReminderCompact]}>
        <View style={styles.reviewReminderCopy}>
          <TDText variant="small" numberOfLines={1}>{result.name}</TDText>
          <TDText variant="caption" tone="warning" numberOfLines={1}>{result.oracleIdVerified ? 'Printing needs confirmation' : 'Resolving printing information...'}</TDText>
        </View>
        <TDButton label={result.oracleIdVerified ? 'Other printings' : 'Resolving...'} variant="secondary" size="sm" onPress={onOtherPrintings} disabled={!result.oracleIdVerified} />
      </TDCard>
    );
  }
  return (
    <TDCard style={[styles.productionResultCard, compact && styles.productionResultCardCompact]}>
      <View style={[styles.productionResultHeader, compact && styles.productionResultHeaderCompact]}>
        {result.imageUrl ? (
          <Image
            source={{ uri: result.imageUrl }}
            style={[
              styles.productionResultImage,
              compact && styles.productionResultImageCompact,
              isLarge && styles.productionResultImageLarge,
            ]}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.productionResultImageMissing, compact && styles.productionResultImageCompact, isLarge && styles.productionResultImageLarge]}>
            <Ionicons name="image-outline" size={22} color={color.textMuted} />
          </View>
        )}
        <View style={styles.productionResultCopy}>
          <TDText variant={compact ? 'small' : 'body'} numberOfLines={1} style={styles.productionResultName}>{result.name}</TDText>
          <TDText variant="caption" tone="muted" numberOfLines={1}>{`${result.setCode ?? 'SET'} • ${result.collectorNumber ?? '?'}`}</TDText>
          {result.setName ? <TDText variant="caption" tone="muted" numberOfLines={1}>{result.setName}</TDText> : null}
          <TDText variant="caption" tone="muted" numberOfLines={1}>{`${conditionLabel} • ${finishLabel}${destinationLabel ? ` • ${destinationLabel}` : ''}`}</TDText>
          <View style={styles.productionPriceRow}>
            {result.exactPrintingResolved ? (
              marketLabel ? (
                <TDText variant="label" style={styles.productionPriceText}>{`Market ${marketLabel}`}</TDText>
              ) : (
                <View style={styles.productionPriceLoading}>
                  <TDSkeleton lines={1} style={styles.productionPriceSkeleton} />
                </View>
              )
            ) : (
              <TDText variant="caption" tone="muted" numberOfLines={1}>Price after printing confirmation</TDText>
            )}
          </View>
          <TDText variant="caption" tone={result.exactPrintingResolved ? 'success' : 'warning'} numberOfLines={1}>
            {result.exactPrintingResolved ? '✓ Added to session' : result.oracleIdVerified ? 'Printing needs confirmation' : 'Resolving printing information...'}
          </TDText>
        </View>
      </View>
      {result.requiresPrintingReview ? (
        <View style={styles.productionResultFooter}>
          <View style={styles.productionResultActions}>
            {onUndo ? <TDButton label="Undo" variant="secondary" size="sm" onPress={onUndo} /> : null}
            <TDButton label={result.oracleIdVerified ? 'Other printings' : 'Resolving...'} variant="secondary" size="sm" onPress={onOtherPrintings} disabled={!result.oracleIdVerified} />
          </View>
        </View>
      ) : onUndo ? (
        <View style={styles.productionResultFooter}>
          <TDButton label="Undo" variant="secondary" size="sm" onPress={onUndo} />
        </View>
      ) : null}
    </TDCard>
  );
}

async function ensureScanbotSdkInitialized() {
  if (!scanbotInitPromise) {
    scanbotInitPromise = (async () => {
      try {
        await ScanbotSDK.initialize(new SdkConfiguration({ licenseKey: SCANBOT_LICENSE_KEY, loggingEnabled: __DEV__ }));
        return { ok: true as const, licenseLabel: SCANBOT_LICENSE_KEY ? 'configured' as const : 'trial' as const, error: null };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Scanbot SDK initialization failed.';
        return { ok: false as const, licenseLabel: 'missing' as const, error: message };
      }
    })();
  }
  return scanbotInitPromise;
}

async function persistImageRef(imageRef: ScanbotImageRef, prefix: string) {
  const info = await imageRef.info();
  const size = info ? { width: info.width, height: info.height } : { width: 0, height: 0 };
  const mimeType: 'image/jpeg' = 'image/jpeg';
  const orientation: 'portrait' | 'landscape' = size.width >= size.height ? 'landscape' : 'portrait';
  const directory = Paths.cache ?? Paths.document;
  if (!directory) return { path: null, size, bytes: 0, mimeType, orientation };
  const file = new File(directory, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
  const saved = await imageRef.saveImage(file.uri);
  if (!saved) return { path: null, size, bytes: 0, mimeType, orientation };
  const savedInfo = file.info();
  return { path: file.uri, size, bytes: typeof savedInfo.size === 'number' ? savedInfo.size : 0, mimeType, orientation };
}

function formatConfidence(value: number | null) {
  return value === null ? 'n/a' : value.toFixed(2);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function logDiagnostics(report: PrebuiltScannerBakeoffReport) {
  if (!__DEV__) return;
  console.info('TD_SCANNER_BAKEOFF', {
    engine: 'scanbot',
    stage: 'bakeoff',
    cardsightEnabled: true,
    cardsightCandidate: report.summary.cardsight.raw.topCandidate ?? report.summary.cardsight.cropped.topCandidate ?? null,
    cardsightLatencyMs: report.summary.cardsight.raw.latencyMs ?? report.summary.cardsight.cropped.latencyMs ?? null,
  });
}

function logPrebuiltScannerDiagnostics(event: PrebuiltScannerDiagnosticsEvent) {
  if (!__DEV__) return;
  console.info('TD_PREBUILT_SCANNER', {
    scanbotDetected: event.scanbotDetected ?? null,
    scanbotCaptured: event.scanbotCaptured ?? null,
    cardsightRequest: event.cardsightRequest ?? null,
    cardsightResult: event.cardsightResult ?? null,
    cardIntelligenceResult: event.cardIntelligenceResult ?? null,
    sessionAppend: event.sessionAppend ?? null,
  });
}

function buildCardsightPreviewArtifact(input: {
  attempt: CardSightMobileScanResult | null;
  rawImageUri: string;
  croppedImageUri: string | null;
  rawImageSize: { width: number; height: number };
  croppedImageSize: { width: number; height: number } | null;
  rawImageBytes: number;
  croppedImageBytes: number | null;
  candidateName: string | null;
}): CardsightPreviewArtifact | null {
  if (!input.attempt) return null;
  const source = input.attempt.mode;
  const size = source === 'raw'
    ? input.rawImageSize
    : input.croppedImageSize ?? input.rawImageSize;
  const bytes = source === 'raw'
    ? input.rawImageBytes
    : input.croppedImageBytes ?? input.rawImageBytes;
  return {
    path: source === 'raw' ? input.rawImageUri : input.croppedImageUri ?? input.rawImageUri,
    size,
    bytes,
    mimeType: 'image/jpeg',
    orientation: size.width >= size.height ? 'landscape' : 'portrait',
    source,
    candidate: input.candidateName,
  };
}

function cardsightTraceSummary(trace: CardSightAttemptTrace | null): CardsightTraceSummary | null {
  if (!trace) return null;
  return {
    authenticated: trace.authenticated,
    imageSource: trace.imageSource,
    width: trace.imageWidth,
    height: trace.imageHeight,
    bytes: trace.imageBytes,
    mimeType: trace.mimeType,
    requestStarted: trace.requestStarted,
    httpStatus: trace.httpStatus,
    latencyMs: trace.latencyMs,
  };
}

function cardsightResultSummary(trace: CardSightAttemptTrace | null): CardsightResultSummary | null {
  if (!trace) return null;
  return {
    httpStatus: trace.httpStatus,
    latencyMs: trace.latencyMs,
    candidateCount: trace.candidateCount,
    topCandidateName: trace.topCandidateName,
    topCandidateSet: trace.topCandidateSet,
    topCandidateCollectorNumber: trace.topCandidateCollectorNumber,
    topCandidateConfidence: trace.topCandidateConfidence,
    rawProviderConfidence: trace.rawProviderConfidence,
    parsingSucceeded: trace.parsingSucceeded,
  };
}

function selectCardsightTrace(attempt: CardSightMobileScanResult | null): CardSightAttemptTrace | null {
  if (!attempt?.traces?.length) return null;
  return attempt.traces.find((trace) => trace.mode === attempt.mode) ?? attempt.traces[attempt.traces.length - 1] ?? null;
}

function buildCardsightDiagnosticsSnapshot(input: {
  image: CardsightPreviewArtifact | null;
  attempt: CardSightMobileScanResult | null;
  intelligence: CardIntelligenceSummary | null;
}): CardsightDiagnosticsSnapshot {
  const trace = selectCardsightTrace(input.attempt);
  return {
    image: input.image,
    request: cardsightTraceSummary(trace),
    result: cardsightResultSummary(trace),
    intelligence: input.intelligence,
  };
}

function chooseBetterAttempt(raw: CardSightMobileScanResult, cropped: CardSightMobileScanResult) {
  const rawScore = raw.ok && raw.candidates.length ? (raw.topConfidence ?? raw.candidates[0]?.confidence ?? 0) : 0;
  const croppedScore = cropped.ok && cropped.candidates.length ? (cropped.topConfidence ?? cropped.candidates[0]?.confidence ?? 0) : 0;
  if (croppedScore > rawScore + 0.02) return cropped;
  return rawScore >= croppedScore ? raw : cropped;
}

function logCardIntelligenceResult(input: CardIntelligenceSummary) {
  if (!__DEV__) return;
  console.info('TD_CARD_INTELLIGENCE_RESULT', input);
}

function logPrintingIdentity(input: {
  cardName: string;
  cardSightId: string | null;
  canonicalCardId: string | null;
  oracleId: string | null;
  printingId: string | null;
  scryfallId: string | null;
}) {
  if (!__DEV__) return;
  console.info('TD_PRINTING_IDENTITY', input);
}

async function runProductionScannerCapture(input: {
  rawImageUri: string;
  croppedImageUri: string | null;
  rawImageSize: { width: number; height: number };
  croppedImageSize: { width: number; height: number } | null;
  rawImageBytes: number;
  croppedImageBytes: number | null;
  session: ContinuousScannerSession | null;
  sessionUserId: string | null;
  onSessionUpdate: (session: ContinuousScannerSession) => void;
  onCapturedCountChange: (count: number) => void;
  onSuccess: (message: string | null) => void;
  onPrebuiltDiagnostics: (event: PrebuiltScannerDiagnosticsEvent) => void;
  onCardsightPreview: (preview: CardsightPreviewArtifact | null) => void;
  onCardsightDiagnostics: (snapshot: CardsightDiagnosticsSnapshot | null) => void;
  onProductionResult: (result: ProductionScanResult | null) => void;
  onFeedback: (feedback: ProductionScanFeedback) => void;
  preferences: ScannerFeedbackPreferences;
  currentDetectionSignature: string | null;
  lastAcceptedIdentityRef: MutableRefObject<string | null>;
  lastAcceptedAtRef: MutableRefObject<number>;
  lastAcceptedDetectionSignatureRef: MutableRefObject<string | null>;
  waitingForCardChangeRef: MutableRefObject<boolean>;
}): Promise<{ ok: true; sessionLineId: string | null; needsCardChange: boolean } | { ok: false; message: string; outcome?: 'duplicate' | 'error' }> {
  const startedAt = Date.now();
  if (!input.session || !input.sessionUserId) {
    return { ok: false, message: 'Scanner session is still preparing.', outcome: 'error' };
  }
  if (!isCardSightScannerEnabled()) {
    return { ok: false, message: 'CardSight is unavailable in this build.', outcome: 'error' };
  }
  const isDuplicatePresentation = Boolean(
    input.preferences.blockDuplicateScans
    && input.currentDetectionSignature
    && input.lastAcceptedDetectionSignatureRef.current === input.currentDetectionSignature
    && Date.now() - input.lastAcceptedAtRef.current < 1200,
  );
  if (isDuplicatePresentation) {
    input.onFeedback({
      outcome: 'duplicate',
      message: 'Duplicate skipped',
      cardName: null,
      audioEventKey: null,
    });
    return { ok: false, message: 'Duplicate skipped', outcome: 'duplicate' };
  }
  input.onPrebuiltDiagnostics({
    cardsightRequest: 'started',
  });
  if (__DEV__) {
    console.info('TD_SCANNER_PROVIDER', {
      scanbotDetected: 'frame-detected',
      scanbotCaptured: 'captured',
      cardsightRequest: 'started',
    });
  }
  const [rawCardsight, croppedCardsight] = await Promise.all([
    scanCardSightWithFallback({
      imageUri: input.rawImageUri,
      mapping: fullImageMapping(input.rawImageSize),
      online: true,
      allowUnconfirmedCandidate: true,
    }),
    scanCardSightWithFallback({
      imageUri: input.croppedImageUri ?? input.rawImageUri,
      mapping: fullImageMapping(input.croppedImageSize ?? input.rawImageSize),
      online: true,
      allowUnconfirmedCandidate: true,
    }),
  ]);
  const chosenAttempt = chooseBetterAttempt(rawCardsight, croppedCardsight);
  const chosenTrace = selectCardsightTrace(chosenAttempt);
  const selection = chooseProductionCandidate(rawCardsight, croppedCardsight, {
    rawImageUri: input.rawImageUri,
    croppedImageUri: input.croppedImageUri,
    rawImageSize: input.rawImageSize,
    croppedImageSize: input.croppedImageSize,
    rawImageBytes: input.rawImageBytes,
    croppedImageBytes: input.croppedImageBytes,
  });
  const selectedImage = buildCardsightPreviewArtifact({
    attempt: chosenAttempt,
    rawImageUri: input.rawImageUri,
    croppedImageUri: input.croppedImageUri,
    rawImageSize: input.rawImageSize,
    croppedImageSize: input.croppedImageSize,
    rawImageBytes: input.rawImageBytes,
    croppedImageBytes: input.croppedImageBytes,
    candidateName: selection?.candidate.name ?? (chosenAttempt && chosenAttempt.ok ? chosenAttempt.candidates[0]?.name ?? null : null) ?? chosenTrace?.topCandidateName ?? null,
  });
  input.onCardsightPreview(selectedImage);
  if (selection) {
    logPrintingIdentity({
      cardName: selection.candidate.name,
      cardSightId: stringId(selection.candidate.providerIds?.cardsight),
      canonicalCardId: selection.candidate.oracleId ?? null,
      oracleId: selection.candidate.oracleId ?? null,
      printingId: selection.candidate.id ?? null,
      scryfallId: stringId(selection.candidate.providerIds?.scryfall),
    });
  }
  const intelligenceSummary: CardIntelligenceSummary = selection
    ? {
      canonicalCardId: selection.candidate.oracleId ?? null,
      printingId: selection.candidate.id ?? null,
      name: selection.candidate.name ?? null,
      setCode: selection.candidate.setCode ?? null,
      collectorNumber: selection.candidate.collectorNumber ?? null,
      confidence: selection.candidate.confidence ?? selection.topConfidence ?? null,
      requiresConfirmation: selection.requiresConfirmation,
      accepted: true,
      rejectionReason: null,
    }
    : {
      canonicalCardId: null,
      printingId: null,
      name: null,
      setCode: null,
      collectorNumber: null,
      confidence: chosenAttempt && chosenAttempt.ok ? chosenAttempt.topConfidence ?? null : null,
      requiresConfirmation: false,
      accepted: false,
      rejectionReason: chosenTrace?.error ?? 'CardSight did not resolve a confident card identity.',
    };
  input.onCardsightDiagnostics(buildCardsightDiagnosticsSnapshot({
    image: selectedImage,
    attempt: chosenAttempt,
    intelligence: intelligenceSummary,
  }));
  input.onPrebuiltDiagnostics({
    cardsightResult: chosenTrace?.parsingSucceeded ? 'candidates' : 'retry',
  });
  let priceLatencyMs: number | null = null;
  if (!selection) {
    input.onPrebuiltDiagnostics({ cardIntelligenceResult: 'retry' });
    logCardIntelligenceResult(intelligenceSummary);
    logScannerEnrichmentTrace({
      canonicalCardResolved: false,
      exactPrintingResolved: false,
      scryfallId: null,
      imageResolved: Boolean(selectedImage?.path),
      priceResolved: false,
      marketPrice: null,
      pricingLatencyMs: priceLatencyMs,
      totalEnrichmentMs: Date.now() - startedAt,
    });
    if (__DEV__) {
      console.info('TD_SCANNER_PROVIDER', {
        scanbotDetected: 'frame-detected',
        scanbotCaptured: 'captured',
        cardsightRequest: 'completed',
        cardsightResult: chosenTrace?.parsingSucceeded ? 'candidates' : 'retry',
        cardIntelligenceResult: 'retry',
        sessionAppend: null,
      });
    }
    input.onFeedback({
      outcome: 'error',
      message: 'Couldn’t identify card. Try again.',
      cardName: null,
      audioEventKey: null,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    return { ok: false, message: 'Couldn’t identify card. Try again.', outcome: 'error' };
  }

  logCardIntelligenceResult(intelligenceSummary);

  const confidence = Math.max(0, Math.min(100, Math.round((selection.candidate.confidence ?? selection.topConfidence ?? 0.82) * 100)));
  const recognition = createRecognitionPipelineReport({
    detectedGame: 'magic',
    candidates: [selection.candidate],
    confidence: {
      overall: confidence,
      threshold: 82,
      requiresConfirmation: selection.requiresConfirmation,
      signals: [],
      conflicts: [],
    },
    recognitionMethod: selection.recognitionMethod,
  });

  const stableScanId = `prebuilt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fingerprint = fingerprintProductionCandidate(selection.candidate);
  const exactPrintingResolved = !selection.requiresConfirmation;
  const finish = selection.candidate.finishes[0] ?? 'nonfoil';
  let marketPrice: number | null = null;
  let priceSource: string | null = null;
  if (input.lastAcceptedIdentityRef.current === fingerprint && Date.now() - input.lastAcceptedAtRef.current < 1200) {
    if (exactPrintingResolved) {
      const previewPrice = selectScryfallScannerPrice(selection.candidate, finish);
      marketPrice = previewPrice;
      priceSource = previewPrice === null ? 'unavailable' : 'scryfall';
    }
    const successMessage = exactPrintingResolved
      ? `✓ ${selection.candidate.name}\n${selection.candidate.setCode ?? 'Set'} • ${selection.candidate.collectorNumber ?? '?'}${marketPrice !== null ? `\n$${marketPrice.toFixed(2)}` : ''}`
      : `✓ ${selection.candidate.name}\nPrinting needs confirmation`;
    input.onSuccess(successMessage);
    input.onFeedback({
      outcome: exactPrintingResolved ? 'success' : 'review',
      message: successMessage,
      cardName: selection.candidate.name,
      audioEventKey: null,
    });
    input.onProductionResult({
      name: selection.candidate.name,
      cardSightId: stringId(selection.candidate.providerIds?.cardsight),
      canonicalCardId: selection.candidate.oracleId ?? null,
      printingId: selection.candidate.id,
      imageUrl: selection.candidate.imageUrl ?? null,
      setName: selection.candidate.setName ?? null,
      setCode: selection.candidate.setCode ?? null,
      collectorNumber: selection.candidate.collectorNumber ?? null,
      rarity: null,
      language: selection.candidate.language ?? null,
      finish: selection.candidate.finishes[0] ?? null,
      availableFinishes: selection.candidate.finishes,
      condition: 'near_mint',
      quantity: 1,
      destination: scannerDestinationLabel(input.session.defaultDestination),
      marketPrice: exactPrintingResolved ? marketPrice : null,
      priceSource: exactPrintingResolved ? priceSource : null,
      confidence: selection.candidate.confidence ?? selection.topConfidence ?? null,
      oracleIdVerified: Boolean(selection.candidate.identityAuthority === 'provider_confirmed' && selection.candidate.oracleId),
      exactPrintingResolved,
      requiresPrintingReview: selection.requiresConfirmation,
      candidate: selection.candidate,
      sessionLineId: null,
    });
    logScannerEnrichmentTrace({
      canonicalCardResolved: true,
      exactPrintingResolved,
      scryfallId: selection.candidate.id,
      imageResolved: Boolean(selection.candidate.imageUrl),
      priceResolved: exactPrintingResolved && marketPrice !== null,
      marketPrice: exactPrintingResolved ? marketPrice : null,
      pricingLatencyMs: priceLatencyMs,
      totalEnrichmentMs: Date.now() - startedAt,
    });
    void Haptics.notificationAsync(selection.requiresConfirmation ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      input.onSuccess(null);
    }, 650);
    return { ok: true, sessionLineId: null, needsCardChange: input.preferences.requireCardChangeBeforeRearm || selection.requiresConfirmation };
  }
  const nextSession = addRecognitionToSession(input.session, {
    stableScanId,
    candidate: selection.candidate,
    recognition,
    destination: input.session.defaultDestination,
    createdAt: new Date().toISOString(),
  }) as ContinuousScannerSession;
  const lineId = nextSession.lines[nextSession.lines.length - 1]?.id ?? null;
  let sessionAfterPrice: ContinuousScannerSession = nextSession;
  if (lineId && exactPrintingResolved) {
    const priceResult = enrichScannerSessionLinePrice({
      session: nextSession,
      lineId,
      stableScanId,
      candidate: selection.candidate,
      finish,
    });
    sessionAfterPrice = priceResult.session;
    marketPrice = priceResult.price;
    priceSource = priceResult.source;
    priceLatencyMs = priceResult.trace.pricingLatencyMs;
  }

  await appStorage.setItem(continuousScannerSessionKey(input.sessionUserId), JSON.stringify(sessionAfterPrice));
  input.onSessionUpdate(sessionAfterPrice);
  input.onCapturedCountChange(sessionAfterPrice.lines.length);
  input.lastAcceptedIdentityRef.current = fingerprint;
  input.lastAcceptedAtRef.current = Date.now();
  const successMessage = exactPrintingResolved
    ? `✓ ${selection.candidate.name}\n${selection.candidate.setCode ?? 'Set'} • ${selection.candidate.collectorNumber ?? '?'}${marketPrice !== null ? `\n$${marketPrice.toFixed(2)}` : ''}`
    : `✓ ${selection.candidate.name}\nPrinting needs confirmation`;
  input.onSuccess(successMessage);
  input.onFeedback({
    outcome: exactPrintingResolved ? 'success' : 'review',
    message: successMessage,
    cardName: selection.candidate.name,
    audioEventKey: lineId,
  });
  input.onPrebuiltDiagnostics({
    cardIntelligenceResult: selection.requiresConfirmation ? 'needs_review' : 'exact',
    sessionAppend: 'added',
  });
  input.onProductionResult({
    name: selection.candidate.name,
    cardSightId: stringId(selection.candidate.providerIds?.cardsight),
    canonicalCardId: selection.candidate.oracleId ?? null,
    printingId: selection.candidate.id,
    imageUrl: selection.candidate.imageUrl ?? null,
    setName: selection.candidate.setName ?? null,
    setCode: selection.candidate.setCode ?? null,
    collectorNumber: selection.candidate.collectorNumber ?? null,
    rarity: null,
    language: selection.candidate.language ?? null,
    finish,
    availableFinishes: selection.candidate.finishes,
    condition: 'near_mint',
    quantity: 1,
    destination: scannerDestinationLabel(input.session.defaultDestination),
    marketPrice: exactPrintingResolved ? marketPrice : null,
    priceSource: exactPrintingResolved ? priceSource : null,
    confidence: selection.candidate.confidence ?? selection.topConfidence ?? null,
    oracleIdVerified: Boolean(selection.candidate.identityAuthority === 'provider_confirmed' && selection.candidate.oracleId),
    exactPrintingResolved,
    requiresPrintingReview: selection.requiresConfirmation,
    candidate: selection.candidate,
    sessionLineId: lineId,
  });
  logScannerEnrichmentTrace({
    canonicalCardResolved: true,
    exactPrintingResolved,
    scryfallId: selection.candidate.id,
    imageResolved: Boolean(selection.candidate.imageUrl),
    priceResolved: exactPrintingResolved && marketPrice !== null,
    marketPrice: exactPrintingResolved ? marketPrice : null,
    pricingLatencyMs: priceLatencyMs,
    totalEnrichmentMs: Date.now() - startedAt,
  });
  void Haptics.notificationAsync(selection.requiresConfirmation ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
  setTimeout(() => {
    input.onSuccess(null);
  }, 650);
  if (__DEV__) {
    console.info('TD_SCANNER_PROVIDER', {
      scanbotDetected: 'frame-detected',
      scanbotCaptured: 'captured',
      cardsightRequest: 'completed',
      cardsightResult: chosenTrace?.parsingSucceeded ? 'candidates' : 'retry',
      cardIntelligenceResult: selection.requiresConfirmation ? 'needs_review' : 'exact',
      sessionAppend: 'added',
    });
  }
  return { ok: true, sessionLineId: lineId, needsCardChange: input.preferences.requireCardChangeBeforeRearm || selection.requiresConfirmation };
}

function logScannerEnrichmentTrace(input: {
  canonicalCardResolved: boolean;
  exactPrintingResolved: boolean;
  scryfallId: string | null;
  imageResolved: boolean;
  priceResolved: boolean;
  marketPrice: number | null;
  pricingLatencyMs: number | null;
  totalEnrichmentMs: number;
}) {
  if (!__DEV__) return;
  console.info('TD_SCAN_ENRICHMENT', input);
}

function stringId(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function detectionSignature(result: DocumentDetectionResult) {
  const status = result.status ?? 'UNKNOWN';
  const aspect = typeof result.aspectRatio === 'number' ? result.aspectRatio.toFixed(2) : 'na';
  const brightness = typeof result.averageBrightness === 'number' ? result.averageBrightness.toFixed(2) : 'na';
  const score = typeof result.detectionScores?.totalScore === 'number' ? result.detectionScores.totalScore.toFixed(2) : 'na';
  const points = result.pointsNormalized?.map((point) => `${Math.round(point.x)}:${Math.round(point.y)}`).join('|') ?? '';
  return [status, aspect, brightness, score, points].join('::');
}

function chooseProductionCandidate(rawCardsight: CardSightMobileScanResult, croppedCardsight: CardSightMobileScanResult, images: {
  rawImageUri: string;
  croppedImageUri: string | null;
  rawImageSize: { width: number; height: number };
  croppedImageSize: { width: number; height: number } | null;
  rawImageBytes: number;
  croppedImageBytes: number | null;
}): null | {
  candidate: ScannerCardCandidate;
  recognitionMethod: 'metadata_assisted' | 'manual_search' | 'future_visual_provider' | 'unavailable';
  requiresConfirmation: boolean;
  topConfidence: number | null;
  provider: 'cardsight';
  cardsightPreview: CardsightPreviewArtifact | null;
} {
  if (!isCardSightScannerEnabled()) {
    return null;
  }
  const cardsight = bestProviderAttempt(rawCardsight, croppedCardsight);
  if (!cardsight || !cardsight.ok || !cardsight.candidates.length) {
    return null;
  }
  {
    const verifiedCandidate = cardsight.candidates.find((candidate) => candidate.identityAuthority === 'provider_confirmed' && Boolean(candidate.oracleId)) ?? null;
    const selectedCandidate = verifiedCandidate ?? cardsight.candidates[0];
    const selectedSource = cardsight === rawCardsight ? 'raw' : 'cropped';
    const preview: CardsightPreviewArtifact | null = {
      path: selectedSource === 'raw' ? images.rawImageUri : images.croppedImageUri ?? images.rawImageUri,
      size: selectedSource === 'raw'
        ? images.rawImageSize
        : images.croppedImageSize ?? images.rawImageSize,
      bytes: selectedSource === 'raw'
        ? images.rawImageBytes
        : images.croppedImageBytes ?? images.rawImageBytes,
      mimeType: 'image/jpeg',
      orientation: (selectedSource === 'raw' ? images.rawImageSize : images.croppedImageSize ?? images.rawImageSize).width >= (selectedSource === 'raw' ? images.rawImageSize : images.croppedImageSize ?? images.rawImageSize).height ? 'landscape' : 'portrait',
      source: selectedSource,
      candidate: selectedCandidate?.name ?? null,
    };
    return {
      candidate: selectedCandidate,
      recognitionMethod: 'metadata_assisted',
      requiresConfirmation: cardsight.fallbackRecommended || !selectedCandidate.oracleId || selectedCandidate.identityAuthority !== 'provider_confirmed',
      topConfidence: cardsight.ok ? cardsight.topConfidence : null,
      provider: 'cardsight',
      cardsightPreview: preview,
    };
  }
}

function fullImageMapping(size: { width: number; height: number }) {
  return {
    cardCropPixels: { x: 0, y: 0, width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) },
  } as GuideCropMapping;
}

function bestProviderAttempt<T extends { ok: boolean; candidates?: ScannerCardCandidate[]; topConfidence?: number | null; fallbackRecommended?: boolean; status?: string; reason?: string; latencyMs?: number | null }>(raw: T, cropped: T) {
  const rawScore = raw.ok && raw.candidates?.length ? (raw.topConfidence ?? raw.candidates[0]?.confidence ?? null) : null;
  const croppedScore = cropped.ok && cropped.candidates?.length ? (cropped.topConfidence ?? cropped.candidates[0]?.confidence ?? null) : null;
  if (rawScore === null && croppedScore === null) return raw.ok ? raw : cropped.ok ? cropped : null;
  if (croppedScore !== null && (rawScore === null || croppedScore > rawScore + 0.02)) return cropped;
  return raw;
}

function fingerprintProductionCandidate(candidate: ScannerCardCandidate) {
  return [candidate.id, candidate.setCode ?? '', candidate.collectorNumber ?? ''].join(':');
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020A12' },
  cameraStage: { flex: 1 },
  screenGuard: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg, backgroundColor: '#020A12' },
  topBar: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm, paddingHorizontal: space.md },
  topTextGroup: { flex: 1, minWidth: 0, gap: 0 },
  topMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: 2 },
  topActions: { flexDirection: 'column', alignItems: 'flex-end', gap: space.xs },
  startupOverlay: { position: 'absolute', left: space.md, right: space.md, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: space.md, paddingVertical: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: color.borderStrong, backgroundColor: color.canvas + 'D8' },
  startupOverlayCopy: { textAlign: 'center' },
  cameraLiveStatus: { position: 'absolute', left: space.md, right: space.md, bottom: 156, alignItems: 'center', gap: 2, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.md, borderWidth: 1, zIndex: 20 },
  cameraLiveStatusMuted: { borderColor: color.border + '88', backgroundColor: color.canvas + '22' },
  cameraLiveStatusInfo: { borderColor: color.info + '44', backgroundColor: color.info + '14' },
  cameraLiveStatusWarning: { borderColor: color.warning + '44', backgroundColor: color.warning + '14' },
  cameraLiveStatusSuccess: { borderColor: color.success + '44', backgroundColor: color.success + '14' },
  cameraLiveHeadline: { textAlign: 'center', color: color.text },
  bottomOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: space.sm, paddingHorizontal: space.md },
  sessionStrip: { marginTop: 2 },
  productionError: { marginTop: -space.xs, marginBottom: space.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  results: { gap: space.sm },
  resultCard: { gap: 4, backgroundColor: '#07111DEE' },
  productionResultCard: { gap: space.sm, backgroundColor: '#07111DEE', paddingVertical: space.sm, paddingHorizontal: space.sm },
  productionResultCardCompact: { paddingVertical: space.xs, paddingHorizontal: space.xs },
  productionResultHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  productionResultHeaderCompact: { gap: space.xs },
  productionResultCopy: { flex: 1, minWidth: 0, gap: 2 },
  productionResultName: { fontWeight: '600' },
  productionResultImage: { width: 68, height: 94, borderRadius: radius.md, backgroundColor: '#0D1722' },
  productionResultImageCompact: { width: 56, height: 78 },
  productionResultImageLarge: { width: 76, height: 106 },
  productionResultImageMissing: { width: 68, height: 94, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D1722' },
  productionPriceRow: { minHeight: 18, justifyContent: 'center', marginTop: 1 },
  productionPriceText: { fontWeight: '700' },
  productionPriceLoading: { width: 88, paddingVertical: 2 },
  productionPriceSkeleton: { marginVertical: 0 },
  productionResultFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: space.sm, flexWrap: 'wrap' },
  productionResultActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
  reviewReminder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, backgroundColor: '#07111DEE', paddingVertical: space.xs, paddingHorizontal: space.sm },
  reviewReminderCompact: { paddingVertical: 6, paddingHorizontal: 10 },
  reviewReminderCopy: { flex: 1, minWidth: 0, gap: 1 },
  devDiagnostics: { gap: space.xs, marginTop: space.sm },
  previewGrid: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  previewBlock: { gap: space.xs, marginTop: space.xs, paddingTop: space.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#273244' },
  previewPlaceholder: { width: '100%', height: 120, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D1722' },
  previewImage: { width: '100%', height: 120, borderRadius: radius.md, backgroundColor: '#0D1722' },
});

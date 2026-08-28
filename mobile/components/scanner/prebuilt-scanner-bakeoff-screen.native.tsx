import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScanbotSDK, { SdkConfiguration, ScanbotDocumentScannerView, type DocumentDetectionResult, type ImageRef as ScanbotImageRef, type ScanbotDocumentScannerViewHandle } from 'react-native-scanbot-sdk';

import { TDButton, TDCard, TDLoadingState, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { addRecognitionToSession, createContinuousScannerSession, createRecognitionPipelineReport, continuousScannerSessionKey, type ContinuousScannerSession } from '@/services/continuous-offer-scanner';
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
import { enrichScannerSessionLinePrice } from '@/services/scanner-price-enrichment';
import { isScannerDiagnosticsEnabled } from '@/services/native-scanner-calibration';
import { runPrebuiltScannerBakeoff, type PrebuiltScannerBakeoffReport } from '@/services/scanner-prebuilt-bakeoff';
import { appStorage } from '@/services/storage/app-storage';
import type { ScannerCardCandidate } from '@/services/scanner-foundation';
import { scanCardSightWithFallback, type CardSightMobileScanResult } from '@/services/cardsight-scan-provider';

type ScannerStage = 'initializing' | 'ready' | 'capturing' | 'processing' | 'error';
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
};

type CardsightPreviewArtifact = ScannerImageArtifact & {
  source: 'raw' | 'cropped';
  candidate: string | null;
};

const SCANBOT_LICENSE_KEY = process.env.EXPO_PUBLIC_SCANBOT_LICENSE_KEY?.trim() ?? '';

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
  const lastAcceptedIdentityRef = useRef<string | null>(null);
  const lastAcceptedAtRef = useRef(0);
  const captureInFlightRef = useRef(false);
  const lastDetectionStatusRef = useRef<string | null>(null);

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

  const handleFrameDetectionResult = useCallback((result: DocumentDetectionResult) => {
    setCameraReady(true);
    setDetection(result);
    setStage((current) => current === 'initializing' ? 'ready' : current);
    if (__DEV__ && result.status !== lastDetectionStatusRef.current) {
      lastDetectionStatusRef.current = result.status;
      logPrebuiltScannerDiagnostics({ scanbotDetected: result.status });
    }
  }, []);

  const handleSnappedDocumentResult = useCallback(async (originalImage: ScanbotImageRef, documentImage?: ScanbotImageRef) => {
    if (captureInFlightRef.current || stage === 'processing') return;
    captureInFlightRef.current = true;
    setStage('capturing');
    setSuccess(null);
    setReport(null);
    setError(null);
    setCaptureArtifacts(null);
    setCardsightPreview(null);
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
      if (mode === 'production') {
        const productionOutcome = await runProductionScannerCapture({
          rawImageUri: raw.path,
          croppedImageUri: cropped?.path ?? null,
          rawImageSize: raw.size,
          croppedImageSize: cropped?.size ?? null,
          rawImageBytes: raw.bytes,
          croppedImageBytes: cropped?.bytes ?? null,
          session,
          sessionUserId,
          onSessionUpdate: setSession,
          onCapturedCountChange: setCapturedCount,
          onSuccess: setSuccess,
          onPrebuiltDiagnostics: logPrebuiltScannerDiagnostics,
          onCardsightPreview: setCardsightPreview,
          lastAcceptedIdentityRef,
          lastAcceptedAtRef,
        });
        if (productionOutcome.ok) {
          setStage('ready');
          return;
        }
        setError(productionOutcome.message);
        setStage('ready');
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
      setStage('ready');
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'The scanner could not process the capture.';
      setError(message);
      setStage('error');
    } finally {
      captureInFlightRef.current = false;
      scannerRef.current?.unfreezeCamera();
    }
  }, [mode, session, sessionUserId, stage]);

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
      <View style={[styles.cameraStage, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}>
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
            <TDText variant="title">Trading Docks scanner</TDText>
            <TDText tone="muted">{mode === 'production' ? 'Scanbot auto-capture + CardSight fallback' : 'Prebuilt Scanbot capture + CardSight bakeoff'}</TDText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close scanner" onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="close-outline" size={20} color={color.text} />
          </Pressable>
        </View>

        <View style={styles.centerOverlay} pointerEvents="none">
          {!cameraReady ? <TDLoadingState title="Preparing scanner" message={stageCopy} /> : <TDText variant="caption" tone="muted">{stageCopy}</TDText>}
        </View>

        <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + space.sm }]}>
          <TDCard style={styles.summaryCard}>
            {mode === 'production' ? (
              <>
                <TDText variant="label" tone="muted">Session • {capturedCount} cards</TDText>
                <TDText variant="small">{success ?? stageCopy}</TDText>
                <TDText variant="caption" tone="muted">Scanbot SDK: {sdkLicenseLabel}</TDText>
                {error ? <TDText variant="caption" tone="danger">{error}</TDText> : null}
                <View style={styles.row}>
                  <TDButton label="Open session" variant="secondary" onPress={() => router.push('/scanner-session' as never)} />
                </View>
                {__DEV__ && diagnosticsEnabled && captureArtifacts ? (
                  <View style={styles.devDiagnostics}>
                    <TDText variant="caption" tone="muted">Raw capture • {captureArtifacts.raw.size.width} × {captureArtifacts.raw.size.height} • {formatBytes(captureArtifacts.raw.bytes)}</TDText>
                    <TDText variant="caption" tone="muted">Normalized capture • {captureArtifacts.cropped ? `${captureArtifacts.cropped.size.width} × ${captureArtifacts.cropped.size.height} • ${formatBytes(captureArtifacts.cropped.bytes)}` : 'not returned'}</TDText>
                    {cardsightPreview?.path ? (
                      <View style={styles.previewBlock}>
                        <TDText variant="label" tone="muted">CardSight sent • {cardsightPreview.source}</TDText>
                        <Image source={{ uri: cardsightPreview.path }} style={styles.previewImage} resizeMode="cover" />
                        <TDText variant="caption" tone="muted">
                          {cardsightPreview.size.width} × {cardsightPreview.size.height} • {formatBytes(cardsightPreview.bytes)}
                          {cardsightPreview.candidate ? ` • ${cardsightPreview.candidate}` : ''}
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
          </TDCard>
          {mode === 'bakeoff' && report ? (
            <View style={styles.results}>
              <ResultCard title="Local pipeline" summary={report.summary.local} />
              <ResultCard title="CardSight" summary={report.summary.cardsight} />
              <ResultCard title="TCGTracking" summary={report.summary.tcgtracking} />
            </View>
          ) : null}
        </View>
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
  const directory = Paths.cache ?? Paths.document;
  if (!directory) return { path: null, size, bytes: 0 };
  const file = new File(directory, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
  const saved = await imageRef.saveImage(file.uri);
  if (!saved) return { path: null, size, bytes: 0 };
  const savedInfo = file.info();
  return { path: file.uri, size, bytes: typeof savedInfo.size === 'number' ? savedInfo.size : 0 };
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
  lastAcceptedIdentityRef: MutableRefObject<string | null>;
  lastAcceptedAtRef: MutableRefObject<number>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!input.session || !input.sessionUserId) {
    return { ok: false, message: 'Scanner session is still preparing.' };
  }
  if (!isCardSightScannerEnabled()) {
    return { ok: false, message: 'CardSight is unavailable in this build.' };
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
  const selection = chooseProductionCandidate(rawCardsight, croppedCardsight, {
    rawImageUri: input.rawImageUri,
    croppedImageUri: input.croppedImageUri,
    rawImageSize: input.rawImageSize,
    croppedImageSize: input.croppedImageSize,
    rawImageBytes: input.rawImageBytes,
    croppedImageBytes: input.croppedImageBytes,
  });
  input.onPrebuiltDiagnostics({
    cardsightResult: bestProviderAttempt(rawCardsight, croppedCardsight)?.ok ? 'candidates' : 'retry',
  });
  if (!selection) {
    input.onPrebuiltDiagnostics({ cardIntelligenceResult: 'retry' });
    return { ok: false, message: 'Couldn’t identify card\nTry again' };
  }

  input.onCardsightPreview(selection.cardsightPreview ?? null);

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
  const successMessage = selection.requiresConfirmation
    ? `✓ ${selection.candidate.name}\nMatching printing...`
    : `✓ ${selection.candidate.name}\n${selection.candidate.setCode ?? 'Set'} • ${selection.candidate.collectorNumber ?? '?'}`;
  if (input.lastAcceptedIdentityRef.current === fingerprint && Date.now() - input.lastAcceptedAtRef.current < 1200) {
    input.onSuccess(successMessage);
    setTimeout(() => {
      input.onSuccess(null);
    }, 550);
    return { ok: true };
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
  if (lineId) {
    const priceResult = enrichScannerSessionLinePrice({
      session: nextSession,
      lineId,
      stableScanId,
      candidate: selection.candidate,
      finish: selection.candidate.finishes[0] ?? 'nonfoil',
    });
    sessionAfterPrice = priceResult.session;
  }

  await appStorage.setItem(continuousScannerSessionKey(input.sessionUserId), JSON.stringify(sessionAfterPrice));
  input.onSessionUpdate(sessionAfterPrice);
  input.onCapturedCountChange(sessionAfterPrice.lines.length);
  input.lastAcceptedIdentityRef.current = fingerprint;
  input.lastAcceptedAtRef.current = Date.now();
  input.onSuccess(successMessage);
  input.onPrebuiltDiagnostics({
    cardIntelligenceResult: selection.requiresConfirmation ? 'needs_review' : 'exact',
    sessionAppend: 'added',
  });
  setTimeout(() => {
    input.onSuccess(null);
  }, 550);
  if (__DEV__) {
    console.info('TD_SCANNER_PROVIDER', {
      scanbotDetected: 'frame-detected',
      scanbotCaptured: 'captured',
      cardsightRequest: 'completed',
      cardsightResult: bestProviderAttempt(rawCardsight, croppedCardsight)?.ok ? 'candidates' : 'retry',
      cardIntelligenceResult: selection.requiresConfirmation ? 'needs_review' : 'exact',
      sessionAppend: 'added',
    });
  }
  return { ok: true };
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
  if (cardsight?.ok && cardsight.candidates.length) {
    const selectedSource = cardsight === rawCardsight ? 'raw' : 'cropped';
    const preview: CardsightPreviewArtifact | null = {
      path: selectedSource === 'raw' ? images.rawImageUri : images.croppedImageUri ?? images.rawImageUri,
      size: selectedSource === 'raw'
        ? images.rawImageSize
        : images.croppedImageSize ?? images.rawImageSize,
      bytes: selectedSource === 'raw'
        ? images.rawImageBytes
        : images.croppedImageBytes ?? images.rawImageBytes,
      source: selectedSource,
      candidate: cardsight.candidates[0]?.name ?? null,
    };
    return {
      candidate: cardsight.candidates[0],
      recognitionMethod: 'metadata_assisted',
      requiresConfirmation: cardsight.fallbackRecommended,
      topConfidence: cardsight.topConfidence,
      provider: 'cardsight',
      cardsightPreview: preview,
    };
  }
  return null;
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
  topTextGroup: { flex: 1, minWidth: 0, gap: 2 },
  iconButton: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C1520CC', borderWidth: 1, borderColor: '#273244' },
  centerOverlay: { position: 'absolute', left: space.md, right: space.md, top: '46%', alignItems: 'center', justifyContent: 'center' },
  bottomOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: space.sm, paddingHorizontal: space.md },
  summaryCard: { gap: space.xs, backgroundColor: '#07111DDD' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  results: { gap: space.sm },
  resultCard: { gap: 4, backgroundColor: '#07111DEE' },
  devDiagnostics: { gap: space.xs, marginTop: space.sm },
  previewBlock: { gap: space.xs, marginTop: space.xs, paddingTop: space.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#273244' },
  previewImage: { width: '100%', height: 120, borderRadius: radius.md, backgroundColor: '#0D1722' },
});

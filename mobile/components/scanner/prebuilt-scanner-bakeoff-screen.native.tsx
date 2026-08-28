import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScanbotSDK, { SdkConfiguration, ScanbotDocumentScannerView, type DocumentDetectionResult, type ImageRef as ScanbotImageRef, type ScanbotDocumentScannerViewHandle } from 'react-native-scanbot-sdk';

import { TDButton, TDCard, TDLoadingState, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { addRecognitionToSession, createContinuousScannerSession, createRecognitionPipelineReport, continuousScannerSessionKey, type ContinuousScannerSession } from '@/services/continuous-offer-scanner';
import { loadScannerContext, searchScannerPrintings } from '@/services/scanner-data';
import { enrichScannerSessionLinePrice } from '@/services/scanner-price-enrichment';
import { isScannerDiagnosticsEnabled } from '@/services/native-scanner-calibration';
import { runPrebuiltScannerBakeoff, type PrebuiltScannerBakeoffReport } from '@/services/scanner-prebuilt-bakeoff';
import { appStorage } from '@/services/storage/app-storage';
import type { ScannerCardCandidate } from '@/services/scanner-foundation';

type ScannerStage = 'initializing' | 'ready' | 'capturing' | 'processing' | 'error';
type ScannerMode = 'bakeoff' | 'production';

const SCANBOT_LICENSE_KEY = process.env.EXPO_PUBLIC_SCANBOT_LICENSE_KEY?.trim() ?? '';

type ScanbotInitResult =
  | { ok: true; licenseLabel: 'configured' | 'trial'; error: null }
  | { ok: false; licenseLabel: 'missing'; error: string };

let scanbotInitPromise: Promise<ScanbotInitResult> | null = null;

export default function PrebuiltScannerBakeoffScreen({
  mode = 'bakeoff',
  onUseLegacyFallback,
}: {
  mode?: ScannerMode;
  onUseLegacyFallback?: () => void;
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
  const lastAcceptedIdentityRef = useRef<string | null>(null);
  const lastAcceptedAtRef = useRef(0);
  const captureInFlightRef = useRef(false);

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
    if (stage === 'capturing') return 'Reading card...';
    if (stage === 'processing') return 'Checking providers...';
    if (report) return 'Captured. Compare the provider results below.';
    if (mode === 'production') {
      if (!sessionUserId) return 'Preparing session...';
      return cameraReady ? 'Detecting card...' : 'Waiting for camera...';
    }
    return cameraReady ? 'Place the card roughly in view.' : 'Waiting for camera...';
  }, [cameraReady, error, mode, report, sdkReady, sessionUserId, stage, success]);

  const handleFrameDetectionResult = useCallback((result: DocumentDetectionResult) => {
    setCameraReady(true);
    setDetection(result);
    setStage((current) => current === 'initializing' ? 'ready' : current);
  }, []);

  const handleSnappedDocumentResult = useCallback(async (originalImage: ScanbotImageRef, documentImage?: ScanbotImageRef) => {
    if (captureInFlightRef.current || stage === 'processing') return;
    captureInFlightRef.current = true;
    setStage('capturing');
    setSuccess(null);
    setReport(null);
    setError(null);
    scannerRef.current?.freezeCamera();
    try {
      const raw = await persistImageRef(originalImage, 'scanbot-raw');
      const cropped = documentImage ? await persistImageRef(documentImage, 'scanbot-cropped') : null;
      if (!raw.path) {
        throw new Error('The scanner did not return a usable image.');
      }
      setStage('processing');
      if (mode === 'production') {
        const productionOutcome = await runProductionScannerCapture({
          rawImageUri: raw.path,
          croppedImageUri: cropped?.path ?? null,
          rawImageSize: raw.size,
          croppedImageSize: cropped?.size ?? null,
          session,
          sessionUserId,
          onSessionUpdate: setSession,
          onCapturedCountChange: setCapturedCount,
          onSuccess: setSuccess,
          onLog: logDiagnostics,
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
        <View style={styles.row}>
          {onUseLegacyFallback ? <TDButton label="Use legacy scanner" variant="secondary" onPress={onUseLegacyFallback} /> : null}
          <TDButton label="Go back" onPress={() => router.back()} />
        </View>
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
          autoSnappingEnabled
          autoSnappingSensitivity={0.82}
          autoSnappingDelay={0.2}
          detectDocumentAfterSnap
          touchToFocusEnabled
          finderEnabled
          finderAspectRatio={{ width: 63, height: 88 }}
          polygonEnabled
          cameraModule="BACK"
          cameraPreviewMode="FILL_IN"
          photoQualityPrioritization="QUALITY"
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
                {detection ? <TDText variant="caption" tone="muted">Detected document: {detection.status}</TDText> : null}
                {error ? <TDText variant="caption" tone="danger">{error}</TDText> : null}
                <View style={styles.row}>
                  <TDButton label="Open session" variant="secondary" onPress={() => router.push('/scanner-session' as never)} />
                  {onUseLegacyFallback ? <TDButton label="Use legacy scanner" variant="secondary" onPress={onUseLegacyFallback} /> : null}
                </View>
              </>
            ) : (
              <>
                <TDText variant="label" tone="muted">Scanner status</TDText>
                <TDText variant="small">Stage: {stage}</TDText>
                <TDText variant="caption" tone="muted">Scanbot SDK: {sdkLicenseLabel}</TDText>
                {detection ? <TDText variant="caption" tone="muted">Detected document: {detection.status}</TDText> : null}
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
  if (!directory) return { path: null, size };
  const file = new File(directory, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
  const saved = await imageRef.saveImage(file.uri);
  return { path: saved ? file.uri : null, size };
}

function formatConfidence(value: number | null) {
  return value === null ? 'n/a' : value.toFixed(2);
}

function logDiagnostics(report: PrebuiltScannerBakeoffReport) {
  if (!__DEV__) return;
  console.info('TD_SCANNER_PROVIDER', {
    engine: 'scanbot',
    stage: 'bakeoff',
    cardsightEnabled: true,
    cardsightCandidate: report.summary.cardsight.raw.topCandidate ?? report.summary.cardsight.cropped.topCandidate ?? null,
    cardsightLatencyMs: report.summary.cardsight.raw.latencyMs ?? report.summary.cardsight.cropped.latencyMs ?? null,
    fallbackProvider: report.summary.tcgtracking.raw.topCandidate ?? report.summary.tcgtracking.cropped.topCandidate ?? 'local',
  });
}

async function runProductionScannerCapture(input: {
  rawImageUri: string;
  croppedImageUri: string | null;
  rawImageSize: { width: number; height: number };
  croppedImageSize: { width: number; height: number } | null;
  session: ContinuousScannerSession | null;
  sessionUserId: string | null;
  onSessionUpdate: (session: ContinuousScannerSession) => void;
  onCapturedCountChange: (count: number) => void;
  onSuccess: (message: string | null) => void;
  onLog: (report: PrebuiltScannerBakeoffReport) => void;
  lastAcceptedIdentityRef: MutableRefObject<string | null>;
  lastAcceptedAtRef: MutableRefObject<number>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!input.session || !input.sessionUserId) {
    return { ok: false, message: 'Scanner session is still preparing.' };
  }
  const report = await runPrebuiltScannerBakeoff({
    rawImageUri: input.rawImageUri,
    croppedImageUri: input.croppedImageUri,
    rawImageSize: input.rawImageSize,
    croppedImageSize: input.croppedImageSize,
    online: true,
  });
  input.onLog(report);

  const selection = await chooseProductionCandidate(report);
  if (!selection) {
    return { ok: false, message: 'No reliable card identity yet. Keep scanning.' };
  }

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
  if (input.lastAcceptedIdentityRef.current === fingerprint && Date.now() - input.lastAcceptedAtRef.current < 1200) {
    input.onSuccess(`✓ ${selection.candidate.name}\n${selection.candidate.setCode ?? 'Set'} • ${selection.candidate.collectorNumber ?? '?'}`);
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
  input.onSuccess(`✓ ${selection.candidate.name}\n${selection.candidate.setCode ?? 'Set'} • ${selection.candidate.collectorNumber ?? '?'}`);
  setTimeout(() => {
    input.onSuccess(null);
  }, 550);
  if (__DEV__) {
    console.info('TD_SCANNER_PROVIDER', {
      scannerEngine: 'prebuilt',
      cardsightEnabled: true,
      escalationStage: selection.provider,
      cardsightRequestStarted: selection.cardsightRequestStarted,
      cardsightResponseStatus: selection.cardsightResponseStatus,
      cardsightCandidate: selection.cardsightCandidate,
      cardsightLatencyMs: selection.cardsightLatencyMs,
      fallbackProvider: selection.fallbackProvider,
    });
  }
  return { ok: true };
}

async function chooseProductionCandidate(report: PrebuiltScannerBakeoffReport): Promise<null | {
  candidate: ScannerCardCandidate;
  recognitionMethod: 'metadata_assisted' | 'manual_search' | 'future_visual_provider' | 'unavailable';
  requiresConfirmation: boolean;
  topConfidence: number | null;
  provider: 'cardsight' | 'tcgtracking' | 'local';
  cardsightRequestStarted: boolean;
  cardsightResponseStatus: string | null;
  cardsightCandidate: string | null;
  cardsightLatencyMs: number | null;
  fallbackProvider: string;
}> {
  const cardsight = bestProviderAttempt(report.raw.cardsight, report.cropped.cardsight);
  if (cardsight?.ok && cardsight.candidates.length) {
    return {
      candidate: cardsight.candidates[0],
      recognitionMethod: 'metadata_assisted',
      requiresConfirmation: cardsight.fallbackRecommended,
      topConfidence: cardsight.topConfidence,
      provider: 'cardsight',
      cardsightRequestStarted: true,
      cardsightResponseStatus: cardsight.status,
      cardsightCandidate: cardsight.candidates[0]?.name ?? null,
      cardsightLatencyMs: cardsight.latencyMs ?? null,
      fallbackProvider: cardsight.fallbackRecommended ? 'TCGTracking' : 'cardsight',
    };
  }

  const tcgtracking = bestProviderAttempt(report.raw.tcgtracking, report.cropped.tcgtracking);
  if (tcgtracking?.ok && tcgtracking.candidates.length) {
    return {
      candidate: tcgtracking.candidates[0],
      recognitionMethod: 'metadata_assisted',
      requiresConfirmation: tcgtracking.fallbackRecommended,
      topConfidence: tcgtracking.topConfidence,
      provider: 'tcgtracking',
      cardsightRequestStarted: false,
      cardsightResponseStatus: 'fallback_to_tcgtracking',
      cardsightCandidate: null,
      cardsightLatencyMs: null,
      fallbackProvider: 'TCGTracking',
    };
  }

  const localTop = bestLocalTopCandidate(report.raw.local, report.cropped.local);
  if (!localTop) return null;
  const localMatches = await searchScannerPrintings(localTop.name, true);
  const candidate = localMatches.ok
    ? localMatches.candidates.find((entry) => entry.id === localTop.scryfallId || entry.oracleId === localTop.oracleId || entry.name === localTop.name) ?? localMatches.candidates[0] ?? null
    : null;
  if (!candidate) return null;
  return {
    candidate,
    recognitionMethod: 'manual_search',
    requiresConfirmation: false,
    topConfidence: localTop.score ?? candidate.confidence ?? null,
    provider: 'local',
    cardsightRequestStarted: false,
    cardsightResponseStatus: 'local_fallback',
    cardsightCandidate: null,
    cardsightLatencyMs: null,
    fallbackProvider: 'local',
  };
}

function bestProviderAttempt<T extends { ok: boolean; candidates?: ScannerCardCandidate[]; topConfidence?: number | null; fallbackRecommended?: boolean; status?: string; reason?: string; latencyMs?: number | null }>(raw: T, cropped: T) {
  const rawScore = raw.ok && raw.candidates?.length ? (raw.topConfidence ?? raw.candidates[0]?.confidence ?? null) : null;
  const croppedScore = cropped.ok && cropped.candidates?.length ? (cropped.topConfidence ?? cropped.candidates[0]?.confidence ?? null) : null;
  if (rawScore === null && croppedScore === null) return raw.ok ? raw : cropped.ok ? cropped : null;
  if (croppedScore !== null && (rawScore === null || croppedScore > rawScore + 0.02)) return cropped;
  return raw;
}

function bestLocalTopCandidate(raw: PrebuiltScannerBakeoffReport['raw']['local'], cropped: PrebuiltScannerBakeoffReport['cropped']['local']) {
  const rawTop = raw.engines.ocr_accurate.top1 ?? raw.engines.apple_vision_feature_print.top1 ?? raw.engines.phash_luma_8x8.top1 ?? null;
  const croppedTop = cropped.engines.ocr_accurate.top1 ?? cropped.engines.apple_vision_feature_print.top1 ?? cropped.engines.phash_luma_8x8.top1 ?? null;
  if (!rawTop && !croppedTop) return null;
  if (!rawTop) return croppedTop;
  if (!croppedTop) return rawTop;
  return (croppedTop.score ?? 0) > (rawTop.score ?? 0) ? croppedTop : rawTop;
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
});

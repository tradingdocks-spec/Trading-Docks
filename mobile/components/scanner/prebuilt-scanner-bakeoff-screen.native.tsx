import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScanbotSDK, { SdkConfiguration, ScanbotDocumentScannerView, type DocumentDetectionResult, type ImageRef as ScanbotImageRef, type ScanbotDocumentScannerViewHandle } from 'react-native-scanbot-sdk';

import { TDButton, TDCard, TDLoadingState, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { isScannerDiagnosticsEnabled } from '@/services/native-scanner-calibration';
import { runPrebuiltScannerBakeoff, type PrebuiltScannerBakeoffReport } from '@/services/scanner-prebuilt-bakeoff';

type ScannerStage = 'initializing' | 'ready' | 'capturing' | 'processing' | 'error';

const SCANBOT_LICENSE_KEY = process.env.EXPO_PUBLIC_SCANBOT_LICENSE_KEY?.trim() ?? '';

type ScanbotInitResult =
  | { ok: true; licenseLabel: 'configured' | 'trial'; error: null }
  | { ok: false; licenseLabel: 'missing'; error: string };

let scanbotInitPromise: Promise<ScanbotInitResult> | null = null;

export default function PrebuiltScannerBakeoffScreen() {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scannerRef = useRef<ScanbotDocumentScannerViewHandle | null>(null);
  const [stage, setStage] = useState<ScannerStage>('initializing');
  const [cameraReady, setCameraReady] = useState(false);
  const [detection, setDetection] = useState<DocumentDetectionResult | null>(null);
  const [report, setReport] = useState<PrebuiltScannerBakeoffReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkLicenseLabel, setSdkLicenseLabel] = useState<'configured' | 'trial' | 'missing'>('missing');

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

  const stageCopy = useMemo(() => {
    if (!sdkReady) return 'Preparing scanner...';
    if (stage === 'capturing') return 'Reading card...';
    if (stage === 'processing') return 'Checking providers...';
    if (report) return 'Captured. Compare the provider results below.';
    return cameraReady ? 'Place the card roughly in view.' : 'Waiting for camera...';
  }, [cameraReady, report, sdkReady, stage]);

  const handleFrameDetectionResult = useCallback((result: DocumentDetectionResult) => {
    setCameraReady(true);
    setDetection(result);
    setStage((current) => current === 'initializing' ? 'ready' : current);
  }, []);

  const handleSnappedDocumentResult = useCallback(async (originalImage: ScanbotImageRef, documentImage?: ScanbotImageRef) => {
    if (stage === 'processing') return;
    setStage('capturing');
    scannerRef.current?.freezeCamera();
    try {
      const raw = await persistImageRef(originalImage, 'scanbot-raw');
      const cropped = documentImage ? await persistImageRef(documentImage, 'scanbot-cropped') : null;
      if (!raw.path) {
        throw new Error('The scanner did not return a usable image.');
      }
      setStage('processing');
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
      scannerRef.current?.unfreezeCamera();
    }
  }, [stage]);

  if (!diagnosticsEnabled) {
    return (
      <View style={styles.screenGuard}>
        <TDText variant="title">Scanner bakeoff unavailable</TDText>
        <TDText tone="muted">Enable scanner diagnostics to use the native prebuilt scanner route.</TDText>
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
            <TDText tone="muted">Prebuilt Scanbot capture + CardSight bakeoff</TDText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close scanner bakeoff" onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="close-outline" size={20} color={color.text} />
          </Pressable>
        </View>

        <View style={styles.centerOverlay} pointerEvents="none">
          {!cameraReady ? <TDLoadingState title="Preparing scanner" message={stageCopy} /> : <TDText variant="caption" tone="muted">{stageCopy}</TDText>}
        </View>

        <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + space.sm }]}>
          <TDCard style={styles.summaryCard}>
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
          </TDCard>
          {report ? (
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

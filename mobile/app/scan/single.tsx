import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TDButton, TDCard, TDText } from '@/components/design-system';
import { ScannerCamera, type ScannerCameraFrame, type ScannerCameraHandle } from '@/components/scanner-camera';
import { color, radius, space } from '@/design';
import { calculateCardGuideLayout } from '@/services/continuous-offer-scanner';
import { displayFinish } from '@/services/collector-workspace';
import { recognizeMagicStillCapture, type MagicStillScanResult } from '@/services/magic-ocr-pipeline';
import { loadScannerContext } from '@/services/scanner-data';
import { resolveScannerPermissionState, type ScannerCardCandidate, type ScannerPermissionState } from '@/services/scanner-foundation';
import {
  SCANNER_CAMERA_LENS_LABELS,
  convertPreviewTapToCameraPoint,
  resolveScannerFocusRequest,
  scannerFocusReticleDuration,
  type ScannerCameraDeviceSummary,
  type ScannerCameraLensMode,
  type ScannerCameraLensOption,
  type ScannerCameraPoint,
  type ScannerTorchState,
} from '@/services/scanner-camera-controls';

export default function SingleScanScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<ScannerCameraHandle>(null);
  const [permission, setPermission] = useState<ScannerPermissionState>('not_requested');
  const [cameraReady, setCameraReady] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchState, setTorchState] = useState<ScannerTorchState | null>(null);
  const [lensMode, setLensMode] = useState<ScannerCameraLensMode>('auto');
  const [lensOptions, setLensOptions] = useState<ScannerCameraLensOption[]>([]);
  const [deviceSummary, setDeviceSummary] = useState<ScannerCameraDeviceSummary | null>(null);
  const [previewResolution, setPreviewResolution] = useState<{ width: number; height: number } | null>(null);
  const [focusReticle, setFocusReticle] = useState<ScannerCameraPoint | null>(null);
  const [processing, setProcessing] = useState(false);
  const [stage, setStage] = useState<'idle' | 'reading' | 'matching' | 'result' | 'failed'>('idle');
  const [result, setResult] = useState<MagicStillScanResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const guideLayout = useMemo(() => calculateCardGuideLayout({
    containerWidth: width,
    containerHeight: height,
    safeTop: insets.top + 72,
    safeBottom: insets.bottom + 132,
    reservedVerticalSpace: 72,
  }), [height, insets.bottom, insets.top, width]);
  const supportedLensOptions = lensOptions.filter((option) => option.supported);
  const selectedLensLabel = supportedLensOptions.find((option) => option.mode === lensMode)?.label ?? SCANNER_CAMERA_LENS_LABELS[lensMode].label;
  const selectedCandidate = result?.ok ? result.selected ?? result.candidates[0] ?? null : null;

  const requestCamera = useCallback(async () => {
    const request = await requestCameraPermission();
    setPermission(resolveScannerPermissionState({
      cameraAvailable: true,
      permissionGranted: request.granted,
      permissionDenied: !request.granted && !request.canAskAgain,
      requested: true,
    }));
  }, [requestCameraPermission]);

  const captureSingle = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || processing) return;
    setProcessing(true);
    setMessage(null);
    setStage('reading');
    try {
      const context = await loadScannerContext();
      const photo = await cameraRef.current.capturePhoto();
      const scan = await recognizeMagicStillCapture({
        imageUri: photo.uri,
        preview: previewResolution ?? { width, height },
        image: { width: photo.width, height: photo.height },
        guide: guideLayout,
        online: true,
        cachedCandidates: [],
        onStage: (nextStage) => setStage(nextStage === 'reading_title' ? 'reading' : 'matching'),
      });
      setResult(scan);
      setStage(scan.ok ? 'result' : 'failed');
      setMessage(scan.ok ? null : scan.reason);
      void context;
    } catch (error) {
      setStage('failed');
      setMessage(error instanceof Error ? error.message : 'Could not scan this card.');
    } finally {
      setProcessing(false);
    }
  }, [cameraReady, guideLayout, height, previewResolution, processing, width]);

  const retake = useCallback(() => {
    setResult(null);
    setMessage(null);
    setStage('idle');
  }, []);

  const addToReviewList = useCallback(() => {
    setMessage('Added to Review List.');
    router.push('/scanner-session' as never);
  }, []);

  const handleFrame = useCallback((frame: ScannerCameraFrame) => {
    setPreviewResolution((current) => current?.width === frame.previewResolution.width && current.height === frame.previewResolution.height
      ? current
      : frame.previewResolution);
  }, []);

  const handlePreviewTap = useCallback(async (event: GestureResponderEvent) => {
    const requestedPoint = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
    const focusRequest = resolveScannerFocusRequest({
      active: permission === 'granted',
      appForegrounded: true,
      processing,
      supportsFocus: Boolean(deviceSummary?.supportsFocus),
    });
    if (!focusRequest.allowed || !cameraRef.current) return;
    const conversion = convertPreviewTapToCameraPoint({
      point: requestedPoint,
      view: { width, height },
      source: previewResolution,
      resizeMode: 'cover',
    });
    if (!conversion.normalizedPoint) return;
    setFocusReticle(requestedPoint);
    setTimeout(() => setFocusReticle(null), scannerFocusReticleDuration(false));
    await cameraRef.current.focusAt(conversion.normalizedPoint);
  }, [deviceSummary?.supportsFocus, height, permission, previewResolution, processing, width]);

  const currentInstruction = stage === 'reading'
    ? 'Reading'
    : stage === 'matching'
      ? 'Reading'
      : stage === 'failed'
        ? "Couldn't identify"
        : stage === 'result'
          ? 'Review result'
          : 'Tap Capture';

  if (!cameraPermission?.granted && permission !== 'granted') {
    return (
      <View style={[s.shell, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }]}>
        <TDCard style={s.permissionCard}>
          <TDText variant="title">Single Scan</TDText>
          <TDText variant="small" tone="muted">Camera access is required to capture one card.</TDText>
          <TDButton label="Grant camera access" onPress={requestCamera} />
          <TDButton label="Back" variant="secondary" onPress={() => router.back()} />
        </TDCard>
      </View>
    );
  }

  return (
    <View style={s.shell}>
      <Pressable accessibilityRole="button" accessibilityLabel="Focus camera preview" onPress={handlePreviewTap} style={StyleSheet.absoluteFill}>
        <ScannerCamera
          ref={cameraRef}
          active
          torchEnabled={torchEnabled}
          lensMode={lensMode}
          appForegrounded
          focusEnabled
          userId="single-scan"
          onReady={() => {
            setCameraReady(true);
            setPermission('granted');
          }}
          onFrameAnalysis={handleFrame}
          onLensOptionsChange={setLensOptions}
          onDeviceDiagnosticsChange={setDeviceSummary}
          onTorchStateChange={setTorchState}
        />
      </Pressable>

      <View pointerEvents="none" style={[s.guide, { left: guideLayout.left, top: guideLayout.top, width: guideLayout.width, height: guideLayout.height }]}>
        <View style={s.corner} />
        <View style={[s.corner, s.cornerRight]} />
        <View style={[s.corner, s.cornerBottom]} />
        <View style={[s.corner, s.cornerBottomRight]} />
      </View>
      {focusReticle ? <View pointerEvents="none" style={[s.focusReticle, { left: focusReticle.x - 18, top: focusReticle.y - 18 }]} /> : null}

      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <HeaderButton label="Back" icon="chevron-back" onPress={() => router.back()} />
        <TDText variant="title" numberOfLines={1}>Single Scan</TDText>
        <HeaderButton label="Settings" icon="settings-outline" onPress={() => undefined} />
      </View>

      <View style={s.instruction}>
        <TDText variant="title" style={s.centerText}>{currentInstruction}</TDText>
      </View>

      <View style={[s.bottomControls, { paddingBottom: insets.bottom + space.md }]}>
        <View style={s.lensControl}>
          {supportedLensOptions.map((option) => (
            <Pressable
              key={option.mode}
              accessibilityRole="button"
              accessibilityLabel={`Use ${option.label} camera`}
              accessibilityState={{ selected: lensMode === option.mode }}
              onPress={() => setLensMode(option.mode)}
              style={[s.lensButton, lensMode === option.mode && s.lensButtonActive]}
            >
              <TDText variant="caption" tone={lensMode === option.mode ? 'primary' : 'muted'}>{option.shortLabel}</TDText>
            </Pressable>
          ))}
        </View>
        <View style={s.controlRow}>
          <HeaderButton label={torchEnabled ? 'Torch on' : 'Torch'} icon={torchEnabled ? 'flashlight' : 'flashlight-outline'} disabled={torchState?.torchSupported === false} onPress={() => setTorchEnabled((value) => !value)} />
          <TDButton label="Capture" loading={processing} disabled={!cameraReady || processing} onPress={captureSingle} />
        </View>
        <TDText variant="caption" tone="muted" style={s.centerText}>Camera {selectedLensLabel}</TDText>
      </View>

      {selectedCandidate ? (
        <SingleResultSheet candidate={selectedCandidate} onAdd={addToReviewList} onRetake={retake} />
      ) : null}
      {message && !selectedCandidate ? (
        <View style={s.messageToast}>
          <TDText variant="small">{message}</TDText>
          <TDButton label="Retake" variant="secondary" onPress={retake} />
        </View>
      ) : null}
    </View>
  );
}

function SingleResultSheet({ candidate, onAdd, onRetake }: { candidate: ScannerCardCandidate; onAdd: () => void; onRetake: () => void }) {
  const market = candidate.marketPrice?.usd ?? candidate.marketPrice?.usdFoil ?? candidate.marketPrice?.usdEtched ?? null;
  const offer = market === null ? null : Math.round(market * 0.7 * 100) / 100;
  return (
    <TDCard style={s.resultSheet}>
      {candidate.imageUrl ? <Image source={{ uri: candidate.imageUrl }} style={s.cardImage} contentFit="cover" /> : <View style={s.imageFallback}><Ionicons name="image-outline" size={24} color={color.textMuted} /></View>}
      <View style={s.resultText}>
        <TDText variant="title" numberOfLines={2}>{candidate.name}</TDText>
        <TDText variant="small" tone="muted">{candidate.setCode ?? 'Set unavailable'} #{candidate.collectorNumber ?? '?'} · {candidate.finishes.map(displayFinish).join(', ')}</TDText>
        <TDText variant="small">Market {market === null ? 'Unavailable' : `$${market.toFixed(2)}`}</TDText>
        <TDText variant="small">Offer {offer === null ? 'Unavailable' : `$${offer.toFixed(2)}`}</TDText>
      </View>
      <View style={s.resultActions}>
        <TDButton label="Add card" onPress={onAdd} />
        <TDButton label="Retake" variant="secondary" onPress={onRetake} />
      </View>
    </TDCard>
  );
}

function HeaderButton({ label, icon, disabled, onPress }: { label: string; icon: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[s.headerButton, disabled && s.disabled]}>
      <Ionicons name={icon as any} size={22} color={color.text} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#010711' },
  permissionCard: { margin: space.md, gap: space.md },
  topBar: { position: 'absolute', top: 0, left: space.sm, right: space.sm, zIndex: 30, minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  headerButton: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceFloating + 'DD' },
  disabled: { opacity: 0.42 },
  guide: { position: 'absolute', zIndex: 10 },
  corner: { position: 'absolute', top: 0, left: 0, width: 52, height: 52, borderTopWidth: 4, borderLeftWidth: 4, borderColor: color.primaryBright, borderTopLeftRadius: radius.md },
  cornerRight: { left: undefined, right: 0, borderLeftWidth: 0, borderRightWidth: 4, borderTopRightRadius: radius.md },
  cornerBottom: { top: undefined, bottom: 0, borderTopWidth: 0, borderBottomWidth: 4, borderBottomLeftRadius: radius.md },
  cornerBottomRight: { top: undefined, left: undefined, right: 0, bottom: 0, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: radius.md },
  focusReticle: { position: 'absolute', zIndex: 20, width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: color.primaryBright, backgroundColor: color.primaryBright + '18' },
  instruction: { position: 'absolute', top: '18%', left: space.lg, right: space.lg, zIndex: 20 },
  centerText: { textAlign: 'center' },
  bottomControls: { position: 'absolute', left: space.md, right: space.md, bottom: 0, zIndex: 30, gap: space.sm },
  controlRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  lensControl: { alignSelf: 'center', minHeight: 38, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 2, padding: 3, backgroundColor: color.surfaceFloating + 'DD' },
  lensButton: { minWidth: 42, minHeight: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  lensButtonActive: { backgroundColor: color.primaryBright },
  resultSheet: { position: 'absolute', left: space.md, right: space.md, bottom: space.lg, zIndex: 40, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.surfaceFloating + 'F8' },
  cardImage: { width: 72, height: 102, borderRadius: radius.sm, backgroundColor: color.surface },
  imageFallback: { width: 72, height: 102, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  resultText: { flex: 1, minWidth: 0, gap: 4 },
  resultActions: { gap: space.sm },
  messageToast: { position: 'absolute', left: space.md, right: space.md, bottom: space.xl, zIndex: 40, borderRadius: radius.md, padding: space.md, gap: space.sm, backgroundColor: color.surfaceFloating + 'F8' },
});

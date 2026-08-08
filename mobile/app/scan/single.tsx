import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DockCardWell, DockSurface, TDButton, TDCard, TDText } from '@/components/design-system';
import { ScannerCamera, type ScannerCameraFrame, type ScannerCameraHandle } from '@/components/scanner-camera';
import { PrintingSelectorSheet } from '@/components/scanner/printing-selector-sheet';
import { color, radius, space } from '@/design';
import {
  addRecognitionToSession,
  calculateCardGuideLayout,
  continuousScannerSessionKey,
  createContinuousScannerSession,
  createRecognitionPipelineReport,
  scannerModeLabel,
  type ContinuousScannerSession,
} from '@/services/continuous-offer-scanner';
import type { CardFinish } from '@/services/collector-workspace';
import { defaultFinishForPrinting, finishLabel, supportedVisibleFinishes } from '@/services/exact-printing-recognition';
import { recognizeMagicStillCapture, type CropRect, type MagicStillScanCropDiagnostics, type MagicStillScanResult } from '@/services/magic-ocr-pipeline';
import { loadScannerContext } from '@/services/scanner-data';
import { resolveScannerPermissionState, type ScannerCardCandidate, type ScannerPermissionState } from '@/services/scanner-foundation';
import {
  SINGLE_SCAN_FOCUS_SETTLE_MS,
  createSingleScanQualityAnalyzer,
  resolveSingleScanCaptureQuality,
  singleScanUserFacingFailure,
  type SingleScanCaptureQuality,
} from '@/services/single-scan-capture-quality';
import { appStorage } from '@/services/storage/app-storage';
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
import {
  createScannerCaptureDiagnostic,
  resolveScannerManualCapturePolicy,
  type ScannerCaptureDiagnostic,
} from '@/services/scanner-capture-policy';
import { selectScryfallScannerPrice } from '@/services/scanner-price-enrichment';
import { resolveSingleScanReadiness, shouldEmitReadyHaptic, type ScannerReadinessTone } from '@/services/scanner-readiness';

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
  const [lastCaptureId, setLastCaptureId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quality, setQuality] = useState<SingleScanCaptureQuality>(() => resolveSingleScanCaptureQuality(null, { cameraReady: false, focusSettling: false }));
  const [lastCaptureDiagnostic, setLastCaptureDiagnostic] = useState<ScannerCaptureDiagnostic | null>(null);
  const [diagnosticCaptureUri, setDiagnosticCaptureUri] = useState<string | null>(null);
  const [cropDiagnostics, setCropDiagnostics] = useState<MagicStillScanCropDiagnostics | null>(null);
  const [correctedCandidate, setCorrectedCandidate] = useState<ScannerCardCandidate | null>(null);
  const [selectedFinish, setSelectedFinish] = useState<CardFinish>('normal');
  const [printingSelectorOpen, setPrintingSelectorOpen] = useState(false);
  const focusSettlingUntilRef = useRef(0);
  const activeCaptureIdRef = useRef<string | null>(null);
  const previousReadinessStateRef = useRef<ReturnType<typeof resolveSingleScanReadiness>['state'] | null>(null);

  const guideLayout = useMemo(() => calculateCardGuideLayout({
    containerWidth: width,
    containerHeight: height,
    safeTop: insets.top + 72,
    safeBottom: insets.bottom + 132,
    reservedVerticalSpace: 72,
  }), [height, insets.bottom, insets.top, width]);
  const supportedLensOptions = lensOptions.filter((option) => option.supported);
  const selectedLensLabel = supportedLensOptions.find((option) => option.mode === lensMode)?.label ?? SCANNER_CAMERA_LENS_LABELS[lensMode].label;
  const recognizedCandidate = result?.ok ? result.selected ?? result.candidates[0] ?? null : null;
  const selectedCandidate = correctedCandidate ?? recognizedCandidate;
  const qualityAnalyzer = useMemo(() => createSingleScanQualityAnalyzer({
    view: { width, height },
    guide: guideLayout,
  }), [guideLayout, height, width]);
  const currentQuality = quality;
  const readiness = resolveSingleScanReadiness({ quality: currentQuality, stage });
  const manualCapturePolicy = resolveScannerManualCapturePolicy({
    cameraInitialized: cameraReady,
    permissionGranted: permission === 'granted',
    appForegrounded: true,
    processing,
  });
  const canCapture = manualCapturePolicy.canCapture;

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
    const manualPolicy = resolveScannerManualCapturePolicy({
      cameraInitialized: cameraReady,
      permissionGranted: permission === 'granted',
      appForegrounded: true,
      processing,
    });
    if (!cameraRef.current || !manualPolicy.canCapture) return;
    const captureQuality = resolveSingleScanCaptureQuality(quality.vision, { cameraReady, focusSettling: Date.now() < focusSettlingUntilRef.current });
    const captureDiagnostic = createScannerCaptureDiagnostic({ trigger: 'manual', quality: captureQuality });
    setQuality(captureQuality);
    setLastCaptureDiagnostic(captureDiagnostic);
    setProcessing(true);
    setMessage(null);
    setStage('reading');
    try {
      const context = await loadScannerContext();
      const captureId = createScanId();
      activeCaptureIdRef.current = captureId;
      setLastCaptureId(captureId);
      const photo = await cameraRef.current.capturePhoto();
      const scan = await recognizeMagicStillCapture({
        imageUri: photo.uri,
        preview: { width, height },
        image: { width: photo.width, height: photo.height },
        guide: guideLayout,
        online: true,
        cachedCandidates: [],
        sequentialTitleOcr: true,
        includeCollectorOcr: true,
        deferCleanup: isDevelopmentDiagnostics(),
        onStage: (nextStage) => setStage(nextStage === 'reading_title' ? 'reading' : 'matching'),
      });
      if (activeCaptureIdRef.current !== captureId) return;
      if (isDevelopmentDiagnostics()) {
        setDiagnosticCaptureUri(photo.uri);
        setCropDiagnostics(scan.cropDiagnostics ?? null);
      }
      setResult(scan);
      if (scan.ok) {
        const nextCandidate = scan.selected ?? scan.candidates[0] ?? null;
        setCorrectedCandidate(null);
        setSelectedFinish(nextCandidate ? defaultFinishForPrinting(nextCandidate).finish : 'normal');
      }
      setStage(scan.ok ? 'result' : 'failed');
      if (scan.ok) {
        setMessage(null);
      } else {
        const friendly = singleScanUserFacingFailure(scan.reason);
        setMessage(`${friendly.title} ${friendly.message}`);
      }
      void context;
    } catch (error) {
      setStage('failed');
      const friendly = singleScanUserFacingFailure(error instanceof Error ? error.message : 'Could not scan this card.');
      setMessage(`${friendly.title} ${friendly.message}`);
    } finally {
      setProcessing(false);
    }
  }, [cameraReady, guideLayout, height, permission, processing, quality.vision, width]);

  const retake = useCallback(() => {
    activeCaptureIdRef.current = null;
    setResult(null);
    setMessage(null);
    setStage('idle');
    setCorrectedCandidate(null);
    setSelectedFinish('normal');
  }, []);

  const addToReviewList = useCallback(async () => {
    if (!result?.ok || !selectedCandidate) return;
    const context = await loadScannerContext();
    const rawSession = await appStorage.getItem(continuousScannerSessionKey(context.userId));
    const currentSession = rawSession ? parseScannerSession(rawSession, context.userId) : null;
    const session = currentSession ?? createContinuousScannerSession({
      id: createScanId(),
      userId: context.userId,
      name: scannerModeLabel('collection_intake'),
      mode: 'collection_intake',
      defaultDestination: 'collection',
    });
    const recognition = createRecognitionPipelineReport({
      detectedGame: 'magic',
      candidates: [selectedCandidate, ...result.candidates.filter((candidate) => candidate.id !== selectedCandidate.id)],
      confidence: result.recognition.confidence,
      recognitionMethod: 'metadata_assisted',
    });
    const finish = defaultFinishForPrinting(selectedCandidate, selectedFinish).finish;
    const market = selectScryfallScannerPrice(selectedCandidate, finish);
    const nextSession = addRecognitionToSession(session, {
      stableScanId: lastCaptureId ?? createScanId(),
      candidate: selectedCandidate,
      recognition,
      quantity: 1,
      condition: 'near_mint',
      finish,
      language: selectedCandidate.language,
      marketPrice: market,
      priceSource: market === null ? 'unavailable' : 'scryfall',
      priceTimestamp: selectedCandidate.marketPrice?.fetchedAt ?? null,
      destination: 'collection',
      notes: 'Added from Single Scan.',
    });
    await appStorage.setItem(continuousScannerSessionKey(context.userId), JSON.stringify(nextSession));
    setMessage('Added to Review List.');
    router.push('/scanner-session' as never);
  }, [lastCaptureId, result, selectedCandidate, selectedFinish]);

  const handleFrame = useCallback((frame: ScannerCameraFrame) => {
    setPreviewResolution((current) => current?.width === frame.previewResolution.width && current.height === frame.previewResolution.height
      ? current
      : frame.previewResolution);
    const nextQuality = qualityAnalyzer.analyzeFrame(frame);
    setQuality(resolveSingleScanCaptureQuality(nextQuality.vision, {
      cameraReady,
      focusSettling: Date.now() < focusSettlingUntilRef.current,
    }));
  }, [cameraReady, qualityAnalyzer]);

  useEffect(() => {
    qualityAnalyzer.reset();
  }, [qualityAnalyzer]);

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
    focusSettlingUntilRef.current = Date.now() + SINGLE_SCAN_FOCUS_SETTLE_MS;
    setQuality((current) => resolveSingleScanCaptureQuality(current.vision, { cameraReady, focusSettling: true }));
    setTimeout(() => setFocusReticle(null), scannerFocusReticleDuration(false));
    await cameraRef.current.focusAt(conversion.normalizedPoint);
  }, [cameraReady, deviceSummary?.supportsFocus, height, permission, previewResolution, processing, width]);

  useEffect(() => {
    if (shouldEmitReadyHaptic(previousReadinessStateRef.current, readiness.state) && Platform.OS !== 'web') {
      void Haptics.selectionAsync();
    }
    previousReadinessStateRef.current = readiness.state;
  }, [readiness.state]);

  const currentInstruction = readiness.message;
  const guideToneStyle = singleGuideToneStyle(readiness.tone);

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
        <View style={[s.corner, guideToneStyle]} />
        <View style={[s.corner, s.cornerRight, guideToneStyle]} />
        <View style={[s.corner, s.cornerBottom, guideToneStyle]} />
        <View style={[s.corner, s.cornerBottomRight, guideToneStyle]} />
      </View>
      {focusReticle ? <View pointerEvents="none" style={[s.focusReticle, { left: focusReticle.x - 18, top: focusReticle.y - 18 }]} /> : null}

      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <HeaderButton label="Back" icon="chevron-back" onPress={() => router.back()} />
        <TDText variant="title" numberOfLines={1}>Single Scan</TDText>
        <HeaderButton label="Settings" icon="settings-outline" onPress={() => setSettingsOpen(true)} />
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
          <TDButton label="Capture" loading={processing} disabled={!canCapture} onPress={captureSingle} style={readiness.state === 'ready' ? s.captureReady : undefined} />
        </View>
        <TDText variant="caption" tone="muted" style={s.centerText}>Camera {selectedLensLabel} - {currentQuality.fillRatio === null ? 'align card in guide' : `${Math.round(currentQuality.fillRatio * 100)}% fill`}</TDText>
      </View>

      {selectedCandidate ? (
        <SingleResultSheet
          candidate={selectedCandidate}
          selectedFinish={selectedFinish}
          onFinishChange={setSelectedFinish}
          onAdd={addToReviewList}
          onOtherPrintings={() => setPrintingSelectorOpen(true)}
          onRetake={retake}
        />
      ) : null}
      <PrintingSelectorSheet
        visible={printingSelectorOpen}
        currentCandidate={selectedCandidate}
        currentFinish={selectedFinish}
        onClose={() => setPrintingSelectorOpen(false)}
        onSelect={(candidate, finish, fallbackMessage) => {
          setCorrectedCandidate(candidate);
          setSelectedFinish(finish);
          setPrintingSelectorOpen(false);
          if (fallbackMessage) setMessage(fallbackMessage);
        }}
      />
      {settingsOpen ? (
        <SingleSettingsSheet
          lensLabel={selectedLensLabel}
          torchLabel={torchEnabled ? 'On' : 'Off'}
          lastCaptureDiagnostic={lastCaptureDiagnostic}
          diagnosticCaptureUri={diagnosticCaptureUri}
          cropDiagnostics={cropDiagnostics}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {message && !selectedCandidate ? (
        <View style={s.messageToast}>
          <TDText variant="small">{message}</TDText>
          <TDButton label="Retake" variant="secondary" onPress={retake} />
          {stage === 'failed' ? <TDButton label="Search manually" variant="secondary" onPress={() => router.push('/scan/automatic' as never)} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function SingleResultSheet({
  candidate,
  selectedFinish,
  onFinishChange,
  onAdd,
  onOtherPrintings,
  onRetake,
}: {
  candidate: ScannerCardCandidate;
  selectedFinish: CardFinish;
  onFinishChange: (finish: CardFinish) => void;
  onAdd: () => void;
  onOtherPrintings: () => void;
  onRetake: () => void;
}) {
  const { width } = useWindowDimensions();
  const finishes = supportedVisibleFinishes(candidate);
  const market = selectScryfallScannerPrice(candidate, selectedFinish);
  const offer = market === null ? null : market * 0.7;
  const compact = width <= 340;
  const artStyle = compact ? s.resultArtCompact : width >= 410 ? s.resultArtLarge : s.resultArt;
  return (
    <DockSurface level="raised" style={s.resultSheet}>
      <View style={s.resultHandle} />
      <DockCardWell lifted style={s.resultArtFrame}>
        {candidate.imageUrl ? <Image source={{ uri: candidate.imageUrl }} style={artStyle} contentFit="cover" /> : <View style={[artStyle, s.imageFallback]}><Ionicons name="image-outline" size={24} color={color.textMuted} /></View>}
      </DockCardWell>
      <View style={s.resultCopy}>
        <TDText variant={compact ? 'title' : 'heading'} adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={2} style={s.resultTitle}>{candidate.name}</TDText>
        <View style={s.resultMetaRow}>
          <TDText variant="caption" tone="muted" numberOfLines={1} style={s.resultMeta}>{candidate.setCode ?? 'Set unavailable'} #{candidate.collectorNumber ?? '?'}</TDText>
          <View style={s.exactPrintingPill}>
            <TDText variant="caption" tone="muted" numberOfLines={1}>{candidate.specialPrintingLabels?.[0] ?? 'Exact printing'}</TDText>
          </View>
        </View>
        {market !== null ? (
          <View style={s.priceRow}>
            <View style={s.priceCell}>
              <TDText variant="caption" tone="muted">Market</TDText>
              <TDText variant="title">${market.toFixed(2)}</TDText>
            </View>
            <View style={s.priceDivider} />
            <View style={s.priceCell}>
              <TDText variant="caption" tone="muted">Offer</TDText>
              <TDText variant="title">${offer!.toFixed(2)}</TDText>
            </View>
          </View>
        ) : (
          <TDText variant="caption" tone="muted" style={s.resultPriceNote}>No market price for this finish.</TDText>
        )}
        <View style={s.finishBlock}>
          <TDText variant="caption" tone="muted">Finish</TDText>
          <View style={s.finishControl}>
          {finishes.map((finish) => (
            <Pressable
              key={finish}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedFinish === finish }}
              accessibilityLabel={`Use ${finishLabel(finish)} finish`}
              onPress={() => onFinishChange(finish)}
              style={[s.finishButton, selectedFinish === finish && s.finishButtonActive]}
            >
              <TDText variant="caption" tone={selectedFinish === finish ? 'primary' : 'muted'}>{finishLabel(finish)}</TDText>
            </Pressable>
          ))}
          </View>
        </View>
      </View>
      <View style={s.resultActions}>
        <TDButton label="Add card" onPress={onAdd} size="lg" iconName="add-circle-outline" style={s.addCardButton} />
        <View style={s.secondaryActions}>
          <ResultTextAction label="Other printings" onPress={onOtherPrintings} />
          <ResultTextAction label="Retake" tone="muted" onPress={onRetake} />
        </View>
      </View>
    </DockSurface>
  );
}

function ResultTextAction({ label, tone = 'primary', onPress }: { label: string; tone?: 'primary' | 'muted'; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.textAction, pressed && s.textActionPressed]}>
      <TDText variant="small" tone={tone}>{label}</TDText>
    </Pressable>
  );
}

function SingleSettingsSheet({
  lensLabel,
  torchLabel,
  lastCaptureDiagnostic,
  diagnosticCaptureUri,
  cropDiagnostics,
  onClose,
}: {
  lensLabel: string;
  torchLabel: string;
  lastCaptureDiagnostic: ScannerCaptureDiagnostic | null;
  diagnosticCaptureUri: string | null;
  cropDiagnostics: MagicStillScanCropDiagnostics | null;
  onClose: () => void;
}) {
  return (
    <TDCard style={s.settingsSheet}>
      <TDText variant="title">Single Scan Settings</TDText>
      <SettingSummaryRow label="Camera" value={lensLabel} />
      <SettingSummaryRow label="Torch" value={torchLabel} />
      <SettingSummaryRow label="Capture" value="Manual" />
      {lastCaptureDiagnostic ? (
        <SettingSummaryRow
          label="Last trigger"
          value={`${lastCaptureDiagnostic.trigger}${lastCaptureDiagnostic.forced ? ' forced' : ''} / ${lastCaptureDiagnostic.qualityReason}`}
        />
      ) : null}
      {diagnosticCaptureUri && cropDiagnostics ? <SingleCropProof imageUri={diagnosticCaptureUri} diagnostics={cropDiagnostics} /> : null}
      <TDText variant="caption" tone="muted">Automatic tuning stays in Automatic Scan. Single Scan keeps the camera surface focused on one card.</TDText>
      <TDButton label="Done" variant="secondary" onPress={onClose} />
    </TDCard>
  );
}

function SingleCropProof({ imageUri, diagnostics }: { imageUri: string; diagnostics: MagicStillScanCropDiagnostics }) {
  return (
    <View style={s.cropProof}>
      <TDText variant="label" tone="muted">Crop proof</TDText>
      <View style={s.cropImageWrap}>
        <Image source={{ uri: imageUri }} style={s.cropImage} contentFit="fill" />
        <CropBox crop={diagnostics.cardCrop} tone="card" />
        <CropBox crop={diagnostics.titleCrop} tone="title" />
        <CropBox crop={diagnostics.collectorCrop} tone="collector" />
      </View>
      <TDText variant="caption" tone="muted">
        Title {diagnostics.titleCropPixels.width} x {diagnostics.titleCropPixels.height} px - Collector {diagnostics.collectorCropPixels.width} x {diagnostics.collectorCropPixels.height} px
      </TDText>
    </View>
  );
}

function CropBox({ crop, tone }: { crop: CropRect; tone: 'card' | 'title' | 'collector' }) {
  const borderColor = tone === 'card' ? color.primaryBright : tone === 'title' ? color.success : color.warning;
  return (
    <View
      pointerEvents="none"
      style={[
        s.cropBox,
        {
          left: `${crop.x * 100}%`,
          top: `${crop.y * 100}%`,
          width: `${crop.width * 100}%`,
          height: `${crop.height * 100}%`,
          borderColor,
        },
      ]}
    />
  );
}

function SettingSummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.settingRow}>
      <TDText variant="small" tone="muted">{label}</TDText>
      <TDText variant="small">{value}</TDText>
    </View>
  );
}

function HeaderButton({ label, icon, disabled, onPress }: { label: string; icon: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[s.headerButton, disabled && s.disabled]}>
      <Ionicons name={icon as any} size={22} color={color.text} />
    </Pressable>
  );
}

function singleGuideToneStyle(tone: ScannerReadinessTone) {
  if (tone === 'emerald') return s.guideToneReady;
  if (tone === 'amber') return s.guideToneWarning;
  if (tone === 'blue') return s.guideToneReading;
  if (tone === 'coral') return s.guideToneFailure;
  return s.guideToneSearching;
}

function createScanId() {
  return globalThis.crypto?.randomUUID?.() ?? `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isDevelopmentDiagnostics() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function parseScannerSession(rawSession: string, userId: string): ContinuousScannerSession | null {
  try {
    const session = JSON.parse(rawSession) as ContinuousScannerSession;
    return session?.userId === userId ? session : null;
  } catch {
    return null;
  }
}

const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#010711' },
  permissionCard: { margin: space.md, gap: space.md },
  topBar: { position: 'absolute', top: 0, left: space.sm, right: space.sm, zIndex: 30, minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  headerButton: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceFloating + 'DD' },
  disabled: { opacity: 0.42 },
  guide: { position: 'absolute', zIndex: 10 },
  corner: { position: 'absolute', top: 0, left: 0, width: 52, height: 52, borderTopWidth: 4, borderLeftWidth: 4, borderColor: color.primaryBright, borderTopLeftRadius: radius.md },
  guideToneSearching: { borderColor: color.info },
  guideToneWarning: { borderColor: color.warning },
  guideToneReady: { borderColor: color.success },
  guideToneReading: { borderColor: color.primaryBright },
  guideToneFailure: { borderColor: color.danger },
  cornerRight: { left: undefined, right: 0, borderLeftWidth: 0, borderRightWidth: 4, borderTopRightRadius: radius.md },
  cornerBottom: { top: undefined, bottom: 0, borderTopWidth: 0, borderBottomWidth: 4, borderBottomLeftRadius: radius.md },
  cornerBottomRight: { top: undefined, left: undefined, right: 0, bottom: 0, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: radius.md },
  focusReticle: { position: 'absolute', zIndex: 20, width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: color.primaryBright, backgroundColor: color.primaryBright + '18' },
  instruction: { position: 'absolute', top: '18%', left: space.lg, right: space.lg, zIndex: 20 },
  centerText: { textAlign: 'center' },
  bottomControls: { position: 'absolute', left: space.md, right: space.md, bottom: 0, zIndex: 30, gap: space.sm },
  controlRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  captureReady: { backgroundColor: color.success, borderColor: color.success },
  lensControl: { alignSelf: 'center', minHeight: 38, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 2, padding: 3, backgroundColor: color.surfaceFloating + 'DD' },
  lensButton: { minWidth: 42, minHeight: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  lensButtonActive: { backgroundColor: color.primaryBright },
  resultSheet: { position: 'absolute', left: space.md, right: space.md, bottom: space.lg, zIndex: 40, maxHeight: '64%', paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md, gap: space.sm, alignItems: 'stretch', backgroundColor: color.surfaceFloating + 'F8' },
  resultHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: radius.pill, backgroundColor: color.borderStrong },
  settingsSheet: { position: 'absolute', left: space.md, right: space.md, bottom: space.lg, zIndex: 45, gap: space.sm, backgroundColor: color.surfaceFloating + 'F8' },
  settingRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  cropProof: { gap: space.xs },
  cropImageWrap: { width: 132, height: 176, overflow: 'hidden', borderRadius: radius.sm, backgroundColor: color.surface },
  cropImage: { width: '100%', height: '100%' },
  cropBox: { position: 'absolute', borderWidth: 2 },
  resultArtFrame: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', padding: 3 },
  resultArtCompact: { width: 112, height: 156, borderRadius: radius.object, backgroundColor: color.surface },
  resultArt: { width: 132, height: 184, borderRadius: radius.object, backgroundColor: color.surface },
  resultArtLarge: { width: 146, height: 204, borderRadius: radius.object, backgroundColor: color.surface },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  resultCopy: { minWidth: 0, gap: space.xs },
  resultTitle: { textAlign: 'center' },
  resultMetaRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  resultMeta: { flexShrink: 1, maxWidth: 150 },
  exactPrintingPill: { maxWidth: 150, minHeight: 22, borderRadius: radius.pill, paddingHorizontal: space.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  priceRow: { alignSelf: 'center', minHeight: 50, minWidth: 212, borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md, backgroundColor: color.surface + 'CC' },
  priceCell: { minWidth: 0, alignItems: 'center', gap: 2 },
  priceDivider: { width: 1, height: 28, marginHorizontal: space.md, backgroundColor: color.border },
  resultPriceNote: { textAlign: 'center' },
  finishBlock: { gap: space.xs, alignItems: 'center' },
  resultActions: { gap: space.xs },
  addCardButton: { alignSelf: 'stretch' },
  secondaryActions: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md },
  textAction: { minHeight: 44, minWidth: 96, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  textActionPressed: { backgroundColor: color.surface },
  finishControl: { minHeight: 38, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  finishButton: { minHeight: 36, minWidth: 78, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  finishButtonActive: { borderColor: color.primaryBright, backgroundColor: color.primaryBright + '24' },
  messageToast: { position: 'absolute', left: space.md, right: space.md, bottom: space.xl, zIndex: 40, borderRadius: radius.md, padding: space.md, gap: space.sm, backgroundColor: color.surfaceFloating + 'F8' },
});

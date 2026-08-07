import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, View, type AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TDButton,
  TDCard,
  TDEmptyState,
  TDText,
} from '@/components/design-system';
import { ScannerCamera, type ScannerCameraFrame, type ScannerCameraHandle, type ScannerCameraSessionSummary } from '@/components/scanner-camera';
import { color, radius, space } from '@/design';
import {
  SCANNER_CAMERA_LENS_LABELS,
  appendScannerCameraEvent,
  normalizeScannerCameraLensMode,
  resolveAutoCaptureReadiness,
  scannerCameraPreferenceKey,
  type ScannerCameraDeviceSummary,
  type ScannerCameraLensMode,
  type ScannerCameraLensOption,
  type ScannerCameraLensSelection,
  type ScannerCameraQualityProfile,
  type ScannerCameraRuntimeEvent,
  type ScannerTorchState,
} from '@/services/scanner-camera-controls';
import { appStorage } from '@/services/storage/app-storage';
import {
  isScannerDiagnosticsEnabled,
  type PreviewDimensions,
} from '@/services/native-scanner-calibration';
import { isMobileDevRouteEnabled } from '@/services/mobile-release-ux';

const qaUserId = 'development-camera-qa';

export default function CameraQaScreen() {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<ScannerCameraHandle>(null);
  const [appForegrounded, setAppForegrounded] = useState(AppState.currentState === 'active');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchState, setTorchState] = useState<ScannerTorchState | null>(null);
  const [lensMode, setLensMode] = useState<ScannerCameraLensMode>('auto');
  const [rawDeviceId, setRawDeviceId] = useState<string | null>(null);
  const [lensOptions, setLensOptions] = useState<ScannerCameraLensOption[]>([]);
  const [cameraInventory, setCameraInventory] = useState<ScannerCameraLensSelection | null>(null);
  const [deviceSummary, setDeviceSummary] = useState<ScannerCameraDeviceSummary | null>(null);
  const [qualityProfile, setQualityProfile] = useState<ScannerCameraQualityProfile | null>(null);
  const [sessionSummary, setSessionSummary] = useState<ScannerCameraSessionSummary | null>(null);
  const [previewDimensions, setPreviewDimensions] = useState<PreviewDimensions | null>(null);
  const [events, setEvents] = useState<ScannerCameraRuntimeEvent[]>([]);
  const [frameCount, setFrameCount] = useState(0);
  const [firstFrameAt, setFirstFrameAt] = useState<number | null>(null);
  const [latestFrameAt, setLatestFrameAt] = useState<number | null>(null);

  const diagnosticsEnabled = isScannerDiagnosticsEnabled() && isMobileDevRouteEnabled('/dev/camera-qa');
  const permissionGranted = Boolean(cameraPermission?.granted);
  const supportedOptions = useMemo(() => lensOptions.filter((option) => option.supported), [lensOptions]);
  const readiness = useMemo(() => resolveAutoCaptureReadiness({
    frameCount,
    firstFrameAt,
    latestFrameAt,
    cardPresence: false,
    cornersVisible: null,
    guideFill: null,
    aspectRatio: null,
    centerOffset: null,
    blur: null,
    motion: null,
    lighting: null,
    glare: null,
    stableDurationMs: null,
    removalState: 'unavailable',
    processing: false,
    duplicateBlocked: false,
    cameraReady,
  }), [cameraReady, firstFrameAt, frameCount, latestFrameAt]);

  const logCameraEvent = useCallback((event: Omit<ScannerCameraRuntimeEvent, 'id'>) => {
    setEvents((current) => appendScannerCameraEvent(current, event));
  }, []);

  useEffect(() => {
    if (!cameraPermission) return;
    setCameraActive(cameraPermission.granted && appForegrounded);
  }, [appForegrounded, cameraPermission]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const foregrounded = nextState === 'active';
      logCameraEvent({
        at: qaNow(),
        type: 'app_state_change',
        oldValue: appForegrounded ? 'active' : 'background',
        newValue: foregrounded ? 'active' : 'background',
        reason: 'app_state',
      });
      setAppForegrounded(foregrounded);
    });
    return () => subscription.remove();
  }, [appForegrounded, logCameraEvent]);

  useEffect(() => {
    void appStorage.getItem(scannerCameraPreferenceKey(qaUserId)).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { lensMode?: unknown; rawDeviceId?: unknown };
        if (parsed.lensMode === 'raw' && typeof parsed.rawDeviceId === 'string') {
          setRawDeviceId(parsed.rawDeviceId);
          setLensMode('auto');
        } else {
          setLensMode(normalizeScannerCameraLensMode(parsed.lensMode));
        }
      } catch {
        setLensMode('auto');
      }
    });
  }, []);

  useEffect(() => {
    void appStorage.setItem(scannerCameraPreferenceKey(qaUserId), JSON.stringify(rawDeviceId ? { lensMode: 'raw', rawDeviceId } : { lensMode }));
  }, [lensMode, rawDeviceId]);

  const selectLensMode = useCallback((mode: ScannerCameraLensMode) => {
    setRawDeviceId(null);
    setLensMode(mode);
    setCameraReady(false);
    logCameraEvent({
      at: qaNow(),
      type: 'device_change',
      oldValue: rawDeviceId ?? lensMode,
      newValue: mode,
      reason: 'device_change',
    });
  }, [lensMode, logCameraEvent, rawDeviceId]);

  const selectRawDevice = useCallback((deviceId: string) => {
    setRawDeviceId(deviceId);
    setCameraReady(false);
    logCameraEvent({
      at: qaNow(),
      type: 'device_change',
      oldValue: rawDeviceId ?? lensMode,
      newValue: deviceId,
      reason: 'device_change',
    });
  }, [lensMode, logCameraEvent, rawDeviceId]);

  const cycleLensMode = useCallback(() => {
    if (!supportedOptions.length) return;
    const currentIndex = supportedOptions.findIndex((option) => option.mode === lensMode);
    const nextOption = supportedOptions[(currentIndex + 1) % supportedOptions.length] ?? supportedOptions[0];
    logCameraEvent({
      at: qaNow(),
      type: 'device_change',
      oldValue: `${rawDeviceId ?? lensMode}:${deviceSummary?.id ?? 'unavailable'}`,
      newValue: `${nextOption.mode}:${nextOption.deviceId ?? 'pending'}`,
      reason: 'device_change',
    });
    selectLensMode(nextOption.mode);
  }, [deviceSummary?.id, lensMode, logCameraEvent, rawDeviceId, selectLensMode, supportedOptions]);

  const handleFrameAnalysis = useCallback((frame: ScannerCameraFrame) => {
    setFrameCount((count) => count + 1);
    setFirstFrameAt((current) => current ?? frame.capturedAt);
    setLatestFrameAt(frame.capturedAt);
    setPreviewDimensions((current) => (
      current?.width === frame.previewResolution.width && current.height === frame.previewResolution.height
        ? current
        : frame.previewResolution
    ));
  }, []);

  if (!diagnosticsEnabled) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.shell}>
      <View style={StyleSheet.absoluteFill}>
        {permissionGranted ? (
          <ScannerCamera
            ref={cameraRef}
            active={cameraActive}
            torchEnabled={torchEnabled}
            lensMode={lensMode}
            rawDeviceId={rawDeviceId}
            appForegrounded={appForegrounded}
            focusEnabled
            userId={qaUserId}
            onReady={() => {
              setCameraReady(true);
              logCameraEvent({
                at: qaNow(),
                type: 'frame_processor_change',
                oldValue: 'initializing',
                newValue: 'ready',
                reason: 'frame_processor',
              });
            }}
            onFrameAnalysis={handleFrameAnalysis}
            onLensOptionsChange={setLensOptions}
            onCameraInventoryChange={setCameraInventory}
            onDeviceDiagnosticsChange={setDeviceSummary}
            onQualityProfileChange={setQualityProfile}
            onSessionConfigChange={setSessionSummary}
            onTorchStateChange={setTorchState}
            onPreviewStopped={() => {
              setCameraReady(false);
              logCameraEvent({
                at: qaNow(),
                type: 'frame_processor_change',
                oldValue: 'ready',
                newValue: 'stopped',
                reason: 'frame_processor',
              });
            }}
          />
        ) : (
          <View style={styles.emptyCamera}>
            <Ionicons name="camera-outline" size={36} color={color.textMuted} />
            <TDText variant="title">Camera permission required</TDText>
            <TDButton label="Grant camera access" onPress={requestCameraPermission} />
          </View>
        )}
      </View>

      <ScrollView
        style={styles.panel}
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg, gap: space.sm }}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close Camera QA" onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="close-outline" size={22} color={color.text} />
          </Pressable>
          <View style={styles.flex}>
            <TDText variant="title">Camera QA</TDText>
            <TDText variant="caption" tone="muted">Development-only camera diagnostics. OCR and scanner sessions are not used.</TDText>
          </View>
        </View>

        <TDCard style={styles.card}>
          <View style={styles.row}>
            {supportedOptions.map((option) => (
              <TDButton
                key={option.mode}
                label={option.label}
                variant={!rawDeviceId && lensMode === option.mode ? 'primary' : 'secondary'}
                onPress={() => selectLensMode(option.mode)}
              />
            ))}
          </View>
          <View style={styles.row}>
            <TDButton label={cameraActive ? 'Pause' : 'Resume'} variant="secondary" disabled={!permissionGranted} onPress={() => setCameraActive((active) => !active)} />
            <TDButton label={torchEnabled ? 'Torch off' : 'Torch on'} variant="secondary" disabled={!deviceSummary?.hasTorch} onPress={() => setTorchEnabled((enabled) => !enabled)} />
            <TDButton label="Cycle cameras" variant="secondary" disabled={supportedOptions.length < 2} onPress={cycleLensMode} />
          </View>
        </TDCard>

        <TDCard style={styles.card}>
          <Metric label="Device" value={deviceSummary?.name ?? 'unavailable'} />
          <Metric label="Device ID" value={deviceSummary?.id ?? 'unavailable'} />
          <Metric label="Physical" value={deviceSummary?.physicalDevices.join(' | ') || 'unavailable'} />
          <Metric label="Selected" value={rawDeviceId ? `Raw ${rawDeviceId}` : SCANNER_CAMERA_LENS_LABELS[lensMode].label} />
          <Metric label="Neutral zoom" value={deviceSummary?.neutralZoom === null || deviceSummary?.neutralZoom === undefined ? 'unavailable' : String(deviceSummary.neutralZoom)} />
          <Metric label="Focus distance" value={deviceSummary?.minFocusDistance === null ? 'not exposed' : String(deviceSummary?.minFocusDistance ?? 'unavailable')} />
          <Metric label="Selected format" value={sessionSummary?.selectedFormat ?? qualityProfile?.selectedFormatLabel ?? 'unavailable'} />
          <Metric label="Photo target" value={resolutionSummary(qualityProfile?.photoResolution ?? null)} />
          <Metric label="Actual photo" value={resolutionSummary(sessionSummary?.photoResolution ?? null)} />
          <Metric label="Preview" value={resolutionSummary(previewDimensions)} />
          <Metric label="FPS" value={readiness.effectiveFps === null ? 'unavailable' : `${readiness.effectiveFps} fps`} />
          <Metric label="Torch" value={`${torchState?.torchProp ?? 'off'}; flash ${torchState?.photoFlashMode ?? 'off'}`} />
          <Metric label="Auto-capture" value={`${readiness.label}: ${readiness.reasons.join(' | ') || 'ready'}`} />
        </TDCard>

        <TDCard style={styles.card}>
          <TDText variant="label" tone="muted">Rear cameras</TDText>
          {(cameraInventory?.rearDevices ?? []).map((device, index) => (
            <Pressable
              key={device.id}
              accessibilityRole="button"
              accessibilityLabel={`Select raw rear camera ${index + 1}`}
              accessibilityState={{ selected: rawDeviceId === device.id }}
              onPress={() => selectRawDevice(device.id)}
              style={[styles.rawDevice, rawDeviceId === device.id && styles.selectedDevice]}
            >
              <TDText variant="small">Camera {index + 1}</TDText>
              <TDText variant="caption" tone="muted">{device.name}</TDText>
              <TDText variant="caption" tone="muted">{device.physicalDevices.join(' | ') || 'unavailable'}</TDText>
            </Pressable>
          ))}
          {cameraInventory?.rearDevices.length ? null : <TDEmptyState title="No rear cameras yet" message="VisionCamera has not reported devices." />}
        </TDCard>

        <TDCard style={styles.card}>
          <TDText variant="label" tone="muted">Lens mappings</TDText>
          {lensOptions.map((option) => (
            <View key={option.mode} style={styles.mappingRow}>
              <TDText variant="small">{option.label}</TDText>
              <TDText variant="caption" tone="muted">
                {option.supported ? option.deviceId ?? 'device pending' : 'Unsupported'}
                {option.effectiveZoom === null ? '' : ` / ${option.effectiveZoom}x effective zoom`}
              </TDText>
              <TDText variant="caption" tone="muted">{option.mappingReason}</TDText>
            </View>
          ))}
        </TDCard>

        <TDCard style={styles.card}>
          <TDText variant="label" tone="muted">Camera events</TDText>
          {events.slice(0, 8).map((event) => (
            <TDText key={event.id} variant="caption" tone="muted">
              {Math.round(event.at)} {event.type}: {event.oldValue} -&gt; {event.newValue} ({event.reason})
            </TDText>
          ))}
        </TDCard>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <TDText variant="caption" tone="muted">{label}</TDText>
      <TDText variant="small">{value}</TDText>
    </View>
  );
}

function resolutionSummary(value: { width: number; height: number } | null | undefined) {
  return value ? `${Math.round(value.width)} x ${Math.round(value.height)}` : 'unavailable';
}

function qaNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#010711' },
  screen: { flex: 1, paddingHorizontal: space.md, backgroundColor: color.canvas },
  panel: { flex: 1, paddingHorizontal: space.md, backgroundColor: color.canvas + '33' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  iconButton: { width: 42, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceFloating + 'DD' },
  card: { gap: space.sm, backgroundColor: color.surfaceFloating + 'F2' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  metric: { minHeight: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: color.border, padding: space.sm, backgroundColor: color.canvasRaised },
  mappingRow: { minHeight: 72, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, gap: 4, backgroundColor: color.canvasRaised },
  rawDevice: { minHeight: 82, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, gap: 4, backgroundColor: color.canvasRaised },
  selectedDevice: { borderColor: color.primaryBright, backgroundColor: color.primary + '24' },
  emptyCamera: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg, backgroundColor: '#010711' },
});

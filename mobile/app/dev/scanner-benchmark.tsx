import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { TDBadge, TDButton, TDCard, TDEmptyState, TDErrorState, TDInput, TDLoadingState, TDScreen, TDText } from '@/components/design-system';
import { color, radius, space } from '@/design';
import { searchScannerPrintings } from '@/services/scanner-data';
import type { ScannerCardCandidate, ScannerPermissionState } from '@/services/scanner-foundation';
import { resolveScannerPermissionState } from '@/services/scanner-foundation';
import {
  acknowledgeBenchmarkPrivacy,
  appendBenchmarkFixture,
  createBenchmarkDataset,
  deleteBenchmarkDataset,
  editBenchmarkFixture,
  isScannerBenchmarkBuilderEnabled,
  removeBenchmarkFixture,
  retakeBenchmarkFixture,
  runBenchmarkForDataset,
  summarizeBenchmarkDataset,
  validateBenchmarkDatasetManifest,
  type BenchmarkAngle,
  type BenchmarkCardFace,
  type BenchmarkDamageState,
  type BenchmarkDataset,
  type BenchmarkLightingCondition,
  type BenchmarkSleeveStatus,
} from '@/services/scanner-benchmark-builder';
import type { MagicBenchmarkFixtureManifestEntry, MagicBenchmarkFrameType } from '@/services/magic-recognition-provider';
import { appStorage } from '@/services/storage/app-storage';

const DATASET_STORAGE_KEY = 'trading-docks-dev-scanner-benchmark-dataset-v1';

const FRAME_TYPES: MagicBenchmarkFrameType[] = ['modern_frame', 'old_border', 'borderless', 'extended_art', 'showcase', 'retro_frame', 'double_faced', 'same_name_reprint', 'foil', 'etched_foil', 'special_finish', 'sleeved_card', 'glare', 'low_light', 'angled_card', 'damaged_card', 'foreign_language', 'token', 'unsupported_card'];
const FINISHES: MagicBenchmarkFixtureManifestEntry['expectedFinish'][] = ['nonfoil', 'likely_foil', 'likely_etched', 'special_finish_candidate', 'indeterminate'];
const SLEEVES: BenchmarkSleeveStatus[] = ['unsleeved', 'single_sleeved', 'double_sleeved', 'toploader', 'unknown'];
const LIGHTING: BenchmarkLightingCondition[] = ['controlled', 'glare', 'low_light', 'mixed', 'unknown'];
const ANGLES: BenchmarkAngle[] = ['flat', 'slight_angle', 'steep_angle', 'unknown'];
const FACES: BenchmarkCardFace[] = ['front', 'back'];
const DAMAGE: BenchmarkDamageState[] = ['normal', 'damaged'];

export default function ScannerBenchmarkBuilder() {
  const enabled = isScannerBenchmarkBuilderEnabled();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [dataset, setDataset] = useState<BenchmarkDataset | null>(null);
  const [datasetName, setDatasetName] = useState('Magic Scanner Benchmark');
  const [loading, setLoading] = useState(enabled);
  const [permission, setPermission] = useState<ScannerPermissionState>('not_requested');
  const [cameraActive, setCameraActive] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<ScannerCardCandidate[]>([]);
  const [selectedPrinting, setSelectedPrinting] = useState<ScannerCardCandidate | null>(null);
  const [expectedFinish, setExpectedFinish] = useState<MagicBenchmarkFixtureManifestEntry['expectedFinish']>('nonfoil');
  const [frameType, setFrameType] = useState<MagicBenchmarkFrameType>('modern_frame');
  const [sleeveStatus, setSleeveStatus] = useState<BenchmarkSleeveStatus>('unsleeved');
  const [lightingCondition, setLightingCondition] = useState<BenchmarkLightingCondition>('controlled');
  const [angle, setAngle] = useState<BenchmarkAngle>('flat');
  const [cardFace, setCardFace] = useState<BenchmarkCardFace>('front');
  const [damageState, setDamageState] = useState<BenchmarkDamageState>('normal');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const cameraAvailable = Platform.OS !== 'web' || typeof navigator !== 'undefined';
  const summary = useMemo(() => dataset ? summarizeBenchmarkDataset(dataset) : null, [dataset]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void appStorage.getItem(DATASET_STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const parsed = JSON.parse(raw) as BenchmarkDataset;
        setDataset(parsed);
        setDatasetName(parsed.name);
      })
      .catch(() => setError('No saved benchmark dataset could be resumed.'))
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, [enabled]);

  useEffect(() => {
    const next = resolveScannerPermissionState({
      cameraAvailable,
      permissionGranted: cameraPermission?.granted,
      permissionDenied: cameraPermission ? !cameraPermission.granted && !cameraPermission.canAskAgain : false,
      requested: Boolean(cameraPermission),
    });
    setPermission(next);
    setCameraActive(next === 'granted');
  }, [cameraAvailable, cameraPermission]);

  const persist = async (next: BenchmarkDataset) => {
    setDataset(next);
    await appStorage.setItem(DATASET_STORAGE_KEY, JSON.stringify(next));
  };

  const startDataset = async () => {
    const next = createBenchmarkDataset({ name: datasetName, privacyAcknowledged: false });
    await persist(next);
    setStatus('Dataset created. Review the privacy warning before capture.');
  };

  const acknowledgePrivacy = async () => {
    if (!dataset) return;
    await persist(acknowledgeBenchmarkPrivacy(dataset));
    setStatus('Privacy acknowledged. Benchmark images stay local.');
  };

  const runSearch = async () => {
    setSearching(true);
    setError(null);
    const result = await searchScannerPrintings(query, true);
    if (result.ok) {
      setCandidates(result.candidates);
      if (!result.candidates.length) setError('No printings found. Search the exact Magic card name.');
    } else {
      setCandidates([]);
      setError(result.reason);
    }
    setSearching(false);
  };

  const requestCamera = async () => {
    setError(null);
    if (!cameraAvailable) {
      setPermission('unavailable');
      setError('Camera capture is unavailable here. Use a development device or Expo Web camera-capable browser.');
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
    if (next !== 'granted') setError('Camera permission is required for benchmark capture.');
  };

  const capture = async () => {
    setError(null);
    if (!cameraRef.current || permission !== 'granted') {
      setError('Camera is not ready.');
      return;
    }
    const photo = await cameraRef.current.takePictureAsync({ quality: 1, skipProcessing: false });
    setCapturedUri(photo.uri);
    setCameraActive(false);
  };

  const saveFixture = async () => {
    if (!dataset) return;
    const result = appendBenchmarkFixture(dataset, {
      selectedPrinting,
      expectedFinish,
      frameType,
      sleeveStatus,
      lightingCondition,
      angle,
      cardFace,
      damageState,
      notes,
      capturedImageUri: capturedUri,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await persist(result.dataset);
    setCapturedUri(null);
    setSelectedPrinting(null);
    setCandidates([]);
    setQuery('');
    setStatus(`Saved fixture ${result.fixture.id}.`);
  };

  const validateDataset = () => {
    if (!dataset) return;
    const validation = validateBenchmarkDatasetManifest(dataset);
    setError(validation.ok ? null : validation.errors.join(' '));
    setStatus(validation.ok ? 'Manifest is valid and local-only.' : null);
  };

  const runBenchmark = async () => {
    if (!dataset) return;
    const platform = Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web' ? Platform.OS : 'desktop';
    const result = await runBenchmarkForDataset(dataset, platform);
    if (!result.ok) {
      setError(result.error);
    } else if (result.mode === 'executed') {
      await persist({ ...dataset, lastBenchmarkReport: result.report });
      setStatus(`Benchmark executed. ${result.report.fixtureCount} fixture${result.report.fixtureCount === 1 ? '' : 's'} processed.`);
    } else {
      setStatus(`${result.reason} ${result.command}`);
    }
  };

  const removeFirstFixture = async () => {
    if (!dataset || !dataset.manifest.fixtures[0]) return;
    const result = removeBenchmarkFixture(dataset, dataset.manifest.fixtures[0].id);
    if (!result.ok) setError(result.error);
    else {
      await persist(result.dataset);
      setStatus(`Removed fixture and marked image for deletion: ${result.imagePathToDelete}`);
    }
  };

  const retakeFirstFixture = async () => {
    if (!dataset || !dataset.manifest.fixtures[0]) return;
    const result = retakeBenchmarkFixture(dataset, dataset.manifest.fixtures[0].id, capturedUri);
    if (!result.ok) setError(result.error);
    else {
      await persist(result.dataset);
      setCapturedUri(null);
      setStatus(`Retake saved to ${result.localImagePath}.`);
    }
  };

  const editFirstFixture = async () => {
    if (!dataset || !dataset.manifest.fixtures[0]) return;
    await persist(editBenchmarkFixture(dataset, dataset.manifest.fixtures[0].id, { notes }));
    setStatus('Fixture metadata updated.');
  };

  const deleteDataset = async () => {
    if (!dataset) return;
    const result = deleteBenchmarkDataset(dataset, deleteConfirm);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await appStorage.removeItem(DATASET_STORAGE_KEY);
    setDataset(null);
    setStatus(`Deleted local dataset ${result.datasetId}. ${result.fixturePaths.length} local image path${result.fixturePaths.length === 1 ? '' : 's'} marked for deletion.`);
  };

  if (!enabled) {
    return (
      <TDScreen style={s.screen}>
        <TDErrorState title="Benchmark builder unavailable" message="Set EXPO_PUBLIC_ENABLE_SCANNER_BENCHMARK_BUILDER=true in a development environment to use this local-only tool." />
      </TDScreen>
    );
  }

  if (loading) return <TDScreen style={s.screen}><TDLoadingState title="Loading builder" message="Checking for a local benchmark dataset." /></TDScreen>;

  return (
    <TDScreen style={s.screen}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TDText variant="label" tone="info">Development only</TDText>
          <TDText variant="display">Scanner benchmark builder</TDText>
          <TDText variant="small" tone="muted">Create private Magic fixtures for local benchmark calibration. This route is not exposed in production navigation.</TDText>
        </View>

        {error ? <TDErrorState title="Builder notice" message={error} /> : null}
        {status ? <TDCard accessibilityRole="alert" style={s.notice}><TDBadge tone="success">Status</TDBadge><TDText variant="small">{status}</TDText></TDCard> : null}

        {!dataset ? (
          <TDCard style={s.section}>
            <TDText variant="title">Start dataset</TDText>
            <TDInput label="Dataset name" value={datasetName} onChangeText={setDatasetName} />
            <TDButton label="Create dataset" onPress={startDataset} />
          </TDCard>
        ) : (
          <>
            <Dashboard summary={summary} dataset={dataset} />

            {!dataset.privacyAcknowledged ? (
              <TDCard style={s.section}>
                <TDBadge tone="warning">Privacy warning</TDBadge>
                <TDText variant="small" tone="muted">Images stay in ignored local benchmark directories. Do not upload card images, and do not save to the photo library unless explicitly requested outside this tool.</TDText>
                <TDButton label="I understand" onPress={acknowledgePrivacy} />
              </TDCard>
            ) : null}

            <TDCard style={s.section}>
              <TDText variant="title">1. Expected printing</TDText>
              <TDInput label="Magic card name" value={query} onChangeText={setQuery} leftIconName="search-outline" returnKeyType="search" onSubmitEditing={runSearch} />
              <TDButton label="Search printings" loading={searching} disabled={query.trim().length < 2} onPress={runSearch} />
              {searching ? <TDLoadingState title="Searching" message="Looking up Scryfall printings." /> : null}
              {candidates.map((candidate) => (
                <Pressable key={candidate.id} accessibilityRole="button" accessibilityState={{ selected: selectedPrinting?.id === candidate.id }} onPress={() => setSelectedPrinting(candidate)} style={[s.printing, selectedPrinting?.id === candidate.id && s.printingSelected]}>
                  {candidate.imageUrl ? <Image source={{ uri: candidate.imageUrl }} style={s.cardImage} contentFit="cover" /> : <View style={s.imageFallback}><Ionicons name="image-outline" size={20} color={color.textMuted} /></View>}
                  <View style={s.flex}>
                    <TDText variant="small">{candidate.name}</TDText>
                    <TDText variant="caption" tone="muted">{candidate.setCode ?? 'Set'} #{candidate.collectorNumber ?? '?'} - {candidate.language ?? 'language'} - {candidate.finishes.join(', ')}</TDText>
                  </View>
                </Pressable>
              ))}
            </TDCard>

            <TDCard style={s.section}>
              <TDText variant="title">2. Capture</TDText>
              {permission === 'granted' && cameraActive ? (
                <View style={s.cameraPreview}>
                  <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torchEnabled} autofocus="on" />
                  <View pointerEvents="none" style={s.cardGuide}><TDText variant="caption" tone="info">Align card edges</TDText></View>
                  <View style={s.cameraControls}>
                    <TDButton label={torchEnabled ? 'Torch off' : 'Torch on'} variant="secondary" onPress={() => setTorchEnabled((value) => !value)} />
                    <TDButton label="Capture" onPress={capture} />
                  </View>
                </View>
              ) : (
                <View style={s.captureShell}>
                  {capturedUri ? <Image source={{ uri: capturedUri }} style={s.captureImage} contentFit="contain" /> : <Ionicons name="camera-outline" size={40} color={color.textMuted} />}
                  <TDText variant="small" tone="muted">{capturedUri ? 'Review or retake before saving.' : 'Capture a local benchmark image.'}</TDText>
                  <View style={s.actions}>
                    <TDButton label={permission === 'granted' ? 'Open camera' : 'Check camera'} variant="secondary" onPress={permission === 'granted' ? () => setCameraActive(true) : requestCamera} />
                    {capturedUri ? <TDButton label="Retake first fixture" variant="secondary" onPress={retakeFirstFixture} /> : null}
                  </View>
                </View>
              )}
            </TDCard>

            <TDCard style={s.section}>
              <TDText variant="title">3. Labels</TDText>
              <OptionRow label="Category" options={FRAME_TYPES} value={frameType} onSelect={setFrameType} />
              <OptionRow label="Finish" options={FINISHES} value={expectedFinish} onSelect={setExpectedFinish} />
              <OptionRow label="Sleeve" options={SLEEVES} value={sleeveStatus} onSelect={setSleeveStatus} />
              <OptionRow label="Lighting" options={LIGHTING} value={lightingCondition} onSelect={setLightingCondition} />
              <OptionRow label="Angle" options={ANGLES} value={angle} onSelect={setAngle} />
              <OptionRow label="Face" options={FACES} value={cardFace} onSelect={setCardFace} />
              <OptionRow label="Card state" options={DAMAGE} value={damageState} onSelect={setDamageState} />
              <TDInput label="Notes" value={notes} onChangeText={setNotes} multiline />
              <TDButton label="Save fixture" disabled={!dataset.privacyAcknowledged} onPress={saveFixture} />
            </TDCard>

            <TDCard style={s.section}>
              <TDText variant="title">Dataset actions</TDText>
              <View style={s.actions}>
                <TDButton label="Validate manifest" variant="secondary" onPress={validateDataset} />
                <TDButton label="Run benchmark" variant="secondary" disabled={!summary?.benchmarkReady} onPress={runBenchmark} />
                <TDButton label="Edit first" variant="secondary" onPress={editFirstFixture} />
                <TDButton label="Remove first" variant="danger" onPress={removeFirstFixture} />
              </View>
              <TDInput label="Type dataset name to delete" value={deleteConfirm} onChangeText={setDeleteConfirm} />
              <TDButton label="Delete dataset" variant="danger" onPress={deleteDataset} />
            </TDCard>
          </>
        )}
      </ScrollView>
    </TDScreen>
  );
}

function Dashboard({ summary, dataset }: { summary: ReturnType<typeof summarizeBenchmarkDataset> | null; dataset: BenchmarkDataset }) {
  if (!summary) return <TDEmptyState title="No dataset" message="Create or resume a benchmark dataset." />;
  return (
    <TDCard style={s.section}>
      <View style={s.rowBetween}>
        <View>
          <TDText variant="title">{dataset.name}</TDText>
          <TDText variant="caption" tone="muted">{dataset.id}</TDText>
        </View>
        <TDBadge tone={summary.benchmarkReady ? 'success' : 'warning'}>{summary.benchmarkReady ? 'Ready' : 'Incomplete'}</TDBadge>
      </View>
      <View style={s.metricGrid}>
        <Metric label="Total" value={summary.totalFixtures} />
        <Metric label="Complete" value={summary.completeFixtures} />
        <Metric label="Incomplete" value={summary.incompleteFixtures} />
        <Metric label="Categories" value={summary.categoriesRepresented} />
        <Metric label="Foil" value={summary.foilFixtures} />
        <Metric label="Sleeved" value={summary.sleevedFixtures} />
        <Metric label="Difficult light" value={summary.difficultLightingFixtures} />
        <Metric label="Unsupported" value={summary.unsupportedFixtures} />
      </View>
      {summary.incompleteLabels.length ? <TDText variant="caption" tone="muted">{summary.incompleteLabels.join(' | ')}</TDText> : null}
    </TDCard>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={s.metric}><TDText variant="caption" tone="muted">{label}</TDText><TDText variant="title">{String(value)}</TDText></View>;
}

function OptionRow<T extends string>({ label, options, value, onSelect }: { label: string; options: T[]; value: T; onSelect: (value: T) => void }) {
  return (
    <View style={s.optionGroup}>
      <TDText variant="label" tone="muted">{label}</TDText>
      <View style={s.chips}>
        {options.map((option) => <Chip key={option} label={option.replaceAll('_', ' ')} selected={option === value} onPress={() => onSelect(option)} />)}
      </View>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.chip, selected && s.chipSelected]}><TDText variant="caption" tone={selected ? 'primary' : 'muted'}>{label}</TDText></Pressable>;
}

const s = StyleSheet.create({
  screen: { paddingTop: 56 },
  content: { gap: space.md, paddingBottom: 128 },
  header: { gap: space.xs },
  section: { gap: space.md },
  notice: { gap: space.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  metric: { minWidth: 96, flexGrow: 1, borderRadius: radius.sm, borderWidth: 1, borderColor: color.border, padding: space.sm, backgroundColor: color.canvasRaised },
  printing: { minHeight: 104, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.canvasRaised },
  printingSelected: { borderColor: color.primaryBright, backgroundColor: color.primary + '24' },
  cardImage: { width: 52, height: 74, borderRadius: radius.sm, backgroundColor: color.surface },
  imageFallback: { width: 52, height: 74, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  flex: { flex: 1 },
  cameraPreview: { minHeight: 360, overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, backgroundColor: color.canvasRaised },
  cardGuide: { position: 'absolute', top: 42, right: 28, bottom: 92, left: 28, borderRadius: radius.md, borderWidth: 2, borderColor: color.primaryBright, alignItems: 'center', justifyContent: 'flex-end', padding: space.sm },
  cameraControls: { position: 'absolute', right: space.sm, bottom: space.sm, left: space.sm, flexDirection: 'row', gap: space.sm, justifyContent: 'center', flexWrap: 'wrap' },
  captureShell: { minHeight: 260, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.md, backgroundColor: color.canvasRaised },
  captureImage: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: color.surface },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  optionGroup: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: { minHeight: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { borderColor: color.primaryBright, backgroundColor: color.primary + '30' },
});

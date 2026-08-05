import {
  DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS,
  TRADING_CARD_GUIDE_RATIO,
  evaluateBoundaryQuality,
  type CardBoundaryObservation,
  type ContinuousScannerThresholds,
  type ScannerGuideLayout,
} from './continuous-offer-scanner.ts';
import type { LiveFrameSample, NormalizedCardCrop } from './live-card-recognition.ts';

export type VisionRect = { x: number; y: number; width: number; height: number };
export type VisionPoint = { x: number; y: number };
export type VisionRegionName = 'title' | 'artwork' | 'set_symbol' | 'collector_number' | 'bottom_left' | 'type_line';
export type VisionCaptureState = 'detecting' | 'aligning' | 'quality_check' | 'stabilizing' | 'ready' | 'capturing' | 'frozen' | 'waiting_for_removal';
export type VisionGuideTone = 'neutral' | 'warning' | 'ready';

export type VisionDetection = {
  cardPresent: boolean;
  bounds: VisionRect | null;
  corners: [VisionCorner, VisionCorner, VisionCorner, VisionCorner];
  aspectRatio: number | null;
  rotationDegrees: number;
  perspectiveScore: number;
  fillRatio: number;
  centerOffset: { x: number; y: number; normalized: number };
  edgeVisibility: number;
  confidence: number;
  fingerprint: string | null;
};

export type VisionCorner = VisionPoint & { visible: boolean; confidence: number };

export type VisionQuality = {
  blur: number;
  motion: number;
  lighting: number;
  glare: number;
  distance: number;
  stabilityMs: number;
  confidence: number;
};

export type VisionRegionCrop = {
  name: VisionRegionName;
  bounds: VisionRect;
  confidence: number;
};

export type ScannerVisionResult = {
  frameId: string;
  observedAt: number;
  fps: number | null;
  detection: VisionDetection;
  quality: VisionQuality;
  observation: CardBoundaryObservation;
  crop: NormalizedCardCrop | null;
  regions: VisionRegionCrop[];
  guidance: string;
  captureState: VisionCaptureState;
  guideTone: VisionGuideTone;
  cornerGlow: boolean;
  readyForAutoCapture: boolean;
  shouldCapture: boolean;
  shouldRearm: boolean;
  latencyMs: number;
};

export type ScannerVisionEngineState = {
  previousFrame: LiveFrameSample | null;
  stableSince: number | null;
  lastFrameAt: number | null;
  awaitingRemoval: boolean;
  lastFingerprint: string | null;
};

export type ScannerVisionConfig = {
  guide: ScannerGuideLayout;
  thresholds: ContinuousScannerThresholds;
  aspectRatioTolerance: number;
  edgeThreshold: number;
  minCardPixelRatio: number;
};

export type ScannerVisionProviderContext = {
  frame: LiveFrameSample;
  previousFrame: LiveFrameSample | null;
  config: ScannerVisionConfig;
  now: number;
};

export type CardPresenceProvider = { detectPresence: (context: ScannerVisionProviderContext, bounds: VisionRect | null) => { present: boolean; confidence: number } };
export type CardBoundaryProvider = { detectBoundary: (context: ScannerVisionProviderContext) => Pick<VisionDetection, 'bounds' | 'corners' | 'edgeVisibility' | 'confidence'> };
export type PerspectiveProvider = { analyzePerspective: (context: ScannerVisionProviderContext, boundary: Pick<VisionDetection, 'bounds' | 'corners'>) => Pick<VisionDetection, 'aspectRatio' | 'rotationDegrees' | 'perspectiveScore' | 'fillRatio' | 'centerOffset'> };
export type MotionProvider = { analyzeMotion: (context: ScannerVisionProviderContext) => number };
export type BlurProvider = { analyzeBlur: (context: ScannerVisionProviderContext, bounds: VisionRect | null) => number };
export type LightingProvider = { analyzeLighting: (context: ScannerVisionProviderContext, bounds: VisionRect | null) => number };
export type GlareProvider = { analyzeGlare: (context: ScannerVisionProviderContext, bounds: VisionRect | null) => number };
export type CardRemovalProvider = { shouldRearm: (input: { awaitingRemoval: boolean; detection: VisionDetection; thresholds: ContinuousScannerThresholds }) => boolean };
export type RegionExtractionProvider = { extractRegions: (input: { frame: LiveFrameSample; crop: NormalizedCardCrop | null }) => VisionRegionCrop[] };
export type FrameQualityProvider = { analyzeFrame: (input: { context: ScannerVisionProviderContext; detection: VisionDetection; stabilityMs: number }) => VisionQuality };

export type ScannerVisionProviders = {
  presence: CardPresenceProvider;
  boundary: CardBoundaryProvider;
  perspective: PerspectiveProvider;
  motion: MotionProvider;
  blur: BlurProvider;
  lighting: LightingProvider;
  glare: GlareProvider;
  removal: CardRemovalProvider;
  regions: RegionExtractionProvider;
  quality: FrameQualityProvider;
};

export const DEFAULT_SCANNER_VISION_CONFIG: Omit<ScannerVisionConfig, 'guide'> = {
  thresholds: { ...DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS, requiredStabilityMs: 650, maxBlurScore: 0.55 },
  aspectRatioTolerance: 0.12,
  edgeThreshold: 34,
  minCardPixelRatio: 0.04,
};

export function createScannerVisionEngine(input: {
  config: ScannerVisionConfig;
  providers?: Partial<ScannerVisionProviders>;
  initialState?: Partial<ScannerVisionEngineState>;
}) {
  const providers = { ...defaultVisionProviders(), ...input.providers };
  if (!input.providers?.quality) {
    providers.quality = createFrameQualityProvider(providers);
  }
  let state: ScannerVisionEngineState = {
    previousFrame: null,
    stableSince: null,
    lastFrameAt: null,
    awaitingRemoval: false,
    lastFingerprint: null,
    ...input.initialState,
  };

  return {
    analyzeFrame(frame: LiveFrameSample): ScannerVisionResult {
      const startedAt = Date.now();
      validateFrame(frame);
      const context: ScannerVisionProviderContext = {
        frame,
        previousFrame: state.previousFrame,
        config: input.config,
        now: frame.capturedAt,
      };
      const boundary = providers.boundary.detectBoundary(context);
      const perspective = providers.perspective.analyzePerspective(context, boundary);
      const presence = providers.presence.detectPresence(context, boundary.bounds);
      const fingerprint = boundary.bounds ? fingerprintFrame(frame, boundary.bounds) : null;
      const detection: VisionDetection = {
        ...boundary,
        ...perspective,
        cardPresent: presence.present,
        confidence: roundScore(boundary.confidence * 0.65 + presence.confidence * 0.35),
        fingerprint,
      };
      const lowMotion = providers.motion.analyzeMotion(context);
      const previousStableSince = state.stableSince;
      const provisionalStabilityMs = detection.cardPresent && lowMotion <= input.config.thresholds.maxMotionScore
        ? Math.max(0, frame.capturedAt - (previousStableSince ?? frame.capturedAt))
        : 0;
      const quality = providers.quality.analyzeFrame({ context, detection, stabilityMs: provisionalStabilityMs });
      const stableSince = detection.cardPresent && quality.motion <= input.config.thresholds.maxMotionScore
        ? previousStableSince ?? frame.capturedAt
        : null;
      const stabilityMs = detection.cardPresent && stableSince !== null ? Math.max(0, frame.capturedAt - stableSince) : 0;
      const qualityWithStability = { ...quality, stabilityMs };
      const observation = buildBoundaryObservation(context, detection, qualityWithStability);
      const boundaryQuality = evaluateBoundaryQuality(observation, input.config.thresholds);
      const aspectRatioOk = detection.aspectRatio !== null && Math.abs(detection.aspectRatio - TRADING_CARD_GUIDE_RATIO) <= input.config.aspectRatioTolerance;
      const shouldRearm = providers.removal.shouldRearm({ awaitingRemoval: state.awaitingRemoval, detection, thresholds: input.config.thresholds });
      const blockedByRemoval = state.awaitingRemoval && !shouldRearm;
      const readyForAutoCapture = !blockedByRemoval && boundaryQuality.ready && aspectRatioOk && detection.confidence >= 0.7 && qualityWithStability.confidence >= 0.7;
      const crop = detection.bounds && detection.cardPresent ? cropFromDetection(frame, detection) : null;
      const regions = providers.regions.extractRegions({ frame, crop });
      const captureState = captureStateFor({ detection, quality: qualityWithStability, readyForAutoCapture, blockedByRemoval, thresholds: input.config.thresholds });
      const result: ScannerVisionResult = {
        frameId: frame.id,
        observedAt: frame.capturedAt,
        fps: state.lastFrameAt ? roundScore(1000 / Math.max(1, frame.capturedAt - state.lastFrameAt)) : null,
        detection,
        quality: qualityWithStability,
        observation,
        crop,
        regions,
        guidance: guidanceFor({ detection, quality: qualityWithStability, boundaryGuidance: boundaryQuality.guidance, aspectRatioOk, blockedByRemoval, readyForAutoCapture, thresholds: input.config.thresholds }),
        captureState,
        guideTone: readyForAutoCapture ? 'ready' : detection.cardPresent ? 'warning' : 'neutral',
        cornerGlow: readyForAutoCapture,
        readyForAutoCapture,
        shouldCapture: readyForAutoCapture,
        shouldRearm,
        latencyMs: Date.now() - startedAt,
      };
      state = {
        previousFrame: frame,
        stableSince: shouldRearm ? null : stableSince,
        lastFrameAt: frame.capturedAt,
        awaitingRemoval: readyForAutoCapture ? true : shouldRearm ? false : state.awaitingRemoval,
        lastFingerprint: readyForAutoCapture ? fingerprint : state.lastFingerprint,
      };
      return result;
    },
    freezeAfterCapture(fingerprint: string | null = state.lastFingerprint) {
      state = { ...state, awaitingRemoval: true, lastFingerprint: fingerprint };
    },
    resetAfterRemoval() {
      state = { ...state, awaitingRemoval: false, stableSince: null, lastFingerprint: null };
    },
    getState() {
      return { ...state };
    },
  };
}

export function defaultVisionProviders(): ScannerVisionProviders {
  const motion: MotionProvider = { analyzeMotion: ({ previousFrame, frame }) => previousFrame ? motionBetweenFrames(previousFrame, frame) : 0 };
  const blur: BlurProvider = { analyzeBlur: ({ frame }, bounds) => blurFromLaplacian(frame, bounds) };
  const lighting: LightingProvider = { analyzeLighting: ({ frame }, bounds) => lightingFromMean(frame, bounds) };
  const glare: GlareProvider = { analyzeGlare: ({ frame }, bounds) => glareFromHighlights(frame, bounds) };
  return {
    boundary: { detectBoundary },
    perspective: { analyzePerspective },
    presence: {
      detectPresence({ frame, config }, bounds) {
        const area = bounds ? bounds.width * bounds.height : 0;
        const present = Boolean(bounds && area >= frame.width * frame.height * config.minCardPixelRatio);
        return { present, confidence: present ? roundScore(Math.min(1, area / (frame.width * frame.height * config.minCardPixelRatio * 2))) : 0 };
      },
    },
    motion,
    blur,
    lighting,
    glare,
    quality: createFrameQualityProvider({ motion, blur, lighting, glare }),
    removal: {
      shouldRearm({ awaitingRemoval, detection, thresholds }) {
        return awaitingRemoval && (!detection.cardPresent || detection.fillRatio <= thresholds.cardRemovalFillRatio);
      },
    },
    regions: { extractRegions },
  };
}

function detectBoundary(context: ScannerVisionProviderContext): Pick<VisionDetection, 'bounds' | 'corners' | 'edgeVisibility' | 'confidence'> {
  const { frame, config } = context;
  let minX = frame.width;
  let minY = frame.height;
  let maxX = -1;
  let maxY = -1;
  let edgeHits = 0;
  for (let y = 1; y < frame.height - 1; y += 1) {
    for (let x = 1; x < frame.width - 1; x += 1) {
      const value = pixel(frame, x, y);
      const gradient = Math.abs(value - pixel(frame, x - 1, y))
        + Math.abs(value - pixel(frame, x + 1, y))
        + Math.abs(value - pixel(frame, x, y - 1))
        + Math.abs(value - pixel(frame, x, y + 1));
      if (gradient < config.edgeThreshold) continue;
      edgeHits += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) {
    return { bounds: null, corners: invisibleVisionCorners(), edgeVisibility: 0, confidence: 0 };
  }
  const bounds = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  const edgeVisibility = edgeVisibilityFor(frame, bounds, config.edgeThreshold);
  const confidence = roundScore(Math.min(1, edgeVisibility * 0.75 + Math.min(1, edgeHits / Math.max(1, 2 * (bounds.width + bounds.height))) * 0.25));
  return {
    bounds,
    corners: [
      visionCorner(bounds.x, bounds.y, edgeVisibility),
      visionCorner(bounds.x + bounds.width, bounds.y, edgeVisibility),
      visionCorner(bounds.x + bounds.width, bounds.y + bounds.height, edgeVisibility),
      visionCorner(bounds.x, bounds.y + bounds.height, edgeVisibility),
    ],
    edgeVisibility,
    confidence,
  };
}

function analyzePerspective(
  { frame, config }: ScannerVisionProviderContext,
  boundary: Pick<VisionDetection, 'bounds' | 'corners'>,
): Pick<VisionDetection, 'aspectRatio' | 'rotationDegrees' | 'perspectiveScore' | 'fillRatio' | 'centerOffset'> {
  if (!boundary.bounds) {
    return { aspectRatio: null, rotationDegrees: 0, perspectiveScore: 1, fillRatio: 0, centerOffset: { x: 0, y: 0, normalized: 1 } };
  }
  const bounds = boundary.bounds;
  const aspectRatio = bounds.width / bounds.height;
  const guideCenter = { x: config.guide.left + config.guide.width / 2, y: config.guide.top + config.guide.height / 2 };
  const cardCenter = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const centerOffset = {
    x: (cardCenter.x - guideCenter.x) / Math.max(1, config.guide.width / 2),
    y: (cardCenter.y - guideCenter.y) / Math.max(1, config.guide.height / 2),
    normalized: Math.min(1, Math.hypot(cardCenter.x - guideCenter.x, cardCenter.y - guideCenter.y) / Math.max(1, Math.hypot(config.guide.width / 2, config.guide.height / 2))),
  };
  const topEdge = boundary.corners[1].y - boundary.corners[0].y;
  const rotationDegrees = Math.atan2(topEdge, Math.max(1, boundary.corners[1].x - boundary.corners[0].x)) * 180 / Math.PI;
  const aspectError = Math.abs(aspectRatio - TRADING_CARD_GUIDE_RATIO) / TRADING_CARD_GUIDE_RATIO;
  const fillRatio = Math.min(1.25, Math.max(bounds.width / config.guide.width, bounds.height / config.guide.height));
  const clipped = bounds.x <= 1 || bounds.y <= 1 || bounds.x + bounds.width >= frame.width - 1 || bounds.y + bounds.height >= frame.height - 1;
  return {
    aspectRatio,
    rotationDegrees,
    perspectiveScore: roundScore(Math.min(1, aspectError + Math.abs(rotationDegrees) / 45 + (clipped ? 0.35 : 0))),
    fillRatio,
    centerOffset,
  };
}

function buildBoundaryObservation(context: ScannerVisionProviderContext, detection: VisionDetection, quality: VisionQuality): CardBoundaryObservation {
  const bounds = detection.bounds;
  const fullyInsideGuide = bounds
    ? bounds.x >= context.config.guide.left
      && bounds.y >= context.config.guide.top
      && bounds.x + bounds.width <= context.config.guide.left + context.config.guide.width
      && bounds.y + bounds.height <= context.config.guide.top + context.config.guide.height
    : false;
  return {
    corners: detection.corners.map((corner) => ({ x: corner.x, y: corner.y, visible: corner.visible })) as CardBoundaryObservation['corners'],
    fullyInsideGuide,
    guideFillRatio: detection.fillRatio,
    perspectiveScore: detection.perspectiveScore,
    motionScore: quality.motion,
    blurScore: quality.blur,
    glareScore: quality.glare,
    lightingScore: quality.lighting,
    stabilityMs: quality.stabilityMs,
    cardPresent: detection.cardPresent,
    orientation: bounds ? bounds.width > bounds.height ? 'landscape' : 'portrait' : 'unknown',
    imageFingerprint: detection.fingerprint,
    observedAt: context.frame.capturedAt,
  };
}

function cropFromDetection(frame: LiveFrameSample, detection: VisionDetection): NormalizedCardCrop | null {
  if (!detection.bounds || !detection.fingerprint) return null;
  return {
    frameId: frame.id,
    bounds: detection.bounds,
    corners: detection.corners.map((corner) => ({ x: corner.x / frame.width, y: corner.y / frame.height, visible: corner.visible })) as CardBoundaryObservation['corners'],
    orientation: detection.bounds.width > detection.bounds.height ? 'landscape' : 'portrait',
    perspectiveCorrected: detection.perspectiveScore <= 0.08,
    fingerprint: detection.fingerprint,
  };
}

function extractRegions({ crop }: { frame: LiveFrameSample; crop: NormalizedCardCrop | null }): VisionRegionCrop[] {
  if (!crop) return [];
  const regions: [VisionRegionName, VisionRect][] = [
    ['title', relativeRegion(crop.bounds, 0.08, 0.06, 0.68, 0.09)],
    ['artwork', relativeRegion(crop.bounds, 0.08, 0.18, 0.84, 0.38)],
    ['type_line', relativeRegion(crop.bounds, 0.08, 0.58, 0.84, 0.08)],
    ['set_symbol', relativeRegion(crop.bounds, 0.76, 0.58, 0.16, 0.08)],
    ['collector_number', relativeRegion(crop.bounds, 0.58, 0.9, 0.34, 0.06)],
    ['bottom_left', relativeRegion(crop.bounds, 0.06, 0.88, 0.32, 0.08)],
  ];
  return regions.map(([name, bounds]) => ({ name, bounds, confidence: crop.perspectiveCorrected ? 0.86 : 0.68 }));
}

function guidanceFor(input: {
  detection: VisionDetection;
  quality: VisionQuality;
  boundaryGuidance: string[];
  aspectRatioOk: boolean;
  blockedByRemoval: boolean;
  readyForAutoCapture: boolean;
  thresholds: ContinuousScannerThresholds;
}) {
  if (input.blockedByRemoval) return 'Remove card';
  if (!input.detection.cardPresent) return 'Place card';
  if (input.detection.fillRatio < input.thresholds.minGuideFillRatio) return 'Move closer';
  if (input.detection.fillRatio > input.thresholds.maxGuideFillRatio) return 'Move away';
  if (input.detection.centerOffset.normalized > 0.18) return input.detection.centerOffset.y > 0.08 ? 'Move card up' : 'Center card';
  if (!input.aspectRatioOk || input.detection.perspectiveScore > input.thresholds.maxPerspectiveScore) return 'Tilt slightly';
  if (input.quality.lighting < input.thresholds.minLightingScore) return 'Improve lighting';
  if (input.quality.glare > input.thresholds.maxGlareScore) return 'Reduce glare';
  if (input.quality.blur > input.thresholds.maxBlurScore) return 'Hold steady';
  if (input.quality.motion > input.thresholds.maxMotionScore) return 'Hold steady';
  if (input.readyForAutoCapture) return 'Ready';
  return input.boundaryGuidance[0] ?? 'Hold steady';
}

function captureStateFor(input: {
  detection: VisionDetection;
  quality: VisionQuality;
  readyForAutoCapture: boolean;
  blockedByRemoval: boolean;
  thresholds: ContinuousScannerThresholds;
}): VisionCaptureState {
  if (input.blockedByRemoval) return 'waiting_for_removal';
  if (!input.detection.cardPresent) return 'detecting';
  if (input.detection.edgeVisibility < 0.7 || input.detection.centerOffset.normalized > 0.18) return 'aligning';
  if (input.quality.motion > input.thresholds.maxMotionScore || input.quality.stabilityMs < input.thresholds.requiredStabilityMs) return 'stabilizing';
  if (!input.readyForAutoCapture) return 'quality_check';
  return 'ready';
}

function distanceScore(fillRatio: number, thresholds: ContinuousScannerThresholds) {
  if (fillRatio <= 0) return 0;
  if (fillRatio >= thresholds.minGuideFillRatio && fillRatio <= thresholds.maxGuideFillRatio) return 1;
  const target = (thresholds.minGuideFillRatio + thresholds.maxGuideFillRatio) / 2;
  return roundScore(Math.max(0, 1 - Math.abs(fillRatio - target) / target));
}

function edgeVisibilityFor(frame: LiveFrameSample, bounds: VisionRect, edgeThreshold: number) {
  const sampleCount = 12;
  let visible = 0;
  const checks: [number, number, number, number][] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const x = Math.round(bounds.x + (index / (sampleCount - 1)) * bounds.width);
    const y = Math.round(bounds.y + (index / (sampleCount - 1)) * bounds.height);
    checks.push(
      [x, bounds.y + 1, x, bounds.y - 1],
      [x, bounds.y + bounds.height - 2, x, bounds.y + bounds.height],
      [bounds.x + 1, y, bounds.x - 1, y],
      [bounds.x + bounds.width - 2, y, bounds.x + bounds.width, y],
    );
  }
  for (const [x1, y1, x2, y2] of checks) {
    if (Math.abs(pixel(frame, x1, y1) - pixel(frame, x2, y2)) >= edgeThreshold) visible += 1;
  }
  return roundScore(visible / checks.length);
}

function blurFromLaplacian(frame: LiveFrameSample, bounds: VisionRect | null) {
  if (!bounds) return 1;
  let total = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(Math.min(bounds.width, bounds.height) / 24));
  for (let y = bounds.y + 1; y < bounds.y + bounds.height - 1; y += step) {
    for (let x = bounds.x + 1; x < bounds.x + bounds.width - 1; x += step) {
      const center = pixel(frame, x, y) * 4;
      total += Math.abs(center - pixel(frame, x - 1, y) - pixel(frame, x + 1, y) - pixel(frame, x, y - 1) - pixel(frame, x, y + 1));
      count += 1;
    }
  }
  return roundScore(Math.max(0, Math.min(1, 1 - (count ? total / count : 0) / 80)));
}

function createFrameQualityProvider(providers: Pick<ScannerVisionProviders, 'motion' | 'blur' | 'lighting' | 'glare'>): FrameQualityProvider {
  return {
    analyzeFrame({ context, detection, stabilityMs }) {
      const bounds = detection.bounds;
      const quality = {
        blur: providers.blur.analyzeBlur(context, bounds),
        motion: providers.motion.analyzeMotion(context),
        lighting: providers.lighting.analyzeLighting(context, bounds),
        glare: providers.glare.analyzeGlare(context, bounds),
        distance: distanceScore(detection.fillRatio, context.config.thresholds),
        stabilityMs,
        confidence: 0,
      };
      quality.confidence = roundScore((1 - quality.blur) * 0.22 + (1 - quality.motion) * 0.2 + quality.lighting * 0.22 + (1 - quality.glare) * 0.18 + quality.distance * 0.18);
      return quality;
    },
  };
}

function motionBetweenFrames(previous: LiveFrameSample, current: LiveFrameSample) {
  if (previous.width !== current.width || previous.height !== current.height) return 1;
  const step = Math.max(1, Math.floor(Math.sqrt(current.width * current.height / 400)));
  let delta = 0;
  let count = 0;
  for (let y = 0; y < current.height; y += step) {
    for (let x = 0; x < current.width; x += step) {
      delta += Math.abs(pixel(previous, x, y) - pixel(current, x, y));
      count += 1;
    }
  }
  return roundScore(Math.max(0, Math.min(1, (count ? delta / count : 255) / 128)));
}

function lightingFromMean(frame: LiveFrameSample, bounds: VisionRect | null) {
  const stats = frameStats(frame, bounds);
  return roundScore(Math.max(0, Math.min(1, 1 - Math.abs(stats.mean - 136) / 136)));
}

function glareFromHighlights(frame: LiveFrameSample, bounds: VisionRect | null) {
  const stats = frameStats(frame, bounds);
  return roundScore(Math.max(0, Math.min(1, stats.highlightRatio * 4)));
}

function fingerprintFrame(frame: LiveFrameSample, bounds: VisionRect) {
  const bits: string[] = [];
  const stats = frameStats(frame, bounds);
  for (let gy = 0; gy < 8; gy += 1) {
    for (let gx = 0; gx < 8; gx += 1) {
      const x = Math.min(frame.width - 1, Math.floor(bounds.x + (gx + 0.5) * bounds.width / 8));
      const y = Math.min(frame.height - 1, Math.floor(bounds.y + (gy + 0.5) * bounds.height / 8));
      bits.push(pixel(frame, x, y) >= stats.mean ? '1' : '0');
    }
  }
  return parseInt(bits.join('').slice(0, 32), 2).toString(16).padStart(8, '0')
    + parseInt(bits.join('').slice(32), 2).toString(16).padStart(8, '0');
}

function frameStats(frame: LiveFrameSample, bounds: VisionRect | null) {
  const region = bounds ?? { x: 0, y: 0, width: frame.width, height: frame.height };
  let total = 0;
  let count = 0;
  let highlights = 0;
  const step = Math.max(1, Math.floor(Math.min(region.width, region.height) / 32));
  for (let y = region.y; y < region.y + region.height; y += step) {
    for (let x = region.x; x < region.x + region.width; x += step) {
      const value = pixel(frame, x, y);
      total += value;
      count += 1;
      if (value >= 238) highlights += 1;
    }
  }
  return { mean: count ? total / count : 0, highlightRatio: count ? highlights / count : 0 };
}

function relativeRegion(bounds: VisionRect, x: number, y: number, width: number, height: number): VisionRect {
  return {
    x: roundScore(bounds.x + bounds.width * x),
    y: roundScore(bounds.y + bounds.height * y),
    width: roundScore(bounds.width * width),
    height: roundScore(bounds.height * height),
  };
}

function visionCorner(x: number, y: number, confidence: number): VisionCorner {
  return { x, y, visible: confidence >= 0.5, confidence };
}

function invisibleVisionCorners(): [VisionCorner, VisionCorner, VisionCorner, VisionCorner] {
  return [
    { x: 0, y: 0, visible: false, confidence: 0 },
    { x: 0, y: 0, visible: false, confidence: 0 },
    { x: 0, y: 0, visible: false, confidence: 0 },
    { x: 0, y: 0, visible: false, confidence: 0 },
  ];
}

function validateFrame(frame: LiveFrameSample) {
  if (frame.pixelFormat !== 'luma8') throw new Error('Scanner vision engine supports luma8 frames only.');
  if (frame.width <= 0 || frame.height <= 0) throw new Error('Frame dimensions must be positive.');
  if (frame.pixels.length < frame.width * frame.height) throw new Error('Frame sample is shorter than its dimensions.');
}

function pixel(frame: LiveFrameSample, x: number, y: number) {
  if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return 0;
  return frame.pixels[y * frame.width + x] ?? 0;
}

function roundScore(value: number) {
  return Math.round(value * 1000) / 1000;
}

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const palette = {
  ink: '#020A12',
  panel: '#071E31',
  panelSoft: '#09243A',
  line: '#164968',
  lineSoft: '#123B57',
  white: '#F6F8FB',
  muted: '#88A1B7',
  blue: '#137CFF',
  cyan: '#26D9FF',
  mint: '#45E6B0',
  violet: '#8F7BFF',
  amber: '#FFC96B',
};

const ranges = {
  '1D': [0.22, 0.31, 0.28, 0.4, 0.47, 0.42, 0.58, 0.64, 0.61, 0.76, 0.72, 0.88],
  '7D': [0.18, 0.27, 0.24, 0.34, 0.3, 0.49, 0.45, 0.6, 0.56, 0.69, 0.73, 0.84],
  '30D': [0.16, 0.22, 0.3, 0.29, 0.41, 0.52, 0.49, 0.62, 0.67, 0.71, 0.79, 0.91],
  '90D': [0.12, 0.17, 0.23, 0.31, 0.37, 0.35, 0.48, 0.55, 0.63, 0.74, 0.81, 0.94],
  ALL: [0.08, 0.12, 0.18, 0.26, 0.32, 0.44, 0.41, 0.57, 0.66, 0.72, 0.86, 0.98],
};

type RangeKey = keyof typeof ranges;

function BrandMark({ compact = false, glow = true }: { compact?: boolean; glow?: boolean }) {
  const breathe = useSharedValue(0);
  const tilt = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
    tilt.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [breathe, tilt]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 700 },
      { rotateY: `${interpolate(tilt.value, [-1, 1], [-3, 3])}deg` },
      { rotateZ: `${interpolate(tilt.value, [-1, 1], [-1, 1])}deg` },
      { scale: interpolate(breathe.value, [0, 1], [0.99, 1.02]) },
    ],
  }));

  const auraStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.16, 0.42]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [0.9, 1.08]) }],
  }));

  const size = compact ? 58 : 124;
  return (
    <View style={[styles.markShell, { width: size, height: size }]}> 
      {glow && <Animated.View style={[styles.markAura, auraStyle]} />}
      <Animated.View style={[styles.markFrame, animatedStyle]}>
        <Image
          source={require('../assets/images/trading-docks-mark.png')}
          style={[styles.markImage, { width: size, height: size }]}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

function CinematicIntro({ onComplete }: { onComplete: () => void }) {
  const fade = useSharedValue(1);
  const rise = useSharedValue(0);

  useEffect(() => {
    rise.value = withTiming(1, { duration: 850, easing: Easing.out(Easing.cubic) });
    fade.value = withDelay(1500, withTiming(0, { duration: 450 }));
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [fade, onComplete, rise]);

  const wrapStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateY: interpolate(rise.value, [0, 1], [22, 0]) }],
  }));

  return (
    <Animated.View style={[styles.intro, wrapStyle, { pointerEvents: 'none' }]}>
      <View style={styles.introHalo} />
      <Animated.View style={[styles.introContent, contentStyle]}>
        <BrandMark />
        <Text style={styles.introSignal}>DOCKLIGHT INITIALIZED</Text>
        <Text style={styles.introBrand}>TRADING DOCKS</Text>
        <View style={styles.introProgress}><View style={styles.introProgressFill} /></View>
      </Animated.View>
    </Animated.View>
  );
}

function AmbientField() {
  const drift = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.sin) }), -1, true);
    pulse.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [drift, pulse]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [-18, 18]) },
      { translateY: interpolate(drift.value, [0, 1], [8, -18]) },
      { scale: interpolate(pulse.value, [0, 1], [0.96, 1.05]) },
    ],
    opacity: interpolate(pulse.value, [0, 1], [0.28, 0.48]),
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Animated.View style={[styles.orbPrimary, orbStyle]} />
      <View style={styles.orbSecondary} />
      <View style={styles.orbitLarge} />
      <View style={styles.orbitSmall} />
      {[...Array(14)].map((_, index) => (
        <View key={index} style={[styles.star, {
          left: 18 + ((index * 67) % Math.max(width - 36, 280)),
          top: 64 + ((index * 107) % Math.max(height - 120, 600)),
          opacity: 0.1 + (index % 4) * 0.05,
        }]} />
      ))}
    </View>
  );
}

function BrandHeader() {
  return (
    <View style={styles.brandRow}>
      <BrandMark compact glow={false} />
      <View style={styles.brandCopy}>
        <Text style={styles.brandName}>TRADING DOCKS</Text>
        <Text style={styles.brandTag}>COLLECT · KNOW · MOVE</Text>
      </View>
      <View style={styles.liveMini}>
        <View style={styles.liveMiniDot} />
        <Text style={styles.liveMiniText}>SIGNAL</Text>
      </View>
    </View>
  );
}

function CountUpValue() {
  const progress = useSharedValue(0);
  useEffect(() => { progress.value = withDelay(400, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })); }, [progress]);
  const style = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 1], [0.45, 1]), transform: [{ translateY: interpolate(progress.value, [0, 1], [8, 0]) }] }));
  return <Animated.Text style={[styles.portfolioValue, style]}>$18,214.60</Animated.Text>;
}

function Sparkline({ points }: { points: number[] }) {
  const chartWidth = Math.max(width - 88, 270);
  const chartHeight = 118;
  const step = chartWidth / (points.length - 1);
  const progress = useSharedValue(0);

  useEffect(() => { progress.value = withTiming(1, { duration: 850, easing: Easing.out(Easing.cubic) }); }, [points, progress]);

  return (
    <View style={[styles.sparkline, { width: chartWidth, height: chartHeight }]}> 
      <View style={[styles.gridLine, { top: 14 }]} />
      <View style={[styles.gridLine, { top: 58 }]} />
      <View style={[styles.gridLine, { top: 102 }]} />
      {points.slice(0, -1).map((point, index) => {
        const next = points[index + 1];
        const x1 = index * step;
        const y1 = chartHeight - 10 - point * (chartHeight - 24);
        const x2 = (index + 1) * step;
        const y2 = chartHeight - 10 - next * (chartHeight - 24);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const segmentWidth = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <Animated.View
            key={`${index}-${point}`}
            entering={FadeIn.delay(index * 30)}
            style={[styles.lineSegment, { width: segmentWidth, left: x1, top: y1, transform: [{ rotate: `${angle}deg` }] }]}
          />
        );
      })}
      {points.map((point, index) => (
        <Animated.View key={`dot-${index}`} entering={FadeIn.delay(220 + index * 28)} style={[styles.lineDot, { left: index * step - 4, top: chartHeight - 14 - point * (chartHeight - 24) }]} />
      ))}
      <View style={[styles.chartTooltip, { right: 2, top: Math.max(0, chartHeight - 72 - points[points.length - 1] * (chartHeight - 24)) }]}>
        <Text style={styles.chartTooltipLabel}>NOW</Text>
        <Text style={styles.chartTooltipValue}>+$216</Text>
      </View>
      <View style={[styles.activeHalo, { left: chartWidth - 30, top: chartHeight - 43 - points[points.length - 1] * (chartHeight - 24) }]} />
    </View>
  );
}

function PortfolioCard() {
  const [range, setRange] = useState<RangeKey>('1D');
  return (
    <Animated.View entering={FadeInDown.delay(220).duration(700)} style={styles.portfolioCard}>
      <View style={styles.cardGlow} />
      <View style={styles.portfolioHeader}>
        <View>
          <View style={styles.portfolioLabelRow}><Text style={styles.overline}>PORTFOLIO PREVIEW</Text><View style={styles.sampleBadge}><Text style={styles.sampleBadgeText}>SAMPLE DATA</Text></View></View>
          <CountUpValue />
          <Text style={styles.portfolioGain}>+$216.34 today · 1.7%</Text>
        </View>
        <View style={styles.liveValuePill}><Ionicons name="sparkles-outline" size={12} color={palette.mint}/><Text style={styles.liveValueText}>DEMO</Text></View>
      </View>
      <View style={styles.rangeRow}>
        {(Object.keys(ranges) as RangeKey[]).map((item) => (
          <Pressable key={item} onPress={() => { setRange(item); Haptics.selectionAsync(); }} style={[styles.rangeButton, range === item && styles.rangeButtonActive]}>
            <Text style={[styles.rangeText, range === item && styles.rangeTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <Sparkline points={ranges[range]} />
      <View style={styles.moversRow}>
        <View style={styles.moverItem}>
          <Text style={styles.moverLabel}>HIGHEST MOVER</Text>
          <Text style={styles.moverTitle}>Doubling Season</Text>
          <Text style={styles.moverGain}>+18.4% · +$36.82</Text>
        </View>
        <View style={styles.moverDivider} />
        <View style={styles.moverItem}>
          <Text style={styles.moverLabel}>WATCH</Text>
          <Text style={styles.moverTitle}>Rhystic Study</Text>
          <Text style={styles.moverWatch}>-4.1% today</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function MissionControl() {
  const items = [
    ['trending-up', '12 cards increased', 'Market movement worth reviewing', palette.mint],
    ['pricetag-outline', '3 listings recommended', 'Cards with strong sell timing', palette.cyan],
    ['swap-horizontal-outline', '2 profitable buylists', 'Offers above your target margin', palette.violet],
    ['cube-outline', '1 precon profitable to crack', 'Singles value exceeds sealed cost', palette.amber],
  ] as const;

  return (
    <Animated.View entering={FadeInUp.delay(380).duration(680)} style={styles.missionCard}>
      <View style={styles.missionTop}>
        <View style={styles.missionHeading}>
          <Text style={styles.overline}>HARBOR BRIEFING</Text>
          <Text style={styles.missionTitle}>Today’s next best moves</Text>
          <Text style={styles.missionSubtitle}>A concise readout of what deserves your attention.</Text>
        </View>
      </View>
      <View style={styles.missionList}>
        {items.map(([icon, label, detail, color], index) => (
          <Animated.View key={label} entering={FadeInUp.delay(430 + index * 65).duration(420)} style={styles.missionRow}>
            <View style={[styles.missionIcon, { backgroundColor: `${color}12` }]}><Ionicons name={icon} size={17} color={color} /></View>
            <View style={styles.missionCopy}>
              <Text style={styles.missionText}>{label}</Text>
              <Text style={styles.missionDetail}>{detail}</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color="#55758D" />
          </Animated.View>
        ))}
      </View>
      <View style={styles.opportunitySummary}>
        <View>
          <Text style={styles.opportunityLabel}>ESTIMATED OPPORTUNITY VALUE</Text>
          <Text style={styles.opportunityHint}>Across today’s recommended actions</Text>
        </View>
        <Text style={styles.opportunityValue}>+$482</Text>
      </View>
      <Pressable style={({ pressed }) => [styles.reviewButton, pressed && styles.pressed]} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
        <Text style={styles.reviewText}>Open today’s manifest</Text><Ionicons name="arrow-forward" size={17} color={palette.white}/>
      </Pressable>
    </Animated.View>
  );
}

function ActionCards() {
  const actions = useMemo(() => [
    { icon: 'scan-outline', label: 'Incoming', detail: 'Scan and add cards', metric: 'Camera + scanner', accent: palette.cyan },
    { icon: 'pulse-outline', label: 'Signals', detail: '7 opportunities', metric: '+$84 today', accent: palette.violet },
    { icon: 'pricetag-outline', label: 'Outbound', detail: '$418 ready to sell', metric: '31 cards', accent: palette.mint },
  ], []);

  return (
    <Animated.View entering={FadeInUp.delay(520).duration(650)} style={styles.actionRow}>
      {actions.map((action) => (
        <Pressable key={action.label} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]} onPress={() => Haptics.selectionAsync()}>
          <View style={[styles.actionIcon, { borderColor: `${action.accent}55`, backgroundColor: `${action.accent}12` }]}><Ionicons name={action.icon as never} size={19} color={action.accent} /></View>
          <Text style={styles.actionTitle}>{action.label}</Text>
          <Text style={styles.actionDetail}>{action.detail}</Text>
          <Text style={[styles.actionMetric, { color: action.accent }]}>{action.metric}</Text>
        </Pressable>
      ))}
    </Animated.View>
  );
}

function MagneticCTA({ onPress }: { onPress: () => void }) {
  const pressed = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => { pulse.value = withRepeat(withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.sin) }), -1, true); }, [pulse]);
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.98]) }] }));
  const auraStyle = useAnimatedStyle(() => ({ opacity: interpolate(pulse.value, [0, 1], [0.12, 0.34]), transform: [{ scale: interpolate(pulse.value, [0, 1], [0.94, 1.05]) }] }));

  return (
    <AnimatedPressable
      onPressIn={() => { pressed.value = withTiming(1, { duration: 90 }); Haptics.selectionAsync(); }}
      onPressOut={() => { pressed.value = withSpring(0, { damping: 12 }); }}
      onPress={onPress}
      style={[styles.cta, buttonStyle]}>
      <Animated.View style={[styles.ctaAura, auraStyle]} />
      <View style={styles.ctaCopy}>
        <Text style={styles.ctaOverline}>FREE TO START</Text>
        <Text style={styles.ctaTitle}>Get Started Free</Text>
        <Text style={styles.ctaSub}>Build your collection workspace in minutes.</Text>
      </View>
      <View style={styles.ctaArrow}><Ionicons name="arrow-forward" size={23} color={palette.white} /></View>
    </AnimatedPressable>
  );
}

export default function LandingScreen() {
  const router = useRouter();
  const [introVisible, setIntroVisible] = useState(true);
  const enter = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/welcome');
  };

  return (
    <View style={styles.screen}>
      <AmbientField />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} bounces>
          <Animated.View entering={FadeIn.duration(500)}><BrandHeader /></Animated.View>
          <Animated.View entering={FadeInDown.delay(100).duration(650)} style={styles.hero}>
            <View style={styles.signalPill}><View style={styles.signalPillDot} /><Text style={styles.signalPillText}>TODAY’S COLLECTOR BRIEFING</Text></View>
            <Text style={styles.heroTitle}>Know what matters. Before everyone else.</Text>
            <Text style={styles.heroBody}>Scan and organize your cards, track market movement, and discover what to hold, list, or sell.</Text>
          </Animated.View>
          <PortfolioCard />
          <MissionControl />
          <ActionCards />
          <Animated.View entering={FadeInUp.delay(720).duration(650)} style={styles.bottomGroup}>
            <MagneticCTA onPress={enter} />
            <Pressable onPress={enter} style={({ pressed }) => [styles.previewButton, pressed && styles.pressed]}>
              <Ionicons name="play" size={15} color={palette.cyan} /><Text style={styles.previewText}>Open the mobile foundation</Text>
            </Pressable>
            <View style={styles.trustStrip}>
              <View style={styles.trustItem}><Ionicons name="shield-checkmark-outline" size={14} color={palette.mint}/><Text style={styles.trustText}>Secure storage</Text></View>
              <View style={styles.trustDivider}/><View style={styles.trustItem}><Ionicons name="analytics-outline" size={14} color={palette.cyan}/><Text style={styles.trustText}>Market-linked insights</Text></View>
              <View style={styles.trustDivider}/><View style={styles.trustItem}><Ionicons name="gift-outline" size={14} color={palette.violet}/><Text style={styles.trustText}>Free plan</Text></View>
            </View>
            <Text style={styles.planText}>Built for collectors, sellers, and stores</Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
      {introVisible && <CinematicIntro onComplete={() => setIntroVisible(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink }, safeArea: { flex: 1 }, content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 48 },
  intro: { ...StyleSheet.absoluteFillObject, zIndex: 100, backgroundColor: '#010A12', alignItems: 'center', justifyContent: 'center' },
  introHalo: { position: 'absolute', width: 360, height: 360, borderRadius: 360, backgroundColor: '#075FA1', opacity: 0.3 }, introContent: { alignItems: 'center' },
  introSignal: { color: palette.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 3.4, marginTop: 30 }, introBrand: { color: palette.white, fontSize: 25, fontWeight: '900', letterSpacing: 5.2, marginTop: 10 },
  introProgress: { width: 136, height: 2, backgroundColor: '#15344D', marginTop: 26, overflow: 'hidden' }, introProgressFill: { width: '100%', height: 2, backgroundColor: palette.blue },
  markShell: { alignItems: 'center', justifyContent: 'center' }, markAura: { position: 'absolute', width: '118%', height: '118%', borderRadius: 34, backgroundColor: palette.cyan, shadowColor: palette.blue, shadowOpacity: 0.8, shadowRadius: 30 },
  markFrame: { borderRadius: 26, shadowColor: palette.cyan, shadowOpacity: 0.34, shadowRadius: 18, shadowOffset: { width: 0, height: 9 } }, markImage: { borderRadius: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 }, brandCopy: { marginLeft: 14, flex: 1 }, brandName: { color: palette.white, fontSize: 18, fontWeight: '900', letterSpacing: 3 }, brandTag: { color: palette.muted, fontSize: 9, fontWeight: '800', letterSpacing: 2.2, marginTop: 5 },
  liveMini: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#0A302C' }, liveMiniDot: { width: 6, height: 6, borderRadius: 6, backgroundColor: palette.mint }, liveMiniText: { color: palette.mint, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  hero: { marginTop: 30 }, signalPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#1E5E91', backgroundColor: '#08213A' }, signalPillDot: { width: 7, height: 7, borderRadius: 7, backgroundColor: palette.blue }, signalPillText: { color: palette.blue, fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  heroTitle: { color: palette.white, fontSize: 37, lineHeight: 40, fontWeight: '900', letterSpacing: -1.7, marginTop: 18, maxWidth: 405 }, heroBody: { color: palette.muted, fontSize: 15, lineHeight: 24, fontWeight: '600', marginTop: 14, maxWidth: 355 },
  portfolioCard: { marginTop: 28, borderRadius: 30, padding: 20, backgroundColor: 'rgba(8,34,56,0.98)', borderWidth: 1, borderColor: 'rgba(66,151,205,0.34)', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.38, shadowRadius: 28, shadowOffset: { width: 0, height: 18 } }, cardGlow: { position: 'absolute', width: 230, height: 230, borderRadius: 230, backgroundColor: '#0E65A8', opacity: 0.14, right: -100, top: -90 },
  portfolioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, portfolioLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, sampleBadge: { borderRadius: 999, borderWidth: 1, borderColor: '#1C5576', backgroundColor: '#09283E', paddingHorizontal: 7, paddingVertical: 4 }, sampleBadgeText: { color: '#8EB0C8', fontSize: 6.5, fontWeight: '900', letterSpacing: 0.9 }, overline: { color: palette.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 2.2 }, portfolioValue: { color: palette.white, fontSize: 40, fontWeight: '900', letterSpacing: -1.8, marginTop: 7 }, portfolioGain: { color: palette.mint, fontSize: 11, fontWeight: '800', marginTop: 3 },
  liveValuePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#0B3D33' }, liveValueText: { color: palette.mint, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  rangeRow: { flexDirection: 'row', gap: 5, marginTop: 20, padding: 4, borderRadius: 14, backgroundColor: '#061827' }, rangeButton: { flex: 1, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, rangeButtonActive: { backgroundColor: '#123B5D' }, rangeText: { color: '#66849D', fontSize: 9, fontWeight: '900' }, rangeTextActive: { color: palette.white },
  sparkline: { marginTop: 14, position: 'relative', alignSelf: 'center' }, gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: palette.lineSoft }, lineSegment: { position: 'absolute', height: 4, borderRadius: 4, backgroundColor: palette.blue, transformOrigin: 'left center', shadowColor: palette.cyan, shadowOpacity: 0.65, shadowRadius: 7 }, lineDot: { position: 'absolute', width: 8, height: 8, borderRadius: 8, backgroundColor: '#BEE8FF', borderWidth: 2, borderColor: palette.blue }, activeHalo: { position: 'absolute', width: 34, height: 34, borderRadius: 34, borderWidth: 1, borderColor: palette.cyan, opacity: 0.45 }, chartTooltip: { position: 'absolute', minWidth: 48, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, backgroundColor: '#0C263B', shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 5 } }, chartTooltipLabel: { color: '#6E8AA0', fontSize: 6, fontWeight: '900', letterSpacing: 0.9 }, chartTooltipValue: { color: palette.white, fontSize: 9, fontWeight: '900', marginTop: 1 },
  moversRow: { flexDirection: 'row', alignItems: 'stretch', borderTopWidth: 1, borderTopColor: '#17415F', paddingTop: 14, marginTop: 6 }, moverItem: { flex: 1 }, moverDivider: { width: 1, backgroundColor: '#17415F', marginHorizontal: 14 }, moverLabel: { color: '#66869F', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 }, moverTitle: { color: palette.white, fontSize: 12, fontWeight: '900', marginTop: 5 }, moverGain: { color: palette.mint, fontSize: 10, fontWeight: '800', marginTop: 4 }, moverWatch: { color: palette.amber, fontSize: 10, fontWeight: '800', marginTop: 4 },
  missionCard: { marginTop: 18, borderRadius: 28, padding: 20, backgroundColor: 'rgba(6,27,44,0.92)', shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } }, missionTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, missionHeading: { flex: 1 }, missionTitle: { color: palette.white, fontSize: 21, fontWeight: '900', letterSpacing: -0.65, marginTop: 6 }, missionSubtitle: { color: palette.muted, fontSize: 10, lineHeight: 15, fontWeight: '600', marginTop: 6 },
  missionList: { marginTop: 17 }, missionRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(71,119,151,0.18)' }, missionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, missionCopy: { flex: 1, marginLeft: 11 }, missionText: { color: palette.white, fontSize: 11, lineHeight: 15, fontWeight: '800' }, missionDetail: { color: '#7893A8', fontSize: 8.5, lineHeight: 12, fontWeight: '600', marginTop: 2 },
  opportunitySummary: { marginTop: 15, borderRadius: 17, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(10,57,49,0.72)' }, opportunityLabel: { color: '#7BD4BA', fontSize: 7, fontWeight: '900', letterSpacing: 1.15 }, opportunityValue: { color: palette.mint, fontSize: 20, fontWeight: '900' }, opportunityHint: { color: '#6F9F91', fontSize: 7.5, fontWeight: '600', marginTop: 3 },
  reviewButton: { height: 46, borderRadius: 15, marginTop: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0B579C' }, reviewText: { color: palette.white, fontSize: 11.5, fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 16 }, actionCard: { flex: 1, minHeight: 148, borderRadius: 22, backgroundColor: 'rgba(7,27,44,0.88)', padding: 13, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } }, pressed: { transform: [{ scale: 0.975 }], opacity: 0.84 }, actionIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, actionTitle: { color: palette.white, fontSize: 13, fontWeight: '900', marginTop: 12 }, actionDetail: { color: '#A2B8CA', fontSize: 10, fontWeight: '700', marginTop: 3 }, actionMetric: { fontSize: 9.5, fontWeight: '900', marginTop: 10 },
  bottomGroup: { marginTop: 20 }, cta: { minHeight: 88, borderRadius: 24, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: palette.blue, overflow: 'visible', shadowColor: palette.blue, shadowOpacity: 0.5, shadowRadius: 25, shadowOffset: { width: 0, height: 14 } }, ctaAura: { position: 'absolute', left: -6, right: -6, top: -6, bottom: -6, borderRadius: 32, borderWidth: 1, borderColor: palette.cyan }, ctaCopy: { flex: 1, paddingRight: 10 }, ctaOverline: { color: '#D7ECFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.6 }, ctaTitle: { color: palette.white, fontSize: 19, fontWeight: '900', marginTop: 5 }, ctaSub: { color: '#D7EBFF', fontSize: 10, fontWeight: '700', marginTop: 4 }, ctaArrow: { width: 44, height: 44, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  previewButton: { marginTop: 13, minHeight: 58, borderRadius: 20, borderWidth: 1, borderColor: '#17435F', backgroundColor: 'rgba(6,24,40,0.94)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, previewText: { color: palette.white, fontSize: 14, fontWeight: '800' }, trustStrip: { marginTop: 16, minHeight: 48, borderRadius: 17, borderWidth: 1, borderColor: '#123B55', backgroundColor: 'rgba(5,22,36,0.86)', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, trustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 }, trustText: { color: '#91A9BC', fontSize: 8, fontWeight: '800' }, trustDivider: { width: 1, height: 18, backgroundColor: '#173D56', marginHorizontal: 9 }, planText: { color: '#8BA3B6', fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center', marginTop: 15 },
  orbPrimary: { position: 'absolute', width: 360, height: 360, borderRadius: 360, backgroundColor: '#0D4C86', right: -170, top: -120 }, orbSecondary: { position: 'absolute', width: 250, height: 250, borderRadius: 250, backgroundColor: '#082D45', left: -150, bottom: 70, opacity: 0.72 }, orbitLarge: { position: 'absolute', width: 440, height: 440, borderRadius: 440, borderWidth: 1, borderColor: 'rgba(103,234,255,0.06)', right: -220, top: 255 }, orbitSmall: { position: 'absolute', width: 250, height: 250, borderRadius: 250, borderWidth: 1, borderColor: 'rgba(47,143,255,0.07)', left: -110, top: 610 }, star: { position: 'absolute', width: 2, height: 2, borderRadius: 2, backgroundColor: '#A7DFFF' },
});

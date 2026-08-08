import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';

import { CollectibleStack, TDText } from '@/components/design-system';
import { Logo } from '@/components/primitives';
import { color, radius, space } from '@/design';
import { buildLaunchChoreographyContract } from '@/services/signature-experience';

export function TradingDocksLaunchChoreography({ message }: { message: string }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const contract = buildLaunchChoreographyContract({ appReady: false, reduceMotion });

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: contract.targetDurationMs,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [contract.targetDurationMs, progress, reduceMotion]);

  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Trading Docks is opening" style={s.wrap}>
      <Animated.View
        style={[
          s.dockGeometry,
          !reduceMotion && {
            opacity: progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.28, 1, 1] }),
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          },
        ]}
      >
        <View style={s.track} />
        <CollectibleStack count={3} tone="scanner" style={s.stack} />
        <Logo />
        <View style={s.lightRun} />
      </Animated.View>
      <TDText variant="caption" tone="muted" style={s.message}>{message}</TDText>
    </View>
  );
}

export function SignatureSkeleton({ surface }: { surface: 'home' | 'collection' | 'decks' | 'account' | 'binder' | 'scanner' }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`${surface} loading skeleton`} style={s.skeleton}>
      <View style={s.skeletonHeader} />
      <View style={s.skeletonRail} />
      <View style={surface === 'binder' ? s.skeletonBinderGrid : s.skeletonObjects}>
        {Array.from({ length: surface === 'binder' ? 6 : 3 }).map((_, index) => (
          <View key={index} style={surface === 'collection' || surface === 'binder' ? s.skeletonObjectWide : s.skeletonObject} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md },
  dockGeometry: { width: 220, minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: space.md },
  track: { position: 'absolute', left: 18, right: 18, bottom: 52, height: 2, borderRadius: 2, backgroundColor: color.primaryBright + '55' },
  stack: { position: 'absolute', left: 16, bottom: 66 },
  lightRun: { width: 110, height: 2, borderRadius: 2, backgroundColor: color.primaryBright + '88' },
  message: { maxWidth: 260, textAlign: 'center' },
  skeleton: { gap: space.md, padding: space.md },
  skeletonHeader: { width: '54%', height: 18, borderRadius: radius.pill, backgroundColor: color.surfaceRaised },
  skeletonRail: { height: 44, borderRadius: radius.control, backgroundColor: color.canvasRaised },
  skeletonObjects: { flexDirection: 'row', gap: space.sm },
  skeletonBinderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  skeletonObject: { flex: 1, height: 138, borderRadius: radius.object, backgroundColor: color.surfaceRaised },
  skeletonObjectWide: { width: '48%', height: 108, borderRadius: radius.object, backgroundColor: color.surfaceRaised },
});

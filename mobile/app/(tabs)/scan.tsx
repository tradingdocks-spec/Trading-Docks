import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TDButton,
  TDText,
} from '@/components/design-system';
import { color, radius, space } from '@/design';
import { supabase } from '@/lib/supabase';
import { useAccount } from '@/providers/account';
import {
  continuousScannerSessionKey,
  type ContinuousScannerSession,
} from '@/services/continuous-offer-scanner';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';
import { appStorage } from '@/services/storage/app-storage';

const scanModeRows = [
  {
    id: 'automatic',
    title: 'Automatic Scan',
    description: 'Hands-free scanning for fast intake.',
    icon: 'scan-outline',
    route: '/scan/automatic',
    primary: true,
    cta: 'Start scanning',
  },
  {
    id: 'single',
    title: 'Single Scan',
    description: 'Capture and review one card.',
    icon: 'radio-button-on-outline',
    route: '/scan/single',
    primary: false,
    cta: 'Open',
  },
  {
    id: 'review',
    title: 'Review List',
    description: 'Review suggested matches and finish the session.',
    icon: 'list-outline',
    route: '/scanner-session',
    primary: false,
    cta: 'Review',
  },
] as const;

export default function ScanModesScreen() {
  const insets = useSafeAreaInsets();
  const { accountType } = useAccount();
  const bottomInset = getMobileScrollBottomInset(insets.bottom);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    void loadReviewListCount()
      .then((count) => {
        if (mounted) setReviewCount(count);
      })
      .catch(() => {
        if (mounted) setReviewCount(0);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingBottom: bottomInset }]}>
      <View style={s.header}>
        <TDText variant="label" tone="info">{accountType === 'store' ? 'Store intake' : accountType === 'seller' ? 'Seller intake' : 'Collection intake'}</TDText>
        <TDText variant="display">Scan</TDText>
        <TDText variant="small" tone="muted">Automatic Scan is the fastest path. Single Scan and Review stay close when you need control.</TDText>
      </View>

      <View style={s.modeList}>
        <PrimaryScanMode
          count={reviewCount}
          onStart={() => router.push('/scan/automatic' as never)}
          onSingle={() => router.push('/scan/single' as never)}
          onReview={() => router.push('/scanner-session' as never)}
        />
        {scanModeRows.filter((row) => !row.primary).map((row) => (
          <ScanModeRow
            key={row.id}
            title={row.title}
            description={row.description}
            icon={row.icon}
            cta={row.cta}
            count={row.id === 'review' && reviewCount > 0 ? reviewCount : null}
            onPress={() => router.push(row.route as never)}
          />
        ))}
      </View>

      <TDText variant="caption" tone="muted" style={s.footer}>
        {accountType === 'store' ? 'Store workspace' : accountType === 'seller' ? 'Seller workspace' : 'Collection workspace'}
      </TDText>
    </ScrollView>
  );
}

async function loadReviewListCount() {
  if (!supabase) return 0;
  const { data, error } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (error || !userId) return 0;
  const rawSession = await appStorage.getItem(continuousScannerSessionKey(userId));
  if (!rawSession) return 0;
  try {
    const session = JSON.parse(rawSession) as ContinuousScannerSession;
    if (session.userId !== userId) return 0;
    return session.lines.length;
  } catch {
    return 0;
  }
}

function PrimaryScanMode({
  count,
  onStart,
  onSingle,
  onReview,
}: {
  count: number;
  onStart: () => void;
  onSingle: () => void;
  onReview: () => void;
}) {
  return (
    <View style={s.primaryCard}>
      <View style={s.primaryTop}>
        <View style={s.primaryIcon}>
          <Ionicons name="scan-outline" size={26} color={color.text} />
        </View>
        <View style={s.modeText}>
          <TDText variant="heading" numberOfLines={1}>Automatic Scan</TDText>
          <TDText variant="small" tone="muted">Hands-free capture, exact-printing review, and rapid add flow.</TDText>
        </View>
      </View>
      <TDButton label="Start scanning" iconName="scan-outline" onPress={onStart} />
      <View style={s.inlineLinks}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open Single Scan" onPress={onSingle} style={({ pressed }) => [s.linkButton, pressed && s.modeRowPressed]}>
          <TDText variant="small" tone="info">Single Scan</TDText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open Review List${count > 0 ? ` with ${count} cards` : ''}`} onPress={onReview} style={({ pressed }) => [s.linkButton, pressed && s.modeRowPressed]}>
          <TDText variant="small" tone={count > 0 ? 'warning' : 'info'}>{count > 0 ? `Review ${count}` : 'Review List'}</TDText>
        </Pressable>
      </View>
    </View>
  );
}

function ScanModeRow({
  title,
  description,
  icon,
  cta,
  count,
  onPress,
}: {
  title: string;
  description: string;
  icon: string;
  cta: string;
  count: number | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => [
        s.modeRow,
        pressed && s.modeRowPressed,
      ]}
    >
      <View style={s.modeIcon}>
        <Ionicons name={icon as any} size={21} color={color.primaryBright} />
      </View>
      <View style={s.modeText}>
        <View style={s.modeTitleRow}>
          <TDText variant="title" numberOfLines={1}>{title}</TDText>
          {count ? <TDText variant="small" tone="info">{count}</TDText> : null}
        </View>
        <TDText variant="small" tone="muted" numberOfLines={1}>{description}</TDText>
      </View>
      <TDText variant="caption" tone="info">{cta}</TDText>
    </Pressable>
  );
}

const s = StyleSheet.create({
  content: {
    gap: space.md,
    paddingHorizontal: space.md,
    paddingTop: space.lg,
  },
  screen: {
    flex: 1,
    backgroundColor: color.canvas,
  },
  header: {
    gap: space.xs,
  },
  modeList: {
    gap: space.sm,
  },
  primaryCard: {
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.md,
    backgroundColor: color.primary + '20',
    borderWidth: 1,
    borderColor: color.primaryBright + '55',
  },
  primaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  primaryIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primaryBright,
  },
  inlineLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
  },
  linkButton: {
    minHeight: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  modeRow: {
    minHeight: 68,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.surfaceFloating,
  },
  modeRowPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.995 }],
  },
  modeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primary + '18',
  },
  modeText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  footer: {
    textAlign: 'center',
  },
});

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
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
  },
  {
    id: 'single',
    title: 'Single Scan',
    description: 'Capture and review one card.',
    icon: 'radio-button-on-outline',
    route: '/scan/single',
    primary: false,
  },
  {
    id: 'review',
    title: 'Review List',
    description: 'Review suggested matches and finish the session.',
    icon: 'list-outline',
    route: '/scanner-session',
    primary: false,
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
        <TDText variant="display">Scan</TDText>
        <TDText variant="small" tone="muted">Choose how Trading Docks should read cards today.</TDText>
      </View>

      <View style={s.modeList}>
        {scanModeRows.map((row) => (
          <ScanModeRow
            key={row.id}
            title={row.title}
            description={row.description}
            icon={row.icon}
            primary={row.primary}
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

function ScanModeRow({
  title,
  description,
  icon,
  primary,
  count,
  onPress,
}: {
  title: string;
  description: string;
  icon: string;
  primary?: boolean;
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
        primary && s.modeRowPrimary,
        pressed && s.modeRowPressed,
      ]}
    >
      <View style={[s.modeIcon, primary && s.modeIconPrimary]}>
        <Ionicons name={icon as any} size={22} color={primary ? color.text : color.primaryBright} />
      </View>
      <View style={s.modeText}>
        <View style={s.modeTitleRow}>
          <TDText variant="title" numberOfLines={1}>{title}</TDText>
          {count ? <TDText variant="small" tone="info">{count}</TDText> : null}
        </View>
        <TDText variant="small" tone="muted" numberOfLines={1}>{description}</TDText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={color.textMuted} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  content: {
    gap: space.lg,
    paddingHorizontal: space.md,
    paddingTop: space.xl,
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
  modeRow: {
    minHeight: 86,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.surfaceFloating,
  },
  modeRowPrimary: {
    minHeight: 96,
    backgroundColor: color.primary + '22',
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
  modeIconPrimary: {
    backgroundColor: color.primaryBright,
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

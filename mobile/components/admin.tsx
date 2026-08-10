import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TDBadge, TDIconButton, TDListRow, TDMetric, TDNavigationHeader, TDText } from '@/components/design-system';
import { color, space } from '@/design';

export function AdminTopBar({ title, eyebrow = 'COMMAND CENTER', back = false }: { title: string; eyebrow?: string; back?: boolean }) {
  return (
    <TDNavigationHeader
      eyebrow={eyebrow}
      title={title}
      subtitle="Administrative access is additive to the current workspace."
      leftAction={back ? <TDIconButton label="Back" iconName="chevron-back" onPress={() => router.back()} /> : undefined}
      rightAction={<TDBadge tone="success">Secure</TDBadge>}
    />
  );
}

export function MetricCard({
  label,
  value,
  note,
  icon,
  tone = 'blue',
}: {
  label: string;
  value: string | number;
  note: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'blue' | 'green' | 'amber' | 'red';
}) {
  const metricTone = tone === 'green' ? 'success' : tone === 'amber' ? 'warning' : tone === 'red' ? 'danger' : 'info';
  return (
    <View style={s.metric}>
      <View style={s.metricIcon}>
        <Ionicons name={icon} size={18} color={color.primaryBright} />
      </View>
      <TDMetric label={label} value={String(value)} tone={metricTone} compact style={s.metricValue} />
      <TDText variant="caption" tone="muted" style={s.metricNote}>{note}</TDText>
    </View>
  );
}

export function AdminPanel({ children, style }: PropsWithChildren<{ style?: object }>) {
  return <View style={[s.panel, style]}>{children}</View>;
}

export function AdminRow({
  icon,
  title,
  subtitle,
  onPress,
  badge,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
  badge?: string;
  right?: ReactNode;
}) {
  return (
    <TDListRow
      title={title}
      description={subtitle}
      iconName={icon}
      onPress={onPress}
      right={right ?? (
        <View style={s.rowRight}>
          {badge ? <TDBadge tone="info">{badge}</TDBadge> : null}
          {onPress ? <Ionicons name="chevron-forward" size={18} color={color.textMuted} /> : null}
        </View>
      )}
    />
  );
}

export function AdminActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.actionButton, pressed && s.pressed]}>
      <TDText variant="small" tone="info">{label}</TDText>
    </Pressable>
  );
}

const s = StyleSheet.create({
  panel: { gap: 0 },
  metric: { minHeight: 70, flex: 1, minWidth: 148, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  metricIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  metricValue: { flex: 1, minWidth: 84 },
  metricNote: { flex: 1, minWidth: 110 },
  metricNoteCompact: { maxWidth: 160 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  actionButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
});

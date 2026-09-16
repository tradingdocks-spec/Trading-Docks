import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { PropsWithChildren, ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';

import {
  tdButtonAccessibility,
  tdButtonIsDisabled,
  tdInputAccessibility,
  tdInputState,
  tdSelectableAccessibility,
  type TDBadgeTone,
  type TDButtonSize,
  type TDButtonVariant,
  type TDMetricTone,
} from '@/design/component-model';
import { color, edge, elevation, icon, radius, space, surface, type } from '@/design';

type TDButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: TDButtonVariant;
  size?: TDButtonSize;
  disabled?: boolean;
  loading?: boolean;
  iconName?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

type TDCardProps = PropsWithChildren<ViewProps & {
  variant?: 'default' | 'elevated' | 'floating' | 'outlined';
  style?: StyleProp<ViewStyle>;
}>;

type TDInputProps = TextInputProps & {
  label?: string;
  error?: string | null;
  disabled?: boolean;
  leftIconName?: keyof typeof Ionicons.glyphMap;
  rightAccessory?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

type TDTextProps = PropsWithChildren<TextProps & {
  variant?: 'display' | 'heading' | 'title' | 'body' | 'small' | 'caption' | 'label';
  tone?: 'primary' | 'secondary' | 'muted' | 'success' | 'warning' | 'danger' | 'info';
  style?: StyleProp<TextStyle>;
}>;

type TDStateProps = {
  title: string;
  message?: string;
  action?: ReactNode;
  accessibilityLabel?: string;
};

type TDChipProps = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  tone?: TDBadgeTone;
  iconName?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

type TDMetricTileProps = {
  label: string;
  value: string;
  tone?: TDMetricTone;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

type TDIconRowProps = {
  title: string;
  description?: string;
  iconName: keyof typeof Ionicons.glyphMap;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

type TDIconButtonProps = {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

type TDListRowProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  right?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

type TDSheetProps = PropsWithChildren<{
  title?: string;
  onClose?: () => void;
  style?: StyleProp<ViewStyle>;
}>;

type TDSegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  iconName?: keyof typeof Ionicons.glyphMap;
};

type TDSegmentedControlProps<T extends string> = {
  label?: string;
  options: TDSegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

type TDResultTrayProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  status?: string;
  image?: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

type TDToastProps = {
  message: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  action?: ReactNode;
};

type TDStatusIndicatorProps = {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
};

type TDNavigationHeaderProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

type TDScannerGuideProps = {
  tone?: 'neutral' | 'cyan' | 'blue' | 'success' | 'warning' | 'danger';
  progress?: number;
  style?: StyleProp<ViewStyle>;
};

type TDSessionStripProps = {
  summary: string;
  actionLabel?: string;
  onPress?: () => void;
  bottomInset?: number;
  tone?: 'neutral' | 'success' | 'warning' | 'info';
  style?: StyleProp<ViewStyle>;
};

type DockSurfaceProps = PropsWithChildren<ViewProps & {
  level?: 'dock' | 'raised';
  active?: boolean;
  tone?: 'neutral' | 'active' | 'success' | 'warning';
  material?: TradingDocksMaterialClass;
  style?: StyleProp<ViewStyle>;
}>;

type DockTrayProps = PropsWithChildren<ViewProps & {
  inset?: boolean;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

type DockRailProps = PropsWithChildren<ViewProps & {
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

type DockSegmentProps = PropsWithChildren<{
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}>;

type DockActionProps = PropsWithChildren<{
  label: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
  prominent?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}>;

type DockMetricProps = {
  label: string;
  value: string;
  tone?: 'neutral' | 'active' | 'success' | 'warning';
  style?: StyleProp<ViewStyle>;
};

type DockCardWellProps = PropsWithChildren<ViewProps & {
  lifted?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

type DockSectionProps = PropsWithChildren<ViewProps & {
  title?: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}>;

type DockHeaderProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

type CollectibleThumbnailProps = {
  title: string;
  imageUrl?: string | null;
  subtitle?: string;
  quantityLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

type CollectibleWellProps = PropsWithChildren<{
  lifted?: boolean;
  accessibilityLabel?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}>;

type CollectibleCardProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  metadata?: string;
  quantityLabel?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}>;

type CollectibleStackProps = {
  count: number;
  tone?: 'neutral' | 'decks' | 'scanner';
  style?: StyleProp<ViewStyle>;
};

type CollectibleHeroProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  subtitle?: string;
  imageUrl?: string | null;
  tone?: 'neutral' | 'decks' | 'scanner';
  style?: StyleProp<ViewStyle>;
}>;

type LocationBreadcrumbProps = {
  path: string | string[] | null | undefined;
  compact?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export const TRADING_DOCKS_MATERIAL_CLASSES = [
  'canvas',
  'structuralDock',
  'insetBay',
  'raisedControl',
  'collectibleObject',
  'activeInstrument',
] as const;

export type TradingDocksMaterialClass = typeof TRADING_DOCKS_MATERIAL_CLASSES[number];

export function TDScreen({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { width } = useWindowDimensions();
  return (
    <View style={s.screen}>
      <View style={[s.screenContent, width >= 900 && s.screenContentWide, style]}>
        {children}
      </View>
    </View>
  );
}

export function TDText({ children, variant = 'body', tone = 'primary', style, ...textProps }: TDTextProps) {
  return <Text {...textProps} style={[textStyles[variant], toneStyles[tone], style]}>{children}</Text>;
}

export function DockSurface({ children, level = 'dock', active, tone = 'neutral', material = 'structuralDock', style, ...props }: DockSurfaceProps) {
  return (
    <View
      {...props}
      style={[
        s.dockSurface,
        level === 'raised' && s.dockSurfaceRaised,
        materialStyle[material],
        active && s.dockSurfaceActive,
        dockTone[tone],
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const DockGroup = DockSurface;

export function DockTray({ children, inset = true, active, style, ...props }: DockTrayProps) {
  return (
    <View {...props} style={[s.dockTray, inset && s.dockTrayInset, active && s.dockTrayActive, style]}>
      {children}
    </View>
  );
}

export function DockRail({ children, compact, style, ...props }: DockRailProps) {
  return <View {...props} style={[s.dockRail, compact && s.dockRailCompact, style]}>{children}</View>;
}

export function DockSegment({ children, selected, disabled, onPress, accessibilityLabel, style }: DockSegmentProps) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        s.dockSegment,
        selected && s.dockSegmentSelected,
        focused && s.webFocus,
        pressed && !disabled && s.pressed,
        disabled && s.disabled,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function DockAction({ label, iconName, selected, prominent, disabled, onPress, style }: DockActionProps) {
  return (
    <DockSegment
      accessibilityLabel={label}
      selected={selected}
      disabled={disabled}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
        onPress?.();
      }}
      style={[prominent && s.dockActionProminent, style]}
    >
      {iconName ? <Ionicons name={iconName} size={prominent ? icon.lg : icon.md} color={selected || prominent ? color.text : color.primaryBright} /> : null}
      <TDText variant={prominent ? 'small' : 'caption'} tone={selected || prominent ? 'primary' : 'secondary'} numberOfLines={1}>{label}</TDText>
    </DockSegment>
  );
}

export function DockMetric({ label, value, tone = 'neutral', style }: DockMetricProps) {
  return (
    <View style={[s.dockMetric, dockMetricTone[tone], style]}>
      <TDText variant="caption" tone="muted" numberOfLines={1}>{label}</TDText>
      <TDText variant="title" numberOfLines={1}>{value}</TDText>
    </View>
  );
}

export function DockCardWell({ children, lifted, style, ...props }: DockCardWellProps) {
  return <View {...props} style={[s.dockCardWell, lifted && s.dockCardWellLifted, style]}>{children}</View>;
}

export function DockSection({ title, action, children, style, ...props }: DockSectionProps) {
  return (
    <View {...props} style={[s.dockSection, style]}>
      {title || action ? (
        <View style={s.dockSectionHeader}>
          {title ? <TDText variant="title">{title}</TDText> : <View />}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function DockHeader({ title, eyebrow, subtitle, right, style }: DockHeaderProps) {
  return (
    <View style={[s.dockHeader, style]}>
      <View style={s.dockHeaderCopy}>
        {eyebrow ? <TDText variant="caption" tone="info" numberOfLines={1}>{eyebrow}</TDText> : null}
        <TDText variant="title" numberOfLines={2}>{title}</TDText>
        {subtitle ? <TDText variant="small" tone="secondary" numberOfLines={2}>{subtitle}</TDText> : null}
      </View>
      {right}
    </View>
  );
}

export function CollectibleThumbnail({ title, imageUrl, subtitle, quantityLabel, size = 'md', style }: CollectibleThumbnailProps) {
  return (
    <View accessibilityLabel={`${title} collectible thumbnail`} accessibilityRole="image" style={[s.collectibleThumbnail, collectibleThumbnailSize[size], style]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={s.collectibleImage}
          contentFit="cover"
          transition={140}
          alt={`${title} card image`}
          accessibilityLabel={`${title} card image`}
        />
      ) : (
        <View style={s.collectiblePlaceholder}>
          <Ionicons name="image-outline" size={icon.lg} color={color.textMuted} />
          <TDText variant="caption" tone="muted" style={s.centerText}>{subtitle ?? 'Image unavailable'}</TDText>
        </View>
      )}
      {quantityLabel ? (
        <View style={s.collectibleQuantity}>
          <TDText variant="caption">{quantityLabel}</TDText>
        </View>
      ) : null}
    </View>
  );
}

export function CollectibleWell({ children, lifted, accessibilityLabel, onPress, style }: CollectibleWellProps) {
  const [focused, setFocused] = useState(false);
  const contentStyle = [s.collectibleWell, lifted && s.collectibleWellLifted, focused && s.webFocus, style];
  if (!onPress) {
    return <View accessibilityLabel={accessibilityLabel} style={contentStyle}>{children}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [contentStyle, pressed && s.collectiblePressed]}
    >
      {children}
    </Pressable>
  );
}

export function CollectibleCard({ title, subtitle, imageUrl, metadata, quantityLabel, onPress, children, style }: CollectibleCardProps) {
  return (
    <CollectibleWell accessibilityLabel={`Open ${title}`} onPress={onPress} style={[s.collectibleCard, style]}>
      <CollectibleThumbnail title={title} imageUrl={imageUrl} quantityLabel={quantityLabel} />
      <View style={s.collectibleCopy}>
        <TDText variant="small" numberOfLines={2}>{title}</TDText>
        {subtitle ? <TDText variant="caption" tone="muted" numberOfLines={1}>{subtitle}</TDText> : null}
        {metadata ? <TDText variant="caption" tone="secondary" numberOfLines={1}>{metadata}</TDText> : null}
        {children}
      </View>
    </CollectibleWell>
  );
}

export function CollectibleStack({ count, tone = 'neutral', style }: CollectibleStackProps) {
  return (
    <View accessibilityLabel={`${count} collectible objects`} accessibilityRole="image" style={[s.collectibleStack, style]}>
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          style={[
            s.collectibleStackLayer,
            tone === 'decks' && s.collectibleStackDecks,
            tone === 'scanner' && s.collectibleStackScanner,
            { transform: [{ translateX: index * 5 }, { translateY: index * -3 }] },
          ]}
        />
      ))}
      <TDText variant="caption" tone="muted" style={s.collectibleStackCount}>{count}</TDText>
    </View>
  );
}

export function CollectibleHero({ title, eyebrow, subtitle, imageUrl, tone = 'neutral', children, style }: CollectibleHeroProps) {
  return (
    <DockSurface level="raised" material="collectibleObject" style={[s.collectibleHero, tone === 'decks' && s.collectibleHeroDecks, tone === 'scanner' && s.collectibleHeroScanner, style]}>
      <View style={s.collectibleHeroLight} />
      {imageUrl ? <CollectibleThumbnail title={title} imageUrl={imageUrl} size="lg" style={s.collectibleHeroImage} /> : null}
      <View style={s.collectibleHeroCopy}>
        {eyebrow ? <TDText variant="caption" tone={tone === 'decks' ? 'warning' : 'info'} numberOfLines={1}>{eyebrow}</TDText> : null}
        <TDText variant="display" numberOfLines={2}>{title}</TDText>
        {subtitle ? <TDText variant="small" tone="muted" numberOfLines={2}>{subtitle}</TDText> : null}
        {children}
      </View>
    </DockSurface>
  );
}

export function LocationBreadcrumb({ path, compact, accessibilityLabel, style }: LocationBreadcrumbProps) {
  const parts = Array.isArray(path)
    ? path.filter(Boolean)
    : String(path ?? '').split(/[›>]/).map((part) => part.trim()).filter(Boolean);
  const visibleParts = parts.length ? parts : ['Unassigned'];
  const tone = parts.length ? 'warning' : 'muted';
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? `Location ${visibleParts.join(', ')}`}
      style={[s.locationBreadcrumb, compact && s.locationBreadcrumbCompact, !parts.length && s.locationBreadcrumbEmpty, style]}
    >
      <Ionicons name={locationIconFor(visibleParts[visibleParts.length - 1])} size={compact ? icon.xs : icon.sm} color={parts.length ? color.warning : color.textMuted} />
      <View style={s.locationBreadcrumbParts}>
        {visibleParts.map((part, index) => (
          <View key={`${part}-${index}`} style={s.locationPart}>
            {index > 0 ? <TDText variant="caption" tone="muted">›</TDText> : null}
            <TDText variant="caption" tone={tone} numberOfLines={1}>{part}</TDText>
          </View>
        ))}
      </View>
    </View>
  );
}

function locationIconFor(value: string): keyof typeof Ionicons.glyphMap {
  const normalized = value.toLowerCase();
  if (normalized.includes('binder') || normalized.includes('page')) return 'albums-outline';
  if (normalized.includes('box') || normalized.includes('container')) return 'cube-outline';
  if (normalized.includes('shelf') || normalized.includes('cabinet')) return 'file-tray-stacked-outline';
  if (normalized.includes('slot') || normalized.includes('pocket')) return 'grid-outline';
  if (normalized.includes('case')) return 'briefcase-outline';
  return 'location-outline';
}

export function TDButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  iconName,
  accessibilityLabel,
  style,
}: TDButtonProps) {
  const [focused, setFocused] = useState(false);
  const isDisabled = tdButtonIsDisabled(disabled, loading);
  const foreground = variant === 'primary' ? color.text : variant === 'danger' ? color.danger : color.primaryBright;

  const handlePress = () => {
    if (isDisabled) return;
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync();
    }
    onPress?.();
  };

  return (
    <Pressable
      {...tdButtonAccessibility(accessibilityLabel ?? label, disabled, loading)}
      disabled={isDisabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={handlePress}
      style={({ pressed }) => [
        s.button,
        buttonSize[size],
        buttonVariant[variant],
        focused && s.webFocus,
        pressed && !isDisabled && s.pressed,
        isDisabled && s.disabled,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={foreground} /> : null}
      {!loading && iconName ? <Ionicons name={iconName} size={icon.md} color={foreground} /> : null}
      <Text style={[s.buttonText, variant === 'primary' ? s.buttonTextPrimary : s.buttonTextSecondary]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TDCard({ children, variant = 'default', style, ...props }: TDCardProps) {
  return <View style={[s.card, cardVariant[variant], style]} {...props}>{children}</View>;
}

export function TDInput({
  label,
  error,
  disabled,
  leftIconName,
  rightAccessory,
  containerStyle,
  style,
  accessibilityLabel,
  ...props
}: TDInputProps) {
  const [focused, setFocused] = useState(false);
  const state = tdInputState(error, disabled);

  return (
    <View style={[s.inputWrap, containerStyle]}>
      {label ? <TDText variant="label" tone={state === 'error' ? 'danger' : 'muted'}>{label}</TDText> : null}
      <View style={[s.inputShell, focused && s.webFocus, state === 'error' && s.inputError, disabled && s.disabled]}>
        {leftIconName ? <Ionicons name={leftIconName} size={icon.md} color={state === 'error' ? color.danger : color.textMuted} /> : null}
        <TextInput
          {...tdInputAccessibility(accessibilityLabel ?? label, error, disabled)}
          {...props}
          editable={!disabled && props.editable !== false}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          placeholderTextColor={color.textMuted}
          style={[s.input, style]}
        />
        {rightAccessory}
      </View>
      {error ? <TDText variant="caption" tone="danger">{error}</TDText> : null}
    </View>
  );
}

export function TDBadge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: TDBadgeTone }>) {
  return (
    <View accessibilityRole="text" style={[s.badge, badgeTone[tone]]}>
      <Text style={[s.badgeText, badgeTextTone[tone]]}>{children}</Text>
    </View>
  );
}

export function TDChip({
  label,
  selected,
  disabled,
  onPress,
  tone = 'info',
  iconName,
  accessibilityLabel,
  style,
}: TDChipProps) {
  const [focused, setFocused] = useState(false);
  const chipTone = selected ? tone : 'neutral';
  const contentColor = selected ? badgeTextTone[tone].color : color.textMuted;
  return (
    <Pressable
      {...tdSelectableAccessibility(accessibilityLabel ?? label, selected, disabled)}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        chipToneStyle[chipTone],
        selected && s.chipSelected,
        focused && s.webFocus,
        pressed && !disabled && s.pressed,
        disabled && s.disabled,
        style,
      ]}
    >
      {iconName ? <Ionicons name={iconName} size={icon.sm} color={contentColor} /> : null}
      <Text style={[s.chipText, { color: contentColor }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function TDMetricTile({ label, value, tone = 'neutral', compact, style }: TDMetricTileProps) {
  return (
    <View style={[s.metricTile, compact && s.metricTileCompact, metricTone[tone], style]}>
      <TDText variant="caption" tone="muted">{label}</TDText>
      <TDText variant={compact ? 'small' : 'title'}>{value}</TDText>
    </View>
  );
}

export const TDMetric = TDMetricTile;

export function TDIconButton({
  label,
  iconName,
  onPress,
  selected,
  disabled,
  tone = 'neutral',
  size = 'md',
  style,
}: TDIconButtonProps) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        s.iconButton,
        iconButtonSize[size],
        iconButtonTone[tone],
        selected && s.iconButtonSelected,
        focused && s.webFocus,
        pressed && !disabled && s.pressed,
        disabled && s.disabled,
        style,
      ]}
    >
      <Ionicons name={iconName} size={size === 'lg' ? icon.lg : size === 'sm' ? icon.sm : icon.md} color={iconButtonColor(tone, selected)} />
    </Pressable>
  );
}

export function TDListRow({
  title,
  description,
  eyebrow,
  iconName,
  right,
  selected,
  disabled,
  onPress,
  accessibilityLabel,
  style,
}: TDListRowProps) {
  const [focused, setFocused] = useState(false);
  const content = (
    <>
      {iconName ? (
        <View style={[s.listRowIcon, selected && s.listRowIconSelected]}>
          <Ionicons name={iconName} size={icon.md} color={selected ? color.primaryBright : color.textMuted} />
        </View>
      ) : null}
      <View style={s.listRowCopy}>
        {eyebrow ? <TDText variant="caption" tone="muted" numberOfLines={1}>{eyebrow}</TDText> : null}
        <TDText variant="small" numberOfLines={2}>{title}</TDText>
        {description ? <TDText variant="caption" tone="muted" numberOfLines={2}>{description}</TDText> : null}
      </View>
      {right}
    </>
  );

  if (!onPress) {
    return <View style={[s.listRow, selected && s.listRowSelected, disabled && s.disabled, style]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        s.listRow,
        selected && s.listRowSelected,
        focused && s.webFocus,
        pressed && !disabled && s.pressed,
        disabled && s.disabled,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

export function TDIconRow({ title, description, iconName, right, onPress, accessibilityLabel, style }: TDIconRowProps) {
  const [focused, setFocused] = useState(false);
  const content = (
    <>
      <View style={s.iconRowIcon}>
        <Ionicons name={iconName} size={icon.md} color={color.info} />
      </View>
      <View style={s.iconRowCopy}>
        <TDText variant="small">{title}</TDText>
        {description ? <TDText variant="caption" tone="muted">{description}</TDText> : null}
      </View>
      {right}
    </>
  );

  if (!onPress) return <View style={[s.iconRow, style]}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [s.iconRow, focused && s.webFocus, pressed && s.pressed, style]}
    >
      {content}
    </Pressable>
  );
}

export function TDSectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={s.sectionHeader}>
      <TDText variant="title">{title}</TDText>
      {action}
    </View>
  );
}

export function TDNavigationHeader({ title, eyebrow, subtitle, leftAction, rightAction, style }: TDNavigationHeaderProps) {
  return (
    <View style={[s.navigationHeader, style]}>
      {leftAction}
      <View style={s.navigationHeaderCopy}>
        {eyebrow ? <TDText variant="label" tone="info" numberOfLines={1}>{eyebrow}</TDText> : null}
        <TDText variant="title" numberOfLines={2}>{title}</TDText>
        {subtitle ? <TDText variant="caption" tone="muted" numberOfLines={2}>{subtitle}</TDText> : null}
      </View>
      {rightAction}
    </View>
  );
}

export function TDSheet({ title, onClose, children, style }: TDSheetProps) {
  return (
    <TDCard variant="floating" style={[s.sheet, style]}>
      {title || onClose ? (
        <View style={s.sheetHeader}>
          {title ? <TDText variant="title">{title}</TDText> : <View />}
          {onClose ? <TDIconButton label={`Close ${title ?? 'sheet'}`} iconName="close-outline" onPress={onClose} /> : null}
        </View>
      ) : null}
      {children}
    </TDCard>
  );
}

export function TDSegmentedControl<T extends string>({ label, options, value, onChange, disabled }: TDSegmentedControlProps<T>) {
  return (
    <View style={s.segmentedWrap}>
      {label ? <TDText variant="label" tone="muted">{label}</TDText> : null}
      <View style={s.segmented} accessibilityRole="tablist">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityLabel={option.label}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [s.segment, selected && s.segmentSelected, pressed && !disabled && s.pressed, disabled && s.disabled]}
            >
              {option.iconName ? <Ionicons name={option.iconName} size={icon.sm} color={selected ? color.text : color.textMuted} /> : null}
              <Text style={[s.segmentText, selected && s.segmentTextSelected]} numberOfLines={1}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function TDResultTray({
  title,
  subtitle,
  status,
  image,
  tone = 'neutral',
  primaryAction,
  secondaryAction,
  compact,
  children,
  style,
}: TDResultTrayProps) {
  return (
    <View style={[s.resultTray, resultTrayTone[tone], compact && s.resultTrayCompact, style]}>
      {image}
      <View style={s.resultTrayCopy}>
        <View style={s.resultTrayTitleRow}>
          <TDText variant="title" numberOfLines={2}>{title}</TDText>
          {status ? <TDBadge tone={tone === 'neutral' ? 'info' : tone}>{status}</TDBadge> : null}
        </View>
        {subtitle ? <TDText variant="caption" tone="muted" numberOfLines={2}>{subtitle}</TDText> : null}
        {children}
      </View>
      {primaryAction || secondaryAction ? <View style={s.resultTrayActions}>{primaryAction}{secondaryAction}</View> : null}
    </View>
  );
}

export function TDLoadingState({ title, message, accessibilityLabel }: TDStateProps) {
  return (
    <View accessibilityLabel={accessibilityLabel ?? title} accessibilityRole="progressbar" style={s.state}>
      <ActivityIndicator color={color.primaryBright} />
      <TDText variant="title">{title}</TDText>
      {message ? <TDText variant="small" tone="muted" style={s.stateCopy}>{message}</TDText> : null}
    </View>
  );
}

export function TDSkeleton({ lines = 3, style }: { lines?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityLabel="Loading content" accessibilityRole="progressbar" style={[s.skeleton, style]}>
      {Array.from({ length: lines }).map((_, index) => (
        <View key={index} style={[s.skeletonLine, index === lines - 1 && s.skeletonLineShort]} />
      ))}
    </View>
  );
}

export function TDToast({ message, tone = 'neutral', action }: TDToastProps) {
  return (
    <View accessibilityRole={tone === 'danger' ? 'alert' : 'text'} style={[s.toast, toastTone[tone]]}>
      <TDText variant="small" style={s.toastMessage}>{message}</TDText>
      {action}
    </View>
  );
}

export function TDStatusIndicator({ label, tone = 'neutral' }: TDStatusIndicatorProps) {
  return (
    <View accessibilityRole="text" accessibilityLabel={label} style={s.statusIndicator}>
      <View style={[s.statusDot, statusDotTone[tone]]} />
      <TDText variant="caption" tone={tone === 'neutral' ? 'muted' : tone}>{label}</TDText>
    </View>
  );
}

export function TDScannerGuide({ tone = 'cyan', progress = 0, style }: TDScannerGuideProps) {
  return (
    <View pointerEvents="none" style={[s.scannerGuide, style]}>
      <View style={[s.scannerGuideCorner, scannerGuideTone[tone]]} />
      <View style={[s.scannerGuideCorner, s.scannerGuideCornerRight, scannerGuideTone[tone]]} />
      <View style={[s.scannerGuideCorner, s.scannerGuideCornerBottom, scannerGuideTone[tone]]} />
      <View style={[s.scannerGuideCorner, s.scannerGuideCornerBottomRight, scannerGuideTone[tone]]} />
      {progress > 0 ? <View style={[s.scannerGuideProgress, { width: `${Math.max(0, Math.min(100, Math.round(progress * 100)))}%` }]} /> : null}
    </View>
  );
}

export function TDSessionStrip({ summary, actionLabel = 'Review', onPress, bottomInset = 0, tone = 'neutral', style }: TDSessionStripProps) {
  const content = (
    <>
      <TDText variant="small" numberOfLines={1} style={s.sessionStripSummary}>{summary}</TDText>
      <TDText variant="small" tone={tone === 'neutral' ? 'info' : tone} numberOfLines={1}>{actionLabel}</TDText>
    </>
  );

  if (!onPress) return <View style={[s.sessionStrip, { paddingBottom: Math.max(bottomInset, space.xs) }, style]}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${actionLabel}. ${summary}`}
      onPress={onPress}
      style={({ pressed }) => [s.sessionStrip, { paddingBottom: Math.max(bottomInset, space.xs) }, pressed && s.pressed, style]}
    >
      {content}
    </Pressable>
  );
}

export function TDEmptyState({ title, message, action, accessibilityLabel }: TDStateProps) {
  return <TDFeedbackState iconName="sparkles-outline" tone="info" title={title} message={message} action={action} accessibilityLabel={accessibilityLabel} />;
}

export function TDErrorState({ title, message, action, accessibilityLabel }: TDStateProps) {
  return <TDFeedbackState iconName="alert-circle-outline" tone="danger" title={title} message={message} action={action} accessibilityLabel={accessibilityLabel} />;
}

export function TDDivider() {
  return <View accessibilityRole="none" style={s.divider} />;
}

function TDFeedbackState({
  title,
  message,
  action,
  accessibilityLabel,
  iconName,
  tone,
}: TDStateProps & { iconName: keyof typeof Ionicons.glyphMap; tone: 'danger' | 'info' }) {
  return (
    <TDCard
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      variant="outlined"
      style={s.state}
    >
      <View style={[s.stateIcon, tone === 'danger' ? s.stateIconDanger : s.stateIconInfo]}>
        <Ionicons name={iconName} size={icon.lg} color={tone === 'danger' ? color.danger : color.info} />
      </View>
      <TDText variant="title">{title}</TDText>
      {message ? <TDText variant="small" tone="muted" style={s.stateCopy}>{message}</TDText> : null}
      {action}
    </TDCard>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  screenContent: { flex: 1, width: '100%', alignSelf: 'center', padding: space.lg },
  screenContentWide: { maxWidth: 1160, paddingHorizontal: space.xxl },
  dockSurface: { borderRadius: radius.dock, borderWidth: 1, borderColor: edge.subtle, borderTopColor: edge.highlight, backgroundColor: surface.dock, padding: space.md, gap: space.md, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 14, elevation: 10 },
  dockSurfaceRaised: { backgroundColor: surface.raised, borderTopColor: edge.highlight, ...elevation.floating },
  dockSurfaceActive: { borderColor: edge.active },
  dockTray: { borderRadius: radius.tray, borderWidth: 1, borderColor: edge.subtle, backgroundColor: surface.inset, padding: space.sm, gap: space.sm },
  dockTrayInset: { backgroundColor: surface.inset, borderColor: edge.default },
  dockTrayActive: { borderColor: edge.active, backgroundColor: color.primary + '18' },
  dockRail: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.control, borderWidth: 1, borderColor: edge.subtle, borderTopColor: edge.highlight, backgroundColor: surface.raised, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 5 },
  dockRailCompact: { minHeight: 40 },
  dockSegment: { flex: 1, minHeight: 38, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.xs, paddingHorizontal: space.xs },
  dockSegmentSelected: { backgroundColor: color.primary + '1E', borderWidth: 1, borderColor: edge.active, borderTopColor: edge.highlight },
  dockActionProminent: { minHeight: 54, backgroundColor: color.primary, borderWidth: 1, borderColor: color.primaryBright, borderTopColor: edge.highlight, shadowColor: color.primaryBright, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 6 },
  dockMetric: { flex: 1, minWidth: 82, borderRadius: radius.tray, borderWidth: 1, borderColor: edge.subtle, backgroundColor: surface.raised, paddingHorizontal: space.sm, paddingVertical: space.sm, gap: 2 },
  dockCardWell: { borderRadius: radius.object, borderWidth: 1, borderColor: edge.subtle, backgroundColor: surface.raised, padding: space.xs, overflow: 'hidden' },
  dockCardWellLifted: { borderColor: edge.highlight, backgroundColor: surface.raised, ...elevation.raised },
  dockSection: { gap: space.sm },
  dockSectionHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  dockHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  dockHeaderCopy: { flex: 1, minWidth: 0, gap: 3 },
  button: { minHeight: 48, borderRadius: radius.control, borderWidth: 1, borderTopColor: edge.highlight, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.xs, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 4 },
  buttonText: { fontWeight: '900', fontSize: 14 },
  buttonTextPrimary: { color: color.text },
  buttonTextSecondary: { color: color.primaryBright },
  pressed: { opacity: 0.9, transform: [{ translateY: 1 }, { scale: 0.99 }] },
  disabled: { opacity: 0.56 },
  webFocus: { borderColor: color.primaryBright, outlineColor: color.primaryBright, outlineStyle: 'solid' as never, outlineWidth: 2 },
  card: { borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, backgroundColor: color.surfaceRaised, padding: space.md },
  inputWrap: { gap: space.xs },
  inputShell: { minHeight: 52, borderRadius: radius.control, borderWidth: 1, borderColor: color.border, backgroundColor: color.canvasRaised, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md },
  inputError: { borderColor: color.danger, backgroundColor: color.danger + '12' },
  input: { flex: 1, color: color.text, fontSize: 15, outlineStyle: 'none' as never },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.sm, paddingVertical: 5 },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  state: { alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.lg },
  stateCopy: { textAlign: 'center', maxWidth: 460 },
  stateIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  stateIconDanger: { backgroundColor: color.danger + '16' },
  stateIconInfo: { backgroundColor: color.info + '16' },
  divider: { height: 1, backgroundColor: color.border },
  chip: { minHeight: 40, maxWidth: '100%', borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.md, paddingVertical: space.xs, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.xs },
  chipSelected: { borderColor: color.primaryBright },
  chipText: { fontSize: 11, fontWeight: '900', lineHeight: 15 },
  metricTile: { flexGrow: 1, flexBasis: '30%', minWidth: 96, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.sm, paddingVertical: space.sm, backgroundColor: color.canvasRaised, gap: 2 },
  metricTileCompact: { minWidth: 82, paddingHorizontal: space.xs },
  iconButton: { minWidth: 44, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderTopColor: edge.highlight, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 6, elevation: 4 },
  iconButtonSelected: { borderColor: color.primaryBright },
  listRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: color.border },
  listRowSelected: { backgroundColor: color.primary + '14' },
  listRowIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceRaised },
  listRowIconSelected: { backgroundColor: color.primary + '24' },
  listRowCopy: { flex: 1, minWidth: 0, gap: 2 },
  iconRow: { minHeight: 56, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.canvasRaised, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm },
  iconRowIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: color.info + '14' },
  iconRowCopy: { flex: 1, minWidth: 0 },
  navigationHeader: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  navigationHeaderCopy: { flex: 1, minWidth: 0, gap: 3 },
  sheet: { gap: space.md, borderColor: color.borderStrong },
  sheetHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  segmentedWrap: { gap: space.xs },
  segmented: { minHeight: 44, flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: 3, backgroundColor: color.canvasRaised },
  segment: { flex: 1, minHeight: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.xs, paddingHorizontal: space.xs },
  segmentSelected: { backgroundColor: color.primary },
  segmentText: { color: color.textMuted, fontSize: 12, fontWeight: '900' },
  segmentTextSelected: { color: color.text },
  resultTray: { minHeight: 76, borderRadius: radius.control, borderWidth: 1, borderColor: color.border, backgroundColor: color.surfaceFloating, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm },
  resultTrayCompact: { minHeight: 64 },
  resultTrayCopy: { flex: 1, minWidth: 0, gap: 2 },
  resultTrayTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.xs },
  resultTrayActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  skeleton: { gap: space.sm },
  skeletonLine: { height: 14, borderRadius: radius.pill, backgroundColor: color.surfaceRaised },
  skeletonLineShort: { width: '62%' },
  toast: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  toastMessage: { flex: 1, minWidth: 0 },
  statusIndicator: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  scannerGuide: { minHeight: 240, minWidth: 172 },
  scannerGuideCorner: { position: 'absolute', top: 0, left: 0, width: 46, height: 46, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: radius.md },
  scannerGuideCornerRight: { left: undefined, right: 0, borderLeftWidth: 0, borderRightWidth: 3, borderTopRightRadius: radius.md },
  scannerGuideCornerBottom: { top: undefined, bottom: 0, borderTopWidth: 0, borderBottomWidth: 3, borderBottomLeftRadius: radius.md },
  scannerGuideCornerBottomRight: { top: undefined, left: undefined, right: 0, bottom: 0, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: radius.md },
  scannerGuideProgress: { position: 'absolute', left: 0, bottom: -8, height: 3, borderRadius: radius.pill, backgroundColor: color.primaryBright },
  sessionStrip: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: 1, borderColor: color.borderStrong, backgroundColor: color.surfaceFloating },
  sessionStripSummary: { flex: 1, minWidth: 0 },
  collectibleWell: { borderRadius: radius.object, backgroundColor: surface.inset, padding: space.xs, overflow: 'hidden', borderTopWidth: 1, borderTopColor: edge.highlight, borderBottomWidth: 1, borderBottomColor: '#00000088', ...elevation.raised },
  collectibleWellLifted: { transform: [{ translateY: -2 }], shadowOpacity: 0.28, borderTopColor: color.primaryBright + '44' },
  collectiblePressed: { opacity: 0.9, transform: [{ translateY: -3 }, { scale: 1.01 }] },
  collectibleCard: { width: 150, gap: space.xs, backgroundColor: 'transparent', borderBottomColor: 'transparent' },
  collectibleThumbnail: { borderRadius: radius.object, overflow: 'hidden', backgroundColor: surface.raised, borderWidth: 1, borderColor: edge.subtle },
  collectibleImage: { width: '100%', height: '100%' },
  collectiblePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs, padding: space.xs },
  collectibleQuantity: { position: 'absolute', right: 6, top: 6, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: color.canvas + 'D8' },
  collectibleCopy: { gap: 2 },
  collectibleStack: { width: 68, height: 56, justifyContent: 'flex-end' },
  collectibleStackLayer: { position: 'absolute', left: 0, bottom: 6, width: 46, height: 34, borderRadius: 8, borderWidth: 1, borderColor: edge.subtle, backgroundColor: surface.raised },
  collectibleStackDecks: { borderColor: color.accent + '55', backgroundColor: color.accent + '18' },
  collectibleStackScanner: { borderColor: color.primaryBright + '55', backgroundColor: color.primary + '18' },
  collectibleStackCount: { position: 'absolute', right: 0, bottom: 0 },
  collectibleHero: { minHeight: 176, gap: space.md, padding: space.md, overflow: 'hidden' },
  collectibleHeroDecks: { borderColor: color.accent + '44', backgroundColor: color.accent + '10' },
  collectibleHeroScanner: { borderColor: color.primaryBright + '44', backgroundColor: color.primary + '10' },
  collectibleHeroLight: { position: 'absolute', top: -76, right: -52, width: 190, height: 190, borderRadius: 100, backgroundColor: color.text + '08' },
  collectibleHeroImage: { width: '100%', height: 220 },
  collectibleHeroCopy: { gap: space.xs },
  locationBreadcrumb: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 30, borderRadius: radius.control, backgroundColor: color.warning + '12', flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs, paddingVertical: 5 },
  locationBreadcrumbCompact: { minHeight: 24, paddingVertical: 3 },
  locationBreadcrumbEmpty: { backgroundColor: surface.inset },
  locationBreadcrumbParts: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 3 },
  locationPart: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 3 },
  centerText: { textAlign: 'center' },
});

const collectibleThumbnailSize = StyleSheet.create({
  sm: { width: 78, height: 108 },
  md: { width: '100%', height: 198 },
  lg: { width: '100%', height: 240 },
});

const iconButtonSize = StyleSheet.create({
  sm: { minWidth: 40, minHeight: 40 },
  md: { minWidth: 44, minHeight: 44 },
  lg: { minWidth: 52, minHeight: 52 },
});

const iconButtonTone = StyleSheet.create({
  neutral: { backgroundColor: color.surfaceRaised, borderColor: color.border },
  primary: { backgroundColor: color.primary + '22', borderColor: color.primaryBright + '66' },
  success: { backgroundColor: color.success + '16', borderColor: color.success + '55' },
  warning: { backgroundColor: color.warning + '16', borderColor: color.warning + '55' },
  danger: { backgroundColor: color.danger + '16', borderColor: color.danger + '55' },
});

function iconButtonColor(tone: TDIconButtonProps['tone'], selected?: boolean) {
  if (selected || tone === 'primary') return color.primaryBright;
  if (tone === 'success') return color.success;
  if (tone === 'warning') return color.warning;
  if (tone === 'danger') return color.danger;
  return color.text;
}

const buttonSize = StyleSheet.create({
  sm: { minHeight: 40, paddingHorizontal: space.md },
  md: { minHeight: 48, paddingHorizontal: space.lg },
  lg: { minHeight: 56, paddingHorizontal: space.xl },
});

const buttonVariant = StyleSheet.create({
  primary: { backgroundColor: color.primary, borderColor: color.primary, ...elevation.raised },
  secondary: { backgroundColor: color.surfaceRaised, borderColor: color.border },
  ghost: { backgroundColor: 'transparent', borderColor: color.border },
  danger: { backgroundColor: color.danger + '16', borderColor: color.danger + '55' },
});

const cardVariant = StyleSheet.create({
  default: {},
  elevated: { backgroundColor: color.surfaceRaised, ...elevation.raised },
  floating: { backgroundColor: color.surfaceFloating, ...elevation.floating },
  outlined: { backgroundColor: color.canvasRaised },
});

const textStyles = StyleSheet.create({
  display: { ...type.display },
  heading: { ...type.heading },
  title: { ...type.title },
  body: { ...type.body },
  small: { ...type.small },
  caption: { ...type.caption },
  label: { ...type.label, textTransform: 'uppercase' },
});

const toneStyles = StyleSheet.create({
  primary: { color: color.text },
  secondary: { color: color.textSecondary },
  muted: { color: color.textMuted },
  success: { color: color.success },
  warning: { color: color.warning },
  danger: { color: color.danger },
  info: { color: color.info },
});

const badgeTone = StyleSheet.create({
  neutral: { backgroundColor: color.surfaceRaised, borderColor: color.border },
  success: { backgroundColor: color.success + '16', borderColor: color.success + '55' },
  warning: { backgroundColor: color.warning + '16', borderColor: color.warning + '55' },
  danger: { backgroundColor: color.danger + '16', borderColor: color.danger + '55' },
  info: { backgroundColor: color.info + '16', borderColor: color.info + '55' },
  accent: { backgroundColor: color.accent + '16', borderColor: color.accent + '55' },
});

const chipToneStyle = StyleSheet.create({
  neutral: { backgroundColor: color.surfaceRaised, borderColor: color.border },
  success: { backgroundColor: color.success + '18', borderColor: color.success + '66' },
  warning: { backgroundColor: color.warning + '18', borderColor: color.warning + '66' },
  danger: { backgroundColor: color.danger + '18', borderColor: color.danger + '66' },
  info: { backgroundColor: color.primary + '24', borderColor: color.info + '66' },
  accent: { backgroundColor: color.accent + '18', borderColor: color.accent + '66' },
});

const metricTone = StyleSheet.create({
  neutral: { borderColor: color.border },
  success: { borderColor: color.success + '44' },
  warning: { borderColor: color.warning + '44' },
  danger: { borderColor: color.danger + '44' },
  info: { borderColor: color.info + '44' },
  accent: { borderColor: color.accent + '44' },
});

const resultTrayTone = StyleSheet.create({
  neutral: { borderColor: color.border },
  success: { borderColor: color.success + '66' },
  warning: { borderColor: color.warning + '66' },
  danger: { borderColor: color.danger + '66' },
  info: { borderColor: color.info + '66' },
});

const toastTone = StyleSheet.create({
  neutral: { backgroundColor: color.surfaceFloating, borderColor: color.border },
  success: { backgroundColor: color.success + '16', borderColor: color.success + '55' },
  warning: { backgroundColor: color.warning + '16', borderColor: color.warning + '55' },
  danger: { backgroundColor: color.danger + '16', borderColor: color.danger + '55' },
  info: { backgroundColor: color.info + '16', borderColor: color.info + '55' },
});

const statusDotTone = StyleSheet.create({
  neutral: { backgroundColor: color.textMuted },
  success: { backgroundColor: color.success },
  warning: { backgroundColor: color.warning },
  danger: { backgroundColor: color.danger },
  info: { backgroundColor: color.info },
});

const scannerGuideTone = StyleSheet.create({
  neutral: { borderColor: color.textMuted },
  cyan: { borderColor: color.info },
  blue: { borderColor: color.primaryBright },
  success: { borderColor: color.success },
  warning: { borderColor: color.warning },
  danger: { borderColor: color.danger },
});

const materialStyle = StyleSheet.create<Record<TradingDocksMaterialClass, ViewStyle>>({
  canvas: { backgroundColor: color.canvas, borderColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  structuralDock: { backgroundColor: surface.dock, borderColor: edge.subtle, borderTopColor: edge.highlight },
  insetBay: { backgroundColor: surface.inset, borderColor: '#00000066', borderTopColor: edge.subtle },
  raisedControl: { backgroundColor: surface.raised, borderColor: edge.subtle, borderTopColor: edge.highlight, ...elevation.raised },
  collectibleObject: { backgroundColor: surface.inset, borderColor: edge.subtle, borderTopColor: edge.highlight, ...elevation.raised },
  activeInstrument: { backgroundColor: color.primary + '16', borderColor: edge.active, borderTopColor: edge.highlight, shadowColor: color.primaryBright, shadowOpacity: 0.18 },
});

const dockTone = StyleSheet.create({
  neutral: {},
  active: { borderColor: edge.active, backgroundColor: color.primary + '14' },
  success: { borderColor: edge.success, backgroundColor: color.success + '10' },
  warning: { borderColor: edge.warning, backgroundColor: color.warning + '10' },
});

const dockMetricTone = StyleSheet.create({
  neutral: {},
  active: { borderColor: edge.active },
  success: { borderColor: edge.success },
  warning: { borderColor: edge.warning },
});

const badgeTextTone = StyleSheet.create({
  neutral: { color: color.textSecondary },
  success: { color: color.success },
  warning: { color: color.warning },
  danger: { color: color.danger },
  info: { color: color.info },
  accent: { color: color.accent },
});

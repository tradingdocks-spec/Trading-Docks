import { Ionicons } from '@expo/vector-icons';
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
  type TDBadgeTone,
  type TDButtonSize,
  type TDButtonVariant,
} from '@/design/component-model';
import { color, elevation, icon, radius, space, type } from '@/design';

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
  containerStyle?: StyleProp<ViewStyle>;
};

type TDTextProps = PropsWithChildren<{
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

export function TDText({ children, variant = 'body', tone = 'primary', style }: TDTextProps) {
  return <Text style={[textStyles[variant], toneStyles[tone], style]}>{children}</Text>;
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
      <Text style={[s.buttonText, variant === 'primary' ? s.buttonTextPrimary : s.buttonTextSecondary]}>
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

export function TDSectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={s.sectionHeader}>
      <TDText variant="title">{title}</TDText>
      {action}
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
    <TDCard variant="outlined" style={s.state} accessibilityLabel={accessibilityLabel ?? title}>
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
  button: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.xs },
  buttonText: { fontWeight: '900', fontSize: 14 },
  buttonTextPrimary: { color: color.text },
  buttonTextSecondary: { color: color.primaryBright },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.56 },
  webFocus: { borderColor: color.primaryBright, outlineColor: color.primaryBright, outlineStyle: 'solid' as never, outlineWidth: 2 },
  card: { borderWidth: 1, borderColor: color.border, borderRadius: radius.xl, backgroundColor: color.surface, padding: space.lg },
  inputWrap: { gap: space.xs },
  inputShell: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.canvasRaised, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md },
  inputError: { borderColor: color.danger, backgroundColor: color.danger + '12' },
  input: { flex: 1, color: color.text, fontSize: 15, outlineStyle: 'none' as never },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.sm, paddingVertical: 6 },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  state: { alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.lg },
  stateCopy: { textAlign: 'center', maxWidth: 460 },
  stateIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  stateIconDanger: { backgroundColor: color.danger + '16' },
  stateIconInfo: { backgroundColor: color.info + '16' },
  divider: { height: 1, backgroundColor: color.border },
});

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

const badgeTextTone = StyleSheet.create({
  neutral: { color: color.textSecondary },
  success: { color: color.success },
  warning: { color: color.warning },
  danger: { color: color.danger },
  info: { color: color.info },
  accent: { color: color.accent },
});

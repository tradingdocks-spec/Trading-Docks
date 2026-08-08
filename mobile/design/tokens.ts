import { Platform } from 'react-native';
import type { ViewStyle } from 'react-native';

import { tdTokens } from './shared-tokens';

export const color = {
  canvas: tdTokens.color.background.primary,
  canvasRaised: tdTokens.color.background.secondary,
  surface: tdTokens.color.surface.default,
  surfaceRaised: tdTokens.color.surface.elevated,
  surfaceFloating: tdTokens.color.surface.floating,
  text: tdTokens.color.text.primary,
  textSecondary: tdTokens.color.text.secondary,
  textMuted: tdTokens.color.text.muted,
  primary: tdTokens.color.action.primary,
  primaryBright: tdTokens.color.border.focus,
  success: tdTokens.color.state.success,
  warning: tdTokens.color.state.warning,
  danger: tdTokens.color.state.danger,
  info: tdTokens.color.state.information,
  accent: tdTokens.color.state.accent,
  border: tdTokens.color.border.default,
  borderStrong: tdTokens.color.border.strong,
  overlay: tdTokens.color.surface.overlay,
} as const;

export const surface = {
  canvas: tdTokens.depth.surface.canvas,
  dock: tdTokens.depth.surface.dock,
  raised: tdTokens.depth.surface.raised,
  inset: tdTokens.depth.surface.inset,
  object: tdTokens.depth.surface.object,
} as const;

export const edge = {
  default: tdTokens.depth.edge.default,
  subtle: tdTokens.depth.edge.subtle,
  highlight: tdTokens.depth.edge.highlight,
  active: tdTokens.depth.edge.active,
  success: tdTokens.depth.edge.success,
  warning: tdTokens.depth.edge.warning,
} as const;

export const shadow = {
  ambient: tdTokens.depth.shadow.ambient,
  object: tdTokens.depth.shadow.object,
  inset: tdTokens.depth.shadow.inset,
} as const;

export const space = { xxs: tdTokens.space.half, xs: tdTokens.space.xs, sm: tdTokens.space.sm, md: tdTokens.space.md, lg: tdTokens.space.lg, xl: tdTokens.space.xl, xxl: tdTokens.space.xxl, hero: tdTokens.space.hero } as const;
export const radius = { xs: tdTokens.radius.xs, sm: tdTokens.radius.sm, md: tdTokens.radius.md, lg: tdTokens.radius.lg, xl: tdTokens.radius.xxl, modal: 32, pill: tdTokens.radius.pill, dock: tdTokens.radius.dock, tray: tdTokens.radius.tray, control: tdTokens.radius.control, object: tdTokens.radius.object } as const;
export const type = {
  display: { fontSize: tdTokens.typography.size.display, lineHeight: tdTokens.typography.lineHeight.display, fontWeight: '900' as const, letterSpacing: tdTokens.typography.letterSpacing.none },
  heading: { fontSize: tdTokens.typography.size.heading, lineHeight: tdTokens.typography.lineHeight.heading, fontWeight: '900' as const, letterSpacing: tdTokens.typography.letterSpacing.none },
  title: { fontSize: tdTokens.typography.size.title, lineHeight: tdTokens.typography.lineHeight.title, fontWeight: '900' as const },
  body: { fontSize: tdTokens.typography.size.body, lineHeight: tdTokens.typography.lineHeight.body, fontWeight: '500' as const },
  small: { fontSize: tdTokens.typography.size.small, lineHeight: tdTokens.typography.lineHeight.small, fontWeight: '600' as const },
  label: { fontSize: tdTokens.typography.size.caption, lineHeight: 15, fontWeight: '900' as const, letterSpacing: tdTokens.typography.letterSpacing.label },
  caption: { fontSize: tdTokens.typography.size.caption, lineHeight: tdTokens.typography.lineHeight.caption, fontWeight: '600' as const },
} as const;
export const motion = tdTokens.motion.duration;
export const motionDuration = {
  fast: tdTokens.motion.duration.fast,
  standard: tdTokens.motion.duration.standard,
  sheet: tdTokens.motion.duration.slow,
} as const;
export const breakpoint = tdTokens.breakpoint;
export const icon = tdTokens.icon;
export const elevation = {
  flat: Platform.select({ web: { boxShadow: tdTokens.elevation.flat.shadow } as ViewStyle, ios: { shadowColor: tdTokens.elevation.flat.shadowColor, shadowOpacity: tdTokens.elevation.flat.shadowOpacity, shadowRadius: tdTokens.elevation.flat.shadowRadius, shadowOffset: tdTokens.elevation.flat.shadowOffset }, android: { elevation: tdTokens.elevation.flat.elevation }, default: {} }),
  raised: Platform.select({ web: { boxShadow: tdTokens.elevation.raised.shadow } as ViewStyle, ios: { shadowColor: tdTokens.elevation.raised.shadowColor, shadowOpacity: tdTokens.elevation.raised.shadowOpacity, shadowRadius: tdTokens.elevation.raised.shadowRadius, shadowOffset: tdTokens.elevation.raised.shadowOffset }, android: { elevation: tdTokens.elevation.raised.elevation }, default: {} }),
  floating: Platform.select({ web: { boxShadow: tdTokens.elevation.floating.shadow } as ViewStyle, ios: { shadowColor: tdTokens.elevation.floating.shadowColor, shadowOpacity: tdTokens.elevation.floating.shadowOpacity, shadowRadius: tdTokens.elevation.floating.shadowRadius, shadowOffset: tdTokens.elevation.floating.shadowOffset }, android: { elevation: tdTokens.elevation.floating.elevation }, default: {} }),
  overlay: Platform.select({ web: { boxShadow: tdTokens.elevation.overlay.shadow } as ViewStyle, ios: { shadowColor: tdTokens.elevation.overlay.shadowColor, shadowOpacity: tdTokens.elevation.overlay.shadowOpacity, shadowRadius: tdTokens.elevation.overlay.shadowRadius, shadowOffset: tdTokens.elevation.overlay.shadowOffset }, android: { elevation: tdTokens.elevation.overlay.elevation }, default: {} }),
} as const;
export { tdTokens };

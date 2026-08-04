import { Platform } from 'react-native';

export const color = {
  canvas: '#06111F',
  canvasRaised: '#091827',
  surface: '#0D2033',
  surfaceRaised: '#112941',
  surfaceFloating: '#142F49',
  text: '#F6FAFF',
  textSecondary: '#A9BBCB',
  textMuted: '#71899F',
  primary: '#2688FF',
  primaryBright: '#66D9FF',
  success: '#4BE0A0',
  warning: '#FFC76A',
  danger: '#FF6F87',
  border: '#1C3C59',
  borderStrong: '#2D5272',
  overlay: 'rgba(2, 8, 16, 0.72)',
} as const;

export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, hero: 64 } as const;
export const radius = { sm: 12, md: 16, lg: 20, xl: 28, modal: 34, pill: 999 } as const;
export const type = {
  display: { fontSize: 38, lineHeight: 42, fontWeight: '900' as const, letterSpacing: -1.3 },
  heading: { fontSize: 26, lineHeight: 31, fontWeight: '900' as const, letterSpacing: -0.7 },
  title: { fontSize: 18, lineHeight: 23, fontWeight: '900' as const },
  body: { fontSize: 14, lineHeight: 21, fontWeight: '500' as const },
  label: { fontSize: 11, lineHeight: 15, fontWeight: '900' as const, letterSpacing: 1.2 },
  caption: { fontSize: 11, lineHeight: 16, fontWeight: '600' as const },
} as const;
export const motion = { tap: 120, fast: 180, standard: 260, slow: 420 } as const;
export const elevation = {
  raised: Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }, android: { elevation: 6 }, default: {} }),
  floating: Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.34, shadowRadius: 26, shadowOffset: { width: 0, height: 14 } }, android: { elevation: 12 }, default: {} }),
} as const;

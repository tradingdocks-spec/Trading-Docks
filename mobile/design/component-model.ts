export type TDButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type TDButtonSize = 'sm' | 'md' | 'lg';
export type TDInputState = 'default' | 'error' | 'disabled';
export type TDBadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
export type TDMetricTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export const TD_MOBILE_MIN_TOUCH_TARGET = 44;
export const TD_MOBILE_COMFORTABLE_TOUCH_TARGET = 48;
export const TD_MOBILE_SURFACE_LEVELS = ['canvas', 'dock', 'tray', 'object'] as const;
export const TD_MOBILE_SPACING_SCALE = [4, 8, 12, 16, 20, 24, 32, 40, 48] as const;
export const TD_MOBILE_ICON_SIZES = [16, 20, 24, 28] as const;
export const TD_MOBILE_COMPONENT_CONTRACTS = [
  'TDButton',
  'TDCard',
  'TDInput',
  'TDText',
  'TDSectionHeader',
  'TDListRow',
  'TDIconButton',
  'TDBadge',
  'TDSheet',
  'TDSegmentedControl',
  'TDMetric',
  'TDResultTray',
  'TDEmptyState',
  'TDErrorState',
  'TDLoadingState',
  'TDSkeleton',
  'TDToast',
  'TDStatusIndicator',
  'TDNavigationHeader',
  'TDScannerGuide',
  'TDSessionStrip',
  'DockSurface',
  'DockGroup',
  'DockTray',
  'DockRail',
  'DockSegment',
  'DockAction',
  'DockMetric',
  'DockCardWell',
  'DockSection',
  'DockHeader',
] as const;

export function tdButtonIsDisabled(disabled?: boolean, loading?: boolean) {
  return Boolean(disabled || loading);
}

export function tdButtonAccessibility(label?: string, disabled?: boolean, loading?: boolean) {
  const isDisabled = tdButtonIsDisabled(disabled, loading);

  return {
    accessibilityRole: 'button' as const,
    accessibilityLabel: label,
    accessibilityState: {
      disabled: isDisabled,
      busy: Boolean(loading),
    },
  };
}

export function tdInputState(error?: string | null, disabled?: boolean): TDInputState {
  if (disabled) return 'disabled';
  if (error) return 'error';
  return 'default';
}

export function tdInputAccessibility(label?: string, error?: string | null, disabled?: boolean) {
  return {
    accessibilityLabel: label,
    accessibilityState: {
      disabled: Boolean(disabled),
    },
    accessibilityHint: error ?? undefined,
    accessibilityInvalid: Boolean(error),
  };
}

export function tdSelectableAccessibility(label: string, selected?: boolean, disabled?: boolean) {
  return {
    accessibilityRole: 'button' as const,
    accessibilityLabel: label,
    accessibilityState: {
      selected: Boolean(selected),
      disabled: Boolean(disabled),
    },
  };
}

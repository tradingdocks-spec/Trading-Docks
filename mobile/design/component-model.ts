export type TDButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type TDButtonSize = 'sm' | 'md' | 'lg';
export type TDInputState = 'default' | 'error' | 'disabled';
export type TDBadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

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

import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type TDButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type TDButtonSize = "sm" | "md" | "lg";
type TDBadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

type TDButtonProps = ComponentProps<"button"> & {
  label?: string;
  variant?: TDButtonVariant;
  size?: TDButtonSize;
  loading?: boolean;
  icon?: ReactNode;
};

type TDCardProps = ComponentProps<"div"> & {
  variant?: "default" | "elevated" | "floating" | "outlined";
};

type TDInputProps = ComponentProps<"input"> & {
  label?: string;
  error?: string;
  containerClassName?: string;
};

type TDTextProps = ComponentProps<"p"> & {
  as?: "p" | "span" | "h1" | "h2" | "h3";
  variant?: "display" | "heading" | "title" | "body" | "small" | "caption" | "label";
  tone?: "primary" | "secondary" | "muted" | "success" | "warning" | "danger" | "info";
};
type TDCardVariant = NonNullable<TDCardProps["variant"]>;
type TDTextVariant = NonNullable<TDTextProps["variant"]>;
type TDTextTone = NonNullable<TDTextProps["tone"]>;

type TDStateProps = {
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
};

const buttonVariant: Record<TDButtonVariant, string> = {
  primary: "border-[var(--td-action-primary)] bg-[var(--td-action-primary)] text-white shadow-[var(--td-elevation-raised)] hover:bg-[var(--td-action-primary-hover)] active:bg-[var(--td-action-primary-pressed)]",
  secondary: "border-[var(--td-border-default)] bg-[var(--td-surface-elevated)] text-[var(--td-text-primary)] hover:border-[var(--td-border-focus)]",
  ghost: "border-[var(--td-border-default)] bg-transparent text-[var(--td-text-secondary)] hover:bg-[var(--td-surface-default)] hover:text-[var(--td-text-primary)]",
  danger: "border-red-300/30 bg-red-400/10 text-red-200 hover:bg-red-400/15",
};

const buttonSize: Record<TDButtonSize, string> = {
  sm: "min-h-10 px-3 text-xs",
  md: "min-h-12 px-4 text-sm",
  lg: "min-h-14 px-5 text-sm",
};

const cardVariant: Record<TDCardVariant, string> = {
  default: "border-[var(--td-border-default)] bg-[var(--td-surface-default)]",
  elevated: "border-[var(--td-border-default)] bg-[var(--td-surface-elevated)] shadow-[var(--td-elevation-raised)]",
  floating: "border-[var(--td-border-default)] bg-[var(--td-surface-floating)] shadow-[var(--td-elevation-floating)]",
  outlined: "border-[var(--td-border-subtle)] bg-[var(--td-background-secondary)]",
};

const textVariant: Record<TDTextVariant, string> = {
  display: "text-[2.375rem] leading-[1.1] font-semibold tracking-normal",
  heading: "text-[1.625rem] leading-tight font-semibold tracking-normal",
  title: "text-lg leading-snug font-semibold tracking-normal",
  body: "text-sm leading-6 font-medium tracking-normal",
  small: "text-xs leading-5 font-medium tracking-normal",
  caption: "text-[11px] leading-4 font-medium tracking-normal",
  label: "text-[11px] leading-4 font-semibold uppercase tracking-[0.1em]",
};

const textTone: Record<TDTextTone, string> = {
  primary: "text-[var(--td-text-primary)]",
  secondary: "text-[var(--td-text-secondary)]",
  muted: "text-[var(--td-text-muted)]",
  success: "text-[var(--td-success)]",
  warning: "text-[var(--td-warning)]",
  danger: "text-[var(--td-danger)]",
  info: "text-[var(--td-information)]",
};

const badgeTone: Record<TDBadgeTone, string> = {
  neutral: "border-[var(--td-border-default)] bg-[var(--td-surface-elevated)] text-[var(--td-text-secondary)]",
  success: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  warning: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  danger: "border-red-300/30 bg-red-300/10 text-red-200",
  info: "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
  accent: "border-violet-300/30 bg-violet-300/10 text-violet-200",
};

export function TDButton({
  className,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  icon,
  label,
  children,
  ...props
}: TDButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      aria-busy={loading || undefined}
      data-slot="td-button"
      disabled={isDisabled}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--td-radius-md)] border font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--td-background-primary)] disabled:pointer-events-none disabled:opacity-55",
        buttonVariant[variant],
        buttonSize[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : icon}
      {children ?? label}
    </button>
  );
}

export function TDCard({ className, variant = "default", ...props }: TDCardProps) {
  return (
    <div
      data-slot="td-card"
      className={cn("rounded-[var(--td-radius-xl)] border p-5", cardVariant[variant], className)}
      {...props}
    />
  );
}

export function TDInput({
  label,
  error,
  id,
  className,
  containerClassName,
  disabled,
  ...props
}: TDInputProps) {
  const inputId = id ?? props.name;

  return (
    <div className={cn("space-y-2", containerClassName)}>
      {label ? (
        <label htmlFor={inputId} className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--td-text-muted)]">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error && inputId ? `${inputId}-error` : undefined}
        disabled={disabled}
        className={cn(
          "min-h-12 w-full rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-4 text-sm text-[var(--td-text-primary)] outline-none transition placeholder:text-[var(--td-text-muted)] focus:border-[var(--td-border-focus)] focus:ring-2 focus:ring-[rgba(102,217,255,0.18)] disabled:opacity-55",
          error && "border-red-300/45 bg-red-400/10",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={inputId ? `${inputId}-error` : undefined} role="alert" className="text-xs font-semibold text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TDBadge({ className, tone = "neutral", ...props }: ComponentProps<"span"> & { tone?: TDBadgeTone }) {
  return (
    <span
      data-slot="td-badge"
      className={cn("inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]", badgeTone[tone], className)}
      {...props}
    />
  );
}

export function TDText({
  as = "p",
  variant = "body",
  tone = "primary",
  className,
  ...props
}: TDTextProps) {
  const Comp = as;
  return <Comp className={cn(textVariant[variant], textTone[tone], className)} {...props} />;
}

export function TDScreen({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      className={cn("mx-auto w-full max-w-[1600px] px-4 py-5 text-[var(--td-text-primary)] sm:px-6 lg:px-8", className)}
      {...props}
    />
  );
}

export function TDSectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <TDText as="h2" variant="title">{title}</TDText>
      {action}
    </div>
  );
}

export function TDLoadingState({ title, message, className }: TDStateProps) {
  return (
    <div aria-label={title} aria-live="polite" role="status" className={cn("flex items-center gap-3", className)}>
      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-[var(--td-information)]" />
      <div>
        <TDText variant="small">{title}</TDText>
        {message ? <TDText variant="caption" tone="muted">{message}</TDText> : null}
      </div>
    </div>
  );
}

export function TDEmptyState({ title, message, action, className }: TDStateProps) {
  return <TDFeedbackState tone="info" title={title} message={message} action={action} className={className} />;
}

export function TDErrorState({ title, message, action, className }: TDStateProps) {
  return <TDFeedbackState tone="danger" title={title} message={message} action={action} className={className} />;
}

export function TDDivider({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("h-px bg-[var(--td-border-default)]", className)} />;
}

function TDFeedbackState({ tone, title, message, action, className }: TDStateProps & { tone: "danger" | "info" }) {
  return (
    <TDCard variant="outlined" className={cn("flex flex-col items-center gap-3 text-center", className)}>
      <TDBadge tone={tone}>{tone === "danger" ? "Error" : "Empty"}</TDBadge>
      <TDText variant="title">{title}</TDText>
      {message ? <TDText tone="muted" className="max-w-md">{message}</TDText> : null}
      {action}
    </TDCard>
  );
}

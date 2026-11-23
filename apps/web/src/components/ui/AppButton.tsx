import type { ComponentProps } from "react";

export type AppButtonTone = "primary" | "secondary" | "danger" | "success";
export type AppButtonSize = "sm" | "md";

/**
 * Shared app action button primitive.
 *
 * Visual state (color, border, typography, hover, focus, disabled) lives here;
 * call sites pass only layout classes (margins, width, responsive positioning)
 * via `className`. Native attributes, handlers, `disabled`, `aria-*`, `data-*`,
 * and the forwarded `ref` pass straight through to the underlying <button>.
 *
 * Disabled buttons use a shared dashed boundary and legible text.
 *
 * Focus rings use `focus-visible:outline-[3px]` to match the 3 px global rule in
 * globals.css rather than the Tailwind default of 2 px.
 */

export const appButtonBaseClass =
  "shell-disabled-action inline-flex items-center justify-center rounded-lg font-medium transition focus-visible:outline-[3px] focus-visible:outline-offset-2";

/** Tone-specific colors. Disabled appearance is shared in globals.css. */
export const appButtonToneClass: Record<AppButtonTone, string> = {
  primary:
    "bg-shell-primary text-white hover:bg-shell-primary-hover focus-visible:outline-indigo-300",
  secondary:
    "border border-shell-border text-slate-200 hover:bg-slate-800 focus-visible:outline-indigo-300",
  danger:
    "border border-rose-700 text-rose-100 hover:bg-rose-900/60 focus-visible:outline-rose-300",
  success:
    "bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:outline-emerald-400",
};

export const appButtonSizeClass: Record<AppButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-11 px-4 py-2 text-sm",
};

export type AppButtonProps = ComponentProps<"button"> & {
  tone?: AppButtonTone;
  size?: AppButtonSize;
};

export function AppButton({
  tone = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: AppButtonProps) {
  return (
    <button
      type={type}
      className={`${appButtonBaseClass} ${appButtonToneClass[tone]} ${appButtonSizeClass[size]} ${className}`}
      {...props}
    />
  );
}

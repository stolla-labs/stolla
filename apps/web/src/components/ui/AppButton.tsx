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
 */

export const appButtonBaseClass =
  "inline-flex items-center justify-center rounded-lg font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50";

export const appButtonToneClass: Record<AppButtonTone, string> = {
  primary: "bg-indigo-500 text-white hover:bg-indigo-400 focus-visible:outline-indigo-400",
  secondary:
    "border border-slate-700 text-slate-200 hover:bg-slate-800 focus-visible:outline-slate-400",
  danger:
    "border border-rose-700 text-rose-100 hover:bg-rose-900/60 focus-visible:outline-rose-300",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:outline-emerald-400",
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

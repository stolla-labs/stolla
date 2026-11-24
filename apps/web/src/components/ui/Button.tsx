"use client";

import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { emitAnalytics, type AnalyticsEventName } from "@/lib/analytics";

type ButtonVariant = "primary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  href: string;
  analyticsEvent?: AnalyticsEventName;
  analyticsProperties?: Record<string, string>;
};

function variantClass(variant: ButtonVariant) {
  return variant === "primary" ? "lp-btn" : "lp-btn-ghost";
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button className={`${variantClass(variant)} ${className}`} {...props} />
  );
}

export function LinkButton({
  variant = "primary",
  className = "",
  href,
  analyticsEvent,
  analyticsProperties,
  onClick,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      onClick={(event) => {
        if (analyticsEvent) emitAnalytics(analyticsEvent, analyticsProperties);
        onClick?.(event);
      }}
      className={`${variantClass(variant)} ${className}`}
      {...props}
    />
  );
}

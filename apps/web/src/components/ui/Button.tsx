import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import Link from "next/link";

type ButtonVariant = "primary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  href: string;
};

function variantClass(variant: ButtonVariant) {
  return variant === "primary"
    ? "lp-btn px-5 py-3 min-h-11"
    : "lp-btn-ghost px-5 py-3 min-h-11";
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
  ...props
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={`${variantClass(variant)} ${className}`}
      {...props}
    />
  );
}

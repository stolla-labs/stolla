import Link from "next/link";
import type { ComponentProps } from "react";

import {
  appButtonBaseClass,
  appButtonSizeClass,
  appButtonToneClass,
  type AppButtonSize,
  type AppButtonTone,
} from "./AppButton";

/**
 * Shared app action link primitive. Renders a Next.js <Link> with the same
 * tone/size variants as AppButton. Anchor attributes (target, rel, download,
 * aria-*, data-*) and the forwarded ref pass straight through; `href` is
 * required so navigation destinations never change implicitly.
 */

export type AppLinkButtonProps = ComponentProps<typeof Link> & {
  tone?: AppButtonTone;
  size?: AppButtonSize;
  href: string;
};

export function AppLinkButton({
  tone = "primary",
  size = "md",
  className = "",
  href,
  ...props
}: AppLinkButtonProps) {
  return (
    <Link
      href={href}
      className={`${appButtonBaseClass} ${appButtonToneClass[tone]} ${appButtonSizeClass[size]} ${className}`}
      {...props}
    />
  );
}

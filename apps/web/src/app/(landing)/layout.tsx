import { LandingChrome } from "@/components/landing/LandingChrome";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="landing-root min-h-screen">
      <a href="#main-content" className="landing-skip-link">
        Skip to content
      </a>
      <LandingChrome />
      <LandingHeader />
      <main id="main-content">{children}</main>
      <LandingFooter />
    </div>
  );
}

import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="landing-root min-h-screen">
      <LandingHeader />
      <main>{children}</main>
      <LandingFooter />
    </div>
  );
}

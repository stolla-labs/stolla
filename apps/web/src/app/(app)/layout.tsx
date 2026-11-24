import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { IncidentBanner } from "@/components/IncidentBanner";
import { WalletProvider } from "@/context/WalletProvider";

export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <WalletProvider>
      <IncidentBanner />
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer />
    </WalletProvider>
  );
}

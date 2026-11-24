import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { WalletProvider } from "@/context/WalletProvider";
import { MobileBottomNav } from "@/components/MobileBottomNav";

export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <WalletProvider>
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 pb-24 focus:outline-none md:pb-0">
        {children}
      </main>
      <Footer />
      <MobileBottomNav />
    </WalletProvider>
  );
}

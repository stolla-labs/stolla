import type { Metadata } from "next";
import { IBM_Plex_Sans, Inter, Syne } from "next/font/google";
import { WalletProvider } from "@/context/WalletProvider";
import "./globals.css";
import "./landing.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const ibmPlex = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Stolla | Stellar Community Governance",
  description:
    "NFT-gated DAO voting for Stellar project communities on testnet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${ibmPlex.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-zinc-900">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}

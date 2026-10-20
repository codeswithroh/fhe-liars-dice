import type { Metadata } from "next";
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "./providers";
import { NavBar } from "@/components/ui/NavBar";
import { FundWalletModal } from "@/components/ui/FundWalletModal";

// Technical-mood type pairing (see .tastemaker/style-lock.md): a geometric grotesk for
// display/headings, a cohesive Plex family for body copy and mono data (addresses, dice
// values, round numbers) so the two never compete.
const archivo = Archivo({
  variable: "--font-heading",
  subsets: ["latin"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-body",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FHE Liar's Dice",
  description: "A privacy-first casual Liar's Dice built on Fhenix CoFHE encrypted onchain dice.",
  icons: {
    icon: [
      { url: "/favicons/icon.svg", type: "image/svg+xml" },
      { url: "/favicons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicons/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    shortcut: "/favicons/favicon.ico",
    apple: "/favicons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <NavBar />
          <FundWalletModal />
          <main className="flex-1">{children}</main>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}

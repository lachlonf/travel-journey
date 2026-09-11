import type { Metadata, Viewport } from "next";
import { Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const mono = Geist_Mono({ variable: "--font-mono-face", subsets: ["latin"] });
const serif = Newsreader({ variable: "--font-serif-face", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Journey",
  description: "Where I've been, one place at a time.",
  // Unlisted: shared by link, kept out of search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#090b0a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mono.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}

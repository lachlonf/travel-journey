import type { Metadata, Viewport } from "next";
import { Cabin, Courier_Prime, Literata } from "next/font/google";
import "./globals.css";

const display = Cabin({ variable: "--font-display-face", subsets: ["latin"] });
const body = Literata({ variable: "--font-body-face", subsets: ["latin"], style: ["normal", "italic"] });
const meta = Courier_Prime({
  variable: "--font-meta-face",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Journey",
  description: "Where I've been, one place at a time.",
  // Unlisted: shared by link, kept out of search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f4f1e9",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${meta.variable}`}>
      <body>{children}</body>
    </html>
  );
}

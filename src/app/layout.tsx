import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-family",
  style: ["normal", "italic"],
});

const ui = Outfit({
  subsets: ["latin"],
  variable: "--font-ui",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-family",
});

export const metadata: Metadata = {
  title: "VERIFAI — Multimodal Misinformation Verifier",
  description:
    "Verify claims using text analysis, image consistency, and evidence retrieval. Text-image similarity is not proof of truth.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

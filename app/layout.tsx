import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VOICEPRINT.SCR",
  description:
    "Retro-90s voice visualizer with ElevenLabs voice transformation via an MCP server.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

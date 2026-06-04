import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "VOICEPRINT.SCR",
  description: "Retro-90s voice visualizer with ElevenLabs voice transformation.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Cloudflare Web Analytics — cookieless, no PII. Loads only when a beacon token is configured.
  const cfBeacon = process.env.CF_BEACON_TOKEN;
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        {cfBeacon && (
          <Script
            src="https://static.cloudflareinsights.com/beacon.min.js"
            strategy="afterInteractive"
            data-cf-beacon={`{"token": "${cfBeacon}"}`}
          />
        )}
      </body>
    </html>
  );
}

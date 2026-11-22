"use client";

import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import { HostChrome } from "@/components/HostChrome";

// Replaces the root layout, so it brings its own document, styles and font.
export default function GlobalError() {
  return (
    <html lang="nb">
      <body>
        <title>Toppsvar</title>
        <HostChrome signedIn={false}>
          <h1 className="text-display">
            Noe gikk galt hos oss. Prøv igjen om litt.
          </h1>
        </HostChrome>
      </body>
    </html>
  );
}

"use client";

import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import { HostChrome } from "@/components/HostChrome";
import { ServerError } from "@/components/ServerError";

// Replaces the root layout, so it brings its own document, styles and font.
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="nb">
      <body>
        <HostChrome signedIn={false}>
          <ServerError retry={retry} />
        </HostChrome>
      </body>
    </html>
  );
}

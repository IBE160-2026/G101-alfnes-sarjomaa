import "@fontsource-variable/bricolage-grotesque";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RouteFocus } from "@/components/RouteFocus";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Toppsvar", template: "%s – Toppsvar" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="nb">
      <body>
        <RouteFocus />
        {children}
      </body>
    </html>
  );
}

"use client";

import { HostChrome } from "@/components/HostChrome";

export default function ErrorPage() {
  return (
    <HostChrome signedIn={false}>
      <h1 className="text-display">
        Noe gikk galt hos oss. Prøv igjen om litt.
      </h1>
    </HostChrome>
  );
}

"use client";

import { Button } from "@/components/Button";

// The 500 body shared by every error boundary. Client components cannot export
// metadata, so the <title> is set here; React hoists it into <head>.
export function ServerError({ retry }: { retry: () => void }) {
  return (
    <>
      <title>Noe gikk galt – Toppsvar</title>
      <h1 className="text-display">
        Noe gikk galt hos oss. Prøv igjen om litt.
      </h1>
      <Button
        type="button"
        variant="primary"
        onClick={() => retry()}
        className="mt-8"
      >
        Prøv igjen
      </Button>
    </>
  );
}

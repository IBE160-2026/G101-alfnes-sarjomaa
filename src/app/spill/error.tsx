"use client";

import { ServerError } from "@/components/ServerError";

// Renders inside the spill layout, so the Host keeps "Mine spill" and "Logg ut".
export default function SpillError({ retry }: { retry: () => void }) {
  return <ServerError retry={retry} />;
}

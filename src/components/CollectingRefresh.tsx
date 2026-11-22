"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { COLLECTING_REFRESH_MS } from "@/lib/limits";

// Mounted only while collecting, so polling stops with the state (AD-17).
export function CollectingRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      // A failed or redirected refresh would wipe OnceLinkList's links, their only copy.
      if (!document.querySelector("[data-link]")) router.refresh();
    }, COLLECTING_REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);
  return null;
}

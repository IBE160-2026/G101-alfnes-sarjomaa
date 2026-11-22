"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { focusHeading } from "@/components/RouteFocus";
import { GROUPING_POLL_MS } from "@/lib/limits";

// Mounted only while grouping, so polling stops with the state. When the panel goes, the
// heading that held focus goes with it: focus moves to the in review heading, if present.
export function GroupingRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), GROUPING_POLL_MS);
    return () => {
      clearInterval(id);
      const active = document.activeElement;
      if (!active || active === document.body)
        focusHeading(document.getElementById("gjennomgang"));
    };
  }, [router]);
  return null;
}

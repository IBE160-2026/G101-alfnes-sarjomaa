import { notFound } from "next/navigation";

// Unmatched /svar URLs get /svar's own not-found page, never the root one with Host chrome.
export default function SvarRest() {
  notFound();
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

// A top-bar link that marks itself as the current page.
export function NavLink(props: ComponentProps<typeof Link> & { href: string }) {
  const current = usePathname() === props.href;
  return <Link {...props} aria-current={current ? "page" : undefined} />;
}

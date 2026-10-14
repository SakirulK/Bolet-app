"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";

/** Keep providers alive online; document navigation retains the offline shell. */
export function LocalLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!href) return <a {...props} />;
  return <Link {...props} href={href} onNavigate={event => {
    // Queue the latest draft before its component unmounts. Draft readers await
    // queued writes, so rapid exit/resume also preserves the last keystroke.
    window.dispatchEvent(new Event("brainbo-before-navigate"));
    if (!navigator.onLine) {
      event.preventDefault();
      window.location.assign(href);
    }
  }} />;
}

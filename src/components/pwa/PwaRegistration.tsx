"use client";
import { useEffect } from "react";
export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // The first install precaches every study route. Let the current page finish
    // loading before those downloads compete for bandwidth on a tablet.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const register = () => {
      timer = setTimeout(() => {
        void navigator.serviceWorker.register("/sw.js").catch(() => { /* Install help exposes offline readiness and retry. */ });
      }, 1000);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => { window.removeEventListener("load", register); clearTimeout(timer); };
  }, []);
  return null;
}

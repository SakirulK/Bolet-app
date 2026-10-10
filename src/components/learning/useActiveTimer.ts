"use client";
import { useCallback, useEffect, useMemo, useRef } from "react";

/** Measures foreground study time. Hidden-tab time is deliberately excluded. */
export function useActiveTimer() {
  const accumulated = useRef(0);
  const activeSince = useRef<number | null>(null);

  const read = useCallback(() => accumulated.current + (activeSince.current === null ? 0 : Date.now() - activeSince.current), []);
  const reset = useCallback((value = 0) => {
    accumulated.current = Math.max(0, value);
    activeSince.current = typeof document !== "undefined" && document.visibilityState !== "hidden" ? Date.now() : null;
  }, []);

  useEffect(() => {
    if (document.visibilityState !== "hidden") activeSince.current = Date.now();
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        if (activeSince.current !== null) accumulated.current += Date.now() - activeSince.current;
        activeSince.current = null;
      } else if (activeSince.current === null) activeSince.current = Date.now();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);

  return useMemo(() => ({ read, reset }), [read, reset]);
}

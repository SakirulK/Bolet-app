"use client";
import { useEffect, useRef, useState } from "react";

/** A display timer that counts only while this tab is visible. */
export function useElapsed(startedAt: number, stopped = false, initialMs = 0) {
  const [elapsed, setElapsed] = useState(initialMs);
  const accumulated = useRef(initialMs);
  const visibleSince = useRef<number | null>(null);
  useEffect(() => {
    accumulated.current = initialMs;
    visibleSince.current = !stopped && document.visibilityState === "visible" ? Date.now() : null;
    const read = () => accumulated.current + (visibleSince.current === null ? 0 : Date.now() - visibleSince.current);
    setElapsed(read());
    const visibility = () => {
      if (document.visibilityState === "hidden" && visibleSince.current !== null) {
        accumulated.current += Date.now() - visibleSince.current;
        visibleSince.current = null;
      } else if (!stopped && document.visibilityState === "visible" && visibleSince.current === null) {
        visibleSince.current = Date.now();
      }
      setElapsed(read());
    };
    document.addEventListener("visibilitychange", visibility);
    const timer = stopped ? undefined : window.setInterval(() => setElapsed(read()), 1000);
    return () => { document.removeEventListener("visibilitychange", visibility); if (timer) window.clearInterval(timer); };
  }, [initialMs, startedAt, stopped]);
  return elapsed;
}

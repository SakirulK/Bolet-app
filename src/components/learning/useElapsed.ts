"use client";
import { useEffect, useState } from "react";
export function useElapsed(startedAt: number, stopped = false) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (stopped) return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(timer);
  }, [startedAt, stopped]);
  return elapsed;
}

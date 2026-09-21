"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  applyTheme,
  getSystemDark,
  readStoredTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

const THEME_EVENT = "recall-theme-change";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (value: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function subscribe(onStoreChange: () => void) {
  window.addEventListener(THEME_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onStoreChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
    media.removeEventListener("change", onStoreChange);
  };
}

function getPreferenceSnapshot(): ThemePreference {
  return readStoredTheme();
}

function getResolvedSnapshot(): "light" | "dark" {
  const preference = readStoredTheme();
  const dark =
    preference === "dark" || (preference === "system" && getSystemDark());
  return dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(
    subscribe,
    getPreferenceSnapshot,
    () => "system" as const,
  );
  const resolved = useSyncExternalStore(
    subscribe,
    getResolvedSnapshot,
    () => "light" as const,
  );

  const setPreference = useCallback((value: ThemePreference) => {
    localStorage.setItem(THEME_STORAGE_KEY, value);
    applyTheme(value);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const context = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return (
    <ThemeContext.Provider value={context}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return value;
}

"use client";

import { PwaRegistration } from "@/components/pwa/PwaRegistration";
import type { ReactNode } from "react";
import { StoreProvider } from "@/providers/StoreProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <StoreProvider><PwaRegistration />{children}</StoreProvider>
    </ThemeProvider>
  );
}

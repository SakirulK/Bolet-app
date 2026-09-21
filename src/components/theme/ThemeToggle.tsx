"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/providers/ThemeProvider";

export function ThemeToggle() {
  const { resolved, setPreference } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";

  return (
    <Button
      variant="secondary"
      className="w-full justify-start"
      onClick={() => setPreference(next)}
      aria-label={`Switch to ${next} mode`}
    >
      {resolved === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
      {resolved === "dark" ? "Light mode" : "Dark mode"}
    </Button>
  );
}

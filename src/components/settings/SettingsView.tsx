"use client";

import { DataSettings } from "./DataSettings";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { cn } from "@/lib/cn";
import { useStore } from "@/providers/StoreProvider";
import { useTheme } from "@/providers/ThemeProvider";
import type { ThemePreference } from "@/lib/theme";

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function SettingsView({ embedded = false }: { embedded?: boolean }) {
  const { ready } = useStore();
  const { preference, setPreference } = useTheme();

  if (!ready) return <ScreenSkeleton />;

  return (
    <div className={embedded ? "space-y-6" : "mx-auto max-w-xl space-y-8"}>
      {!embedded && <PageHeader
        eyebrow="Settings"
        title="Make it yours"
        description="Appearance, local storage, backups, and data protection."
      />}

      <section className="panel-surface p-5">
        <h2 className="font-medium text-ink">Appearance</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {THEMES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={preference === item.value}
              onClick={() => setPreference(item.value)}
              className={cn(
                "min-h-12 rounded-2xl border text-sm font-medium",
                preference === item.value
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-edge bg-canvas text-muted hover:text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel-surface p-5 text-sm leading-6">
        <h2 className="font-medium text-ink">Sharing and backups</h2>
        <p className="mt-2 text-muted">Backup & Restore protects your entire BrainBo library and study data. To share one deck, open that deck and choose Share. Import Deck in the Library only adds one new deck and never replaces your account.</p>
      </section>

      <DataSettings />
      <section className="panel-surface p-5 text-sm leading-6 text-muted">
        <h2 className="font-medium text-ink">About BrainBo</h2>
        <a href="/install" className="study-link mt-3">Install BrainBo & offline help</a>
        <p className="mt-2">
          A local-first study app. Decks live in IndexedDB on this browser. Add
          it to your Home Screen on iPad for a full-screen, app-like layout.
        </p>
      </section>
    </div>
  );
}

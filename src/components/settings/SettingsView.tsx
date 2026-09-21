"use client";

import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
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

export function SettingsView() {
  const { ready, prefs, setDailyGoal, setDisplayName } = useStore();
  const { preference, setPreference } = useTheme();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [goalDraft, setGoalDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const name = nameDraft ?? prefs.displayName;
  const goal = goalDraft ?? String(prefs.dailyGoal);

  if (!ready) return <ScreenSkeleton />;

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const parsed = Number.parseInt(goal, 10);
    await setDisplayName(name);
    if (Number.isFinite(parsed) && parsed > 0) {
      await setDailyGoal(parsed);
    }
    setNameDraft(null);
    setGoalDraft(null);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Make it yours"
        description="Appearance and goals stay on this device. No account required."
      />

      <section className="rounded-2xl border border-edge bg-surface p-5">
        <h2 className="font-medium text-ink">Appearance</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {THEMES.map((item) => (
            <button
              key={item.value}
              type="button"
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

      <form
        onSubmit={saveProfile}
        className="space-y-4 rounded-2xl border border-edge bg-surface p-5"
      >
        <h2 className="font-medium text-ink">Study profile</h2>
        <div>
          <label htmlFor="display-name" className="text-sm text-muted">
            What should we call you?
          </label>
          <input
            id="display-name"
            value={name}
            onChange={(event) => setNameDraft(event.target.value)}
            className="mt-1.5 h-12 w-full rounded-2xl border border-edge bg-canvas px-4 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
        </div>
        <div>
          <label htmlFor="daily-goal" className="text-sm text-muted">
            Daily card goal
          </label>
          <input
            id="daily-goal"
            inputMode="numeric"
            value={goal}
            onChange={(event) => setGoalDraft(event.target.value)}
            className="mt-1.5 h-12 w-full rounded-2xl border border-edge bg-canvas px-4 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
        </div>
        <Button type="submit" size="lg">
          {saved ? "Saved" : "Save"}
        </Button>
      </form>

      <section className="rounded-2xl border border-edge bg-surface p-5 text-sm leading-6 text-muted">
        <h2 className="font-medium text-ink">About BOLET</h2>
        <a href="/install" className="study-link mt-3">Install BOLET & offline help</a>
        <p className="mt-2">
          A local-first study app. Decks live in IndexedDB on this browser. Add
          it to your Home Screen on iPad for a full-screen, app-like layout.
        </p>
      </section>
    </div>
  );
}

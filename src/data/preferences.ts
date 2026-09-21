import { getDb } from "@/lib/db";
import type { Prefs } from "@/types";

const DEFAULT_PREFS: Prefs = {
  id: "local",
  dailyGoal: 30,
  displayName: "there",
};

export async function getPrefs(): Promise<Prefs> {
  const db = getDb();
  return (await db.prefs.get("local")) ?? DEFAULT_PREFS;
}

export async function updatePrefs(patch: Partial<Omit<Prefs, "id">>) {
  const db = getDb();
  await db.transaction("rw", db.prefs, async () => {
    await db.prefs.put({ ...await getPrefs(), ...patch });
  });
}

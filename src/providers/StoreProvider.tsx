"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { studyAnalytics } from "@/lib/learning/analytics";
import type { Side } from "@/lib/learning/content";
import { getDb } from "@/lib/db";
import { saveDeck, removeDeck } from "@/data/decks";
import { liveQuery } from "dexie";
import { getPrefs, updatePrefs } from "@/data/preferences";
import type { Card, DeckInput, DailyActivity, Deck, DeckRecord, Prefs, StudyHistory, StudyEvent } from "@/types";

type StoreValue = {
  ready: boolean;
  decks: Deck[];
  prefs: Prefs;
  activity: DailyActivity[];
  history: StudyHistory[];
  events: StudyEvent[];
  todayCount: number;
  streak: number;
  cardsForDeck: (deckId: string) => Card[];
  masteryForDeck: (deckId: string) => number;
  dueCountForDeck: (deckId: string) => number;
  toggleFavorite: (deckId: string) => Promise<void>;
  createDeck: (input: DeckInput) => Promise<string>;
  updateDeck: (deckId: string, input: DeckInput) => Promise<void>;
  deleteDeck: (deckId: string) => Promise<void>;
  setDailyGoal: (goal: number) => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  toggleStarCard: (cardId: string, side: Side) => Promise<void>;
};

const StoreContext = createContext<StoreValue | null>(null);

function composeDecks(records: DeckRecord[], cards: Card[]): Deck[] {
  const byDeck = new Map<string, Card[]>();
  for (const item of cards) {
    const list = byDeck.get(item.deckId) ?? [];
    list.push(item);
    byDeck.set(item.deckId, list);
  }
  return records
    .map((record) => ({
      ...record,
      cards: (byDeck.get(record.id) ?? []).sort((a, b) => (a.position ?? a.createdAt) - (b.position ?? b.createdAt)),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function averageMastery(cards: Card[]): number {
  if (cards.length === 0) return 0;
  return Math.round(
    cards.reduce((sum, card) => sum + card.mastery, 0) / cards.length,
  );
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [records, setRecords] = useState<DeckRecord[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({
    id: "local",
    dailyGoal: 30,
    displayName: "there",
  });
  const [history, setHistory] = useState<StudyHistory[]>([]);
  const [events, setEvents] = useState<StudyEvent[]>([]);
  const [activity, setActivity] = useState<DailyActivity[]>([]);

  const refresh = useCallback(async () => {
    const db = getDb();
    const [nextRecords, nextCards, nextPrefs, nextActivity] = await Promise.all([
      db.decks.toArray(),
      db.cards.toArray(),
      getPrefs(),
      db.activity.toArray(),
    ]);
    setRecords(nextRecords.filter(row => !row.deletedAt && !row.purgedAt));
    setCards(nextCards.filter(row => !row.deletedAt && !row.purgedAt));
    setPrefs(nextPrefs);
    setActivity(nextActivity);
    setReady(true);
  }, []);

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const db = getDb();
      return Promise.all([db.decks.toArray(), db.cards.toArray(), getPrefs(), db.activity.toArray(), db.history.toArray(), db.events.toArray()]);
    }).subscribe({
      next: ([nextRecords, nextCards, nextPrefs, nextActivity, nextHistory, nextEvents]) => {
        setRecords(nextRecords.filter(row => !row.deletedAt && !row.purgedAt)); setCards(nextCards.filter(row => !row.deletedAt && !row.purgedAt)); setPrefs(nextPrefs);
        setActivity(nextActivity); setHistory(nextHistory.filter(row => !(row as unknown as { purgedAt?: number }).purgedAt)); setEvents(nextEvents.filter(row => !(row as unknown as { purgedAt?: number }).purgedAt)); setReady(true); setError("");
      },
      error: () => setError("BOLET could not open local storage. Please allow browser storage and reload."),
    });
    return () => subscription.unsubscribe();
  }, []);

  const decks = useMemo(() => composeDecks(records, cards), [records, cards]);

  const cardsByDeck = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const item of cards) {
      const list = map.get(item.deckId) ?? [];
      list.push(item);
      map.set(item.deckId, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.position ?? a.createdAt) - (b.position ?? b.createdAt));
    return map;
  }, [cards]);

  const analytics = useMemo(() => studyAnalytics(events, history), [events, history]);
  const todayCount = analytics.cards;
  const streak = analytics.streak;

  const cardsForDeck = useCallback(
    (deckId: string) => cardsByDeck.get(deckId) ?? [],
    [cardsByDeck],
  );

  const masteryForDeck = useCallback(
    (deckId: string) => averageMastery(cardsByDeck.get(deckId) ?? []),
    [cardsByDeck],
  );

  const dueCountForDeck = useCallback(
    (deckId: string) => {
      const now = Date.now();
      return (cardsByDeck.get(deckId) ?? []).filter((item) => item.dueAt <= now)
        .length;
    },
    [cardsByDeck],
  );

  const toggleFavorite = useCallback(async (deckId: string) => {
    const db = getDb();
    const deck = await db.decks.get(deckId);
    if (!deck) return;
    await db.decks.update(deckId, {
      favorite: !deck.favorite,
      updatedAt: Date.now(),
    });
    await refresh();
  }, [refresh]);

  const createDeck = useCallback(
    async (input: DeckInput) => {
      const id = await saveDeck(input);
      await refresh();
      return id;
    },
    [refresh],
  );

  const updateDeck = useCallback(async (id: string, input: DeckInput) => {
    await saveDeck(input, id);
    await refresh();
  }, [refresh]);

  const deleteDeck = useCallback(
    async (deckId: string) => {
      await removeDeck(deckId);
      await refresh();
    },
    [refresh],
  );

  const setDailyGoal = useCallback(
    async (goal: number) => {
      await updatePrefs({ dailyGoal: goal });
      await refresh();
    },
    [refresh],
  );

  const setDisplayName = useCallback(
    async (name: string) => {
      await updatePrefs({ displayName: name.trim() || "there" });
      await refresh();
    },
    [refresh],
  );

  const toggleStarCard = useCallback(async (cardId: string, side: Side) => {
    const db = getDb();
    await db.transaction("rw", db.cards, async () => {
      const card = await db.cards.get(cardId);
      if (!card || card.deletedAt || card.purgedAt) throw new Error("This card was deleted.");
      await db.cards.update(cardId, side === "term" ? { termStarred: !card.termStarred, updatedAt: Date.now() } : { definitionStarred: !card.definitionStarred, updatedAt: Date.now() });
    });
    await refresh();
  }, [refresh]);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      decks,
      prefs,
      activity,
      history,
      events,
      todayCount,
      streak,
      cardsForDeck,
      masteryForDeck,
      dueCountForDeck,
      toggleFavorite,
      createDeck,
      updateDeck,
      deleteDeck,
      setDailyGoal,
      setDisplayName,
      toggleStarCard,
    }),
    [
      ready,
      decks,
      prefs,
      activity,
      history,
      events,
      todayCount,
      streak,
      cardsForDeck,
      masteryForDeck,
      dueCountForDeck,
      toggleFavorite,
      createDeck,
      updateDeck,
      deleteDeck,
      setDailyGoal,
      setDisplayName,
      toggleStarCard,
    ],
  );

  if (error) return <div role="alert" className="m-6 rounded-2xl border border-edge bg-surface p-6">{error}<button className="ml-3 underline" onClick={() => window.location.reload()}>Reload</button></div>;

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return value;
}

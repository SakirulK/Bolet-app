import { installJournal } from "@/data/sync/journal";
import type { QueueItem, SyncMeta } from "@/data/sync/model";
import Dexie, { type Table } from "dexie";
import type { Card, DailyActivity, DeckRecord, Prefs, StudyHistory, StudyEvent } from "@/types";

import type { Session } from "@/lib/study-session";

export class RecallDB extends Dexie {
  syncQueue!: Table<QueueItem, string>;
  syncMeta!: Table<SyncMeta, string>;
  history!: Table<StudyHistory, string>;
  events!: Table<StudyEvent, string>;
  sessions!: Table<Session, string>;
  decks!: Table<DeckRecord, string>;
  cards!: Table<Card, string>;
  activity!: Table<DailyActivity, string>;
  prefs!: Table<Prefs, string>;

  constructor(name = "recall") {
    super(name);
    this.version(1).stores({
      decks: "id, subject, favorite, updatedAt, lastStudiedAt",
      cards: "id, deckId, starred, dueAt",
      activity: "date",
      prefs: "id",
    });
    this.version(2).stores({ sessions: "id, deckId, startedAt, endedAt" });
    this.version(3).stores({
      cards: "id, deckId, dueAt, nextReviewAt, masteryLevel",
      history: "id, deckId, mode, startedAt", events: "id, sessionId, cardId, deckId, at",
    }).upgrade(async tx => {
      await tx.table("cards").toCollection().modify(card => {
        // A legacy star represented the whole card, so preserve it on both sides.
        card.termStarred ??= !!card.starred; card.definitionStarred ??= !!card.starred;
        card.nextReviewAt ??= card.dueAt ?? Date.now(); card.reviewCount ??= card.repetitions ?? 0;
        card.correctStreak ??= 0; card.incorrectCount ??= 0; card.dontKnowCount ??= 0;
        card.masteryLevel ??= !card.reviewCount ? "New" : card.mastery >= 80 ? "Mastered" : card.mastery >= 40 ? "Familiar" : "Learning";
      });
      const sessions = await tx.table("sessions").toArray();
      const decks = await tx.table("decks").toArray();
      for (const session of sessions) {
        if (!(session.correct + session.incorrect)) continue;
        await tx.table("history").put({ id: session.id, deckId: session.deckId, title: decks.find(d => d.id === session.deckId)?.title ?? "Deleted deck", mode: "flashcards",
          startedAt: session.startedAt, updatedAt: session.updatedAt, endedAt: session.endedAt,
          correct: session.correct, incorrect: session.incorrect, dontKnow: session.incorrect,
          durationMs: Math.max(0, (session.endedAt ?? session.updatedAt) - session.startedAt), studiedIds: session.studiedIds,
          difficultIds: session.missedIds, masteredIds: [], rounds: 0, ratings: {} });
      }
    });
    this.version(4).stores({ syncQueue: "id, entityType, updatedAt", syncMeta: "id" });
    this.version(5).stores({
      cards: "id, deckId, dueAt, nextReviewAt, masteryLevel",
    }).upgrade(tx => tx.table("cards").toCollection().modify(card => {
      card.starred = !!(card.starred || card.termStarred || card.definitionStarred);
      // Keep old clients coherent without exposing separate stars in BrainBo.
      card.termStarred = card.starred;
      card.definitionStarred = card.starred;
    }));
    installJournal(this);
  }
}

let db: RecallDB | undefined;

export function getDb(): RecallDB {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser.");
  }
  if (!db) {
    db = new RecallDB();
  }
  return db;
}

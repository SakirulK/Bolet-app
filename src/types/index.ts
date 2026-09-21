export type Card = {
  id: string;
  deckId: string;
  term: string;
  definition: string;
  notes?: string;
  position?: number;
  /** Kept only for backwards-compatible backups; never used for new star controls. */
  starred?: boolean;
  termStarred: boolean;
  definitionStarred: boolean;
  lastReviewedAt?: number;
  nextReviewAt: number;
  reviewCount: number;
  correctStreak: number;
  incorrectCount: number;
  dontKnowCount: number;
  masteryLevel: MasteryLevel;
  createdAt: number;
  updatedAt: number;
  /** 0–100 display mastery. SRS fields below are intentionally simple. */
  mastery: number;
  ease: number;
  intervalDays: number;
  repetitions: number;
  dueAt: number;
};

export type Deck = {
  id: string;
  title: string;
  description: string;
  subject: string;
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  lastStudiedAt?: number;
  cards: Card[];
};

export type DeckRecord = Omit<Deck, "cards">;

export type DailyActivity = {
  date: string;
  cardsStudied: number;
};

export type Prefs = {
  id: "local";
  dailyGoal: number;
  displayName: string;
};

export type CreateDeckInput = {
  title: string;
  description: string;
  subject: string;
};

export type CardInput = { id?: string; term: string; definition: string };
export type DeckInput = CreateDeckInput & { cards: CardInput[] };

export type MasteryLevel = "New" | "Learning" | "Familiar" | "Mastered";
export type StudyMode = "flashcards" | "learn" | "match" | "test" | "review";
export type StudyHistory = {
  id: string; deckId: string; title: string; mode: StudyMode; startedAt: number; updatedAt: number; endedAt?: number;
  correct: number; incorrect: number; dontKnow: number; durationMs: number; studiedIds: string[]; difficultIds: string[];
  masteredIds: string[]; rounds: number; ratings: Record<string, number>;
};
export type StudyEvent = {
  id: string; sessionId: string; cardId: string; deckId: string; mode: StudyMode; at: number;
  correct: boolean; dontKnow: boolean; rating: "again" | "hard" | "good" | "easy";
  durationMs: number; mastered: boolean; override?: boolean; answer?: string;
};

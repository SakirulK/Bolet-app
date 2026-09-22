export type DurableRecord = { deletedAt?: number | null; purgedAt?: number };

export type Card = DurableRecord & {
  id: string;
  deckId: string;
  term: string;
  definition: string;
  notes?: string;
  /** Scheduling snapshot before event-based cloud reconciliation. */
  _reviewBase?: { card: Record<string, unknown>; eventIds: string[] };
  /** Explicit aliases for the definition; absent on older cards. */
  acceptedAnswers?: string[];
  /** Explicit aliases for the term when answering in reverse. */
  acceptedTermAnswers?: string[];
  position?: number;
  /** One star applies to the whole term/definition pair. */
  starred: boolean;
  /** Legacy sync fields retained so older clients and backups remain readable. */
  termStarred?: boolean;
  definitionStarred?: boolean;
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

export type Deck = DurableRecord & {
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
  theme?: "system" | "light" | "dark";
  profileConfigured?: boolean;
  dailyGoal: number;
  displayName: string;
};

export type CreateDeckInput = {
  title: string;
  description: string;
  subject: string;
};

export type CardInput = { original?: { term: string; definition: string; acceptedAnswers?: string[]; acceptedTermAnswers?: string[]; position?: number }; id?: string; term: string; definition: string; acceptedAnswers?: string[]; acceptedTermAnswers?: string[] };
export type DeckInput = CreateDeckInput & { cards: CardInput[]; original?: CreateDeckInput; removedCardIds?: string[] };

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

import type { CardInput, Deck, DeckInput } from "@/types";

export const BRAINBO_DECK_FORMAT = "brainbo-deck" as const;
export const BRAINBO_DECK_VERSION = 1 as const;
export const MAX_BRAINBO_DECK_BYTES = 5_000_000;
const MAX_CARDS = 10_000;

export type SharedDeckCard = {
  term: string;
  definition: string;
  notes?: string;
  acceptedAnswers?: string[];
  acceptedTermAnswers?: string[];
};

export type SharedDeck = {
  title: string;
  description: string;
  subject: string;
  cards: SharedDeckCard[];
};

export type BrainBoDeckFile = {
  format: typeof BRAINBO_DECK_FORMAT;
  version: typeof BRAINBO_DECK_VERSION;
  exportedAt: string;
  deck: SharedDeck;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, label: string, required = false, max = 50_000) {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${label} is missing.`);
    return "";
  }
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const cleaned = value.trim();
  if (required && !cleaned) throw new Error(`${label} is missing.`);
  if (cleaned.length > max) throw new Error(`${label} is too long.`);
  return cleaned;
}

function aliases(value: unknown, label: string) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > 100) throw new Error(`${label} is malformed.`);
  const result = value.map((item, index) => text(item, `${label} ${index + 1}`, true, 1_000));
  return result.length ? result : undefined;
}

function sanitizeDeck(value: unknown): SharedDeck {
  const source = record(value);
  if (!source) throw new Error("The deck content is malformed.");
  if (!Array.isArray(source.cards)) throw new Error("The deck cards are missing or malformed.");
  if (source.cards.length > MAX_CARDS) throw new Error(`This deck has more than ${MAX_CARDS.toLocaleString()} cards.`);
  const cards = source.cards.map((value, index) => {
    const card = record(value);
    if (!card) throw new Error(`Card ${index + 1} is malformed.`);
    const notes = text(card.notes, `Card ${index + 1} notes`);
    const acceptedAnswers = aliases(card.acceptedAnswers, `Card ${index + 1} accepted answers`);
    const acceptedTermAnswers = aliases(card.acceptedTermAnswers, `Card ${index + 1} accepted term answers`);
    return {
      term: text(card.term, `Card ${index + 1} term`, true),
      definition: text(card.definition, `Card ${index + 1} definition`, true),
      ...(notes ? { notes } : {}),
      ...(acceptedAnswers ? { acceptedAnswers } : {}),
      ...(acceptedTermAnswers ? { acceptedTermAnswers } : {}),
    } satisfies SharedDeckCard;
  });
  return {
    title: text(source.title, "Deck title", true, 300),
    description: text(source.description, "Deck description", false, 20_000),
    subject: text(source.subject, "Deck subject", false, 300) || "Unsorted",
    cards,
  };
}

/** Build a content-only snapshot. Stars, schedules, progress, IDs, deletion state,
 * history, sync metadata, and account ownership are intentionally omitted. */
export function createBrainBoDeckFile(deck: Deck, exportedAt = new Date().toISOString()): BrainBoDeckFile {
  return {
    format: BRAINBO_DECK_FORMAT,
    version: BRAINBO_DECK_VERSION,
    exportedAt,
    deck: sanitizeDeck(deck),
  };
}

export function serializeBrainBoDeck(deck: Deck) {
  return JSON.stringify(createBrainBoDeckFile(deck), null, 2);
}

export function validateBrainBoDeck(value: unknown): { file: BrainBoDeckFile; legacy: boolean } {
  const source = record(value);
  if (!source) throw new Error("This is not a valid BrainBo deck file.");
  const legacy = source.format === undefined && source.version === 1 && source.deck !== undefined;
  if (!legacy && source.format !== BRAINBO_DECK_FORMAT) throw new Error("This file is not a BrainBo deck export.");
  if (source.version !== BRAINBO_DECK_VERSION) throw new Error("This BrainBo deck version is not supported.");
  const deck = sanitizeDeck(source.deck);
  return {
    legacy,
    file: {
      format: BRAINBO_DECK_FORMAT,
      version: BRAINBO_DECK_VERSION,
      exportedAt: typeof source.exportedAt === "string" ? source.exportedAt : new Date(0).toISOString(),
      deck,
    },
  };
}

export function parseBrainBoDeck(textValue: string) {
  if (new TextEncoder().encode(textValue).byteLength > MAX_BRAINBO_DECK_BYTES)
    throw new Error("Choose a BrainBo deck file smaller than 5 MB.");
  let value: unknown;
  try { value = JSON.parse(textValue); }
  catch { throw new Error("This file does not contain valid JSON."); }
  return validateBrainBoDeck(value);
}

export function sharedDeckInput(deck: SharedDeck, title = deck.title): DeckInput {
  const cards: CardInput[] = deck.cards.map(card => ({
    term: card.term,
    definition: card.definition,
    notes: card.notes,
    acceptedAnswers: card.acceptedAnswers,
    acceptedTermAnswers: card.acceptedTermAnswers,
  }));
  return { title: title.trim(), description: deck.description, subject: deck.subject, cards };
}

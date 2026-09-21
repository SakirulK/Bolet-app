import type { Card } from "@/types";
import { opposite, promptSide, shuffled, type Direction, type Side } from "./content";
import { normalizeAnswer } from "./grading";
export type QuestionType = "choice" | "written" | "boolean";
export type Question = { id: string; cardId: string; side: Side; prompt: string; expected: string; type: QuestionType; choices: string[]; pairing?: string };
export function makeQuestion(card: Card, cards: Card[], direction: Direction, type: QuestionType, index: number, falsePair = false): Question {
  const side = promptSide(direction, index), answerSide = opposite(side), expected = card[answerSide];
  const distractors = shuffled(cards.filter(other => other.id !== card.id && normalizeAnswer(other[side]) !== normalizeAnswer(card[side])).map(other => other[answerSide]))
    .filter((value, i, list) => normalizeAnswer(value) !== normalizeAnswer(expected) && list.findIndex(item => normalizeAnswer(item) === normalizeAnswer(value)) === i);
  const actualType = type === "choice" && !distractors.length ? "written" : type;
  return { id: crypto.randomUUID(), cardId: card.id, side, prompt: card[side], expected: actualType === "boolean" ? String(!falsePair || !distractors.length) : expected,
    pairing: actualType === "boolean" ? (falsePair && distractors.length ? distractors[0] : expected) : undefined,
    type: actualType, choices: actualType === "choice" ? shuffled([expected, ...distractors.slice(0, 3)]) : actualType === "boolean" ? ["true", "false"] : [] };
}
export function buildTest(cards: Card[], count: number, types: QuestionType[], direction: Direction, shuffle: boolean): Question[] {
  const source = (shuffle ? shuffled(cards) : cards).slice(0, Math.min(count, cards.length));
  let tfIndex = 0;
  return source.map((card, index) => { const type = types[index % types.length]; return makeQuestion(card, cards, direction, type, index, type === "boolean" && tfIndex++ % 2 === 1); });
}

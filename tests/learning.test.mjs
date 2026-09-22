import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load-ts.mjs';
const { createLearnState, advanceLearn } = load('src/lib/learning/adaptive.ts');
const { recommendRounds } = load('src/lib/learning/recommendation.ts');
const { filterCards, shuffled } = load('src/lib/learning/content.ts');
const { makeQuestion, buildTest } = load('src/lib/learning/questions.ts');
const { calculateNextReview } = load('src/lib/learning/scheduling.ts');
const cards = Array.from({ length: 12 }, (_, i) => ({ id: String(i), term: `Term ${i}`, definition: `Definition ${i}`, starred: i < 3, reviewCount: 0, mastery: 0 }));
for (let rounds = 1; rounds <= 10; rounds++) test(`${rounds} selected rounds all contain actual questions and are counted truthfully`, () => {
  let state = createLearnState(cards.slice(0, 4).map(card => card.id), rounds);
  const visits = new Map(); let attempts = 0;
  while (!state.done && attempts < 200) {
    visits.set(state.round, (visits.get(state.round) ?? 0) + 1);
    const next = advanceLearn(state, true, false);
    assert.ok(next.round === state.round || next.round === state.round + 1);
    state = next; attempts++;
  }
  assert.equal(state.done, true); assert.equal(state.completedRounds, rounds);
  assert.deepEqual([...visits.keys()], Array.from({ length: rounds }, (_, i) => i + 1));
  if (rounds > 3) assert.ok(visits.get(3) < visits.get(1));
});
test('misses and Don’t Know return later without infinite loops; overrides do not requeue as misses', () => {
  for (const dontKnow of [true, false]) {
    let state = createLearnState(['a', 'b', 'c', 'd', 'e'], 1);
    state = advanceLearn(state, false, dontKnow);
    assert.deepEqual(state.queue, ['b', 'c', 'd', 'a', 'e']);
    assert.equal(state.stats.a.incorrectAttempts, 1);
    assert.equal(state.stats.a.dontKnowCount, Number(dontKnow));
    for (let i = 0; !state.done && i < 20; i++) state = advanceLearn(state, false, true);
    assert.equal(state.done, true);
  }
  const override = advanceLearn(createLearnState(['a', 'b'], 1), true, false);
  assert.deepEqual(override.queue, ['b']); assert.equal(override.stats.a.incorrectAttempts, 0);
});
test('card-level starred filtering and shuffle retain membership without mutating source order', () => {
  assert.equal(filterCards(cards, 'all').length, 12);
  assert.deepEqual(filterCards(cards, 'starred').map(card => card.id), ['0', '1', '2']);
  assert.deepEqual(shuffled(cards).map(card => card.id).sort(), cards.map(card => card.id).sort());
});
test('recommendations are bounded and only very weak evidence recommends ten', () => {
  assert.equal(recommendRounds(cards), 6);
  assert.equal(recommendRounds(cards.map(card => ({ ...card, mastery: 90, reviewCount: 10 }))), 2);
  assert.equal(recommendRounds(cards, [{ correct: 1, incorrect: 29, dontKnow: 20, startedAt: 1 }]), 10);
  for (const count of [0, 1, 10, 100]) { const n = recommendRounds(cards.slice(0, count)); assert.ok(n >= 1 && n <= 10); }
});
test('questions have distinct distractors, reverse aliases, no repeated cards and balanced true/false', () => {
  const question = makeQuestion({ ...cards[0], acceptedAnswers: ['alias'], acceptedTermAnswers: ['reverse'] }, cards, 'term', 'choice', 0);
  assert.equal(question.choices.length, 4); assert.equal(new Set(question.choices).size, 4); assert.ok(question.choices.includes(question.expected));
  assert.deepEqual(makeQuestion({ ...cards[0], acceptedTermAnswers: ['reverse'] }, cards, 'definition', 'written', 1).acceptedAnswers, ['reverse']);
  const exam = buildTest(cards, 20, ['boolean'], 'mixed', true);
  assert.equal(exam.length, 12); assert.equal(new Set(exam.map(q => q.cardId)).size, 12);
  assert.equal(exam.filter(q => q.expected === 'true').length, 6);
  assert.equal(exam.filter(q => q.side === 'term').length, 6);
  assert.equal(makeQuestion(cards[0], [cards[0]], 'term', 'choice', 0).type, 'written');
});
test('scheduling is bounded; one easy answer never creates mastery', () => {
  let card = { ...cards[0], intervalDays: 0, correctStreak: 0, incorrectCount: 0, dontKnowCount: 0, repetitions: 0 };
  const now = 100;
  const first = calculateNextReview(card, 'easy', now);
  assert.notEqual(first.masteryLevel, 'Mastered');
  for (let i = 0; i < 30; i++) card = { ...card, ...calculateNextReview(card, 'easy', now) };
  assert.equal(card.masteryLevel, 'Mastered'); assert.ok(card.intervalDays <= 365);
  const again = calculateNextReview(card, 'again', now, true);
  assert.equal(again.correctStreak, 0); assert.equal(again.dontKnowCount, 1); assert.equal(again.nextReviewAt, now + 600000);
});

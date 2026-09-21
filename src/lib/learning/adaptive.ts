export type CardPractice = { correctAttempts: number; incorrectAttempts: number; dontKnowCount: number; consecutiveCorrect: number };
export type LearnState = { ids: string[]; queue: string[]; round: number; rounds: number; completedRounds: number; visits: Record<string, number>; stats: Record<string, CardPractice>; done: boolean };
export function createLearnState(ids: string[], rounds: number): LearnState { return { ids, queue: [...ids], round: 1, rounds: Math.max(1, Math.min(10, rounds)), completedRounds: 0, visits: {}, stats: {}, done: !ids.length }; }
export function advanceLearn(state: LearnState, correct: boolean, dontKnow: boolean): LearnState {
  const [id, ...queue] = state.queue;
  if (!id || state.done) return state;
  const old = state.stats[id] ?? { correctAttempts: 0, incorrectAttempts: 0, dontKnowCount: 0, consecutiveCorrect: 0 };
  const stats = { ...state.stats, [id]: { correctAttempts: old.correctAttempts + Number(correct), incorrectAttempts: old.incorrectAttempts + Number(!correct), dontKnowCount: old.dontKnowCount + Number(dontKnow), consecutiveCorrect: correct ? old.consecutiveCorrect + 1 : 0 } };
  const visits = { ...state.visits, [id]: (state.visits[id] ?? 0) + 1 };
  // A miss always earns a later retry on its first visit in a round. Limit extra
  // retries to one per round so a difficult card cannot trap the learner forever.
  if (!correct && visits[id] < 2) queue.splice(Math.min(3, queue.length), 0, id);
  let round = state.round, nextVisits = visits, completedRounds = state.completedRounds;
  if (!queue.length) {
    completedRounds++;
    if (round < state.rounds) {
      round++; nextVisits = {};
      queue.push(...state.ids.filter(cardId => round === state.rounds || (stats[cardId]?.consecutiveCorrect ?? 0) < 2)
        .sort((a, b) => (stats[b]?.dontKnowCount ?? 0) - (stats[a]?.dontKnowCount ?? 0)));
      // Every selected round contains actual practice. When all cards are confident,
      // use a rotating maintenance card instead of counting an empty round.
      if (!queue.length) queue.push(state.ids[(round - 1) % state.ids.length]);
    }
  }
  return { ...state, queue, round, completedRounds, visits: nextVisits, stats, done: !queue.length };
}

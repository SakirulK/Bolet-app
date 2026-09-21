"use client";
import { LocalLink } from "@/components/ui/LocalLink";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StarButton } from "./StarButton";
import { QuestionAnswer } from "./QuestionAnswer";
import { ContentSelect, DirectionSelect, Section, Toggle, Metrics, fieldClass, durationLabel } from "./StudyControls";
import { filterCards, emptyContent, shuffled, studyUrl, type ContentFilter, type Direction } from "@/lib/learning/content";
import { gradeWrittenAnswer, normalizeAnswer } from "@/lib/learning/grading";
import { recommendRounds } from "@/lib/learning/recommendation";
import { makeQuestion, type QuestionType, type Question } from "@/lib/learning/questions";
import { createLearnState, advanceLearn, type LearnState } from "@/lib/learning/adaptive";
import { newHistory, commitAttempts } from "@/data/history";
import { useStore } from "@/providers/StoreProvider";
import type { Deck, StudyHistory } from "@/types";

type Round = { state: LearnState; question: Question; history: StudyHistory };
export function LearnMode({ deck, initialFilter = "all" }: { deck: Deck; initialFilter?: ContentFilter }) {
  const { history } = useStore();
  const [filter, setFilter] = useState(initialFilter), [shuffle, setShuffle] = useState(true);
  const [direction, setDirection] = useState<Direction>("term");
  const [choice, setChoice] = useState(true), [written, setWritten] = useState(true), [smart, setSmart] = useState(false);
  const [roundCount, setRoundCount] = useState("auto");
  const [round, setRound] = useState<Round | null>(null);
  const [answer, setAnswer] = useState(""), [feedback, setFeedback] = useState<{ correct: boolean; dontKnow: boolean; original: boolean } | null>(null);
  const [retype, setRetype] = useState<string | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const lock = useRef(false), started = useRef(0);
  const eligible = filterCards(deck.cards, filter);
  const recommended = recommendRounds(eligible, history.filter(item => item.deckId === deck.id));
  function questionFor(state: LearnState, index: number) {
    const types: QuestionType[] = [...(choice ? ["choice" as const] : []), ...(written ? ["written" as const] : [])];
    const card = deck.cards.find(card => card.id === state.queue[0])!;
    return makeQuestion(card, deck.cards.filter(card => state.ids.includes(card.id)), direction, types[index % types.length], index);
  }
  function start(ids?: string[]) {
    const cards = ids ? deck.cards.filter(card => ids.includes(card.id)) : eligible;
    if (!cards.length || (!choice && !written)) return;
    const state = createLearnState((shuffle ? shuffled(cards) : cards).map(card => card.id), roundCount === "auto" ? recommendRounds(cards, history.filter(item => item.deckId === deck.id)) : Number(roundCount));
    setRound({ state, question: questionFor(state, 0), history: newHistory(deck.id, deck.title, "learn") });
    setAnswer(""); setFeedback(null); setRetype(null); setError(""); started.current = Date.now();
  }
  function grade(dontKnow = false) {
    if (!round || feedback) return;
    const correct = !dontKnow && (round.question.type === "written" ? gradeWrittenAnswer(answer, round.question.expected, smart) : answer === round.question.expected);
    setFeedback({ correct, dontKnow, original: correct });
  }
  async function next() {
    if (!round || !feedback || lock.current) return;
    if (retype !== null && normalizeAnswer(retype) !== normalizeAnswer(round.question.expected)) { setError("Retype the displayed answer before continuing, or skip retyping."); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const state = advanceLearn(round.state, feedback.correct, feedback.dontKnow);
      const saved = await commitAttempts({ ...round.history, rounds: state.done ? state.rounds : state.round - 1 }, [{ id: round.question.id, cardId: round.question.cardId, correct: feedback.correct, dontKnow: feedback.dontKnow,
        rating: feedback.correct ? round.question.type === "choice" ? "hard" : "good" : "again", override: feedback.correct !== feedback.original, answer, durationMs: Date.now() - started.current }], state.done);
      setRound({ state, history: saved, question: state.done ? round.question : questionFor(state, saved.correct + saved.incorrect) });
      setFeedback(null); setAnswer(""); setRetype(null); started.current = Date.now();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save progress. Try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  const card = deck.cards.find(card => card.id === round?.question.cardId);
  if (!round) return <div className="mx-auto max-w-2xl space-y-6"><header><p className="text-sm text-accent">{deck.title}</p><h1 className="font-display text-3xl">Set up Learn</h1><p className="mt-2 text-muted">Active recall, with extra practice where you need it.</p></header>
    <Section title="Content"><ContentSelect value={filter} onChange={setFilter} /><Toggle label="Shuffle" value={shuffle} onChange={setShuffle} /><p className="text-sm text-muted">{eligible.length} eligible cards</p></Section>
    <Section title="Answer direction"><DirectionSelect value={direction} onChange={setDirection} /></Section>
    <Section title="Question types"><Toggle label="Multiple Choice" value={choice} onChange={setChoice} /><Toggle label="Written Answer" value={written} onChange={setWritten} />{!choice && !written && <p role="alert" className="text-danger">Choose at least one question type.</p>}<Toggle label="Smart Grading · local typo tolerance" value={smart} onChange={setSmart} /></Section>
    <Section title="Number of rounds"><label className="block text-sm">Rounds<select value={roundCount} onChange={e => setRoundCount(e.target.value)} className={fieldClass}><option value="auto">Automatic / Recommended</option>{Array.from({ length: 10 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></label><p className="text-sm text-muted">Recommended: {recommended} rounds. Based on mastery and recent performance.</p><p className="text-sm text-muted">Confident cards leave the rotation until the final check. Misses get a later retry each round.</p></Section>
    {!eligible.length && <p role="status" className="rounded-2xl border border-dashed border-edge p-5">{emptyContent(filter)}</p>}
    <div className="flex flex-wrap gap-3"><Button size="lg" disabled={!eligible.length || (!choice && !written)} onClick={() => start()}>Start Learning</Button><LocalLink className="study-link" href={`/library/${deck.id}`}>Back to Deck</LocalLink></div>
  </div>;
  const attempts = round.history.correct + round.history.incorrect;
  const mastered = Object.values(round.state.stats).filter(item => item.consecutiveCorrect >= 2).length;
  if (round.state.done) return <div className="mx-auto max-w-3xl space-y-6"><h1 className="font-display text-3xl">Learning complete</h1><Metrics values={[["Accuracy", attempts ? `${Math.round(round.history.correct / attempts * 100)}%` : "—"], ["Questions answered", attempts], ["Cards mastered", mastered], ["Still learning", round.state.ids.length - mastered], ["Don’t Know", round.history.dontKnow], ["Time studied", durationLabel(round.history.durationMs)], ["Rounds completed", round.state.rounds]]} />
    <Section title="Difficult cards">{round.history.difficultIds.length ? <ul className="divide-y divide-edge">{deck.cards.filter(card => round.history.difficultIds.includes(card.id)).map(card => <li key={card.id} className="flex items-center justify-between py-3"><span>{card.term}</span><StarButton card={card} side="term" /></li>)}</ul> : <p className="text-muted">No missed answers this round.</p>}</Section>
    <div className="flex flex-wrap gap-3"><Button onClick={() => start(round.state.ids)}>Continue Learning</Button><Button variant="secondary" disabled={!round.history.difficultIds.length} onClick={() => start(round.history.difficultIds)}>Review Difficult Cards</Button><LocalLink className="study-link" href={studyUrl(deck.id, "learn", undefined, "any")}>Study Starred</LocalLink><LocalLink className="study-link" href={`/library/${deck.id}`}>Back to Deck</LocalLink></div></div>;
  if (!card) return <p role="alert">This card was deleted. <LocalLink href={`/library/${deck.id}`} className="underline">Back to Deck</LocalLink></p>;
  return <div className="mx-auto max-w-3xl space-y-6"><header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-accent">{deck.title} · Learn</p><h1 className="font-display text-2xl">Round {round.state.round} of {round.state.rounds}</h1></div><LocalLink className="study-link" href={`/library/${deck.id}`}>Back to Deck</LocalLink></header>
    <ProgressBar label={`${round.state.queue.length} remaining in this round · ${attempts} answered`} value={(round.state.round - 1) / round.state.rounds * 100} />
    <div className="flex items-start justify-between gap-4"><h2 className="whitespace-pre-wrap break-words font-display text-3xl">{round.question.prompt}</h2><StarButton card={card} side={round.question.side} /></div>
    <form className="space-y-5" onSubmit={e => { e.preventDefault(); if (feedback) void next(); else grade(); }}>
      <QuestionAnswer question={round.question} value={answer} onChange={setAnswer} disabled={!!feedback || busy} />
      {!feedback ? <div className="flex gap-3"><Button type="submit" disabled={!answer.trim()}>Check Answer</Button><Button variant="secondary" onClick={() => grade(true)}>Don’t Know</Button></div> : <div className="space-y-4 rounded-2xl bg-surface-2 p-5" aria-live="polite"><p className="font-medium">{feedback.dontKnow ? "Let’s practice this again." : feedback.correct ? "Correct" : "Not quite. This card will return later."}</p><p className="whitespace-pre-wrap break-words">Correct answer: {round.question.expected}</p>
        {round.question.type === "written" && !feedback.dontKnow && <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy || feedback.correct} onClick={() => { setFeedback({ ...feedback, correct: true }); setRetype(null); }}>Mark as Correct</Button><Button variant="secondary" disabled={busy || !feedback.correct} onClick={() => setFeedback({ ...feedback, correct: false })}>Mark as Incorrect</Button></div>}
        {round.question.type === "written" && !feedback.correct && <>{retype === null ? <Button variant="secondary" onClick={() => setRetype("")}>Retype answer</Button> : <label className="block text-sm">Retype the correct answer<input className={fieldClass} value={retype} onChange={e => setRetype(e.target.value)} /><Button variant="ghost" onClick={() => setRetype(null)}>Skip retyping</Button></label>}<p className="text-sm text-muted">Retyping reinforces the answer; it does not erase this attempt.</p></>}
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Continue"}</Button></div>}
    </form>{error && <p role="alert" className="text-danger">{error}</p>}</div>;
}

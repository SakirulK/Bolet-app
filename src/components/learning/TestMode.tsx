"use client";
import { LocalLink } from "@/components/ui/LocalLink";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ContentSelect, DirectionSelect, Section, Toggle, Metrics, fieldClass, durationLabel } from "./StudyControls";
import { QuestionAnswer } from "./QuestionAnswer";
import { StarButton } from "./StarButton";
import { filterCards, emptyContent, opposite, studyUrl, type ContentFilter, type Direction } from "@/lib/learning/content";
import { buildTest, type QuestionType, type Question } from "@/lib/learning/questions";
import { gradeWrittenAnswer } from "@/lib/learning/grading";
import { newHistory, commitAttempts } from "@/data/history";
import type { Deck, StudyHistory } from "@/types";
type Exam = { questions: Question[]; history: StudyHistory; answers: Record<string, string>; grades: Record<string, boolean>; phase: "taking" | "manual" | "results"; submittedAt?: number };
export function TestMode({ deck, initialFilter = "all" }: { deck: Deck; initialFilter?: ContentFilter }) {
  const [filter, setFilter] = useState(initialFilter), [count, setCount] = useState("all"), [custom, setCustom] = useState(5);
  const [types, setTypes] = useState<QuestionType[]>(["choice", "written"]), [direction, setDirection] = useState<Direction>("term");
  const [strict, setStrict] = useState(true), [auto, setAuto] = useState(true), [shuffle, setShuffle] = useState(true);
  const [smart, setSmart] = useState(false);
  const [exam, setExam] = useState<Exam | null>(null), [index, setIndex] = useState(0), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  const eligible = filterCards(deck.cards, filter), questionCount = count === "all" ? eligible.length : count === "custom" ? custom : Number(count);
  function start(ids?: string[]) {
    const cards = ids ? deck.cards.filter(card => ids.includes(card.id)) : eligible;
    const questions = buildTest(cards, ids ? cards.length : questionCount, types, direction, shuffle);
    if (!questions.length || !types.length) return;
    setExam({ questions, history: newHistory(deck.id, deck.title, "test"), answers: {}, grades: {}, phase: "taking" }); setIndex(0); setError("");
  }
  function automatic(question: Question, answers: Record<string, string>) { const answer = answers[question.id] ?? ""; return question.type === "written" ? gradeWrittenAnswer(answer, question.expected, { smartGrading: smart, allowMinorSpellingMistakes: !strict, acceptedAnswers: question.acceptedAnswers }) : answer === question.expected; }
  async function saveResults(current: Exam) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const time = (current.submittedAt ?? Date.now()) - current.history.startedAt;
      const history = await commitAttempts(current.history, current.questions.map(question => ({ id: question.id, cardId: question.cardId, correct: !!current.grades[question.id],
        rating: current.grades[question.id] ? question.type === "written" ? "good" : "hard" : "again", answer: current.answers[question.id] ?? "", durationMs: time / current.questions.length })), true);
      setExam({ ...current, phase: "results", history }); setConfirm(false);
    } catch { setError("Could not save the test. Your answers are still here; try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  function submit() {
    if (!exam) return;
    const current = { ...exam, submittedAt: Date.now() };
    if (auto) { current.grades = Object.fromEntries(current.questions.map(question => [question.id, automatic(question, current.answers)])); void saveResults(current); }
    else { setExam({ ...current, phase: "manual", grades: {} }); setConfirm(false); setIndex(0); }
  }
  const unanswered = exam?.questions.filter(question => !exam.answers[question.id]?.trim()).length ?? 0;
  if (!exam) return <div className="mx-auto max-w-2xl space-y-6"><header><p className="text-sm text-accent">{deck.title}</p><h1 className="font-display text-3xl">Set up Test</h1><p className="mt-2 text-muted">Check what you know. Results stay hidden until submission.</p></header>
    <Section title="Content"><ContentSelect value={filter} onChange={setFilter} /><label className="block text-sm">Number of questions<select className={fieldClass} value={count} onChange={e => setCount(e.target.value)}>{[5, 10, 20].map(n => <option key={n} value={n} disabled={n > eligible.length}>{n}</option>)}<option value="custom">Custom</option><option value="all">All ({eligible.length})</option></select></label>{count === "custom" && <label className="block text-sm">Custom question count<input className={fieldClass} type="number" min={1} max={eligible.length} value={custom} onChange={e => setCustom(Number(e.target.value))} /></label>}<p className="text-sm text-muted">{eligible.length} eligible cards. No repeated questions.</p></Section>
    <Section title="Question types">{([["choice", "Multiple Choice"], ["written", "Written Answer"], ["boolean", "True / False"]] as const).map(([type, label]) => <Toggle key={type} label={label} value={types.includes(type)} onChange={checked => setTypes(checked ? [...types, type] : types.filter(item => item !== type))} />)}{!types.length && <p role="alert" className="text-danger">Choose at least one question type.</p>}<p className="text-sm text-muted">If no distinct distractor exists, a multiple-choice question becomes written.</p></Section>
    <Section title="Answer direction"><DirectionSelect value={direction} onChange={setDirection} /></Section><Section title="Grading and order"><Toggle label="Allow minor spelling mistakes" value={!strict} onChange={value => setStrict(!value)} /><Toggle label="Smart Grading" value={smart} onChange={setSmart} /><p className="text-sm text-muted">Spelling is exact unless minor mistakes are enabled. Smart Grading separately accepts only explicitly saved aliases.</p><Toggle label="Automatically grade test" value={auto} onChange={setAuto} /><Toggle label="Shuffle questions" value={shuffle} onChange={setShuffle} /></Section>
    {!eligible.length && <p role="status">{emptyContent(filter)}</p>}{(questionCount > eligible.length || questionCount < 1 || !Number.isInteger(questionCount)) && <p role="alert" className="text-danger">Choose between 1 and {eligible.length} questions.</p>}
    <div className="flex gap-3"><Button size="lg" disabled={!eligible.length || !types.length || questionCount > eligible.length || questionCount < 1 || !Number.isInteger(questionCount)} onClick={() => start()}>Start Test</Button><LocalLink className="study-link" href={`/library/${deck.id}`}>Back to Deck</LocalLink></div></div>;
  if (exam.phase === "results") { const total = exam.questions.length, incorrectIds = exam.questions.filter(question => !exam.grades[question.id]).map(question => question.cardId); return <div className="mx-auto max-w-3xl space-y-6"><h1 className="font-display text-3xl">Test results</h1><Metrics values={[["Percentage", `${Math.round(exam.history.correct / total * 100)}%`], ["Correct", exam.history.correct], ["Incorrect", exam.history.incorrect], ["Total questions", total], ["Time", durationLabel(exam.history.durationMs)]]} />
    <div className="flex flex-wrap gap-3"><Button onClick={() => start(exam.questions.map(question => question.cardId))}>Retake Test</Button>{incorrectIds.length > 0 && <><Button variant="secondary" onClick={() => start(incorrectIds)}>Test Incorrect</Button><LocalLink className="study-link" href={studyUrl(deck.id, "learn", incorrectIds)}>Learn Incorrect</LocalLink><LocalLink className="study-link" href={studyUrl(deck.id, "flashcards", incorrectIds)}>Flashcards for Incorrect</LocalLink></>}<LocalLink className="study-link" href={studyUrl(deck.id, "test", undefined, "any")}>Study Starred</LocalLink><LocalLink className="study-link" href={`/library/${deck.id}`}>Back to Deck</LocalLink></div>
    <Section title="Detailed review"><ol className="divide-y divide-edge">{exam.questions.map((question, i) => { const card = deck.cards.find(card => card.id === question.cardId); return <li key={question.id} className="space-y-2 py-5"><div className="flex justify-between gap-3"><h3 className="whitespace-pre-wrap break-words font-medium">{i + 1}. {question.prompt}</h3>{card && <StarButton card={card} side={question.side} />}</div>{question.pairing && <p className="text-muted">Paired with: {question.pairing}</p>}<p className="text-sm">Your answer: {exam.answers[question.id] || "Unanswered"}</p><div className="flex justify-between gap-3"><p className="text-sm">Correct answer: {question.expected}</p>{card && <StarButton card={card} side={opposite(question.side)} />}</div><p className={exam.grades[question.id] ? "text-accent" : "text-danger"}>{exam.grades[question.id] ? "Correct" : "Incorrect"}</p></li>; })}</ol></Section></div>; }
  const question = exam.questions[index];
  if (exam.phase === "manual") return <div className="mx-auto max-w-3xl space-y-6"><h1 className="font-display text-3xl">Review your test</h1><p className="text-muted">Mark each answer. {Object.keys(exam.grades).length} of {exam.questions.length} reviewed.</p><ol className="divide-y divide-edge">{exam.questions.map((question, i) => <li key={question.id} className="space-y-3 py-5"><h2 className="font-medium">{i + 1}. {question.prompt}</h2>{question.pairing && <p>{question.pairing}</p>}<p>Your answer: {exam.answers[question.id] || "Unanswered"}</p><p>Expected answer: {question.expected}</p>{question.type !== "written" && <p className="text-sm text-muted">Objective result: {automatic(question, exam.answers) ? "Correct" : "Incorrect"}</p>}<div className="flex gap-3">{[true, false].map(correct => <Button key={String(correct)} disabled={busy || (question.type !== "written" && correct !== automatic(question, exam.answers))} variant={exam.grades[question.id] === correct ? "primary" : "secondary"} aria-pressed={exam.grades[question.id] === correct} onClick={() => setExam({ ...exam, grades: { ...exam.grades, [question.id]: question.type === "written" ? correct : automatic(question, exam.answers) } })}>{correct ? "Correct" : "Incorrect"}</Button>)}</div></li>)}</ol><Button disabled={busy || Object.keys(exam.grades).length !== exam.questions.length} onClick={() => void saveResults(exam)}>Save Results</Button>{error && <p role="alert" className="text-danger">{error}</p>}</div>;
  return <div className="mx-auto max-w-3xl space-y-6"><header><p className="text-sm text-accent">{deck.title} · Test</p><h1 className="font-display text-2xl">Question {index + 1} of {exam.questions.length}</h1></header><ProgressBar label={`${exam.questions.length - unanswered} answered`} value={(exam.questions.length - unanswered) / exam.questions.length * 100} />
    <h2 className="whitespace-pre-wrap break-words font-display text-3xl">{question.prompt}</h2>{question.pairing && <p className="text-xl">{question.pairing}</p>}<QuestionAnswer question={question} value={exam.answers[question.id] ?? ""} onChange={value => setExam({ ...exam, answers: { ...exam.answers, [question.id]: value } })} disabled={busy} />
    <div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={!index || busy} onClick={() => setIndex(index - 1)}>Previous</Button><Button variant="secondary" disabled={index === exam.questions.length - 1 || busy} onClick={() => setIndex(index + 1)}>Next</Button><Button disabled={busy} onClick={() => unanswered ? setConfirm(true) : submit()}>Finish Test</Button></div>
    <nav className="flex flex-wrap gap-2" aria-label="Question navigator">{exam.questions.map((item, i) => <button key={item.id} aria-label={`Question ${i + 1}, ${exam.answers[item.id] ? "answered" : "unanswered"}`} aria-current={i === index ? "step" : undefined} onClick={() => setIndex(i)} className={`h-11 min-w-11 rounded-xl border px-2 ${index === i ? "border-accent" : "border-edge"} ${exam.answers[item.id] ? "bg-surface-2" : "bg-surface"}`}>{i + 1}</button>)}</nav>{error && <p role="alert" className="text-danger">{error}</p>}
    {confirm && <Dialog title="Submit this test?" onClose={() => setConfirm(false)} busy={busy}><p>You still have {unanswered} unanswered questions.</p><div className="mt-5 flex flex-wrap gap-3"><Button variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>Return to Test</Button><Button disabled={busy} onClick={submit}>Submit Anyway</Button></div>{error && <p role="alert" className="mt-3 text-danger">{error}</p>}</Dialog>}</div>;
}

"use client";
import type { Question } from "@/lib/learning/questions";
import { fieldClass } from "./StudyControls";
export function QuestionAnswer({ question, value, onChange, disabled = false }: { question: Question; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  if (question.type === "written") return <label className="block text-sm">Your answer<textarea autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} rows={3} className={fieldClass} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} /></label>;
  return <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2"><legend className="sr-only">Choose an answer</legend>{question.choices.map(choice => <label key={choice} className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border p-4 text-base ${value === choice ? "border-accent bg-accent/5" : "border-edge bg-surface"}`}><input type="radio" name={question.id} value={choice} checked={value === choice} onChange={() => onChange(choice)} className="h-5 w-5 shrink-0 accent-accent" /><span className="whitespace-pre-wrap break-words">{question.type === "boolean" ? choice === "true" ? "True" : "False" : choice}</span></label>)}</fieldset>;
}

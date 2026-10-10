/** Keep meaningful symbols (+, -, math operators, decimal points) intact. */
export function normalizeAnswer(value: string): string {
  // Pasted/exported answers can contain encoded spaces as well as actual ones.
  const text = value.replace(/&(?:nbsp|#0*32|#0*160|#x0*20|#x0*a0);/gi, " ");
  return text.normalize("NFKC").toLocaleLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/["'!?,;:()[\]{}]/g, "").replace(/\.(?=\s|$)/g, "").trim().replace(/\s+/g, " ");
}
export function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  if (Math.max(a.length, b.length) > 2000) return 0;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + Number(a[i - 1] !== b[j - 1]));
    row = next;
  }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}
// Only known measurement nouns are inflected here. Blindly removing a trailing
// s would equate unrelated answers (gas/ga, lens/len) or change sentence meaning.
function normalizeUnitNumber(value: string): string {
  return value.replace(/\b((?:(?:pico|nano|micro|milli|centi|deci|deca|hecto|kilo|mega|giga)?(?:gram|meter|metre|liter|litre)|second|minute|hour|mole|ampere|kelvin|newton|joule|watt|volt|pascal))s\b/g, "$1");
}

export function gradeSpelling(answer: string, expected: string, allowMinorSpellingMistakes = false): boolean {
  const a = normalizeAnswer(answer), b = normalizeAnswer(expected);
  if (!a || !b) return false;
  if (a === b || normalizeUnitNumber(a) === normalizeUnitNumber(b)) return true;
  if (!allowMinorSpellingMistakes || b.length < 5 || a.split(" ").length !== b.split(" ").length) return false;
  // Never blur numbers, negation, or operators. Allow at most one typo per long word,
  // and at most two across an entire answer; short words must be exact.
  if ((a.match(/\d+|[+−=<>/-]|\b(?:not|no|never)\b/g) ?? []).join() !== (b.match(/\d+|[+−=<>/-]|\b(?:not|no|never)\b/g) ?? []).join()) return false;
  const aw = a.split(" "), bw = b.split(" ");
  let edits = 0;
  for (let i = 0; i < aw.length; i++) {
    if (aw[i] === bw[i]) continue;
    if (Math.min(aw[i].length, bw[i].length) < 5) return false;
    const distance = Math.round((1 - calculateSimilarity(aw[i], bw[i])) * Math.max(aw[i].length, bw[i].length));
    if (distance > 1) return false;
    edits += distance;
  }
  return edits <= 2 && calculateSimilarity(a, b) >= 0.85;
}

export type GradingOptions = {
  smartGrading?: boolean;
  allowMinorSpellingMistakes?: boolean;
  /** Explicit, author-provided aliases for the expected side, never inferred. */
  acceptedAnswers?: readonly string[];
};
/** Semantic inference is deliberately disabled. Unordered word overlap can accept
 * reversed or contradictory relationships, which is unsafe for study grading. */
export function gradeSemanticAnswer(answer: string, expected: string): boolean {
  void answer; void expected;
  return false;
}
/** Smart grading uses author-approved aliases. Typo tolerance remains separate. */
export function gradeSmartAnswer(answer: string, expected: string, acceptedAnswers: readonly string[] = [], allowMinorSpellingMistakes = false): boolean {
  return [expected, ...acceptedAnswers].some(candidate => gradeSpelling(answer, candidate, allowMinorSpellingMistakes));
}
export function gradeWrittenAnswer(answer: string, expected: string, options: GradingOptions = {}): boolean {
  return options.smartGrading
    ? gradeSmartAnswer(answer, expected, options.acceptedAnswers, options.allowMinorSpellingMistakes)
    : gradeSpelling(answer, expected, options.allowMinorSpellingMistakes);
}

/** Keep meaningful symbols (+, -, math operators, decimal points) intact. */
export function normalizeAnswer(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
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
export function gradeWrittenAnswer(answer: string, expected: string, smart = false): boolean {
  const a = normalizeAnswer(answer), b = normalizeAnswer(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  if (!smart || b.length < 5 || a.split(" ").length !== b.split(" ").length) return false;
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

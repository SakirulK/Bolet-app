export type DetectionIssue = "ambiguous" | "exact-duplicate" | "conflicting-definition";

export type DetectedCard = {
  term: string;
  definition: string;
  issues: DetectionIssue[];
  sourceLines: number[];
};

export type SkippedImportText = {
  text: string;
  line: number;
  reason: "unmatched" | "slide-number" | "repeated-header" | "footer";
};

export type FlashcardDetection = {
  cards: DetectedCard[];
  skipped: SkippedImportText[];
};

type SourceLine = {
  line: number;
  content: string;
  definitionText: string;
  indent: number;
  blank: boolean;
};

const continuationLabels = /^(?:examples?|notes?|including|such as|because|where|when|why|benefits?|types?|features?)\b/i;
const repeatedHeaderWords = /\b(?:slide|lecture|chapter|unit|module|course|class)\b/i;

function cleanLines(text: string): SourceLine[] {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n").map((raw, index) => {
    const leading = raw.match(/^[\t ]*/)?.[0] ?? "";
    const indent = [...leading].reduce((total, char) => total + (char === "\t" ? 4 : 1), 0);
    const trimmed = raw.trim();
    const marker = trimmed.match(/^(?:([•●▪◦‣*+-])|(\d{1,3}[.)]))\s+/)?.[0].trim() ?? "";
    const content = marker ? trimmed.slice(marker.length).trim() : trimmed;
    return { line: index + 1, content, definitionText: marker ? `${marker} ${content}` : content, indent, blank: !trimmed };
  });
}

function obviousSkip(line: SourceLine, counts: Map<string, number>): SkippedImportText["reason"] | null {
  const normalized = line.content.toLocaleLowerCase();
  if (/^(?:slide\s*)?\d{1,3}(?:\s*(?:\/|of)\s*\d{1,3})?$/.test(normalized) || /^page\s+\d{1,3}(?:\s+of\s+\d{1,3})?$/.test(normalized)) return "slide-number";
  if (/^(?:©|copyright\b|confidential\b|all rights reserved\b)/i.test(line.content)) return "footer";
  if ((counts.get(normalized) ?? 0) >= 2 && (repeatedHeaderWords.test(line.content) || (counts.get(normalized) ?? 0) >= 3)) return "repeated-header";
  return null;
}

function splitInline(value: string) {
  const tab = value.indexOf("\t");
  if (tab > 0) return [value.slice(0, tab), value.slice(tab + 1)] as const;
  const dash = value.match(/\s+[—–]\s+|\s+-\s+/);
  const colon = value.indexOf(":");
  const index = colon > 0 && !value.slice(Math.max(0, colon - 5), colon + 3).includes("://")
    ? colon
    : dash?.index ?? -1;
  const width = index === colon ? 1 : dash?.[0].length ?? 1;
  if (index <= 0) return null;
  const term = value.slice(0, index).trim();
  const definition = value.slice(index + width).trim();
  if (!term || !definition || term.length > 120 || term.split(/\s+/).length > 14 || /[.!?;]$/.test(term)) return null;
  return [term, definition] as const;
}

function termCandidate(line: SourceLine) {
  const words = line.content.split(/\s+/).filter(Boolean);
  return !!line.content && line.content.length <= 120 && words.length <= 14 && !/[.!?;:]$/.test(line.content);
}

function definitionCue(line: SourceLine, term: SourceLine) {
  const words = line.content.split(/\s+/).filter(Boolean).length;
  return line.indent > term.indent || words >= 5 || /[.!?]$/.test(line.content);
}

export function applyDuplicateIssues<T extends { term: string; definition: string; issues: DetectionIssue[] }>(cards: T[]): T[] {
  const groups = new Map<string, number[]>();
  cards.forEach((card, index) => {
    const key = card.term.trim().toLocaleLowerCase();
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  const duplicateIssues = new Map<number, DetectionIssue>();
  for (const indexes of groups.values()) {
    if (indexes.length < 2) continue;
    const definitions = new Set(indexes.map(index => cards[index].definition.trim().toLocaleLowerCase()));
    for (const index of indexes) duplicateIssues.set(index, definitions.size === 1 ? "exact-duplicate" : "conflicting-definition");
  }
  return cards.map((card, index) => ({
    ...card,
    issues: [...card.issues.filter(issue => issue !== "exact-duplicate" && issue !== "conflicting-definition"), ...(duplicateIssues.has(index) ? [duplicateIssues.get(index)!] : [])],
  }));
}

export function detectFlashcards(text: string): FlashcardDetection {
  const source = cleanLines(text);
  const counts = new Map<string, number>();
  for (const line of source) if (!line.blank) counts.set(line.content.toLocaleLowerCase(), (counts.get(line.content.toLocaleLowerCase()) ?? 0) + 1);
  const skipped: SkippedImportText[] = [];
  const lines = source.map(line => {
    if (line.blank) return line;
    const reason = obviousSkip(line, counts);
    if (!reason) return line;
    skipped.push({ text: line.content, line: line.line, reason });
    return { ...line, content: "", definitionText: "", blank: true };
  });

  const cards: DetectedCard[] = [];
  let current: DetectedCard | null = null;
  let currentIndent = 0;
  const flush = () => {
    if (!current) return;
    current.definition = current.definition.trim();
    if (current.definition) cards.push(current);
    else skipped.push({ text: current.term, line: current.sourceLines[0], reason: "unmatched" });
    current = null;
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.blank) { flush(); continue; }
    const next = lines.slice(index + 1).find(candidate => !candidate.blank);
    const inline = splitInline(line.content);
    const inlineIsContinuation = !!current && (line.indent > currentIndent || continuationLabels.test(line.content));

    if (inline && !inlineIsContinuation) {
      flush();
      current = { term: inline[0], definition: inline[1], issues: [], sourceLines: [line.line] };
      currentIndent = line.indent;
      continue;
    }

    const startsPlainPair = termCandidate(line) && !!next && definitionCue(next, line);
    if (!current) {
      if (startsPlainPair) {
        const ambiguous = next!.indent <= line.indent && !/[.!?]$/.test(next!.content);
        current = { term: line.content, definition: "", issues: ambiguous ? ["ambiguous"] : [], sourceLines: [line.line] };
        currentIndent = line.indent;
      } else skipped.push({ text: line.definitionText, line: line.line, reason: "unmatched" });
      continue;
    }

    if (current.definition && startsPlainPair && line.indent <= currentIndent) {
      flush();
      current = { term: line.content, definition: "", issues: [], sourceLines: [line.line] };
      currentIndent = line.indent;
      continue;
    }
    current.definition += `${current.definition ? "\n" : ""}${line.definitionText}`;
    current.sourceLines.push(line.line);
  }
  flush();
  return { cards: applyDuplicateIssues(cards), skipped: skipped.sort((a, b) => a.line - b.line) };
}

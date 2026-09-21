import type { Deck } from "@/types";
export type Delimiter = "auto" | "\t" | "," | ";";

function rowsFor(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || !field) quoted = !quoted;
      else field += char;
    } else if (!quoted && char === delimiter) { row.push(field); field = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  row.push(field); rows.push(row);
  return { rows: rows.filter(row => row.some(value => value.trim())), quoted };
}

export function parseCards(text: string, choice: Delimiter) {
  const delimiter = choice === "auto" ? ["\t", ";", ","].sort((a, b) =>
    rowsFor(text, b).rows.filter(row => row.length === 2).length -
    rowsFor(text, a).rows.filter(row => row.length === 2).length)[0] : choice;
  const { rows, quoted } = rowsFor(text.replace(/^\uFEFF/, ""), delimiter);
  if (rows[0]?.[0]?.trim().toLowerCase() === "term" && rows[0]?.[1]?.trim().toLowerCase() === "definition") rows.shift();
  const invalid = rows.flatMap((row, index) => row.length !== 2 || row.some(value => !value.trim()) ? [index + 1] : []);
  const cards = rows.filter(row => row.length === 2 && row.every(value => value.trim()))
    .map(([term, definition]) => ({ term: term.trim(), definition: definition.trim() }));
  return { cards, invalid, delimiter, quoted };
}

export function exportDeck(deck: Deck, format: "json" | "csv") {
  const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
  const content = format === "json"
    ? JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), deck }, null, 2)
    : "\uFEFFterm,definition\r\n" + deck.cards.map(card => [card.term, card.definition].map(quote).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: format === "json" ? "application/json" : "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = (deck.title.replace(/[^a-z0-9_-]/gi, "-") || "deck") + "." + format;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

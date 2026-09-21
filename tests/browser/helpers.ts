import { expect, type Page } from '@playwright/test';
export const terms = ['CPU', 'Organelle', 'Nucleus', 'Membrane', 'Ribosome', 'Chloroplast', 'Atom', 'Proton', 'Electron', 'Neutron', 'RAM', 'ROM'];
export const definitions = ['Central Processing Unit', 'Mitochondria', 'Controls cell activity', 'Controls entry and exit', 'Makes proteins', 'Uses sunlight', 'Small unit of matter', 'Positive particle', 'Negative particle', 'Neutral particle', 'Random Access Memory', 'Read Only Memory'];
export async function seedStudy(page: Page, count = 6, deckCount = 1) {
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'Your decks' })).toBeVisible();
  await page.evaluate(async ({ terms, definitions, count, deckCount }) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('recall');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction(['decks', 'cards'], 'readwrite');
        for (let d = 0; d < deckCount; d++) {
          const deckId = d === 0 ? 'learn-deck' : `deck-${d}`;
          tx.objectStore('decks').put({ id: deckId, title: d === 0 ? 'Biology & Computing' : `Practice deck ${d}`, description: 'Real study workflow fixture', subject: 'Science', createdAt: Date.now() + d, updatedAt: Date.now(), favorite: false });
          for (let i = 0; i < count; i++) tx.objectStore('cards').put({ id: d === 0 ? `c${i}` : `d${d}c${i}`, deckId, term: terms[i % terms.length] + (i >= terms.length ? ` ${i}` : ''), definition: definitions[i % definitions.length], position: i,
            termStarred: i === 0 || i === 2, definitionStarred: i === 1 || i === 2,
            acceptedAnswers: i === 0 ? ['Processor', 'Mitochondria'] : [], acceptedTermAnswers: i === 0 ? ['Processing chip'] : [],
            createdAt: Date.now(), updatedAt: Date.now(), mastery: 0, ease: 2.5, repetitions: 0, intervalDays: 0, dueAt: Date.now(), nextReviewAt: Date.now(), reviewCount: 0, correctStreak: 0, incorrectCount: 0, dontKnowCount: 0, masteryLevel: 'New' });
        }
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    });
  }, { terms, definitions, count, deckCount });
}
export async function records<T>(page: Page, table: string): Promise<T[]> {
  return await page.evaluate(table => new Promise<unknown[]>((resolve, reject) => {
    const open = indexedDB.open('recall'); open.onerror = () => reject(open.error);
    open.onsuccess = () => { const db = open.result; const request = db.transaction(table).objectStore(table).getAll(); request.onsuccess = () => { resolve(request.result); db.close(); }; request.onerror = () => reject(request.error); };
  }), table) as T[];
}
export async function openMode(page: Page, mode: string, extra = '') {
  await page.goto(`/practice?deck=learn-deck&mode=${mode}${extra}`);
  if (mode !== 'flashcards') await expect(page.getByRole('heading', { name: `Set up ${mode[0].toUpperCase() + mode.slice(1)}` })).toBeVisible();
}
export async function metric(page: Page, label: string, value: string) {
  await expect(page.locator('dl > div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd')).toHaveText(value);
}
export async function setupLearn(page: Page, rounds = 1) {
  await page.getByLabel('Shuffle', { exact: true }).uncheck();
  await page.getByLabel('Multiple Choice', { exact: true }).uncheck();
  await page.getByLabel('Written Answer', { exact: true }).check();
  await page.getByRole('combobox', { name: 'Rounds', exact: true }).selectOption(String(rounds));
}
export function expectedAnswer(prompt: string): string {
  const term = terms.indexOf(prompt); return term >= 0 ? definitions[term] : terms[definitions.indexOf(prompt)];
}
export async function learnAnswer(page: Page, answer?: string) {
  const prompt = await page.getByRole('heading', { level: 2 }).textContent();
  await page.getByLabel('Your answer', { exact: true }).fill(answer ?? expectedAnswer(prompt!));
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
}
export async function continueLearn(page: Page) {
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check Answer', exact: true }).or(page.getByRole('heading', { name: 'Learning complete', exact: true }))).toBeVisible();
}
export async function finishLearn(page: Page, limit = 200) {
  let attempts = 0; const rounds = new Set<number>();
  await expect(page.getByRole('button', { name: 'Check Answer', exact: true })).toBeVisible();
  while (await page.getByRole('button', { name: 'Check Answer', exact: true }).count()) {
    const heading = await page.getByRole('heading', { level: 1 }).textContent();
    rounds.add(Number(heading!.match(/Round (\d+)/)?.[1]));
    await learnAnswer(page); await continueLearn(page);
    if (++attempts >= limit) throw new Error('Learn did not complete within the bounded question limit');
  }
  await expect(page.getByRole('heading', { name: 'Learning complete' })).toBeVisible();
  return { attempts, rounds };
}

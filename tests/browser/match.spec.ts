import { test, expect } from '@playwright/test';
import { seedStudy, openMode, metric, records, terms, definitions } from './helpers';
import type { Card, StudyEvent } from '../../src/types';

test('Match pairs, mistakes, side stars, rapid taps, completion and persistence', async ({ page }) => {
  await seedStudy(page, 4); await openMode(page, 'match'); await page.getByRole('button', { name: 'Start Match' }).click();
  await metric(page, 'Remaining pairs', '4');
  const termTile = page.locator('article').filter({ has: page.getByRole('button', { name: 'term: CPU', exact: true }) });
  const definitionTile = page.locator('article').filter({ has: page.getByRole('button', { name: 'definition: Central Processing Unit', exact: true }) });
  await termTile.getByRole('button', { name: 'Unstar term' }).click(); await definitionTile.getByRole('button', { name: 'Star definition' }).click();
  await page.getByRole('button', { name: 'term: CPU', exact: true }).click();
  await page.getByRole('button', { name: 'definition: Mitochondria', exact: true }).click();
  await metric(page, 'Mistakes', '1'); await expect(page.getByRole('button', { name: 'term: CPU', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'term: CPU', exact: true }).click();
  await page.getByRole('button', { name: 'definition: Central Processing Unit', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await metric(page, 'Remaining pairs', '3');
  await expect(page.getByRole('button', { name: 'term: CPU', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'definition: Central Processing Unit', exact: true })).toBeDisabled();
  for (let i = 1; i < 4; i++) { await page.getByRole('button', { name: `term: ${terms[i]}`, exact: true }).click(); await page.getByRole('button', { name: `definition: ${definitions[i]}`, exact: true }).click(); }
  await expect(page.getByRole('heading', { name: 'All pairs matched' })).toBeVisible(); await metric(page, 'Mistakes', '1'); await metric(page, 'Pairs', '4'); await metric(page, 'Accuracy', '80%');
  const events = await records<StudyEvent>(page, 'events'); expect(events).toHaveLength(5);
  await page.reload(); const card = (await records<Card>(page, 'cards')).find(card => card.id === 'c0')!; expect(card.termStarred).toBe(false); expect(card.definitionStarred).toBe(true);
});
for (const [filter, count] of [['terms', 2], ['definitions', 2], ['any', 3]] as const) test(`Match ${filter} filter retains every selected pair`, async ({ page }) => {
  await seedStudy(page, 12); await openMode(page, 'match', `&filter=${filter}`); await page.getByRole('button', { name: 'Start Match' }).click();
  await metric(page, 'Remaining pairs', String(count)); await expect(page.getByRole('button', { name: /^term:/ })).toHaveCount(count); await expect(page.getByRole('button', { name: /^definition:/ })).toHaveCount(count);
  const labels = await page.getByRole('button', { name: /^term:/ }).allTextContents(); expect(new Set(labels).size).toBe(count);
});
for (const count of ['6', '8', '10', 'all']) test(`Match pair limit ${count} and shuffle membership`, async ({ page }) => {
  await seedStudy(page, 10); await openMode(page, 'match'); await page.getByRole('combobox', { name: 'Pairs', exact: true }).selectOption(count);
  await page.getByRole('button', { name: 'Start Match' }).click(); const n = count === 'all' ? 10 : Number(count);
  await expect(page.getByRole('button', { name: /^term:/ })).toHaveCount(n); await expect(page.getByRole('button', { name: /^definition:/ })).toHaveCount(n);
  for (const term of await page.getByRole('button', { name: /^term:/ }).allTextContents()) await expect(page.getByRole('button', { name: `definition: ${definitions[terms.indexOf(term)]}`, exact: true })).toBeVisible();
});

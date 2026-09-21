import { test, expect } from '@playwright/test';
import { seedStudy, openMode, records, metric } from './helpers';
import type { Card } from '../../src/types';
test('Flashcards keep independent stars on the currently visible side', async ({ page }) => {
  await seedStudy(page, 4); await openMode(page, 'flashcards');
  await page.getByRole('button', { name: 'Unstar term', exact: true }).click(); await expect(page.getByRole('button', { name: 'Star term', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Flip card' }).click(); await page.getByRole('button', { name: 'Star definition', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unstar definition', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const card = (await records<Card>(page, 'cards')).find(card => card.id === 'c0')!; expect(card.termStarred).toBe(false); expect(card.definitionStarred).toBe(true);
  await page.reload(); await expect(page.getByRole('button', { name: 'Star term', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Study settings' }).click(); await page.getByLabel('Card direction').selectOption('definition'); await page.getByRole('button', { name: 'Apply & restart' }).click();
  await expect(page.getByRole('button', { name: 'Unstar definition', exact: true })).toBeVisible();
});
for (const [filter, count] of [['terms', 2], ['definitions', 2], ['any', 3]] as const) test(`Flashcards ${filter} filter`, async ({ page }) => {
  await seedStudy(page, 4); await openMode(page, 'flashcards', `&filter=${filter}`); await metric(page, 'Remaining', String(count));
});

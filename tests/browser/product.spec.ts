import { test, expect } from '@playwright/test';
import { seedStudy, openMode, setupLearn, learnAnswer, continueLearn, records } from './helpers';
import type { Card, StudyEvent } from '../../src/types';
test.setTimeout(60000);
test('editor accepted aliases persist and feed Learn grading', async ({ page }) => {
  await page.goto('/library'); await page.getByRole('button', { name: 'Create deck', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Accepted answers'); await page.getByRole('button', { name: 'Add card', exact: true }).click();
  await page.getByRole('textbox', { name: /^term$/i }).fill('CPU'); await page.getByRole('textbox', { name: /^definition$/i }).fill('Central Processing Unit');
  await page.getByText('Accepted answers (optional)', { exact: true }).click(); await page.getByLabel('Accepted definition answers').fill('Processor\nCPU chip'); await page.getByLabel('Accepted term answers').fill('Central processor');
  await page.getByRole('button', { name: 'Create deck', exact: true }).last().click(); await expect(page).toHaveURL(/library\//);
  await page.reload(); const [card] = await records<Card>(page, 'cards'); expect(card.acceptedAnswers).toEqual(['Processor', 'CPU chip']); expect(card.acceptedTermAnswers).toEqual(['Central processor']);
  await page.getByRole('button', { name: 'Learn', exact: true }).click(); await setupLearn(page); await page.getByLabel('Smart Grading', { exact: true }).check(); await page.getByRole('button', { name: 'Start Learning' }).click(); await learnAnswer(page, 'CPU chip'); await expect(page.getByText('Correct', { exact: true })).toBeVisible(); await continueLearn(page);
});
for (const width of [375, 834, 1194, 1440]) test(`existing mode layouts have no horizontal overflow at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1194 ? 834 : 1000 }); await seedStudy(page, 4);
  for (const mode of ['learn', 'match', 'test']) { await openMode(page, mode); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.getByRole('button', { name: 'Start Test' }).click(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('offline reload keeps each core mode and existing data usable; review feeds progress', async ({ page, context }) => {
  await seedStudy(page, 2); await page.goto('/install'); await expect(page.getByText('Ready for offline study on this device.', { exact: true })).toBeVisible({ timeout: 30000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  for (const mode of ['learn', 'match', 'test', 'flashcards']) {
    await openMode(page, mode);
    if (mode === 'flashcards') await expect(page.getByTestId('flashcard')).toBeVisible();
  }
  await page.goto('/review'); await expect(page.getByRole('button', { name: 'Show Answer' })).toBeVisible();
  for (const rating of ['Again', 'Good']) { await page.getByRole('button', { name: 'Show Answer' }).click(); await page.getByRole('button', { name: rating, exact: true }).click(); }
  await expect(page.getByRole('heading', { name: 'Daily Review complete' })).toBeVisible();
  const events = await records<StudyEvent>(page, 'events'); expect(events).toHaveLength(2);
  await page.goto('/progress'); await expect(page.getByRole('heading', { name: 'Your learning, over time' })).toBeVisible(); await expect(page.getByText('Daily Review · Daily Review', { exact: true })).toBeVisible();
  await page.goto('/library/learn-deck'); await expect(page.getByRole('heading', { name: 'Biology & Computing', exact: true })).toBeVisible();
  expect(await records<Card>(page, 'cards')).toHaveLength(2);
});

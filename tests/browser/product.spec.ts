import { test, expect } from '@playwright/test';
import { seedStudy, openMode, setupLearn, learnAnswer, continueLearn, records } from './helpers';
import type { Card, StudyEvent } from '../../src/types';
test.setTimeout(60000);
test('Home has one continuation path, focused navigation, and accurate favorite language', async ({ page }) => {
  await seedStudy(page, 4);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Continue studying', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Continue studying', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Review due', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent decks', exact: true })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Main', exact: true }).last();
  for (const label of ['Home', 'Library', 'Progress', 'Profile']) await expect(navigation.getByRole('link', { name: label, exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Study', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue studying', exact: true }).click();
  await expect(page).toHaveURL(/\/library\/learn-deck$/);
  const favorite = page.getByRole('button', { name: 'Favorite', exact: true });
  await expect(favorite).toBeVisible(); await favorite.click();
  await expect(page.getByRole('button', { name: 'Favorited', exact: true })).toBeVisible();

  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('recall'); open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put({ id: 'resume-home', deckId: 'learn-deck', startedAt: 1, updatedAt: Date.now(), options: { shuffle: false, direction: 'term', filter: 'all' }, cardIds: ['c0', 'c1'], queue: ['c1'], streaks: { c0: 1 }, missedIds: [], studiedIds: ['c0'], correct: 1, incorrect: 0, revision: 1 });
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Resume Biology & Computing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Continue where you left off?', exact: true })).toBeVisible();
});

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

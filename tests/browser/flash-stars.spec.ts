import { test, expect } from '@playwright/test';
import { seedStudy, openMode, records, metric } from './helpers';
import type { Card } from '../../src/types';
test('deck hub shows study modes, card stars, counts and a persistent Study Starred action', async ({ page }) => {
  await seedStudy(page, 4); await page.goto('/library/learn-deck');
  for (const mode of ['Flashcards', 'Learn', 'Test', 'Match']) await expect(page.getByRole('button', { name: mode, exact: true })).toBeVisible();
  await expect(page.getByText('3 starred', { exact: true })).toBeVisible();
  const first = page.getByRole('listitem').filter({ hasText: 'CPU' });
  await first.getByRole('button', { name: 'Unstar card' }).click();
  await expect(page.getByText('2 starred', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('2 starred', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Study 2 Starred' }).click(); await metric(page, 'Remaining', '2');
});
test('Flashcards persist one card-level star across both sides and keyboard input', async ({ page }) => {
  await seedStudy(page, 4); await openMode(page, 'flashcards');
  await page.getByRole('button', { name: 'Unstar card', exact: true }).click(); await expect(page.getByRole('button', { name: 'Star card', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Flip card' }).click(); await page.getByTestId('flashcard').focus(); await page.keyboard.press('s');
  await expect(page.getByRole('button', { name: 'Unstar card', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const card = (await records<Card>(page, 'cards')).find(card => card.id === 'c0')!; expect(card.starred).toBe(true); expect(card.termStarred).toBe(true); expect(card.definitionStarred).toBe(true);
  await page.reload(); await expect(page.getByRole('button', { name: 'Unstar card', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Study settings' }).click(); await page.getByLabel('Card direction').selectOption('definition'); await page.getByRole('button', { name: 'Apply & restart' }).click();
  await expect(page.getByRole('button', { name: 'Unstar card', exact: true })).toBeVisible();
});
test('Flashcards starred-only filter', async ({ page }) => {
  await seedStudy(page, 4); await openMode(page, 'flashcards', '&filter=starred'); await metric(page, 'Remaining', '3');
});

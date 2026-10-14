import { test, expect } from '@playwright/test';
import { seedStudy, openMode, setupLearn } from './helpers';

test('Learn keeps focus while typing and autosaving, including answer retyping', async ({ page }) => {
  await seedStudy(page, 2);
  await openMode(page, 'learn');
  await setupLearn(page);
  await page.getByRole('button', { name: 'Start Learning' }).click();
  const answer = page.getByRole('textbox', { name: 'Your answer', exact: true });
  await answer.click();
  await answer.pressSequentially('wrong answer', { delay: 80 });
  await expect(answer).toHaveValue('wrong answer');
  await expect(answer).toBeFocused();
  // Allow the draft debounce to run; saving must not dismiss the keyboard either.
  await page.waitForTimeout(350);
  await expect(answer).toBeFocused();
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
  await page.getByRole('button', { name: 'Retype Answer', exact: true }).click();
  const retype = page.getByRole('textbox', { name: 'Retype the correct answer', exact: true });
  await retype.click();
  await retype.pressSequentially('Central Processing Unit', { delay: 50 });
  await expect(retype).toHaveValue('Central Processing Unit');
  await expect(retype).toBeFocused();
});

for (const mode of ['learn', 'test']) test(`${mode} accepts separator spacing with strict spelling`, async ({ page }) => {
  await seedStudy(page, 1);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('recall');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('cards', 'readwrite'), store = tx.objectStore('cards');
      const request = store.get('c0');
      request.onsuccess = () => store.put({ ...request.result, definition: 'micrograms; unsafe' });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await openMode(page, mode);
  if (mode === 'learn') await setupLearn(page);
  else {
    await page.getByLabel('Multiple Choice', { exact: true }).uncheck();
    await page.getByLabel('Written Answer', { exact: true }).check();
    await page.getByRole('combobox', { name: 'Number of questions', exact: true }).selectOption('all');
    await page.getByLabel('Automatically grade test', { exact: true }).check();
  }
  await page.getByLabel('Spelling matters', { exact: true }).check();
  await page.getByRole('button', { name: mode === 'learn' ? 'Start Learning' : 'Start Test', exact: true }).click();
  await page.getByRole('textbox', { name: 'Your answer', exact: true }).fill('micrograms;unsafe');
  await page.getByRole('button', { name: mode === 'learn' ? 'Check Answer' : 'Finish Test', exact: true }).click();
  if (mode === 'learn') await expect(page.getByText('Correct', { exact: true })).toBeVisible();
  else await expect(page.locator('dl > div').filter({ has: page.getByText('Percentage', { exact: true }) }).locator('dd')).toHaveText('100%');
});

test('Save & Exit uses client navigation and preserves the latest draft', async ({ page }) => {
  await seedStudy(page, 2);
  await openMode(page, 'learn');
  await setupLearn(page);
  await page.getByRole('button', { name: 'Start Learning' }).click();
  await page.evaluate(() => { (window as unknown as { navigationMarker: string }).navigationMarker = 'same document'; });
  await page.getByRole('textbox', { name: 'Your answer', exact: true }).fill('last keystroke');
  await page.getByRole('link', { name: 'Save & Exit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Biology & Computing', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { navigationMarker?: string }).navigationMarker)).toBe('same document');
  await page.getByRole('button', { name: 'Learn', exact: true }).click();
  await page.getByRole('button', { name: 'Resume saved Learn session', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Your answer', exact: true })).toHaveValue('last keystroke');
});

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

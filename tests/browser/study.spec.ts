import { test, expect, type Page } from '@playwright/test';

async function seed(page: Page) {
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'Your decks' })).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('recall');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['decks', 'cards'], 'readwrite');
        tx.objectStore('decks').put({ id: 'touch-deck', title: 'Computer basics', description: 'Touch practice', subject: 'Computing', createdAt: Date.now(), updatedAt: Date.now(), favorite: false });
        for (const [index, term, definition] of [[0, 'CPU', 'Central Processing Unit'], [1, 'RAM', 'Random Access Memory']] as const) {
          tx.objectStore('cards').put({ id: `card-${index}`, deckId: 'touch-deck', term, definition, notes: index === 0 ? 'The processor runs instructions.' : '', position: index, starred: index === 0, termStarred: index === 0, definitionStarred: index === 0, nextReviewAt: Date.now(), reviewCount: 0, correctStreak: 0, incorrectCount: 0, dontKnowCount: 0, masteryLevel: "New", createdAt: Date.now(), updatedAt: Date.now(), mastery: 0, ease: 2.5, intervalDays: 0, repetitions: 0, dueAt: Date.now() });
        }
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.goto('/study/touch-deck');
  await expect(page.getByTestId('flashcard')).toContainText('CPU');
}
async function answer(page: Page, known: boolean) {
  const button = page.getByRole('button', { name: known ? 'Know' : 'Still Learning', exact: true });
  await expect(button).toBeEnabled();
  await button.tap();
  await expect(page.getByRole('button', { name: 'Study settings' })).toBeEnabled();
}
async function metric(page: Page, name: string, value: string) {
  await expect(page.locator('dl > div').filter({ has: page.getByText(name, { exact: true }) }).locator('dd')).toHaveText(value);
}
async function swipe(page: Page, dx: number, dy = 0) {
  const box = (await page.getByTestId('flashcard').boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let step = 1; step <= 8; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 8, y: y + dy * step / 8 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('iPad touch: flip, swipe, repeat missed cards, complete, review and persist', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await seed(page);
  await expect(page).toHaveTitle(/BrainBo/);
  await page.getByTestId('flashcard').tap();
  await expect(page.getByTestId('flashcard')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('flashcard').locator('[aria-hidden="false"]')).toContainText('The processor runs instructions.');
  const before = await page.evaluate(() => scrollY);
  await swipe(page, -160);
  await metric(page, 'Incorrect', '1');
  expect(await page.evaluate(() => scrollY)).toBe(before);
  await expect(page.getByRole('button', { name: 'Know', exact: true })).toBeEnabled();
  await swipe(page, 160);
  await metric(page, 'Correct', '1');
  await answer(page, true);
  await answer(page, true);
  await answer(page, true);
  await expect(page.getByRole('heading', { name: 'Session Complete' })).toBeVisible();
  await metric(page, 'Cards studied', '2');
  await metric(page, 'Accuracy', '80%');
  await metric(page, 'Known', '2');
  await metric(page, 'Still learning', '0');
  await page.screenshot({ path: 'test-results/session-complete-ipad.png', fullPage: true });
  await page.getByRole('button', { name: 'Study 1 Again' }).tap();
  await expect(page.getByTestId('flashcard')).toContainText('CPU');
  await metric(page, 'Remaining', '1');
  await answer(page, true); await answer(page, true);
  await page.getByRole('button', { name: 'Back to Deck', exact: true }).tap();
  await expect(page).toHaveURL(/library\/touch-deck/);
  await page.reload();
  const sessions = await page.evaluate(() => new Promise<{ correct: number; incorrect: number; endedAt: number }[]>((resolve, reject) => {
    const open = indexedDB.open('recall');
    open.onsuccess = () => { const db = open.result; const request = db.transaction('sessions').objectStore('sessions').getAll(); request.onsuccess = () => { resolve(request.result); db.close(); }; request.onerror = () => reject(request.error); };
  }));
  expect(sessions).toHaveLength(2);
  expect(sessions.reduce((sum, session) => sum + session.correct, 0)).toBe(6);
  expect(sessions.every(session => !!session.endedAt)).toBe(true);
  expect(errors).toEqual([]);
});

test('settings, keyboard, reduced motion, short gestures and early finish', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page);
  await page.getByRole('button', { name: 'Study settings' }).tap();
  await page.getByLabel('Shuffle cards (off = normal order)').check();
  await page.getByLabel('Card direction').selectOption('definition');
  await page.getByRole('combobox', { name: 'Content', exact: true }).selectOption('starred');
  await page.getByRole('button', { name: 'Apply & restart' }).tap();
  await expect(page.getByTestId('flashcard')).toHaveAttribute('aria-label', /Definition: Central Processing Unit/);
  await metric(page, 'Remaining', '1');
  expect(await page.locator('.study-card-inner').evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
  await page.getByTestId('flashcard').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('flashcard')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowLeft');
  await metric(page, 'Incorrect', '1');
  await expect(page.getByRole('button', { name: 'Know', exact: true })).toBeEnabled();
  await swipe(page, 25);
  await metric(page, 'Incorrect', '1');
  await metric(page, 'Correct', '0');
  await swipe(page, 0, -120);
  await metric(page, 'Correct', '0');
  await page.keyboard.press('ArrowRight');
  await metric(page, 'Correct', '1');
  await expect(page.getByRole('button', { name: 'Study settings' })).toBeEnabled();
  await page.getByRole('button', { name: 'Study settings' }).tap();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Finish session now' }).tap();
  await expect(page.getByRole('heading', { name: 'Session Complete' })).toBeVisible();
  await metric(page, 'Still learning', '0');
  await metric(page, 'Accuracy', '50%');
  await page.getByRole('button', { name: 'Study Again' }).tap();
  await metric(page, 'Correct', '0');
  await page.screenshot({ path: 'test-results/flashcard-ipad.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('landscape, empty starred selection, random direction and mouse click', async ({ page }) => {
  await page.setViewportSize({ width: 1194, height: 834 });
  await seed(page);
  await page.getByRole('button', { name: 'Unstar card' }).tap();
  await expect(page.getByRole('button', { name: 'Star card', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Study settings' }).tap();
  await page.getByRole('combobox', { name: 'Content', exact: true }).selectOption('starred');
  await page.getByRole('button', { name: 'Apply & restart' }).tap();
  await expect(page.getByRole('heading', { name: 'No starred cards yet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Study all cards' }).tap();
  await page.getByRole('button', { name: 'Study settings' }).tap();
  await page.getByLabel('Card direction').selectOption('random');
  await page.getByRole('button', { name: 'Apply & restart' }).tap();
  const before = await page.getByTestId('flashcard').getAttribute('aria-label');
  expect(before).toMatch(/^(Term: CPU|Definition: Central Processing Unit)/);
  await page.getByTestId('flashcard').click();
  await expect(page.getByTestId('flashcard')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.getByTestId('flashcard').getAttribute('aria-label')).not.toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/flashcard-landscape.png', fullPage: true });
});

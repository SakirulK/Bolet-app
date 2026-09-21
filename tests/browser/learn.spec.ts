import { test, expect } from '@playwright/test';
import { seedStudy, openMode, setupLearn, learnAnswer, continueLearn, finishLearn, metric, records, definitions } from './helpers';
import type { Card, StudyEvent, StudyHistory } from '../../src/types';
test.setTimeout(60000);

for (const [filter, count, first] of [['all', 6, 'CPU'], ['terms', 2, 'CPU'], ['definitions', 2, 'Organelle'], ['any', 3, 'CPU']] as const) {
  test(`Learn content ${filter}, shuffle retains eligible cards`, async ({ page }) => {
    await seedStudy(page); await openMode(page, 'learn', `&filter=${filter}`); await setupLearn(page);
    await expect(page.getByText(`${count} eligible cards`, { exact: true })).toBeVisible();
    await page.getByLabel('Shuffle', { exact: true }).check();
    await page.getByRole('button', { name: 'Start Learning' }).click();
    const result = await finishLearn(page); expect(result.attempts).toBe(count);
    const events = await records<StudyEvent>(page, 'events'); expect(new Set(events.map(event => event.cardId)).size).toBe(count);
    expect(events.some(event => event.cardId === (first === 'CPU' ? 'c0' : 'c1'))).toBe(true);
  });
}
for (let rounds = 1; rounds <= 10; rounds++) test(`Learn manual ${rounds} rounds: every displayed round actually occurs`, async ({ page }) => {
  await seedStudy(page, 2); await openMode(page, 'learn'); await setupLearn(page, rounds); await page.getByRole('button', { name: 'Start Learning' }).click();
  const result = await finishLearn(page); expect([...result.rounds]).toEqual(Array.from({ length: rounds }, (_, i) => i + 1));
  await metric(page, 'Rounds completed', String(rounds)); const [history] = await records<StudyHistory>(page, 'history'); expect(history.rounds).toBe(rounds);
});
for (const direction of ['term', 'definition', 'mixed']) test(`Learn ${direction} answer direction and both stars`, async ({ page }) => {
  await seedStudy(page, 2); await openMode(page, 'learn'); await setupLearn(page); await page.getByLabel('Answer direction').selectOption(direction);
  await page.getByRole('button', { name: 'Start Learning' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(direction === 'definition' ? definitions[0] : 'CPU');
  await learnAnswer(page); await expect(page.getByText('Correct', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'I was correct', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Mark as Incorrect|Change to Incorrect/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Unstar term', exact: true }).click();
  await page.getByRole('button', { name: 'Star definition', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unstar definition', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const first = (await records<Card>(page, 'cards')).find(card => card.id === 'c0')!; expect(first.termStarred).toBe(false); expect(first.definitionStarred).toBe(true);
  await continueLearn(page); await expect(page.getByRole('heading', { level: 2 })).toHaveText(direction === 'term' ? 'Organelle' : definitions[1]);
  await page.reload(); const persisted = (await records<Card>(page, 'cards')).find(card => card.id === 'c0')!; expect(persisted.definitionStarred).toBe(true);
});
test('Learn Don’t Know reveals both-side stars, has no override and returns after other cards', async ({ page }) => {
  await seedStudy(page, 4); await openMode(page, 'learn'); await setupLearn(page); await page.getByRole('button', { name: 'Start Learning' }).click();
  await page.getByRole('button', { name: 'Don’t Know', exact: true }).click();
  await expect(page.getByText('Correct answer: Central Processing Unit', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'I was correct' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Star definition', exact: true }).click(); await continueLearn(page);
  for (const prompt of ['Organelle', 'Nucleus', 'Membrane']) { await expect(page.getByRole('heading', { level: 2 })).toHaveText(prompt); await learnAnswer(page); await continueLearn(page); }
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('CPU'); await learnAnswer(page); await continueLearn(page);
  await metric(page, 'Don’t Know', '1'); await metric(page, 'Accuracy', '80%');
  const events = await records<StudyEvent>(page, 'events'); expect(events.filter(event => event.dontKnow)).toHaveLength(1);
});
test('Learn override replaces rejection, persists once, updates accuracy and avoids miss requeue', async ({ page }) => {
  await seedStudy(page, 1); await openMode(page, 'learn'); await setupLearn(page); await page.getByRole('button', { name: 'Start Learning' }).click();
  await learnAnswer(page, 'my equivalent answer'); await expect(page.getByRole('button', { name: 'I was correct' })).toBeVisible();
  await page.getByRole('button', { name: 'I was correct' }).click(); await expect(page.getByText('Correct', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'I was correct' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Star definition', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByRole('heading', { name: 'Learning complete' })).toBeVisible();
  await metric(page, 'Accuracy', '100%'); await metric(page, 'Questions answered', '1');
  await page.reload(); const events = await records<StudyEvent>(page, 'events'); expect(events).toHaveLength(1); expect(events[0].override).toBe(true); expect(events[0].correct).toBe(true);
  const [card] = await records<Card>(page, 'cards'); expect(card.incorrectCount).toBe(0); expect(card.correctStreak).toBe(1); expect(card.definitionStarred).toBe(true);
});
test('Learn retype reinforces without erasing incorrect result; missed card returns', async ({ page }) => {
  await seedStudy(page, 2); await openMode(page, 'learn'); await setupLearn(page); await page.getByRole('button', { name: 'Start Learning' }).click();
  await learnAnswer(page, 'wrong'); await page.getByRole('button', { name: 'Star definition', exact: true }).click(); await expect(page.getByRole('button', { name: 'Unstar definition', exact: true })).toHaveAttribute('aria-pressed', 'true'); await page.getByRole('button', { name: 'Retype Answer', exact: true }).click();
  await page.getByLabel('Retype the correct answer').fill('wrong again'); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Retype');
  await page.getByLabel('Retype the correct answer').fill(definitions[0]); await continueLearn(page);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Organelle'); await learnAnswer(page); await continueLearn(page);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('CPU'); await learnAnswer(page); await continueLearn(page);
  await metric(page, 'Accuracy', '67%'); const events = await records<StudyEvent>(page, 'events'); expect(events.filter(event => !event.correct)).toHaveLength(1); expect(events[0].override).toBe(false);
});
for (const [name, smart, typos, answer, correct] of [
  ['exact', false, false, 'Central Processing Unit', true], ['alias disabled', false, false, 'Processor', false],
  ['smart alias', true, false, 'Processor', true], ['smart does not imply spelling tolerance', true, false, 'Mitocondria', false],
  ['both enabled', true, true, 'Mitocondria', true], ['spelling does not imply smart aliases', false, true, 'Mitochondria', false],
  ['typo only', false, true, 'Central Procesing Unit', true], ['strict typo rejection', false, false, 'Central Procesing Unit', false],
] as const) test(`Learn grading: ${name}`, async ({ page }) => {
  await seedStudy(page, 1); await openMode(page, 'learn'); await setupLearn(page);
  await page.getByLabel('Smart Grading', { exact: true }).setChecked(smart); await page.getByLabel('Allow minor spelling mistakes').setChecked(typos);
  await page.getByRole('button', { name: 'Start Learning' }).click(); await learnAnswer(page, answer);
  if (correct) { await expect(page.getByText('Correct', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'I was correct' })).toHaveCount(0); }
  else await expect(page.getByRole('button', { name: 'I was correct' })).toBeVisible();
});
test('Learn multiple choice, recommendation bounds and empty starred set', async ({ page }) => {
  await seedStudy(page, 4); await openMode(page, 'learn');
  const recommendation = await page.getByText(/Recommended: \d+ rounds/).textContent(); const n = Number(recommendation!.match(/Recommended: (\d+)/)![1]); expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(10);
  await page.getByLabel('Written Answer').uncheck(); await page.getByLabel('Shuffle', { exact: true }).uncheck(); await page.getByRole('combobox', { name: 'Rounds', exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'Start Learning' }).click(); await expect(page.getByRole('radio')).toHaveCount(4);
  await page.getByRole('radio', { name: definitions[0], exact: true }).check(); await page.getByRole('button', { name: 'Check Answer' }).click(); await expect(page.getByText('Correct', { exact: true })).toBeVisible();
  await page.goto('/practice?deck=learn-deck&mode=learn&filter=definitions&ids=c3');
  await expect(page.getByText('No starred definitions in this deck yet.', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Start Learning' })).toBeDisabled();
});
test('Learn Automatic starts and completes the displayed recommendation', async ({ page }) => {
  await seedStudy(page, 1); await openMode(page, 'learn'); await page.getByLabel('Multiple Choice', { exact: true }).uncheck();
  const text = await page.getByText(/Recommended: \d+ rounds/).textContent(); const rounds = Number(text!.match(/Recommended: (\d+)/)![1]);
  await page.getByRole('button', { name: 'Start Learning' }).click(); await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Round 1 of ${rounds}`);
  const actual = await finishLearn(page); expect(actual.rounds.size).toBe(rounds); await metric(page, 'Rounds completed', String(rounds));
});

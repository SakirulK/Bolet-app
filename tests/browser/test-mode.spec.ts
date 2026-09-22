import { test, expect, type Page } from '@playwright/test';
import { seedStudy, openMode, expectedAnswer, metric, records, definitions } from './helpers';
import type { StudyHistory } from '../../src/types';
test.setTimeout(60000);
async function chooseTypes(page: Page, types: string[]) {
  for (const label of ['Multiple Choice', 'Written Answer', 'True / False']) await page.getByLabel(label, { exact: true }).setChecked(types.includes(label));
}
async function fillCurrent(page: Page) {
  const prompt = await page.getByRole('heading', { level: 2 }).textContent(); const expected = expectedAnswer(prompt!);
  if (await page.getByLabel('Your answer', { exact: true }).count()) await page.getByLabel('Your answer', { exact: true }).fill(expected);
  else if (await page.getByRole('radio', { name: 'True', exact: true }).count()) {
    const pairing = await page.locator('p.text-xl').textContent(); await page.getByRole('radio', { name: pairing === expected ? 'True' : 'False', exact: true }).check();
  } else await page.getByRole('radio', { name: expected, exact: true }).check();
}
async function finishCorrect(page: Page) {
  while (true) { await fillCurrent(page); await expect(page.getByText(/Correct answer:/)).toHaveCount(0); if (await page.getByRole('button', { name: 'Next', exact: true }).isDisabled()) break; await page.getByRole('button', { name: 'Next', exact: true }).click(); }
  await page.getByRole('button', { name: 'Finish Test' }).click();
}
for (const count of ['5', '10', 'custom', 'all']) test(`Test question count ${count}`, async ({ page }) => {
  await seedStudy(page, 12); await openMode(page, 'test'); await page.getByLabel('Number of questions').selectOption(count);
  if (count === 'custom') await page.getByLabel('Custom question count').fill('7');
  await page.getByRole('button', { name: 'Start Test' }).click(); await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Question 1 of ${count === 'all' ? 12 : count === 'custom' ? 7 : count}`);
});
for (const types of [['Multiple Choice'], ['Written Answer'], ['True / False'], ['Multiple Choice', 'Written Answer', 'True / False']]) {
  for (const direction of ['term', 'definition', 'mixed']) test(`Test ${types.join('+')} / ${direction}`, async ({ page }) => {
    await seedStudy(page, 6); await openMode(page, 'test'); await chooseTypes(page, types); await page.getByLabel('Answer with').selectOption(direction);
    await page.getByRole('button', { name: 'Start Test' }).click(); await finishCorrect(page); await expect(page.getByRole('heading', { name: 'Test results' })).toBeVisible(); await metric(page, 'Percentage', '100%'); await metric(page, 'Total questions', '6');
  });
}
test('Test starred filter clamps custom count to eligible material', async ({ page }) => {
  await seedStudy(page, 12); await openMode(page, 'test', '&filter=starred'); await expect(page.getByLabel('Number of questions').locator('option[value="5"]')).toHaveJSProperty('disabled', true);
  await page.getByLabel('Number of questions').selectOption('custom'); await page.getByLabel('Custom question count').fill('9'); await expect(page.getByLabel('Custom question count')).toHaveValue('3');
  await page.getByRole('button', { name: 'Start Test' }).click(); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Question 1 of 3');
});
for (const [name, smart, typos, answer, correct] of [
  ['strict exact', false, false, 'Central Processing Unit', true], ['strict typo', false, false, 'Central Procesing Unit', false],
  ['minor spelling mistakes', false, true, 'Central Procesing Unit', true], ['smart alias', true, false, 'Processor', true],
  ['alias off', false, true, 'Processor', false], ['smart without spelling tolerance', true, false, 'Mitocondria', false], ['smart with spelling tolerance', true, true, 'Mitocondria', true],
] as const) test(`Test grading ${name}`, async ({ page }) => {
  await seedStudy(page, 1); await openMode(page, 'test'); await chooseTypes(page, ['Written Answer']);
  await page.getByLabel('Smart Grading', { exact: true }).setChecked(smart); await page.getByLabel('Spelling matters').setChecked(!typos);
  await page.getByRole('button', { name: 'Start Test' }).click(); await page.getByLabel('Your answer').fill(answer); await page.getByRole('button', { name: 'Finish Test' }).click();
  await metric(page, 'Correct', correct ? '1' : '0');
});
test('Test manual grading, unanswered warning, navigation, result stars and incorrect study links', async ({ page }) => {
  await seedStudy(page, 3); await openMode(page, 'test'); await chooseTypes(page, ['Written Answer']); await page.getByLabel('Automatically grade test').uncheck(); await page.getByLabel('Shuffle questions').uncheck();
  await page.getByRole('button', { name: 'Start Test' }).click(); await page.getByLabel('Your answer').fill('A self-graded answer'); await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Previous' }).click(); await expect(page.getByLabel('Your answer')).toHaveValue('A self-graded answer');
  await page.getByRole('button', { name: 'Question 3, unanswered', exact: true }).click(); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Question 3 of 3');
  await page.getByRole('button', { name: 'Finish Test' }).click(); await expect(page.getByRole('dialog')).toContainText('You still have 2 unanswered questions.'); await page.getByRole('button', { name: 'Return to Test' }).click();
  await page.getByRole('button', { name: 'Finish Test' }).click(); await page.getByRole('button', { name: 'Submit Anyway' }).click();
  await expect(page.getByRole('heading', { name: 'Review your test' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Save Results' })).toBeDisabled();
  const rows = page.locator('ol > li'); await rows.nth(0).getByRole('button', { name: 'Correct', exact: true }).click();
  for (const i of [1, 2]) await rows.nth(i).getByRole('button', { name: 'Incorrect', exact: true }).click();
  await page.getByRole('button', { name: 'Save Results' }).click(); await metric(page, 'Correct', '1'); await metric(page, 'Incorrect', '0'); await metric(page, 'Unanswered', '2');
  const first = page.locator('ol > li').first(); await first.getByRole('button', { name: 'Unstar card' }).click(); await first.getByRole('button', { name: 'Star card' }).click();
  const learnHref = await page.getByRole('link', { name: 'Learn Incorrect', exact: true }).getAttribute('href'); const flashHref = await page.getByRole('link', { name: 'Flashcards for Incorrect', exact: true }).getAttribute('href');
  expect(learnHref).toContain('ids=c1%2Cc2'); expect(flashHref).toContain('mode=flashcards');
  await page.getByRole('button', { name: 'Test Incorrect', exact: true }).click(); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Question 1 of 2');
  await page.goto(learnHref!); await expect(page.getByText('2 eligible cards', { exact: true })).toBeVisible(); await page.goto(flashHref!); await metric(page, 'Remaining', '2');
  const history = await records<StudyHistory>(page, 'history'); expect(history.filter(item => item.mode === 'test')).toHaveLength(1);
});
test('Test mixed objective manual review records known answers consistently', async ({ page }) => {
  await seedStudy(page, 3); await openMode(page, 'test'); await chooseTypes(page, ['Multiple Choice', 'True / False']); await page.getByLabel('Automatically grade test').uncheck();
  await page.getByRole('button', { name: 'Start Test' }).click(); await finishCorrect(page);
  for (const row of await page.locator('ol > li').all()) { await expect(row.getByText('Objective result: Correct')).toBeVisible(); await row.getByRole('button', { name: 'Correct', exact: true }).click(); }
  await page.getByRole('button', { name: 'Save Results' }).click(); await metric(page, 'Percentage', '100%');
});
test('Test exact definition prompt and card star in results', async ({ page }) => {
  await seedStudy(page, 1); await openMode(page, 'test'); await chooseTypes(page, ['Written Answer']); await page.getByLabel('Answer with').selectOption('definition');
  await page.getByRole('button', { name: 'Start Test' }).click(); await expect(page.getByRole('heading', { level: 2 })).toHaveText(definitions[0]); await page.getByLabel('Your answer').fill('CPU'); await page.getByRole('button', { name: 'Finish Test' }).click();
  await expect(page.getByRole('button', { name: 'Unstar card', exact: true })).toBeVisible();
});

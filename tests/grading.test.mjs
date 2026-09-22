import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load-ts.mjs';
const { normalizeAnswer, gradeSpelling, gradeSmartAnswer, gradeSemanticAnswer, gradeWrittenAnswer, calculateSimilarity } = load('src/lib/learning/grading.ts');
const exact = {}, typo = { allowMinorSpellingMistakes: true }, smart = { smartGrading: true };
for (const [name, answer, expected, options, correct] of [
  ['exact answer', 'Central Processing Unit', 'Central Processing Unit', exact, true],
  ['capitalization', 'philadelphia', 'Philadelphia', exact, true],
  ['harmless punctuation and whitespace', '  Central   Processing Unit! ', 'Central Processing Unit', exact, true],
  ['typos off', 'Mitocondria', 'Mitochondria', exact, false],
  ['typos on', 'Mitocondria', 'Mitochondria', typo, true],
  ['smart alias on', 'CPU', 'Central Processing Unit', { ...smart, acceptedAnswers: ['CPU'] }, true],
  ['smart alias off', 'CPU', 'Central Processing Unit', { acceptedAnswers: ['CPU'] }, false],
  ['smart on but typo off', 'Mitocondria', 'An organelle', { ...smart, acceptedAnswers: ['Mitochondria'] }, false],
  ['smart and typo on', 'Mitocondria', 'An organelle', { ...smart, ...typo, acceptedAnswers: ['Mitochondria'] }, true],
  ['typo only never enables alias', 'Mitochondria', 'An organelle', { ...typo, acceptedAnswers: ['Mitochondria'] }, false],
  ['no inferred abbreviation', 'CPU', 'Central Processing Unit', smart, false],
  ['optional parenthetical must be explicit', 'Washington, D.C.', 'Washington, D.C. (United States)', smart, false],
  ['explicit optional form', 'Washington, D.C.', 'Washington, D.C. (United States)', { ...smart, acceptedAnswers: ['Washington, D.C.'] }, true],
  ['semantic inference requires an explicit alias', 'Plants use sunlight to create chemical energy.', 'Plants convert light energy into chemical energy.', smart, false],
  ['reversed meaning is rejected', 'Plants convert chemical energy into light energy.', 'Plants convert light energy into chemical energy.', smart, false],
  ['contradictory verb is rejected', 'Plants destroy light energy into chemical energy.', 'Plants convert light energy into chemical energy.', smart, false],
  ['semantic grading remains conservative', 'Plants absorb water through their roots.', 'Plants convert light energy into chemical energy.', smart, false],
  ['different numbers', '12.5', '12.6', { ...smart, ...typo }, false],
  ['different sign', '-12', '+12', typo, false],
  ['negation matters', 'does not produce energy', 'does produce energy', typo, false],
  ['short words exact', 'cat', 'bat', typo, false],
  ['two edits in one word rejected', 'Mitozondriax', 'Mitochondria', typo, false],
  ['blank rejected', '   ', 'Mitochondria', smart, false],
  ['blank alias rejected', '', 'Mitochondria', { ...smart, acceptedAnswers: [''] }, false],
]) test(name, () => assert.equal(gradeWrittenAnswer(answer, expected, options), correct));
for (const options of [exact, typo, smart, { ...smart, ...typo }]) test(`different answer rejected ${JSON.stringify(options)}`, () => assert.equal(gradeWrittenAnswer('Nucleus', 'Mitochondria', options), false));
test('utilities separate normalization, spelling and smart aliases', () => {
  assert.equal(normalizeAnswer('  Philadelphia! '), 'philadelphia');
  assert.equal(gradeSpelling('CPU', 'Central Processing Unit', true), false);
  assert.equal(gradeSmartAnswer('CPU', 'Central Processing Unit', ['CPU']), true);
  assert.equal(gradeSemanticAnswer('Plants use sunlight to create chemical energy', 'Plants convert light energy into chemical energy'), false);
  assert.equal(calculateSimilarity('mitochondria', 'mitocondria') > .9, true);
});

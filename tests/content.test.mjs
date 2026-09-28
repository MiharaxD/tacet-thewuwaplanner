import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadContent, runtimeData, validateContent, checkRuntimeData } from '../scripts/lib/content.mjs';

test('content compiles to the committed runtime data without losing fields or order', async () => {
  const content = await loadContent();
  await validateContent(content);
  await checkRuntimeData();
  for (const [name, expected] of Object.entries(runtimeData(content))) {
    const actual = JSON.parse(await readFile(`data/${name}.json`, 'utf8'));
    assert.deepEqual(expected, actual, name);
  }
  assert.equal(content.catalog.characters.length, 57);
  assert.equal(content.catalog.weapons.length, 120);
  assert.equal(content.catalog.materials.length, 153);
  assert.equal(content.catalog.characters.find(row => row.id === 'rover-spectro').sharedProgress, 'rover');
  assert.ok(content.catalog.characters.find(row => row.id === 'rover-spectro').ascension);
  assert.ok(content.art.aemeath.bannerPosition);
  assert.ok(content.rules.weaponXpByRarity[4]);
  assert.ok(content.rules.unlockCosts);
});

test('content validation rejects duplicate IDs and missing source references', async () => {
  const original = await loadContent();
  const duplicate = structuredClone(original);
  duplicate.catalog.materials.push({ ...duplicate.catalog.materials[0] });
  await assert.rejects(validateContent(duplicate), /duplicado/);
  const missingSource = structuredClone(original);
  missingSource.catalog.characters[0].sources.push('missing-source');
  await assert.rejects(validateContent(missingSource), /fonte inexistente/);
});

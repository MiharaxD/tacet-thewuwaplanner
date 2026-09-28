import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { loadContent, runtimeData, validateContent, checkRuntimeData, writeCuratedContent, deriveRecipes } from '../scripts/lib/content.mjs';
import { createContentWorkspace } from './fixtures/content-workspace.mjs';

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

test('sources use the documented schema, including the purification source', async () => {
  const original = await loadContent();
  await validateContent(original);
  const purification = original.sources.find(source => source.id === 'synthesis-purification');
  assert.equal(purification.scope, 'Síntese · Purification');
  assert.equal(typeof purification.note, 'string');
  assert.equal(purification.gameVersion, null);
  assert.equal('title' in purification, false);
  assert.equal('notes' in purification, false);
  const noScope = structuredClone(original);
  delete noScope.sources[0].scope;
  await assert.rejects(validateContent(noScope), /schema inválido/);
  const oldNotes = structuredClone(original);
  delete oldNotes.sources[0].note;
  oldNotes.sources[0].notes = 'old field';
  await assert.rejects(validateContent(oldNotes), /schema inválido/);
  const invalidDate = structuredClone(original);
  invalidDate.sources[0].consultedAt = '2026-02-31';
  await assert.rejects(validateContent(invalidDate), /schema inválido/);
});

test('purification recipes are derived without changing the runtime recipes', async () => {
  const content = await loadContent();
  const compiled = runtimeData(content).recipes;
  const saved = JSON.parse(await readFile('data/recipes.json', 'utf8'));
  assert.ok(content.recipes.length > 0);
  assert.ok(content.recipes.every(recipe => !recipe.id.startsWith('purify-')));
  assert.ok(compiled.some(recipe => recipe.id.startsWith('purify-')));
  assert.deepEqual(compiled, saved);
  assert.equal(JSON.stringify(runtimeData(content).recipes), JSON.stringify(compiled));
  const missingSource = structuredClone(content);
  missingSource.sources = missingSource.sources.filter(source => source.id !== 'synthesis-purification');
  await assert.rejects(validateContent(missingSource), /synthesis-purification/);
});

test('a curated synthesis recipe takes precedence over generated Purification', async () => {
  const content = await loadContent();
  const generated = deriveRecipes(content.catalog, content.recipes).find(recipe => recipe.id.startsWith('purify-'));
  assert.ok(generated);
  const curated = { id: 'custom-override', inputs: generated.inputs, outputs: generated.outputs, verified: true, sources: ['synthesis-purification'] };
  const result = deriveRecipes(content.catalog, [...content.recipes, curated]);
  assert.ok(result.includes(curated));
  assert.equal(result.some(recipe => recipe.id === generated.id), false);
});

test('curated writes reject new characters without art and stale files before changing content', async () => {
  const { root, content } = await createContentWorkspace();
  try {
    const before = await readFile(join(root, 'content/manifest.json'), 'utf8');
    const missingArt = structuredClone(content);
    missingArt.catalog.characters.push({ ...missingArt.catalog.characters[0], id: 'novo-ressonante' });
    await assert.rejects(writeCuratedContent(missingArt, root), /não possui art configurada/);
    await assert.rejects(access(join(root, 'content/characters/novo-ressonante.json')), { code: 'ENOENT' });
    assert.equal(await readFile(join(root, 'content/manifest.json'), 'utf8'), before);
    await writeFile(join(root, 'content/characters/stale.json'), '{}');
    await assert.rejects(writeCuratedContent(content, root), /obsoletos.*stale\.json/);
    assert.equal(await readFile(join(root, 'content/manifest.json'), 'utf8'), before);
  } finally {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    await rm(root, { recursive: true, force: true });
  }
});

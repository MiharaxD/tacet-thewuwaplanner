import { loadContent, writeRuntimeData } from './lib/content.mjs';
import { assertFingerprint, stableFingerprintPath } from './lib/staging.mjs';

const expectedContentHash = await stableFingerprintPath('content');
const content = await loadContent();
await assertFingerprint('content', expectedContentHash, 'content');
await writeRuntimeData(content, '.', { expectedContentHash });
console.log(`Catálogo gerado: ${content.catalog.characters.length} personagens, ${content.catalog.weapons.length} armas e ${content.catalog.materials.length} materiais.`);

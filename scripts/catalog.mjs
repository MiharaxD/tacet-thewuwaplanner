import { loadContent, writeRuntimeData } from './lib/content.mjs';

const content = await loadContent();
await writeRuntimeData(content);
console.log(`Catálogo gerado: ${content.catalog.characters.length} personagens, ${content.catalog.weapons.length} armas e ${content.catalog.materials.length} materiais.`);

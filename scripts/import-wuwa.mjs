import { readFile, readdir, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { pageRecords } from './read-akademiya.mjs';
import { loadContent, writeCuratedContent } from './lib/content.mjs';

const characterSource = 'source-assets/wuwa/characters';
const materialSource = 'source-assets/wuwa/materials';
const referencePath = 'scripts/wuwa-reference.json';
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const norm = name => name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]/g, '');
const slug = name => name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const assetUrl = path => './' + path.split('/').map(encodeURIComponent).join('/');
const sourceUrl = path => `https://github.com/MiharaxD/tacet-thewuwaplanner/blob/main/${path.split('/').map(encodeURIComponent).join('/')}`;
const refresh = process.argv.includes('--refresh');
let reference;
if (refresh) {
  const pages = await Promise.all(['characters', 'materials'].map(async kind => {
    const response = await fetch(`https://wuwa.akademiya.app/en/${kind}`);
    if (!response.ok) throw Error(`${kind}: HTTP ${response.status}`);
    return pageRecords(await response.text(), kind === 'characters' ? 'characterId' : 'itemId').filter(r => r.name);
  }));
  reference = { consultedAt: new Date().toISOString().slice(0,10), characters: pages[0], materials: pages[1] };
  if (!reference.characters.length || !reference.materials.length) throw Error('Akademiya returned no records');
} else reference = await readJson(referencePath);

const content = await loadContent();
const { catalog, sources, rules } = content;
const putSource = entry => { const i = sources.findIndex(s => s.id === entry.id); if (i < 0) sources.push(entry); else sources[i] = { ...sources[i], ...entry }; };
putSource({ id: 'wuwa-akademiya', url: 'https://wuwa.akademiya.app/en/characters', scope: 'Elementos, armas e raridades dos personagens importados', consultedAt: reference.consultedAt, gameVersion: null, note: 'Identidades da listagem pública; não certifica disponibilidade em banners.' });
putSource({ id: 'wuwa-materials', url: 'https://wuwa.akademiya.app/en/materials', scope: 'Nomes, raridades e imagens dos materiais', consultedAt: reference.consultedAt, gameVersion: null, note: 'Imagens locais fornecidas pelo usuário; imagens ausentes obtidas da CDN indicada por Akademiya.' });
const aliases = { 'Sound-Keeping Tacet Core': 'Sound', 'Gold-Dissolving Feather': 'Gold' };
const remoteMaterial = name => reference.materials.find(m => norm(m.name) === norm(aliases[name] || name));
const materialByName = name => catalog.materials.find(m => norm(m.name) === norm(name));
const localImages = (await readdir(materialSource)).filter(f => /\.(webp|png|jpg)$/i.test(f));
await mkdir('assets/materials', { recursive: true });
const imageAliases = { 'Sentinel’s Dagger': "Sentine's Dagger", 'Sentinel\'s Dagger': "Sentine's Dagger", 'Unfading Glory': 'Unfanding Glory', "The Netherworld's Stare": "The Netheworld's Stare", 'LF Mech Core': 'LF Merch Core', 'MF Mech Core': 'MF Merch Core', 'HF Mech Core': 'HF Merch Core', 'FF Mech Core': 'FF Merch Core', ...aliases };
const usedMaterials = new Map();
async function material(name, category, preferredId) {
  let m = materialByName(name);
  const remote = remoteMaterial(name);
  if (remote) usedMaterials.set(remote.itemId, remote);
  if (!m) {
    const activity = { Inimigos: 'overworld', Forja: 'forgery', Coleta: 'overworld', Chefe: 'boss', Semanal: 'weekly', Especial: 'overworld' }[category];
    m = { id: preferredId || slug(name), name, category, rarity: remote?.rarity ?? null, origin: { Inimigos: 'Inimigos · mundo aberto', Forja: 'Forgery Challenge', Coleta: 'Coleta · mundo aberto', Chefe: 'Chefe de mundo', Semanal: 'Desafio semanal', Especial: 'Progressão da história' }[category], activity, sources: ['wuwa-materials'], verified: true };
    catalog.materials.push(m);
  }
  if (!m.image) {
    const file = localImages.find(f => norm(f.replace(/\.[^.]+$/, '')) === norm(imageAliases[name] || name));
    const target = `assets/materials/${m.id}.webp`;
    if (file) {
      try { await access(target); } catch { await copyFile(`${materialSource}/${file}`, target); }
      m.image = assetUrl(target);
    } else if (remote) {
      try { await access(target); } catch {
        if (!refresh) throw Error(`Missing image ${target}; run npm run catalog:refresh`);
        const response = await fetch(`https://static.nanoka.cc/assets/ww/${remote.icon}`);
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw Error(`Invalid image: ${name} (${response.status})`);
        await mkdir('assets/materials', { recursive: true });
        await writeFile(target, Buffer.from(await response.arrayBuffer()));
        console.log(`Downloaded ${name}`);
      }
      m.image = assetUrl(target);
    } else throw Error(`No image/reference for ${name}`);
  }
  return m.id;
}

// The copied guides repeat the icon's alt text before the actual item name.
function parseRows(text) {
  return text.split(/\r?\n/).flatMap(line => {
    const match = line.trim().match(/^(.+) x([\d,]+)$/);
    if (!match) return [];
    let name;
    for (let i = 1; i < match[1].length; i++) {
      if (match[1][i] === ' ' && match[1].slice(i + 1).startsWith(match[1].slice(0, i))) { name = match[1].slice(i + 1); break; }
    }
    if (!name) throw Error(`Unrecognized material line: ${line}`);
    return [{ name, count: Number(match[2].replaceAll(',', '')) }];
  });
}
function section(text, heading, end) {
  const start = text.indexOf(heading);
  if (start < 0) throw Error(`Missing section: ${heading}`);
  return text.slice(start + heading.length, text.indexOf(end, start + heading.length));
}
async function family(rows, category) {
  if (rows.length !== 4) throw Error(`Expected four tiers: ${JSON.stringify(rows)}`);
  const existing = materialByName(rows[0].name);
  const id = existing ? existing.id.replace(/-0$/, '') : slug(rows[0].name.replace(/^LF /, ''));
  for (let i = 0; i < 4; i++) {
    const actual = await material(rows[i].name, category, `${id}-${i}`);
    if (actual !== `${id}-${i}`) throw Error(`Conflicting family: ${actual}`);
  }
  return id;
}

const imported = [];
  for (const folder of await readdir(characterSource)) {
  const files = await readdir(`${characterSource}/${folder}`);
  const image = files.find(f => /\.(webp|png)$/i.test(f));
  if (!image) throw Error(`Missing portrait in ${folder}`);
  const texts = files.filter(f => f.endsWith('.txt'));
  if (!texts.length && folder !== 'Luuk') throw Error(`Missing materials in ${folder}`);
  for (const file of texts.length ? texts : [null]) {
    let name, asc, forte, ranks, sourcePath;
    if (file) {
      sourcePath = `${characterSource}/${folder}/${file}`;
      const text = await readFile(sourcePath, 'utf8');
      name = text.match(/Total Ascension Materials for (.+)/)[1].trim();
      asc = parseRows(section(text, 'Total Ascension Materials', 'Total Forte Materials'));
      forte = parseRows(section(text, 'Total Forte Materials', 'Character Ascension Materials'));
      ranks = text.split(/Rank [1-6]\s*\r?\n/).slice(1).map(parseRows);
    } else {
      name = 'Luuk Herssen';
      const enemy = ['Fractured Exoswarm Pendant', 'Worn Exoswarm Pendant', 'Chipped Exoswarm Pendant', 'Intact Exoswarm Pendant'];
      asc = [...enemy.map((name, i) => ({ name, count: [4,12,12,4][i] })), { name: "Suncoveter's Reach", count: 46 }, { name: 'Edelschnee', count: 60 }, { name: 'Shell Credit', count: 170000 }];
      forte = [...enemy.map((name, i) => ({ name, count: [25,28,40,57][i] })), ...['LF','MF','HF','FF'].map((tier,i) => ({ name: `${tier} Waveworn Shard`, count: [25,28,55,67][i] })), { name: 'Gold in Memory', count: 26 }, { name: 'Shell Credit', count: 2030000 }];
      sourcePath = 'https://game8.co/games/Wuthering-Waves/archives/575852';
    }
    const identity = reference.characters.find(c => norm(c.name) === norm(name));
    if (!identity) throw Error(`Unknown character: ${name}`);
    name = identity.name.replace('Rover: ', 'Rover (').replace(/^(Rover \(.+)$/, '$1)').replace('Yangyang: ', 'Yangyang ');
    const id = slug(name);
    if (asc.length !== 7 || forte.length !== 10) throw Error(`Incomplete materials: ${name} (${asc.length}/${forte.length})`);
    const enemy = await family(asc.slice(0,4), 'Inimigos');
    if (forte.slice(0,4).some((row,i) => row.name !== asc[i].name)) throw Error(`Enemy family mismatch: ${name}`);
    const forgery = await family(forte.slice(4,8), 'Forja');
    const boss = await material(asc[4].name, folder === 'Rover' ? 'Especial' : 'Chefe');
    const flower = await material(asc[5].name, 'Coleta');
    const weekly = await material(forte[8].name, 'Semanal');
    const ascension = rules.ascension.map(row => [...row]);
    if (folder === 'Rover') for (let i=1;i<6;i++) ascension[i][2] = 1;
    if (ranks && ranks.length !== 6) throw Error(`Missing ascension ranks: ${name}`);
    if (ranks) for (let i=0;i<6;i++) {
      const [credit,flowers,bosses,tier,enemies] = ascension[i];
      const expected = { 'Shell Credit': credit, [asc[tier].name]: enemies };
      if (flowers) expected[asc[5].name] = flowers;
      if (bosses) expected[asc[4].name] = bosses;
      if (ranks[i].length !== Object.keys(expected).length || ranks[i].some(r => expected[r.name] !== r.count)) {
        // This supplied file accidentally pastes Roccia's rank table below Jinhsi's totals.
        // Jinhsi's original reviewed catalog and the file's totals agree.
        if (id !== 'jinhsi') throw Error(`Unexpected ascension costs: ${name}, rank ${i+1}`);
      }
    }
    const sourceId = `assets-${id}`;
    putSource({ id: sourceId, url: file ? sourceUrl(sourcePath) : sourcePath, scope: `${name}: materiais de ascensão e Forte`, consultedAt: reference.consultedAt, gameVersion: null, note: file ? 'Texto fornecido pelo usuário. Seis etapas de ascensão conferidas na importação. Totais de Forte incluem nós; o cálculo atual cobre os cinco Fortes, sem nós inerentes/bônus.' : 'Pasta original contém somente retrato. Materiais complementados pelo guia Game8; custos por etapa seguem a tabela compartilhada.' });
    const previous = catalog.characters.find(c => c.id === id);
    if (id === 'jinhsi') sources.find(s => s.id === sourceId).note = 'O resumo do texto e o catálogo original concordam: Howler Core, Elegy Tacet Core e Loong’s Pearl. A tabela por etapa foi colada de Roccia e foi descartada; preservada a tabela previamente conferida da Jinhsi.';
    imported.push({ ...previous, id, name, element: identity.element.text, weapon: identity.weapon.text, rarity: identity.rarity, enemy, forgery, flower, boss, weekly, image: assetUrl(`assets/characters/icons/${id}.webp`), sources: [...new Set([...(previous?.sources || []), sourceId, 'wuwa-akademiya'])], ascensionVerified: true, forteVerified: true, ...(folder === 'Rover' ? { ascension, sharedProgress: 'rover' } : {}) });
  }
}
for (const character of imported) {
  const art = content.art[character.id];
  if (!art?.icon || !art?.card || !art?.banner)
    throw Error(`Novo personagem ${character.name} não possui art configurada em content/characters/${character.id}.json.`);
}
catalog.characters = imported.sort((a,b) => a.name.localeCompare(b.name, 'en'));
for (const m of catalog.materials) await material(m.name, m.category);
catalog.consultedAt = reference.consultedAt;
await writeCuratedContent(content);
if (refresh) await writeFile(referencePath, JSON.stringify({ ...reference, materials: [...usedMaterials.values()] }, null, 2) + '\n');
console.log(`Imported ${catalog.characters.length} characters and ${catalog.materials.length} materials.`);

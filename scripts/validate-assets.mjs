import { access, readFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

export async function validateAssetFields({ catalog, art, events }, root = '.') {
  const assets = resolve(root, 'assets');
  const fields = [
    ...(catalog?.characters || []).map(({ id, image }) => [`character ${id}`, image]),
    ...(catalog?.materials || []).map(({ id, image }) => [`material ${id}`, image]),
    ...(catalog?.weapons || []).map(({ id, image }) => [`weapon ${id}`, image]),
    ...Object.entries(art || {}).flatMap(([id, value]) =>
      ['icon', 'card', 'banner'].map(key => [`character-art ${id}.${key}`, value[key]])),
    ...(events?.events || []).flatMap(event => [
      [`event ${event.id}.icon`, event.icon],
      ...(event.banners || []).map((banner, index) => [`event ${event.id}.banners[${index}]`, banner.image]),
    ]),
  ];
  for (const [label, url] of fields) {
    if (url == null || url === '') continue;
    if (typeof url !== 'string') throw Error(`${label}: caminho de imagem inválido`);
    if (/^https:\/\//i.test(url)) continue;
    let decoded;
    try { decoded = decodeURIComponent(url.replace(/^\.\//, '')); }
    catch { throw Error(`${label}: URL inválida: ${url}`); }
    const target = resolve(root, decoded);
    const inside = relative(assets, target);
    if (!inside || inside === '..' || inside.startsWith(`..${sep}`) || inside.startsWith('/') || inside.startsWith('\\'))
      throw Error(`${label}: imagem fora de assets/: ${url}`);
    try { await access(target); }
    catch { throw Error(`${label}: imagem ausente: ${url}`); }
  }
}

export async function validateRuntimeAssets(root = '.') {
  const read = async file => {
    try { return JSON.parse(await readFile(resolve(root, `data/${file}.json`), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  };
  await validateAssetFields({ catalog: await read('catalog'), art: await read('character-art'), events: await read('events') }, root);
}

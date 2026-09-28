import { access, readFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

export async function validateRuntimeAssets(root = '.') {
  const assets = resolve(root, 'assets');
  const inputs = [
    ['data/catalog.json', data => [
      ...(data.characters || []).map(({ id, image }) => [`character ${id}`, image]),
      ...(data.materials || []).map(({ id, image }) => [`material ${id}`, image]),
      ...(data.weapons || []).map(({ id, image }) => [`weapon ${id}`, image]),
    ]],
    ['data/character-art.json', data => Object.entries(data).flatMap(([id, art]) =>
      ['icon', 'card', 'banner'].map(key => [`character-art ${id}.${key}`, art[key]]))],
    ['data/events.json', data => (data.events || []).flatMap(event => [
      [`event ${event.id}.icon`, event.icon],
      ...(event.banners || []).map((banner, index) => [`event ${event.id}.banners[${index}]`, banner.image]),
    ])],
  ];
  for (const [file, fields] of inputs) {
    let data;
    try { data = JSON.parse(await readFile(resolve(root, file), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const [label, url] of fields(data)) {
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
}

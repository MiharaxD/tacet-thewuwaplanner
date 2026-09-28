import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import { execFileSync } from 'node:child_process';
import {validateEventCatalog} from '../src/domain/official-events.js';
validateEventCatalog(JSON.parse(await readFile('data/events.json','utf8')));
const output=resolve('dist');
if(dirname(output)!==resolve('.'))throw Error('Diretório de build inválido.');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for (const dir of ['src','data','assets']) await cp(dir,`dist/${dir}`,{recursive:true});
await cp('index.html','dist/index.html');
async function* javascriptFiles(dir) {
 for (const entry of await readdir(dir,{withFileTypes:true})) {
  const path = `${dir}/${entry.name}`;
  if (entry.isDirectory()) yield* javascriptFiles(path);
  else if (entry.isFile() && entry.name.endsWith('.js')) yield path;
 }
}
for await (const file of javascriptFiles('src')) execFileSync(process.execPath,['--check',file]);
for (const file of await readdir('data')) if (file.endsWith('.json')) JSON.parse(await readFile(`data/${file}`,'utf8'));
console.log('Produção validada em dist/ — HTML, CSS, ES Modules e dados locais.');

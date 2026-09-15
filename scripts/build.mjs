import { cp, mkdir, readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await mkdir('dist',{recursive:true});
for (const dir of ['src','data','assets']) await cp(dir,`dist/${dir}`,{recursive:true});
await cp('index.html','dist/index.html');
for (const file of await readdir('src')) if (file.endsWith('.js')) execFileSync(process.execPath,['--check',`src/${file}`]);
for (const file of await readdir('data')) if (file.endsWith('.json')) JSON.parse(await readFile(`data/${file}`,'utf8'));
console.log('Produção validada em dist/ — HTML, CSS, ES Modules e dados locais.');

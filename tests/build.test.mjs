import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

test('build removes obsolete output and copies the current project',async()=>{
 const root=await mkdtemp(join(tmpdir(),'tacet-build-test-'));
 try{
  for(const dir of ['src','data','assets','dist/old'])await mkdir(join(root,dir),{recursive:true});
  await writeFile(join(root,'dist/old/removed.txt'),'obsolete');
  await writeFile(join(root,'index.html'),'<h1>Current build</h1>');
  await writeFile(join(root,'data/events.json'),JSON.stringify({version:1,events:[]}));
  await writeFile(join(root,'src/current.js'),'export const current=true;');
  await writeFile(join(root,'assets/current.txt'),'current asset');
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/build.mjs',import.meta.url))],{cwd:root});
  await assert.rejects(access(join(root,'dist/old/removed.txt')),{code:'ENOENT'});
  assert.equal(await readFile(join(root,'dist/assets/current.txt'),'utf8'),'current asset');
  assert.equal(await readFile(join(root,'dist/index.html'),'utf8'),'<h1>Current build</h1>');
 }finally{
  assert.equal(dirname(resolve(root)),resolve(tmpdir()));
  await rm(root,{recursive:true,force:true});
 }
});

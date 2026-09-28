import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {validateRuntimeAssets} from '../scripts/validate-assets.mjs';

test('published image paths stay in production assets',async()=>{
 const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
 await validateRuntimeAssets(project);
 const catalog=JSON.parse(await readFile(join(project,'data/catalog.json'),'utf8'));
 for(const entry of [...catalog.characters,...catalog.materials,...catalog.weapons])
  assert.ok(!/WUWA(?:%20| )Assets|source-assets/i.test(entry.image||''),entry.id);
});

test('build removes obsolete output and copies the current project',async()=>{
 const root=await mkdtemp(join(tmpdir(),'tacet-build-test-'));
 try{
  for(const dir of ['src/pages','data','assets','source-assets/wuwa','dist/old'])await mkdir(join(root,dir),{recursive:true});
  await writeFile(join(root,'dist/old/removed.txt'),'obsolete');
  await writeFile(join(root,'index.html'),'<h1>Current build</h1>');
  await writeFile(join(root,'data/events.json'),JSON.stringify({version:1,events:[]}));
  await writeFile(join(root,'data/catalog.json'),JSON.stringify({characters:[{id:'example',image:'./assets/current.txt'}],materials:[],weapons:[]}));
  await writeFile(join(root,'assets/space name.webp'),'encoded path fixture');
  await writeFile(join(root,'src/current.js'),'export const current=true;');
  await writeFile(join(root,'src/pages/summary.js'),'export const nested=true;');
  await writeFile(join(root,'assets/current.txt'),'current asset');
  await writeFile(join(root,'source-assets/wuwa/raw.txt'),'raw source');
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/build.mjs',import.meta.url))],{cwd:root});
  await assert.rejects(access(join(root,'dist/old/removed.txt')),{code:'ENOENT'});
  assert.equal(await readFile(join(root,'dist/assets/current.txt'),'utf8'),'current asset');
  assert.equal(await readFile(join(root,'dist/index.html'),'utf8'),'<h1>Current build</h1>');
  assert.equal(await readFile(join(root,'dist/src/pages/summary.js'),'utf8'),'export const nested=true;');
  await validateRuntimeAssets(join(root,'dist'));
  await assert.rejects(access(join(root,'dist/source-assets')),{code:'ENOENT'});
  await assert.rejects(access(join(root,'dist/assets/WUWA Assets')),{code:'ENOENT'});
  await writeFile(join(root,'data/catalog.json'),JSON.stringify({characters:[{id:'example',image:'./assets/space%20name.webp'}],materials:[],weapons:[]}));
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/build.mjs',import.meta.url))],{cwd:root});
  await writeFile(join(root,'data/catalog.json'),JSON.stringify({characters:[{id:'example',image:'./assets/missing.webp'}],materials:[],weapons:[]}));
  assert.throws(()=>execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/build.mjs',import.meta.url))],{cwd:root,stdio:'pipe'}),/Command failed/);
  await writeFile(join(root,'data/catalog.json'),JSON.stringify({characters:[{id:'example',image:'./source-assets/wuwa/raw.txt'}],materials:[],weapons:[]}));
  assert.throws(()=>execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/build.mjs',import.meta.url))],{cwd:root,stdio:'pipe'}),/Command failed/);
  await writeFile(join(root,'data/catalog.json'),JSON.stringify({characters:[{id:'example',image:'./assets/current.txt'}],materials:[],weapons:[]}));
  await writeFile(join(root,'src/pages/summary.js'),'export const = invalid;');
  assert.throws(()=>execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/build.mjs',import.meta.url))],{cwd:root,stdio:'pipe'}),/Command failed/);
 }finally{
  assert.equal(dirname(resolve(root)),resolve(tmpdir()));
  await rm(root,{recursive:true,force:true});
 }
});

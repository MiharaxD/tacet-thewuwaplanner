// Refresh public reference data explicitly; the application itself stays offline.
import {readFile} from 'node:fs/promises';
import {pageRecords} from './read-akademiya.mjs';
import {assertFingerprint,stableFingerprintPath,writeStagedFile} from './lib/staging.mjs';
const source='https://wuwa.akademiya.app/en/weapons';
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error(`${r.status}: ${url}`);return r.text();}
const html=await get(source),records=pageRecords(html,'weaponId');
const links=new Map([...html.matchAll(/href="([^"]*\/weapons\/(\d+))"/g)].map(m=>[Number(m[2]),m[1]]));
const snapshotHash=await stableFingerprintPath('scripts/weapons-reference.json');
let cache={consultedAt:new Date().toISOString().slice(0,10),source,weapons:[]};
try{cache=JSON.parse(await readFile('scripts/weapons-reference.json','utf8'));}catch{}
await assertFingerprint('scripts/weapons-reference.json',snapshotHash,'scripts/weapons-reference.json');
let cursor=0;const errors=[];
await Promise.all(Array.from({length:6},async()=>{while(cursor<records.length){
 const w=records[cursor++];if(cache.weapons.some(x=>x.weaponId===w.weaponId))continue;
 try{
  if(!links.has(w.weaponId))throw Error('Missing detail link');
  const url='https://wuwa.akademiya.app'+links.get(w.weaponId),body=await get(url);
  const row=pageRecords(body,'weaponId').find(x=>x.weaponId===w.weaponId&&x.ascension);
  if(!row)throw Error('Missing ascension data');
  cache.weapons.push({weaponId:row.weaponId,name:row.name,rarity:row.rarity,type:row.weapon.text,icon:row.icon,beta:row.beta,url,levels:row.ascension.levels.sort((a,b)=>a.maxLevel-b.maxLevel)});
  if(cache.weapons.length%20===0)console.log(`${cache.weapons.length}/${records.length} armas conferidas`);
 }catch(e){errors.push(`${w.name}: ${e.message}`);}
}}));
if(errors.length)throw Error(errors.join('\n'));
cache.weapons.sort((a,b)=>a.weaponId-b.weaponId);
await writeStagedFile('.', 'scripts/weapons-reference.json',JSON.stringify(cache,null,2)+'\n',{expectedBaseline:snapshotHash});
console.log({count:cache.weapons.length,total:records.length,errors});

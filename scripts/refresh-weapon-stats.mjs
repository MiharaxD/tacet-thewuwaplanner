import {readFile,writeFile} from 'node:fs/promises';
import {pageRecords} from './read-akademiya.mjs';
import {assertFingerprint,stableFingerprintPath,withStagedDirectory} from './lib/staging.mjs';
const referenceHash=await stableFingerprintPath('scripts/weapons-reference.json');
const dataHash=await stableFingerprintPath('data');
const reference=JSON.parse(await readFile('scripts/weapons-reference.json','utf8'));
const catalog=JSON.parse(await readFile('data/catalog.json','utf8'));
await assertFingerprint('scripts/weapons-reference.json',referenceHash,'scripts/weapons-reference.json');
await assertFingerprint('data',dataHash,'data');
const pending=[...catalog.weapons],stats={},errors=[];
await Promise.all(Array.from({length:6},async()=>{while(pending.length){
 const weapon=pending.shift(),ref=reference.weapons.find(r=>r.name===weapon.name);
 try{
  const response=await fetch(ref.url,{signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const row=pageRecords(await response.text(),'weaponId').find(r=>r.weaponId===ref.weaponId);
  if(!row?.ascension?.baseStats?.length)throw Error('Atributos ausentes');
  stats[weapon.id]={level:1,stats:row.ascension.baseStats.map(s=>({name:s.text,value:s.value,percent:s.isPercentage})),skill:row.skill?{name:row.skill.name,rank:1,description:row.skill.description.replace(/\{(\d+)\}/g,(_,i)=>row.skill.params[i]?.[0]??'?')}:null,source:ref.url,consultedAt:new Date().toISOString().slice(0,10)};
 }catch(error){errors.push(`${weapon.name}: ${error.message}`);}
}}));
if(errors.length)throw Error(errors.join('\n'));
await withStagedDirectory('.', 'data', stage => writeFile(`${stage}/data/weapon-stats.json`,JSON.stringify(stats,null,2)+'\n'), {
 expectedBaseline:dataHash,
 beforeSwap:()=>assertFingerprint('scripts/weapons-reference.json',referenceHash,'scripts/weapons-reference.json'),
 afterSwap:()=>assertFingerprint('scripts/weapons-reference.json',referenceHash,'scripts/weapons-reference.json'),
});
console.log(`${Object.keys(stats).length} armas com atributos conferidos.`);

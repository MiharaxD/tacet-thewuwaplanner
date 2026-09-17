import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pageRecords} from './read-akademiya.mjs';
const catalog=JSON.parse(await readFile('data/catalog.json','utf8'));
const refs=JSON.parse(await readFile('scripts/wuwa-reference.json','utf8')).characters;
const portuguese=JSON.parse(await readFile('data/forte-descriptions-pt.json','utf8'));
const pending=[...catalog.characters],result={},errors=[];
const clean=text=>(text||'').replace(/<[^>]*>/g,'').replace(/\{Cus:Sap,S=([^ ]+) P=([^ ]+) SapTag=\d+\}/g,'$2').replace(/\n\s*\n/g,'\n').trim();
const normalize=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
await mkdir('assets/forte-icons',{recursive:true});
await Promise.all(Array.from({length:5},async()=>{while(pending.length){
 const c=pending.shift(),ref=refs.find(r=>normalize(r.name)===normalize(c.name));
 try{
  if(!ref)throw Error('Referência ausente');
  const source=`https://wuwa.akademiya.app/en/characters/${ref.characterId}`;
  const response=await fetch(source,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const html=await response.text();
  const chunks=[...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map(m=>JSON.parse(m[1])).join('');
  const strings={};for(const m of chunks.matchAll(/([0-9a-f]+):T([0-9a-f]+),/g))strings['$'+m[1]]=Buffer.from(chunks.slice(m.index+m[0].length)).subarray(0,parseInt(m[2],16)).toString();
  const row=pageRecords(html,'characterId').find(r=>r.characterId===ref.characterId);
  const branches=['normal','skill','forte','ultimate','intro'].map(type=>{
   const root=Object.values(row.skillTree).find(n=>n.type===type);
   const nodes=[];let node=Object.values(root.nodes||{})[0];
   while(node){const s=node.skill||row.skills.passives.find(p=>p.skillId===node.skillId);if(!s)throw Error(`Nó ${node.nodeIndex} ausente`);
    const description=clean(strings[s.description]||s.description);
    if(!description||/^\$[a-f0-9]+$/.test(description))throw Error('Descrição incompleta');
    nodes.push({name:clean(s.name),description,icon:s.icon,sourceCosts:s.cost||s.promote?.[0]?.cost||[]});node=Object.values(node.nodes||{})[0];}
   if(nodes.length!==2)throw Error(`Árvore incompleta: ${type}`);
   return {type,nodes};
  });
  branches[2].nodes.forEach((node,i)=>{if(portuguese[c.id]?.[i])node.descriptionPt=portuguese[c.id][i];});
  result[c.id]={source,consultedAt:new Date().toISOString().slice(0,10),branches};
 }catch(e){errors.push(`${c.name}: ${e.message}`);}
}}));
await writeFile('data/character-fortes.json',JSON.stringify(result,null,2)+'\n');
console.log(`${Object.keys(result).length} personagens.`,errors);
if(errors.length)process.exitCode=1;

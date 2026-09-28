import {loadContent,writeCuratedContent} from './lib/content.mjs';
const content=await loadContent();
const {catalog,recipes,sources}=content;
for(const m of catalog.materials.filter(m=>['Forja','Inimigos'].includes(m.category)&&/-[1-3]$/.test(m.id))){
 const tier=Number(m.id.at(-1)),input=m.id.slice(0,-1)+(tier-1);
 if(!catalog.materials.some(x=>x.id===input&&x.category===m.category&&x.rarity===m.rarity-1))continue;
 if(!recipes.some(r=>r.outputs[m.id]))recipes.push({id:'purify-'+m.id,inputs:{[input]:3},outputs:{[m.id]:1},verified:true,sources:['synthesis-purification']});
}
if(!sources.some(s=>s.id==='synthesis-purification'))sources.push({id:'synthesis-purification',url:'https://wutheringwaves.fandom.com/wiki/Synthesis',title:'Synthesis · Purification',consultedAt:'2026-09-17',notes:'3 materiais de raridade inferior para 1 da próxima raridade, dentro da mesma família.'});
await writeCuratedContent(content);

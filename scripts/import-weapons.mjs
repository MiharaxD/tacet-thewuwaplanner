import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const reference=await read('scripts/weapons-reference.json'),catalog=await read('data/catalog.json'),rules=await read('data/rules.json'),sources=await read('data/sources.json');
const putSource=s=>{const index=sources.findIndex(x=>x.id===s.id);if(index<0)sources.push(s);else sources[index]=s;};
putSource({id:'weapon-skill-materials',url:'https://wutheringwaves.fandom.com/wiki/Weapon_and_Skill_Material',scope:'Famílias de materiais de armas e Fortes',consultedAt:reference.consultedAt,gameVersion:null,note:'Página solicitada pelo usuário. Conteúdo indexado consultado; acesso direto indisponível. Custos individuais complementados com Akademiya.'});
putSource({id:'weapon-xp-rarities',url:'https://wutheringwaves.fandom.com/wiki/Weapon/Leveling',scope:'EXP acumulada por raridade de arma',consultedAt:reference.consultedAt,gameVersion:null,note:'Tabela 4★; 3★, 2★ e 1★ correspondem respectivamente a 60%, 50% e 40% dessa tabela. Limites e custos de ascensão conferidos nas páginas individuais. Valores por intervalo conferidos com os totais indexados.'});
const xp4=[0,400,900,1600,2400,3400,4500,5800,7300,8900,10700,12700,14900,17300,20000,22900,26000,29400,33000,36900,41100,45500,50200,55200,60600,66300,72300,78700,85400,92500,100000,107900,116200,125000,134200,143900,154100,164800,176000,187700,200000,212800,226200,240200,254900,270200,286200,302900,320300,338500,357400,377100,397600,419000,441200,464300,488400,513400,539400,566400,594500,623700,654000,685400,718000,751800,786900,823300,861000,900000,940500,982400,1025800,1070700,1117200,1165300,1215100,1266600,1319800,1374800,1435300,1498500,1565500,1637600,1716300,1803500,1901400,2012800,2140800,2289200];
rules.weaponXpByRarity={1:xp4.map(n=>Math.round(n*.4)),2:xp4.map(n=>Math.round(n*.5)),3:xp4.map(n=>Math.round(n*.6)),4:xp4,5:rules.weaponXp};
const previous=catalog.weapons;
const supplements={'Boson Astrolabe':['spliced-string','exoswarm-core'],'Pulsation Bracer':['waveworn-shard','mech-core'],'Radiance Cleaver':['carved-crystal','fractured-exoswarm-pendant']};
for(const row of reference.weapons){
 if(row.levels.length||!supplements[row.name])continue;
 const [forgery,enemy]=supplements[row.name];
 row.supplement=`https://wutheringwaves.fandom.com/wiki/${row.name.replaceAll(' ','_')}`;
 row.levels=rules.weaponAscension.map(([shell,tier,n,ft,fn],i)=>({maxLevel:rules.caps[i],cost:[{name:'Shell Credit',quantity:shell},{name:catalog.materials.find(m=>m.id===`${enemy}-${tier}`).name,quantity:n},...(ft===null?[]:[{name:catalog.materials.find(m=>m.id===`${forgery}-${ft}`).name,quantity:fn}])]}));
 row.levels.push({maxLevel:90,cost:[]});
}
catalog.weapons=[];await mkdir('assets/weapons',{recursive:true});
for(const row of reference.weapons.filter(w=>!w.beta&&w.levels.length)){
 const old=previous.find(w=>w.name===row.name),id=old?.id||row.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),sourceId=`weapon-${row.weaponId}`;
 const maxLevel=row.levels.at(-1).maxLevel,maxAscension=rules.caps.indexOf(maxLevel);
 if(maxAscension<0||row.levels.length!==maxAscension+1||row.levels.some((l,i)=>l.maxLevel!==rules.caps[i])||(row.rarity>2&&row.levels.at(-1).cost.length))throw Error(`Invalid ascension stages: ${row.name}`);
 const ascensionCosts=row.levels.slice(0,-1).map(l=>Object.fromEntries(l.cost.map(item=>{const m=catalog.materials.find(m=>m.name===item.name);if(!m||!Number.isSafeInteger(item.quantity)||item.quantity<=0)throw Error(`Invalid material: ${row.name}/${item.name}`);return [m.id,item.quantity];})));
 if(ascensionCosts.some(cost=>!cost.shell))throw Error(`Missing credits: ${row.name}`);
 const used=[...new Set(ascensionCosts.flatMap(c=>Object.keys(c)))],family=category=>catalog.materials.find(m=>used.includes(m.id)&&m.category===category)?.id.replace(/-\d$/,'');
 const imagePath=`assets/weapons/${row.weaponId}.webp`;
 let existingImage=false;try{await access(imagePath);existingImage=true;}catch{}
 if(process.argv.includes('--download-images')&&!existingImage){const response=await fetch('https://static.nanoka.cc/assets/ww/'+row.icon,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`Image unavailable: ${row.name}`);await writeFile(imagePath,new Uint8Array(await response.arrayBuffer()));}
 let image;try{await access(imagePath);image='./'+imagePath;}catch{}
 putSource({id:sourceId,url:row.supplement||row.url,scope:`${row.name}: raridade, tipo, limites e custos por ascensão`,consultedAt:reference.consultedAt,gameVersion:null,note:row.supplement?'Tabela de custos incremental confirmada no conteúdo indexado da Wiki; Akademiya não fornece as etapas desta arma. Famílias de materiais confirmadas em Weapon and Skill Material. Imagem © KURO GAMES.':'Custos incrementais por etapa, ordenados pelo limite de nível. Imagem © KURO GAMES, via Akademiya/static.nanoka.cc. Fonte consultada marca beta=false; não é confirmação independente de disponibilidade regional.'});
 catalog.weapons.push({...old,id,name:row.name,type:row.type,rarity:row.rarity,enemy:family('Inimigos'),forgery:family('Forja'),maxLevel,maxAscension,ascensionCosts,image,sources:[...new Set([...(old?.sources||[]),'weapon-skill-materials',sourceId,'weapon-xp-rarities'])],ascensionVerified:true});
}
catalog.weapons.sort((a,b)=>b.rarity-a.rarity||a.name.localeCompare(b.name,'en'));
for(const [file,data]of Object.entries({catalog,rules,sources}))await writeFile(`data/${file}.json`,JSON.stringify(data,null,2)+'\n');
console.log(`${catalog.weapons.length} armas importadas com custos individuais e EXP por raridade.`);

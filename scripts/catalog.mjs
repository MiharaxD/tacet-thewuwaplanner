// Curadoria manual. Este script só serializa fatos conferidos; não consulta a rede.
import { mkdir,writeFile } from 'node:fs/promises';
const date='2026-09-15';
const wiki=slug=>`https://wutheringwaves.fandom.com/wiki/${slug}`;
const g8=id=>`https://game8.co/games/Wuthering-Waves/archives/${id}`;
const source=(id,url,scope,note='')=>({id,url,scope,consultedAt:date,gameVersion:null,note});
const sources=[
 source('lab','https://wutheringlab.com/','Identidade dos personagens e fonte principal','Cabeçalho anuncia 3.6; não prova que todas as tabelas foram revistas para 3.6.'),
 source('level',wiki('Resonator/Leveling'),'EXP por nível, limites e custo de 0,35 Shell Credit por EXP','Valores de EXP armazenados acumulados. Trechos da tabela disponíveis no índice de busca; página direta bloqueada.'),
 source('weapon-level',wiki('Weapon/Leveling'),'EXP de armas de 5 estrelas; 0,4 Shell Credit/EXP','Tabela de 5 estrelas separada das demais raridades. Valores acumulados.'),
 source('forte',wiki('Luminal_Synthesis'),'Custos incrementais e ascensão exigida para os cinco Fortes','Tabela principal confirmada com Game8. Custos de habilidades inerentes divergem; excluídos até revisão.'),
 source('wave',wiki('Waveplate'),'Custos de atividades e regeneração','40: simulação/forja. 60: chefes/semanal. 1 a cada 6 min, capacidade 240.'),
 source('reset',wiki('Reset'),'Reset diário 04:00 e segunda-feira 04:00','Fusos fixos: América UTC−5, Europa UTC+1, Ásia UTC+8.'),
 source('weekly',wiki('Weekly_Challenge'),'Três resgates de recompensas semanais compartilhados'),
 source('potions',wiki('Resonator_EXP_Material'),'Poções de 1.000, 3.000, 8.000 e 20.000 EXP'),
 source('cores',wiki('Weapon_EXP_Material'),'Consumíveis de EXP de arma'),
 source('howler-recipe',wiki('MF_Howler_Core'),'Síntese 3 LF Howler Core → 1 MF Howler Core','Nenhum custo adicional listado na receita. Direção única nesta base.'),
 source('whisper-recipe',wiki('MF_Whisperin_Core'),'Síntese 3 LF Whisperin Core → 1 MF Whisperin Core'),
 source('official','https://wutheringwaves.kurogames.com/en/main/news','Notícias oficiais','Página dinâmica sem calendário verificável nesta consulta; nenhum evento oficial foi inventado.')
];
const definitions=[
 ['jinhsi','Jinhsi','Spectro','Broadblade',5,'howler','waveworn','pearl','elegy','dagger',494451],
 ['jiyan','Jiyan','Aero','Broadblade',5,'howler','waveworn','pecok','rock','bell',504555],
 ['verina','Verina','Spectro','Rectifier',5,'howler','helix','poppy','elegy','bell',504557],
 ['yinlin','Yinlin','Electro','Rectifier',5,'whisper','helix','coriolus','abomination','feather',504556],
 ['sanhua','Sanhua','Glacio','Sword',4,'whisper','drip','wintry','sound','destruction',504777],
 ['encore','Encore','Fusion','Rectifier',5,'whisper','helix','pecok','rage','destruction',504782]
];
const characters=definitions.map(([id,name,element,weapon,rarity,enemy,forgery,flower,boss,weekly,ref])=>{
 sources.push(source(id,`https://wutheringlab.com/character/${id}-build/`,'Identidade, retrato e ascensão por etapa',id==='jinhsi'?'HTML contém imagem residual de Gloom Slough; Loong’s Pearl confirmado no guia dedicado e Game8.':''));
 sources.push(source(`${id}-cost`,g8(ref),'Materiais, ascensão e Fortes por etapa'));
 return {id,name,element,weapon,rarity,enemy,forgery,flower,boss,weekly,image:`./assets/${id}.${id==='verina'?'webp':'png'}`,sources:[id,`${id}-cost`],ascensionVerified:true,forteVerified:true};
});
sources.push(source('pearl','https://wutheringlab.com/guide/jinhsi-material-loongs-pearl-routes-amp-best-farming-guide/','Loong’s Pearl: Mt. Firmament'));
const mats=[];
function mat(id,name,category,rarity,origin,activity,sourceIds,extra={}){mats.push({id,name,category,rarity,origin,activity,sources:sourceIds,verified:true,...extra});}
mat('shell','Shell Credit','Moeda',null,'Simulation Training: Shell Credit','simulation',['wave']);
for(const [family,label] of [['howler','Howler Core'],['whisper','Whisperin Core']]) ['LF','MF','HF','FF'].forEach((tier,i)=>mat(`${family}-${i}`,`${tier} ${label}`,'Inimigos',i+2,`${family==='howler'?'Howlers':'Whisperins'} · mundo aberto`,'overworld',[family==='howler'?'howler-recipe':'whisper-recipe']));
for(const [family,names,origin] of [ ['waveworn',['Waveworn Residue 210','Waveworn Residue 226','Waveworn Residue 235','Waveworn Residue 239'],'Eroded Ruins · Wuming Bay'], ['helix',['Lento Helix','Adagio Helix','Andante Helix','Presto Helix'],'Misty Forest · Dim Forest'], ['drip',['Inert Metallic Drip','Reactive Metallic Drip','Polarized Metallic Drip','Heterized Metallic Drip'],'Flaming Remnants · Port City of Guixu']]) names.forEach((name,i)=>mat(`${family}-${i}`,name,'Forja',i+2,origin,'forgery',[family==='waveworn'?'jiyan-cost':family==='helix'?'verina-cost':'sanhua-cost']));
for(const [id,name,origin,ref] of [['pearl',"Loong’s Pearl",'Mt. Firmament','pearl'],['pecok','Pecok Flower','Central Plains · Huanglong','jiyan-cost'],['poppy','Belle Poppy','Port City of Guixu · arredores','verina-cost'],['coriolus','Coriolus','Dim Forest · Huanglong','yinlin-cost'],['wintry','Wintry Bell','Gorges of Spirits · Huanglong','sanhua-cost']]) mat(id,name,'Coleta',null,origin,'overworld',[ref]);
for(const [id,name,origin,ref] of [['elegy','Elegy Tacet Core','Mourning Aix · Whining Aix’s Mire','jinhsi-cost'],['rock','Roaring Rock Fist','Feilian Beringal · Dim Forest','jiyan-cost'],['abomination','Group Abomination Tacet Core','Mech Abomination · Court of Savantae Ruins','yinlin-cost'],['sound','Sound-Keeping Tacet Core','Lampylumen Myriad · Tiger’s Maw','sanhua-cost'],['rage','Rage Tacet Core','Inferno Rider · Sea of Flames','encore-cost']]) mat(id,name,'Chefe',4,origin,'boss',[ref]);
for(const [id,name,origin,ref] of [['dagger',"Sentinel’s Dagger",'Jué · Mt. Firmament','jinhsi-cost'],['bell','Monument Bell','Bell-borne Geochelone · Bell-borne Ravine','jiyan-cost'],['feather','Dreamless Feather','Dreamless · Norfall Barrens','yinlin-cost'],['destruction','Unending Destruction','Scar · Chaotic Juncture','encore-cost']]) mat(id,name,'Semanal',4,origin,'weekly',[ref]);
for(const [kind,label,ref] of [['potion','Resonance Potion','potions'],['energy','Energy Core','cores']]) ['Basic','Medium','Advanced','Premium'].forEach((tier,i)=>mat(`${kind}-${i}`,`${tier} ${label}`,'Experiência',i+2,`Simulation Training: ${label}`,'simulation',[ref],{xp:[1000,3000,8000,20000][i],xpKind:kind}));
['Crude Ring','Basic Ring','Improved Ring','Tailored Ring'].forEach((name,i)=>mat(`ring-${i}`,name,'Inimigos',i+2,'Exiles · mundo aberto','overworld',['stringmaster-detail']));
sources.push(source('stringmaster-detail','https://theriagames.com/guide/wuthering-waves-stringmaster-guide/','Stringmaster: anéis e Helix por etapa; corroborado com Wiki'));
sources.push(source('emerald-detail',wiki('Emerald_of_Genesis'),'Emerald of Genesis: Howler, Metallic Drip e créditos por etapa'));
sources.push(source('stringmaster-credit',wiki('Stringmaster'),'Stringmaster: créditos de ascensão por etapa'));
const weapons=[['ages','Ages of Harvest','Broadblade','waveworn','whisper',458249,'ages-of-harvest'],['verdant','Verdant Summit','Broadblade','waveworn','whisper',455951,'verdant-summit'],['stringmaster','Stringmaster','Rectifier','helix','ring',455927,'stringmaster'],['emerald','Emerald of Genesis','Sword','drip','howler',455939,'emerald-of-genesis']].map(([id,name,type,forgery,enemy,ref,slug])=>{
 sources.push(source(id,`https://wutheringlab.com/weapon/${slug}/`,'Identidade da arma'));sources.push(source(`${id}-cost`,g8(ref),'Materiais de ascensão',enemy?'Créditos complementados pela tabela individual da Wiki.':'Custos ainda não conferidos integralmente; não entram no cálculo.'));
 return {id,name,type,forgery,enemy,rarity:5,sources:[id,`${id}-cost`],ascensionVerified:Boolean(enemy)};
});
sources.push(source('ages-credit',wiki('Ages_of_Harvest'),'Créditos de ascensão 10000/20000/40000/60000/80000/120000'));
const resonatorXp=[0,400,800,1300,1900,2600,3500,4500,5700,7000,8500,10200,12200,14400,16800,19500,22500,25800,29400,33300,37600,42200,47200,52600,58400,64700,71400,78600,86300,94500,103200,112500,122300,132700,143700,155400,167700,180700,194400,208800,223900,239800,256500,274000,292300,311500,331500,352400,374300,397100,420900,445700,471500,498400,526400,555500,585800,617200,649800,683700,718800,755200,792900,832000,872500,914400,957700,1002500,1048800,1096700,1146200,1197300,1250100,1304600,1360800,1418800,1478600,1540200,1603700,1669100,1736500,1805900,1877300,1950800,2026400,2104200,2184200,2266500,2351100,2438000];
const weaponXp=[0,600,1300,2100,3000,4000,5100,6400,7800,9400,11200,13200,15400,17900,20600,23600,26900,30500,34400,38700,43300,48300,53700,59500,65800,72500,79700,87400,95600,104300,113600,123500,134000,145100,156900,169300,182400,196200,210800,226100,242200,259100,276800,295400,314800,335100,356400,378600,401800,426000,451200,477500,504800,533200,562800,593500,625400,658500,692800,728400,765300,803500,843100,884100,926500,970300,1015600,1062400,1110700,1160500,1211900,1264900,1319600,1376000,1434100,1493900,1555500,1618900,1684100,1751200,1822800,1896700,1973600,2054200,2139500,2230900,2329900,2438300,2558300,2692400];
const rules={caps:[20,40,50,60,70,80,90],floors:[1,20,40,50,60,70,80],union:[1,10,20,30,40,50,60],skillCaps:[1,1,3,4,6,8,10],resonatorXp,weaponXp,experienceMode:'cumulative',resonatorCreditPerXp:0.35,weaponCreditPerXp:0.4,
 ascensionMode:'incremental',ascension:[ [5000,0,0,0,4],[10000,4,3,1,4],[15000,8,6,1,8],[20000,12,9,2,4],[40000,16,12,2,8],[80000,20,16,3,4] ],
 weaponAscension:[ [10000,0,6,null,0],[20000,1,6,0,6],[40000,2,4,1,8],[60000,2,6,2,6],[80000,3,4,3,8],[120000,3,8,3,12] ],
 skillMode:'incremental',skills:[[1500,0,2,2,0],[2000,0,3,3,0],[4500,1,2,2,0],[6000,1,3,3,0],[16000,2,3,2,0],[30000,2,5,3,1],[50000,3,2,2,1],[70000,3,3,3,1],[100000,3,6,4,1]],
 unlocksVerified:true,unlockCosts:{inherent:[[10000,1,3,3,1],[20000,2,3,3,1]],stat:[[50000,2,3,3,0],[100000,3,3,3,1]]},unlockAscensions:{inherent:[2,4],stat:[3,4]},
 activities:{overworld:{waveplates:0},simulation:{waveplates:40},forgery:{waveplates:40},boss:{waveplates:60},weekly:{waveplates:60,weeklyLimit:3}},servers:{America:-5,Europe:1,Asia:8,SEA:8},dailyResetHour:4,weeklyResetDay:1};
const recipes=[{id:'howler-lf-mf',inputs:{'howler-0':3},outputs:{'howler-1':1},sources:['howler-recipe'],verified:true},{id:'whisper-lf-mf',inputs:{'whisper-0':3},outputs:{'whisper-1':1},sources:['whisper-recipe'],verified:true}];
await mkdir('data',{recursive:true});
for(const [name,value] of Object.entries({catalog:{version:1,consultedAt:date,characters,weapons,materials:mats},rules,sources,recipes,events:{version:1,consultedAt:date,events:[],note:'Nenhum calendário oficial atual verificado. Cadastro pessoal disponível.'}})) await writeFile(`data/${name}.json`,JSON.stringify(value,null,2)+'\n');
await import('./import-wuwa.mjs');

await import('./import-weapons.mjs');

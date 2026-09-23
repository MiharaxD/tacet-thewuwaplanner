import { clone,integer,validateGoal } from './engine.js';
export const STORAGE_KEY='tacet-planner:v1';
export const CONFLICT_MESSAGE='Dados alterados em outra aba. Esta aba não pode salvar. Exporte um backup desta aba, se necessário, e recarregue para continuar.';
export function getStorage(host){try{return host.localStorage;}catch{return null;}}
// Serialize browser writes across tabs; the snapshot check also protects callers
// without Web Locks and detects changes made before a storage event is delivered.
export function withStorageLock(locks,action){return locks?.request?locks.request(STORAGE_KEY,action):Promise.resolve().then(action);}
export const defaultState=()=>({version:1,inventory:{},goals:[],events:[],eventCompletions:{},settings:{server:'America',timeZone:'America/Sao_Paulo',unionLevel:1,dailyWaveplates:240,weeklyClaimsUsed:0,weeklyPeriod:null,yields:{}}});
function record(value){return value&&typeof value==='object'&&!Array.isArray(value);}
function instant(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));}
export function validateState(input,db){
 if(!record(input)||input.version!==1)throw Error('Backup incompatível: esperado formato versão 1.');
 if(!record(input.inventory)||!Array.isArray(input.goals)||input.goals.length>100||!Array.isArray(input.events)||input.events.length>500||!record(input.settings))throw Error('Estrutura de backup inválida.');
 const validMaterials=new Set(db.catalog.materials.map(m=>m.id));
 for(const [id,n]of Object.entries(input.inventory))if(!validMaterials.has(id)||!integer(n))throw Error(`Estoque inválido: ${id}`);
 const ids=new Set();
 for(const goal of input.goals){validateGoal(goal,db);if(ids.has(goal.id)||ids.has(`char:${goal.charId}`))throw Error('Metas duplicadas.');ids.add(goal.id);ids.add(`char:${goal.charId}`);}
 const settings=input.settings;
 if(!Object.hasOwn(db.rules.servers,settings.server)||!integer(settings.unionLevel,1,80)||!integer(settings.dailyWaveplates,1,10000)||!integer(settings.weeklyClaimsUsed,0,3)||!record(settings.yields)||typeof settings.timeZone!=='string')throw Error('Configurações inválidas.');
 try{new Intl.DateTimeFormat('pt-BR',{timeZone:settings.timeZone});}catch{throw Error('Fuso horário inválido.');}
 if(settings.weeklyPeriod!==null&&!instant(settings.weeklyPeriod))throw Error('Período semanal inválido.');
 for(const [id,n]of Object.entries(settings.yields))if((!validMaterials.has(id)&&!['xp-potion','xp-energy'].includes(id))||!Number.isFinite(n)||n<0||n>1e9)throw Error('Rendimento inválido.');
 const eventCompletions=input.eventCompletions??{};
 if(!record(eventCompletions)||Object.keys(eventCompletions).length>5000||Object.entries(eventCompletions).some(([id,done])=>!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||(typeof done!=='boolean'&&!instant(done))))throw Error('Conclusões de eventos inválidas.');
 const eventIds=new Set();
 for(const e of input.events){
  if(!e||typeof e.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(e.id)||eventIds.has(e.id)||typeof e.title!=='string'||!e.title.trim()||e.title.length>120||e.kind!=='personal'||!instant(e.start)||!instant(e.end)||Date.parse(e.end)<=Date.parse(e.start)||!Array.isArray(e.tasks)||e.tasks.length>50||!record(e.rewards)||typeof e.claimed!=='boolean')throw Error('Evento inválido.');
  eventIds.add(e.id);
  for(const t of e.tasks)if(!t||typeof t.text!=='string'||!t.text.trim()||t.text.length>200||typeof t.done!=='boolean')throw Error('Tarefa inválida.');
  for(const [id,n]of Object.entries(e.rewards))if(!validMaterials.has(id)||!integer(n,0))throw Error('Recompensa inválida.');
 }
 // Rebuild only approved keys. Imported objects never become prototypes or DOM code.
 return {version:1,inventory:{...input.inventory},goals:input.goals.map(g=>({id:g.id,charId:g.charId,sequence:g.sequence??0,current:clone(g.current),target:clone(g.target),weapon:g.weapon?clone(g.weapon):null,done:g.done})),events:input.events.map(e=>({id:e.id,title:e.title,kind:'personal',start:e.start,end:e.end,tasks:e.tasks.map(t=>({text:t.text,done:t.done})),rewards:{...e.rewards},claimed:e.claimed})),eventCompletions:{...eventCompletions},settings:{server:settings.server,timeZone:settings.timeZone,unionLevel:settings.unionLevel,dailyWaveplates:settings.dailyWaveplates,weeklyClaimsUsed:settings.weeklyClaimsUsed,weeklyPeriod:settings.weeklyPeriod,yields:{...settings.yields}}};
}
export function parseBackup(text,db){
 if(typeof text!=='string'||text.length>2000000)throw Error('Backup muito grande (limite: 2 MB).');
 let parsed;try{parsed=JSON.parse(text);}catch{throw Error('O arquivo não contém JSON válido.');}
 return validateState(migrateSavedState(parsed),db);
}
export function migrateSavedState(input){
 // Explicit minimal interchange format: v0 stores inventory only. Other keys are
 // rejected so a migration can never silently discard unsupported saved data.
 if(record(input)&&input.version===0){
  if(!record(input.inventory)||Object.keys(input).some(k=>!['version','inventory'].includes(k)))throw Error('Migração v0 aceita somente version e inventory.');
  return {...defaultState(),inventory:{...input.inventory}};
 }
 return input;
}
export function mergeState(current,incoming,db){
 const next=clone(current);
 // Quantities represent snapshots; max avoids duplicating stock when importing twice.
 for(const [id,n]of Object.entries(incoming.inventory))next.inventory[id]=Math.max(next.inventory[id]||0,n);
 for(const goal of incoming.goals)if(!next.goals.some(g=>g.id===goal.id||g.charId===goal.charId))next.goals.push(clone(goal));
 for(const event of incoming.events)if(!next.events.some(e=>e.id===event.id))next.events.push(clone(event));
 next.eventCompletions={...(next.eventCompletions||{})};
 for(const [id,done]of Object.entries(incoming.eventCompletions||{})){const current=next.eventCompletions[id];next.eventCompletions[id]=typeof current==='string'||typeof done==='string'?[current,done].filter(v=>typeof v==='string').sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1):current===true||done;}
 return validateState(next,db);
}
export function loadState(storage,db){
 try{
  const raw=storage.getItem(STORAGE_KEY);if(!raw)return {state:defaultState(),warning:null};
  try{return {state:parseBackup(raw,db),warning:null};}
  catch(error){
   try{storage.setItem(`${STORAGE_KEY}:recovery`,raw);}catch{}
   return {state:defaultState(),warning:'O salvamento está inválido. Uma cópia foi preservada para recuperação; exporte-a em Configurações.',corrupt:true};
  }
 }catch{return {state:defaultState(),warning:'Armazenamento indisponível. Use Exportar backup antes de fechar.'};}
}
export function saveState(storage,state,db){storage.setItem(STORAGE_KEY,JSON.stringify(validateState(state,db)));}
export function claimRewards(state,eventId){
 const next=clone(state),event=next.events.find(e=>e.id===eventId);
 if(!event||event.claimed||event.tasks.some(t=>!t.done))throw Error('Conclua as tarefas antes de registrar o recebimento.');
 for(const [id,n]of Object.entries(event.rewards))next.inventory[id]=(next.inventory[id]||0)+n;
 event.claimed=true;return next;
}
export class Store{
 constructor(state,db,storage){
  this.state=state;this.db=db;this.storage=storage;this.history=[];this.saveError=null;this.conflicted=false;
  try{this.snapshot=storage.getItem(STORAGE_KEY);}catch{this.storage=null;this.saveError='Armazenamento indisponível. Exporte um backup antes de fechar.';}
 }
 markConflict(){this.conflicted=true;this.saveError=CONFLICT_MESSAGE;}
 assertWritable(){
  if(this.conflicted)throw Error(CONFLICT_MESSAGE);
  if(!this.storage)return;
  let raw;try{raw=this.storage.getItem(STORAGE_KEY);}catch{this.storage=null;this.saveError='Armazenamento indisponível. Exporte um backup antes de fechar.';return;}
  if(raw!==this.snapshot){this.markConflict();throw Error(CONFLICT_MESSAGE);}
 }
 observeStorage(event){
  if(this.storage&&event.storageArea===this.storage&&(event.key===STORAGE_KEY||event.key===null)){
   try{this.assertWritable();}catch{}
  }
 }
 commit(next){
  this.assertWritable();next=validateState(next,this.db);this.history.push(clone(this.state));if(this.history.length>20)this.history.shift();this.state=next;this.persist();return this.state;
 }
 persist(){this.assertWritable();try{const raw=JSON.stringify(validateState(this.state,this.db));this.storage.setItem(STORAGE_KEY,raw);this.snapshot=raw;this.saveError=null;}catch{this.saveError='Não foi possível salvar. Exporte um backup antes de fechar.';}}
 undo(){this.assertWritable();if(!this.history.length)throw Error('Nada para desfazer.');this.state=this.history.pop();this.persist();return this.state;}
}

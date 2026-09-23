import * as farmRates from '../src/farm-rates.js';
import * as materials from '../src/materials.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as engine from '../src/engine.js';
import * as state from '../src/state.js';
import * as time from '../src/time.js';
import * as ui from '../src/ui.js';
import * as forms from '../src/forms.js';
import * as official from '../src/official-events.js';

test('the actual app boots and accepts inventory edits when the storage getter throws',async()=>{
 let clock=Date.now(),renderCount=0,html='';const timers=[];
 const ClockDate=class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
 const listeners=new Map(),app={get innerHTML(){return html;},set innerHTML(value){html=value;renderCount++;},querySelectorAll:()=>[]};
 const toast={textContent:'',classList:{add(){},remove(){}}};
 const modalListeners=new Map();
 const modal={open:false,addEventListener(name,fn){modalListeners.set(name,fn);},close(){this.open=false;},showModal(){this.open=true;},querySelector(){return null;},classList:{toggle(){}}};
 const elements={'#app':app,'#modal':modal,'#toast':toast};
 const window={addEventListener(){},get localStorage(){throw new DOMException('Blocked','SecurityError');}};
 const context=vm.createContext({
  ...farmRates,...materials,...engine,...state,...time,...ui,...forms,...official,h:ui.escape,window,navigator:{},location:{hash:''},
  document:{querySelector:key=>elements[key]||null,querySelectorAll:()=>[],addEventListener:(name,fn)=>{if(name!=='click'||!listeners.has(name))listeners.set(name,fn);},activeElement:null},
  registerPlannerTools(){},structuredClone,Intl,URL,crypto,Date:ClockDate,
  eventStatus:(e,now=clock)=>time.eventStatus(e,now),countdown:(end,now=clock)=>time.countdown(end,now),
  officialEvents:(catalog,server,now=clock)=>official.officialEvents(catalog,server,now),
  eventCycle:(e,now=clock)=>official.eventCycle(e,now),isEventCompleted:(s,e,now=clock)=>official.isEventCompleted(s,e,now),
  setEventCompleted:(s,c,id,done,now=clock)=>official.setEventCompleted(s,c,id,done,now),
  setInterval(fn,delay){timers.push({fn,delay});},setTimeout(){},clearTimeout(){},
  fetch:async path=>({ok:true,json:async()=>JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'))})
 });
 // Run the real boot and event handlers with only browser I/O replaced.
 const source=(await readFile(new URL('../src/app.js',import.meta.url),'utf8'))
  .replace(/^import .*;\r?\n/gm,'').replace(/boot\(\);\s*$/,'globalThis.bootResult=boot();');
 vm.runInContext('"use strict";\n'+source,context);await context.bootResult;
 assert.match(app.innerHTML,/Seu próximo avanço/);
 assert.match(app.innerHTML,/Armazenamento indisponível/);
 assert.doesNotMatch(app.innerHTML,/boot-error/);
 const beforeTyping=app.innerHTML;
 const stockInput={closest:()=>null,dataset:{stock:'shell'},value:'',valueAsNumber:0,setCustomValidity(){},reportValidity(){}};
 const historyBefore=vm.runInContext('store.history.length',context);
 for(const value of ['1','12','123','1234','12345']){stockInput.value=value;stockInput.valueAsNumber=Number(value);listeners.get('input')({target:stockInput});}
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(vm.runInContext('store.history.length',context),historyBefore);
 assert.equal(app.innerHTML,beforeTyping,'typing must not replace the input DOM');
 listeners.get('change')({target:stockInput});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(vm.runInContext('state().inventory.shell',context),12345);
 assert.equal(vm.runInContext('store.history.length',context),historyBefore+1);
 listeners.get('change')({target:stockInput});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(vm.runInContext('store.history.length',context),historyBefore+1,'unchanged quantity adds no undo entry');
 vm.runInContext('store.undo()',context);assert.equal(vm.runInContext('state().inventory.shell||0',context),0);
 vm.runInContext("route='characters';search='no-character-matches-this';render();",context);
 assert.ok(app.innerHTML.includes(vm.runInContext('db.catalog.characters.length',context)+' personagens verificados'));
 vm.runInContext("search='';",context);
 assert.match(toast.textContent,/Exporte um backup/);
 assert.equal(vm.runInContext('store.storage',context),null);
 vm.runInContext("let savedStock=null;store.storage={getItem:()=>savedStock,setItem:(key,value)=>{savedStock=value;}};store.snapshot=null;",context);
 listeners.get('change')({target:stockInput});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(vm.runInContext('JSON.parse(savedStock).inventory.shell',context),12345);
 vm.runInContext('store.undo()',context);
 assert.equal(vm.runInContext('JSON.parse(savedStock).inventory.shell||0',context),0);

 vm.runInContext(`db.events={version:1,events:[{id:'published-event',title:'Evento publicado',start:new Date(Date.now()-86400000).toISOString(),end:new Date(Date.now()+86400000).toISOString()}]};route='events';render();`,context);
 assert.match(app.innerHTML,/Evento publicado/);assert.match(app.innerHTML,/data-official-event="published-event"/);
 assert.doesNotMatch(app.innerHTML,/new-event|edit-event|remove-event|Registrar recebimento/);
 vm.runInContext(`db.events.events.push({id:'expired',title:'Evento vencido teste',start:'2000-01-01T00:00:00Z',end:'2000-01-02T00:00:00Z'},{id:'future',title:'Evento futuro teste',start:new Date(Date.now()+86400000).toISOString(),end:new Date(Date.now()+172800000).toISOString()});render();`,context);
 assert.doesNotMatch(app.innerHTML,/Evento vencido teste/);assert.match(app.innerHTML,/Evento futuro teste/);assert.match(app.innerHTML,/Evento publicado/);
 vm.runInContext(`store.commit({...state(),eventCompletions:{expired:true}});render();`,context);
 assert.match(app.innerHTML,/<details class="completed-events">[\s\S]*Evento vencido teste/);
 vm.runInContext("db.events.events=db.events.events.filter(e=>e.id==='published-event');",context);
 vm.runInContext("route='summary';render();",context);
 assert.match(app.innerHTML,/data-official-event="published-event"/);
 assert.doesNotMatch(app.innerHTML,/class="stats"|METAS ATIVAS|MATERIAIS RESERVADOS|RECURSOS EM FALTA|WAVEPLATES \/ DIA/);


 listeners.get('change')({target:{closest:()=>null,dataset:{officialEvent:'published-event'},checked:true}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(vm.runInContext('state().eventCompletions["published-event"]',context),true);
 assert.doesNotMatch(app.innerHTML,/Evento publicado|completed-events/,'completed events disappear from every summary section');
 assert.match(app.innerHTML,/Nenhum evento pendente por aqui/);
 vm.runInContext("route='events';render();",context);
 assert.match(app.innerHTML,/<details class="completed-events"><summary>Eventos completos \(1\)<\/summary>[\s\S]*Evento publicado/);
 assert.doesNotMatch(app.innerHTML,/<details class="completed-events" open/);
 listeners.get('change')({target:{closest:()=>null,dataset:{officialEvent:'published-event'},checked:false}});
 await new Promise(resolve=>setImmediate(resolve));
 vm.runInContext("route='summary';render();",context);
 assert.match(app.innerHTML,/data-official-event="published-event"/);
 assert.doesNotMatch(app.innerHTML,/completed-events/);
 vm.runInContext("route='events';",context);

  assert.equal(vm.runInContext('db.events.events[0].title',context),'Evento publicado');
  vm.runInContext(`db.events.events[0].permanent=true;delete db.events.events[0].end;db.events.events[0].start='2020-01-01T00:00:00Z';render();`,context);
  assert.match(app.innerHTML,/Permanente/);assert.doesNotMatch(app.innerHTML,/NaN|Invalid Date|Termina:/);
  vm.runInContext(`route='summary';render();`,context);
  assert.match(app.innerHTML,/Permanente/);assert.doesNotMatch(app.innerHTML,/NaN|Invalid Date/);
  vm.runInContext(`db.events.events[0].type='recurring';db.events.events[0].reset={anchor:'2020-01-01T00:00:00Z',everyHours:24};render();`,context);
  assert.match(app.innerHTML,/Reset em/);assert.doesNotMatch(app.innerHTML,/NaN|Invalid Date/);

  listeners.get('change')({target:{closest:()=>null,dataset:{officialEvent:'published-event'},checked:true}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.doesNotMatch(app.innerHTML,/Evento publicado|completed-events/);
  vm.runInContext(`store.commit({...state(),eventCompletions:{...state().eventCompletions,'published-event':new Date(Date.now()-86400000).toISOString()}});render();`,context);
  assert.match(app.innerHTML,/data-official-event="published-event"/,'recurring event returns after its completion cycle');
  vm.runInContext(`db.events.events[0].type='event';route='events';render();`,context);

  assert.match(app.innerHTML,/<details class="completed-events">/);
  assert.doesNotMatch(app.innerHTML,/<details class="completed-events" open/);
  assert.doesNotMatch(app.innerHTML,/NaN/);
  vm.runInContext(`db.events.events[0].start='2020-01-01T00:00:00Z';db.events.events[0].end='2099-01-01T00:00:00Z';render();`,context);
  assert.doesNotMatch(app.innerHTML,/NaN/);
  vm.runInContext(`store.commit({...state(),inventory:{'howler-0':9}});route='inventory';render();`,context);
  assert.match(app.innerHTML,/data-action="auto-synthesis" data-id="howler-1"/);
  assert.match(app.innerHTML,/data-stock="howler-0"/);
  vm.runInContext(`actions['auto-synthesis']({dataset:{id:'howler-1'}});`,context);
  assert.equal(vm.runInContext("state().inventory['howler-1']",context),3);
  assert.equal(vm.runInContext("state().inventory['howler-0']",context),0);
  assert.match(app.innerHTML,/id="inv-howler-1"[^>]*value="3"/);
  vm.runInContext(`const testGoal=newGoal(db.catalog.characters[0].id,'goal-farm-test');store.commit({...state(),goals:[testGoal],inventory:{}});route='summary';render();`,context);
  assert.match(app.innerHTML,/goal-farm-grid/);assert.match(app.innerHTML,/tentativas/);assert.match(app.innerHTML,/Waveplates/);
  vm.runInContext(`route='characters';render();`,context);assert.match(app.innerHTML,/goal-farm-grid/);
  const tiles=vm.runInContext('previewMaterials(plan.goals[0].itemRows)',context);assert.match(tiles,/tile-owned/);assert.match(tiles,/tile-needed/);assert.match(tiles,/edit-goal-stock/);
  const inventoryBeforeDelete=vm.runInContext('JSON.stringify(state().inventory)',context);
  const clickAction=async(action,id)=>{listeners.get('click')({target:{closest:()=>({dataset:{action,id}})}});await new Promise(resolve=>setImmediate(resolve));};
  await clickAction('remove','goal-farm-test');assert.match(modal.innerHTML,/confirm-remove/);assert.equal(modal.open,true);
  await clickAction('confirm-remove','goal-farm-test');assert.equal(vm.runInContext('state().goals.length',context),0);assert.equal(modal.open,false);
  assert.equal(modal.innerHTML,'','closed dialogs must not retain hidden stock editors');
  vm.runInContext(`openModal('<form id="goal-form"><section id="goal-stock-editor"></section></form>');`,context);
  modal.open=false;modalListeners.get('close')();assert.equal(modal.innerHTML,'','Escape/native close also removes the stale form and editor');
  vm.runInContext(`openModal('<p>Novo modal</p>');`,context);modalListeners.get('close')();assert.match(modal.innerHTML,/Novo modal/,'a delayed close event must not clear a reopened dialog');
  vm.runInContext('closeModal()',context);
  assert.equal(vm.runInContext('JSON.stringify(state().inventory)',context),inventoryBeforeDelete);
  const popup={dataset:{},innerHTML:'',opened:false,setAttribute(){},matches(){return this.opened;},showPopover(){this.opened=true;},hidePopover(){this.opened=false;},querySelector(){return null;},querySelectorAll(){return [{value:'123',valueAsNumber:123,dataset:{goalStock:'shell'}}];}};
  context.document.createElement=()=>popup;context.document.body={append:el=>{elements['#'+el.id]=el;}};
  vm.runInContext(`route='summary';render();actions['edit-goal-stock']({dataset:{id:'shell'},isConnected:false});`,context);
  assert.equal(popup.opened,true);assert.match(popup.innerHTML,/data-goal-stock="shell"/);
  vm.runInContext(`actions['save-goal-stock']();`,context);
  assert.equal(vm.runInContext('state().inventory.shell',context),123);assert.equal(popup.opened,false);
  await clickAction('undo');await clickAction('undo');assert.equal(vm.runInContext('state().goals[0].id',context),'goal-farm-test');
  assert.equal(vm.runInContext('JSON.stringify(state().inventory)',context),inventoryBeforeDelete);
 // Exercise the actual periodic callback with a controllable clock.
 assert.equal(timers.length,1);assert.equal(timers[0].delay,60000);
 clock=Date.parse('2026-09-21T12:00:00Z');
 vm.runInContext(`db.events={version:1,events:[
 {id:'cycle',title:'Evento recorrente',type:'recurring',permanent:true,start:'2020-01-01T00:00:00Z',reset:{anchor:'2026-09-21T12:00:00Z',everyHours:1}},
 {id:'future',title:'Evento futuro',start:'2026-09-21T12:30:00Z',end:'2026-09-21T14:00:00Z'}]};
 store.commit({...state(),eventCompletions:{cycle:new Date().toISOString()}});refreshWeekly();route='summary';render();`,context);
 assert.doesNotMatch(app.innerHTML,/No seu radar|agenda-preview|Evento recorrente|completed-events/);
 assert.equal((app.innerHTML.match(/data-official-event="future"/g)||[]).length,1);
 assert.match(app.innerHTML,/data-official-event="future"[^>]*disabled/);
 const resetText={textContent:''},eventText={dataset:{eventCountdown:'future'},textContent:''};
 context.document.querySelectorAll=selector=>selector==='[data-reset-countdown]'?[resetText]:selector==='[data-event-countdown]'?[eventText]:[];
 const focused={tagName:'INPUT',id:'editing-stock'};context.document.activeElement=focused;
 modal.open=true;modal.innerHTML='Preserve modal contents';
 let beforeTick=renderCount;
 clock+=60000;await timers[0].fn();
 assert.equal(renderCount,beforeTick,'ordinary tick must not replace app.innerHTML');
 assert.equal(eventText.textContent,'Começa em 0h 29min');
 assert.equal(resetText.textContent,time.countdown(new Date(time.nextReset(clock,vm.runInContext('db.rules.servers[state().settings.server]',context))).toISOString(),clock)+' · America');
 assert.equal(context.document.activeElement,focused);assert.equal(modal.open,true);assert.equal(modal.innerHTML,'Preserve modal contents');
 context.document.activeElement=null;modal.open=false;
 clock+=60000;await timers[0].fn();assert.equal(renderCount,beforeTick,'idle ticks also avoid rebuilding cards and details');
 assert.equal(eventText.textContent,'Começa em 0h 28min');
 clock=Date.parse('2026-09-21T12:30:00Z');await timers[0].fn();
 assert.equal(renderCount,++beforeTick,'future becoming active renders once');assert.match(app.innerHTML,/data-official-event="future"/);assert.doesNotMatch(app.innerHTML,/Começa em/);assert.doesNotMatch(app.innerHTML,/data-official-event="future"[^>]*disabled/);
 clock=Date.parse('2026-09-21T13:00:00Z');await timers[0].fn();
 assert.equal(renderCount,++beforeTick,'cycle renewal renders once');assert.match(app.innerHTML,/data-official-event="cycle"/);assert.doesNotMatch(app.innerHTML,/completed-events/);
 await timers[0].fn();assert.equal(renderCount,beforeTick,'same boundary is not rendered twice');
 clock=Date.parse('2026-09-21T14:00:00Z');await timers[0].fn();
 assert.equal(renderCount,++beforeTick,'simultaneous cycle and event expiry use one render');assert.doesNotMatch(app.innerHTML,/Evento futuro/);
 vm.runInContext(`store.commit({...state(),settings:{...state().settings,weeklyClaimsUsed:3}});render();`,context);
 beforeTick=renderCount;clock=Date.parse('2026-09-28T12:00:00Z');await timers[0].fn();
 assert.equal(renderCount,beforeTick+1);assert.equal(vm.runInContext('state().settings.weeklyClaimsUsed',context),0);
 await timers[0].fn();assert.equal(renderCount,beforeTick+1);

 vm.runInContext(`route='events';eventView='list';db.events={events:[{id:'ended',title:'Encerrado sem conclusão',start:'2000-01-01T00:00:00Z',end:'2000-01-02T00:00:00Z'}]};store.commit({...state(),eventCompletions:{}});render();`,context);
 assert.match(app.innerHTML,/Nenhum evento ativo ou futuro/);assert.doesNotMatch(app.innerHTML,/Tudo concluído por aqui/);
 vm.runInContext(`store.commit({...state(),eventCompletions:{ended:true}});render();`,context);
 assert.match(app.innerHTML,/Tudo concluído por aqui/);assert.match(app.innerHTML,/<details class="completed-events">/);
 clock=Date.parse('2026-09-30T16:00:00Z');
 vm.runInContext(`db.events={events:[{id:'zone-event',title:'Evento na virada',start:'2026-09-30T15:00:00Z',end:'2026-09-30T17:00:00Z'}]};store.commit({...state(),settings:{...state().settings,timeZone:'Asia/Tokyo'}});actions['event-calendar']();`,context);
 assert.match(app.innerHTML,/outubro de 2026/);
 assert.match(app.innerHTML,/calendar-day today"><span>1<\/span>[\s\S]*?Evento na virada/);
 vm.runInContext("actions['prev-month']();",context);assert.match(app.innerHTML,/setembro de 2026/);
 vm.runInContext('render()',context);assert.match(app.innerHTML,/setembro de 2026/,'render preserves manual month navigation');
 vm.runInContext("actions['next-month']();",context);assert.match(app.innerHTML,/outubro de 2026/);
 vm.runInContext(`store.commit({...state(),settings:{...state().settings,timeZone:'America/Sao_Paulo'}});actions['event-list']();actions['event-calendar']();`,context);
 assert.match(app.innerHTML,/setembro de 2026/);
 assert.match(app.innerHTML,/calendar-day today"><span>30<\/span>[\s\S]*?Evento na virada/);

 vm.runInContext("db.events={events:[]};eventView='list';render();",context);
 assert.match(app.innerHTML,/Nenhum evento ativo ou futuro/);
 const futureRecurring=vm.runInContext(`eventCard({id:'future-cycle',title:'Ciclo futuro',type:'recurring',permanent:true,start:new Date(Date.now()+86400000).toISOString(),reset:{anchor:new Date(Date.now()+86400000).toISOString(),everyHours:24}})`,context);
 assert.match(futureRecurring,/Começa em/);assert.match(futureRecurring,/data-official-event="future-cycle"[^>]*disabled/);assert.doesNotMatch(futureRecurring,/event-is-complete/);

});



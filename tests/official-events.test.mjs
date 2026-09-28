import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateEventCatalog,officialEvents,eventDuration,setEventCompleted,eventCycle,isEventCompleted} from '../src/domain/official-events.js';
import {defaultState,validateState,parseBackup,mergeState,Store} from '../src/storage/state.js';
import {eventStatus,nextReset} from '../src/domain/time.js';
const event={id:'test-event',title:'Evento de teste',start:'2026-09-20T10:00:00-03:00',end:'2026-10-04T10:00:00-03:00'};
const catalog={version:1,events:[event]};
test('permanent events need no end, stay active and recurring completion resets indefinitely',()=>{
 const permanent={...event,permanent:true,type:'recurring',reset:{anchor:event.start,everyHours:24}};delete permanent.end;
 assert.doesNotThrow(()=>validateEventCatalog({version:1,events:[permanent]}));
 const now=Date.parse('2030-01-01T15:00:00Z');
 assert.equal(eventStatus(permanent,now),'Ativo');
 assert.equal(eventStatus({...permanent,end:event.end},now),'Ativo');
 const cycle=eventCycle(permanent,now);assert.ok(cycle.end>now&&cycle.end-now<=86400000);
 const state=setEventCompleted(defaultState(),{events:[permanent]},permanent.id,true,now);
 assert.equal(isEventCompleted(state,permanent,now),true);
 assert.equal(isEventCompleted(state,permanent,cycle.end),false);
 assert.equal(eventDuration(permanent),'Permanente');
 assert.equal(eventCycle({...permanent,type:'event'},now).end,Infinity);
 assert.throws(()=>validateEventCatalog({version:1,events:[{...permanent,permanent:'true'}]}));
 assert.throws(()=>validateEventCatalog({version:1,events:[{...permanent,permanent:false}]}));
});
const db=Object.fromEntries(await Promise.all(['catalog','rules','recipes'].map(async n=>[n,JSON.parse(await readFile(new URL('../data/'+n+'.json',import.meta.url)))])));

test('completion timestamps require an explicit timezone and preserve existing booleans',()=>{
 for(const value of [true,false,'2026-09-19T15:00:00Z','2026-09-19T15:00:00-03:00',new Date().toISOString()]){
  const state={...defaultState(),eventCompletions:{test:value}};
  assert.equal(parseBackup(JSON.stringify(state),db).eventCompletions.test,value);
 }
 for(const value of ['2026-09-19T15:00:00','2026-09-19','invalid'])
  assert.throws(()=>validateState({...defaultState(),eventCompletions:{test:value}},db),/Conclusões de eventos inválidas/);
});
test('recurring events lead, then each group follows remaining time and reorders after resets',()=>{
 const now=Date.parse(event.start)+3600000,at=hours=>new Date(Date.parse(event.start)+hours*3600000).toISOString();
 const entries=[
  {...event,id:'long',title:'A',end:at(100)},
  {...event,id:'weekly',type:'recurring',reset:{anchor:event.start,everyHours:168}},
  {...event,id:'short',title:'Z',end:at(2)},
  {...event,id:'daily',type:'recurring',reset:{anchor:event.start,everyHours:24}},
  {...event,id:'future',start:at(3),end:at(200)},
  {...event,id:'other-server',servers:['Asia'],end:at(1.5)}
 ];
 const before=structuredClone(entries);
 assert.deepEqual(officialEvents({events:entries},'America',now).map(e=>e.id),['daily','weekly','short','future','long']);
 assert.deepEqual(entries,before);
 const cycles=[{...event,id:'a',type:'recurring',reset:{anchor:event.start,everyHours:24}},{...event,id:'b',type:'recurring',reset:{anchor:at(6),everyHours:24}}];
 assert.deepEqual(officialEvents({events:cycles},'America',Date.parse(at(5))).map(e=>e.id),['b','a']);
 assert.deepEqual(officialEvents({events:cycles},'America',Date.parse(at(6))).map(e=>e.id),['a','b']);
});
test('recurring completion expires exactly at reset, including after offline periods and backup restore',()=>{
 const recurring={...event,type:'recurring',reset:{anchor:event.start,everyHours:24}},data={version:1,events:[recurring]},now=Date.parse(event.start)+3600000;
 validateEventCatalog(data);
 const completed=setEventCompleted(defaultState(),data,event.id,true,now);
 assert.equal(isEventCompleted(completed,recurring,now),true);
 const boundary=Date.parse(event.start)+86400000;
 assert.equal(isEventCompleted(completed,recurring,boundary-1),true);
 assert.equal(isEventCompleted(completed,recurring,boundary),false);
 assert.equal(isEventCompleted(completed,recurring,boundary+7*86400000),false);
 assert.equal(eventCycle(recurring,now).end,boundary);
 assert.equal(isEventCompleted(parseBackup(JSON.stringify(completed),db),recurring,boundary),false);
 const again=setEventCompleted(completed,data,event.id,true,boundary);
 assert.equal(isEventCompleted(again,recurring,boundary),true);
 assert.equal(isEventCompleted(setEventCompleted(again,data,event.id,false,boundary),recurring,boundary),false);
 assert.equal(isEventCompleted(mergeState(again,completed,db),recurring,boundary),true);
});
test('catalog preserves banner images and validates recurrence and image paths',()=>{
 const banner={...event,type:'banner',icon:'assets/brand/favicon.webp',banners:[{name:'Personagem',image:'assets/character.webp'}]};
 assert.deepEqual(validateEventCatalog({version:1,events:[banner]}).events[0],banner);
 for(const change of [{icon:'javascript:alert(1)'},{banners:[{name:'Arma',image:'http://example.com/x.png'}]},{type:'recurring',reset:{anchor:event.start,everyHours:0}},{type:'recurring',reset:{anchor:'invalid',everyHours:24}}])assert.throws(()=>validateEventCatalog({version:1,events:[{...event,...change}]}));
});
test('catalog validates dates, unique IDs and server targeting',()=>{
 assert.equal(validateEventCatalog(catalog).events.length,1);assert.equal(eventDuration(event),'14 dias');
 for(const change of [{start:'2026-09-20T10:00:00'},{end:event.start},{title:''},{servers:['unknown']}])assert.throws(()=>validateEventCatalog({version:1,events:[{...event,...change}]}));
 assert.throws(()=>validateEventCatalog({version:1,events:[event,event]}));
 assert.equal(officialEvents({events:[{...event,servers:['Asia']}]},'America').length,0);
});
test('players only change their completion, without touching catalog or inventory',()=>{
 const state=defaultState(),before=structuredClone(catalog),next=setEventCompleted(state,catalog,event.id,true);
 assert.equal(next.eventCompletions[event.id],true);assert.deepEqual(state.eventCompletions,{});assert.deepEqual(catalog,before);assert.deepEqual(next.inventory,state.inventory);
 assert.equal(setEventCompleted(next,catalog,event.id,false).eventCompletions[event.id],false);
 assert.throws(()=>setEventCompleted(state,catalog,'not-published',true));assert.throws(()=>setEventCompleted(state,catalog,event.id,'true'));
});
test('completion survives backups, old saves migrate and legacy events are retained',()=>{
 const old=defaultState();delete old.eventCompletions;old.events=[{...event,kind:'personal',tasks:[],rewards:{},claimed:false}];
 const migrated=validateState(old,db);assert.deepEqual(migrated.eventCompletions,{});assert.equal(migrated.events.length,1);
 const next=setEventCompleted(migrated,catalog,event.id,true),loaded=parseBackup(JSON.stringify(next),db);assert.equal(loaded.eventCompletions[event.id],true);
 assert.equal(mergeState(migrated,loaded,db).eventCompletions[event.id],true);
 assert.throws(()=>validateState({...next,eventCompletions:{bad:1}},db));
});
test('editing a published title or dates preserves completion through the stable ID',()=>{
 const state=setEventCompleted(defaultState(),catalog,event.id,true),changed={events:[{...event,title:'Nome corrigido',end:'2026-10-05T10:00:00-03:00'}]};
 assert.equal(state.eventCompletions[officialEvents(changed,'America')[0].id],true);
 const storage={getItem:()=>null,setItem(){}};const store=new Store(defaultState(),db,storage);store.commit(state);store.snapshot=null;store.undo();assert.deepEqual(store.state.eventCompletions,{});
});

test('completion merge compares real instants across offsets and preserves booleans',()=>{
 const withValue=value=>({...defaultState(),eventCompletions:{test:value}});
 const earlier='2026-09-24T01:00:00Z',later='2026-09-23T23:30:00-03:00';
 for(const [a,b] of [[earlier,later],[later,earlier]])assert.equal(mergeState(withValue(a),withValue(b),db).eventCompletions.test,later);
 const equivalent='2026-09-23T22:00:00-03:00';
 const chosen=mergeState(withValue(earlier),withValue(equivalent),db).eventCompletions.test;
 assert.ok([earlier,equivalent].includes(chosen));assert.equal(Date.parse(chosen),Date.parse(earlier));
 for(const [a,b,result] of [[false,false,false],[true,false,true],[false,true,true],[true,true,true]])assert.equal(mergeState(withValue(a),withValue(b),db).eventCompletions.test,result);
});

test('future normal events ignore saved completion until start without erasing it',()=>{
 const start=Date.parse(event.start);
 for(const value of [true,'2026-09-19T15:00:00Z']){
  const state={...defaultState(),eventCompletions:{[event.id]:value}},before=structuredClone(state);
  assert.equal(isEventCompleted(state,event,start-1),false);
  assert.equal(isEventCompleted(state,event,start),true);
  assert.equal(isEventCompleted(state,event,start+1),true);
  assert.deepEqual(state,before);
 }
 assert.equal(isEventCompleted(defaultState(),event,start-1),false);
});

test('future events cannot be completed until their start, including recurring events',()=>{
 const start=Date.parse(event.start);
 for(const type of ['event','recurring']){
  const entry={...event,type,reset:{anchor:event.start,everyHours:24}},data={events:[entry]},s=defaultState();
  assert.throws(()=>setEventCompleted(s,data,entry.id,true,start-1),/ainda não começou/);
  assert.deepEqual(s.eventCompletions,{});
  assert.equal(setEventCompleted(s,data,entry.id,false,start-1).eventCompletions[entry.id],false);
  const completed=setEventCompleted(s,data,entry.id,true,start);
  assert.equal(isEventCompleted(completed,entry,start),true);
  if(type==='recurring'){
   assert.equal(isEventCompleted(completed,entry,start-1),false);
   assert.equal(isEventCompleted(completed,entry,start+86400000),false);
  }
 }
});

test('40-day recurring cycles match 960 hours and reset completion at the boundary',()=>{
 const start='2026-10-01T04:00:00-03:00',anchor=Date.parse(start),day=86400000;
 const recurring={id:'endgame',title:'Endgame',type:'recurring',start,permanent:true,reset:{anchor:start,everyDays:40}};
 const hourly={...recurring,reset:{anchor:start,everyHours:960}};
 const data={version:1,events:[recurring]};
 assert.deepEqual(validateEventCatalog(data).events[0],recurring);
 for(const elapsed of [0,20,39,40,80,40000]){
  const now=anchor+elapsed*day;
  assert.deepEqual(eventCycle(recurring,now),eventCycle(hourly,now));
 }
 assert.deepEqual(eventCycle(recurring,anchor+20*day),{start:anchor,end:anchor+40*day});
 assert.deepEqual(eventCycle(recurring,anchor+40*day),{start:anchor+40*day,end:anchor+80*day});
 assert.deepEqual(eventCycle(recurring,anchor+80*day),{start:anchor+80*day,end:anchor+120*day});
 const completed=setEventCompleted(defaultState(),data,recurring.id,true,anchor+20*day);
 assert.equal(isEventCompleted(completed,recurring,anchor+39*day),true);
 assert.equal(isEventCompleted(completed,recurring,anchor+40*day-1),true);
 assert.equal(isEventCompleted(completed,recurring,anchor+40*day),false);
 const again=setEventCompleted(completed,data,recurring.id,true,anchor+40*day);
 assert.equal(isEventCompleted(again,recurring,anchor+40*day),true);
 assert.equal(isEventCompleted(again,recurring,anchor+80*day),false);
});

test('finite day-based recurrence truncates its final cycle at the event end',()=>{
 const start='2026-10-01T04:00:00-03:00',anchor=Date.parse(start),day=86400000;
 const recurring={id:'finite-endgame',title:'Endgame temporário',type:'recurring',start,end:new Date(anchor+85*day).toISOString(),reset:{anchor:start,everyDays:40}};
 assert.deepEqual(validateEventCatalog({version:1,events:[recurring]}).events[0],recurring);
 assert.deepEqual(eventCycle(recurring,anchor+79*day),{start:anchor+40*day,end:anchor+80*day});
 assert.deepEqual(eventCycle(recurring,anchor+82*day),{start:anchor+80*day,end:anchor+85*day});
 assert.equal(eventStatus(recurring,anchor+85*day),'Encerrado');
});

test('recurrence accepts exactly one valid hours or days interval up to the existing ten-year limit',()=>{
 const start='2026-10-01T04:00:00-03:00';
 const entry={id:'interval-test',title:'Intervalo',type:'recurring',start,permanent:true,reset:{anchor:start,everyHours:168}};
 const valid=res=>assert.doesNotThrow(()=>validateEventCatalog({version:1,events:[{...entry,reset:{anchor:start,...res}}]}));
 const invalid=res=>assert.throws(()=>validateEventCatalog({version:1,events:[{...entry,reset:{anchor:start,...res}}]}));
 for(const everyHours of [1,24,168,960,87600])valid({everyHours});
 for(const everyDays of [0.1,7,14,30,40,42,45,60,90,120,365,3650])valid({everyDays});
 for(const reset of [{},{everyHours:24,everyDays:40},{everyHours:undefined},{everyDays:undefined},
  {everyHours:0},{everyHours:87601},{everyDays:0},{everyDays:-1},{everyDays:3651},
  {everyHours:NaN},{everyHours:Infinity},{everyHours:'24'},{everyDays:NaN},{everyDays:Infinity},{everyDays:'40'}])invalid(reset);
 assert.throws(()=>validateEventCatalog({version:1,events:[{...entry,reset:{anchor:'2026-10-01T04:00:00',everyDays:40}}]}));
});

test('server reset cycles use each server offset and the configured hour, including the exact boundary',()=>{
 const rules={dailyResetHour:4,weeklyResetDay:1,servers:{America:-5,Europe:1,Asia:8,SEA:8}};
 const daily={id:'daily-server',title:'Diária',type:'recurring',start:'2026-09-01T00:00:00Z',permanent:true,reset:{serverReset:'daily'}};
 assert.deepEqual(validateEventCatalog({version:1,events:[daily]}).events[0],daily);
 for(const [server,boundary] of [['America','2026-09-28T09:00:00Z'],['Europe','2026-09-28T03:00:00Z'],['Asia','2026-09-27T20:00:00Z']]){
  const at=Date.parse(boundary),context={server,rules},current=eventCycle(daily,at,context);
  assert.deepEqual(current,{start:at,end:at+86400000});
  assert.equal(eventCycle(daily,at-1,context).end,at);
  const user={...defaultState(),settings:{...defaultState().settings,server}};
  const done=setEventCompleted(user,{events:[daily]},daily.id,true,at-1,rules);
  assert.equal(isEventCompleted(done,daily,at-1,rules),true);
  assert.equal(isEventCompleted(done,daily,at,rules),false);
 }
 const at=Date.parse('2026-09-28T04:00:00Z');
 assert.notEqual(eventCycle(daily,at,{server:'America',rules}).start,eventCycle(daily,at,{server:'Europe',rules}).start);
});

test('weekly server recurrence follows configured weekday and hour, while anchored cycles stay independent',()=>{
 const rules={dailyResetHour:6,weeklyResetDay:2,servers:{America:-5,Europe:1,Asia:8,SEA:8}};
 const weekly={id:'weekly-server',title:'Semanal',type:'recurring',start:'2026-09-01T00:00:00Z',permanent:true,reset:{serverReset:'weekly'}};
 const boundary=Date.parse('2026-09-29T11:00:00Z'),context={server:'America',rules};
 assert.equal(nextReset(boundary-1,-5,true,rules),boundary);
 assert.deepEqual(eventCycle(weekly,boundary,context),{start:boundary,end:boundary+7*86400000});
 const user=defaultState(),done=setEventCompleted(user,{events:[weekly]},weekly.id,true,boundary-1,rules);
 assert.equal(isEventCompleted(done,weekly,boundary-1,rules),true);
 assert.equal(isEventCompleted(done,weekly,boundary,rules),false);
 const anchored={...weekly,reset:{anchor:'2026-09-01T00:00:00Z',everyDays:42}};
 assert.equal(eventCycle(anchored,boundary,context).start,Date.parse(anchored.reset.anchor));
 assert.throws(()=>validateEventCatalog({version:1,events:[{...weekly,reset:{serverReset:'weekly',anchor:anchored.reset.anchor,everyHours:168}}]}),/Reset de servidor inválido/);
 for(const bad of [{serverReset:'month'},{serverReset:'daily',everyDays:1},{serverReset:'daily',anchor:anchored.reset.anchor}])
  assert.throws(()=>validateEventCatalog({version:1,events:[{...weekly,reset:bad}]}));
});

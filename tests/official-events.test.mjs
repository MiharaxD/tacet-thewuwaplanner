import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateEventCatalog,officialEvents,eventDuration,setEventCompleted,eventCycle,isEventCompleted} from '../src/official-events.js';
import {defaultState,validateState,parseBackup,mergeState,Store} from '../src/state.js';
const event={id:'test-event',title:'Evento de teste',start:'2026-09-20T10:00:00-03:00',end:'2026-10-04T10:00:00-03:00'};
const catalog={version:1,events:[event]};
const db=Object.fromEntries(await Promise.all(['catalog','rules','recipes'].map(async n=>[n,JSON.parse(await readFile(new URL('../data/'+n+'.json',import.meta.url)))])));
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
 const banner={...event,type:'banner',icon:'assets/favicon.webp',banners:[{name:'Personagem',image:'assets/character.webp'}]};
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

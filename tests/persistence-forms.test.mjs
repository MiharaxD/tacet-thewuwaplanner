import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defaultState,validateState,loadState,Store,STORAGE_KEY,getStorage,withStorageLock} from '../src/state.js';
import {rewardSlots,readEventRewards,restoreSettingsDraft} from '../src/forms.js';

const db=Object.fromEntries(await Promise.all(['catalog','rules','sources','recipes'].map(async name=>[name,JSON.parse(await readFile(new URL(`../data/${name}.json`,import.meta.url),'utf8'))])));
function memory(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
function tabs(){const storage=memory();return {storage,a:new Store(defaultState(),db,storage),b:new Store(defaultState(),db,storage)};}
function stock(store,quantity){const next=structuredClone(store.state);next.inventory.shell=quantity;return next;}

test('a stale tab cannot overwrite another tab, even before the storage event arrives',()=>{
 const {storage,a,b}=tabs();a.commit(stock(a,100));
 const changed=structuredClone(b.state);changed.settings.dailyWaveplates=120;
 assert.throws(()=>b.commit(changed),/outra aba/);
 assert.equal(loadState(storage,db).state.inventory.shell,100);
 assert.equal(b.state.settings.dailyWaveplates,240);
 assert.equal(b.history.length,0);
 assert.equal(b.conflicted,true);
});

test('stale undo and background persistence preserve both saved data and undo history',()=>{
 const {storage,a}=tabs();a.commit(stock(a,10));
 const b=new Store(loadState(storage,db).state,db,storage);b.commit(stock(b,50));
 assert.throws(()=>a.undo(),/outra aba/);
 assert.throws(()=>a.persist(),/outra aba/);
 assert.equal(a.history.length,1);
 assert.equal(a.state.inventory.shell,10);
 assert.equal(loadState(storage,db).state.inventory.shell,50);
});

test('only changes to the planner in the correct storage area trigger a conflict',()=>{
 const {storage,a,b}=tabs();a.commit(stock(a,100));
 b.observeStorage({key:'unrelated',storageArea:storage});
 b.observeStorage({key:STORAGE_KEY,storageArea:memory()});
 assert.equal(b.conflicted,false);
 b.observeStorage({key:STORAGE_KEY,storageArea:storage});
 assert.equal(b.conflicted,true);
});

test('removing saved data or clearing storage also blocks an old tab',()=>{
 const {storage,a}=tabs();a.commit(stock(a,100));storage.removeItem(STORAGE_KEY);
 a.observeStorage({key:null,storageArea:storage});
 assert.equal(a.conflicted,true);
 assert.throws(()=>a.commit(stock(a,200)),/outra aba/);
 assert.equal(storage.getItem(STORAGE_KEY),null);
});

test('a reloaded store can save the latest data and its own writes do not conflict',()=>{
 const {storage,a,b}=tabs();a.commit(stock(a,100));
 assert.throws(()=>b.commit(stock(b,5)),/outra aba/);
 const fresh=new Store(loadState(storage,db).state,db,storage);
 fresh.commit(stock(fresh,110));fresh.commit(stock(fresh,120));fresh.undo();
 assert.equal(loadState(storage,db).state.inventory.shell,110);
 assert.equal(fresh.conflicted,false);
});

test('simultaneous browser write requests are serialized and reject the stale writer',async()=>{
 // Model the exclusive queue provided by navigator.locks, including a delayed write.
 let tail=Promise.resolve();const requested=[];
 const locks={request(name,action){requested.push(name);const result=tail.then(action);tail=result.catch(()=>{});return result;}};
 const {storage,a,b}=tabs();
 const results=await Promise.allSettled([
  withStorageLock(locks,async()=>{await Promise.resolve();a.commit(stock(a,100));}),
  withStorageLock(locks,()=>b.commit(stock(b,200)))
 ]);
 assert.deepEqual(results.map(r=>r.status),['fulfilled','rejected']);
 assert.deepEqual(requested,[STORAGE_KEY,STORAGE_KEY]);
 assert.equal(loadState(storage,db).state.inventory.shell,100);
});

test('without Web Locks, snapshot checks still reject sequential stale saves',async()=>{
 const {storage,a,b}=tabs();
 await withStorageLock(undefined,()=>a.commit(stock(a,100)));
 await assert.rejects(withStorageLock(undefined,()=>b.commit(stock(b,200))),/outra aba/);
 assert.equal(loadState(storage,db).state.inventory.shell,100);
});

test('a blocked localStorage getter allows in-memory edits, undo and backup export',()=>{
 const host={get localStorage(){throw new DOMException('Blocked','SecurityError');}};
 const storage=getStorage(host);assert.equal(storage,null);
 const loaded=loadState(storage,db),store=new Store(loaded.state,db,storage);
 assert.ok(loaded.warning);store.commit(stock(store,100));
 assert.equal(JSON.parse(JSON.stringify(store.state)).inventory.shell,100);
 assert.ok(store.saveError);store.undo();assert.deepEqual(store.state.inventory,{});
});

test('storage becoming unreadable cannot lead to a blind overwrite',()=>{
 const backing=memory();let blocked=false;
 const storage={getItem(key){if(blocked)throw Error('blocked');return backing.getItem(key);},setItem:(key,value)=>backing.setItem(key,value)};
 const store=new Store(defaultState(),db,storage);store.commit(stock(store,100));blocked=true;
 store.commit(stock(store,200));
 assert.equal(store.state.inventory.shell,200);
 assert.equal(loadState(backing,db).state.inventory.shell,100);
 assert.ok(store.saveError);
});

test('quota errors retain edits in memory and a later successful save updates the snapshot',()=>{
 const backing=memory();let full=true;
 const storage={getItem:key=>backing.getItem(key),setItem(key,value){if(full)throw Error('quota');backing.setItem(key,value);}};
 const store=new Store(defaultState(),db,storage);store.commit(stock(store,10));
 assert.ok(store.saveError);full=false;store.persist();store.commit(stock(store,20));
 assert.equal(loadState(backing,db).state.inventory.shell,20);assert.equal(store.saveError,null);
});

test('an imported event retains every reward when only its title is edited',()=>{
 const event={id:'four-rewards',title:'Before',kind:'personal',start:'2026-09-15T00:00:00Z',end:'2026-09-16T00:00:00Z',tasks:[],claimed:false,rewards:Object.fromEntries(db.catalog.materials.slice(0,5).map((m,i)=>[m.id,i+1]))};
 const state=defaultState();state.events=[event];const imported=validateState(state,db).events[0];
 const fd=new FormData();Object.entries(imported.rewards).forEach(([id,n],i)=>{fd.set(`reward-${i}`,id);fd.set(`amount-${i}`,String(n));});
 assert.equal(rewardSlots(imported).length,5);
 const edited={...imported,title:'After',rewards:readEventRewards(fd,imported)};
 assert.deepEqual(edited.rewards,event.rewards);
 fd.set('amount-4','17');assert.equal(readEventRewards(fd,imported)[Object.keys(event.rewards)[4]],17);
 fd.set('reward-4','');assert.equal(Object.keys(readEventRewards(fd,imported)).length,4);
});

test('claimed event rewards stay unchanged when disabled inputs are absent',()=>{
 const event={claimed:true,rewards:{shell:100,'potion-0':2}};
 assert.deepEqual(readEventRewards(new FormData(),event),event.rewards);
});

test('unsaved settings restore into a newly rendered form without changing saved state',()=>{
 const saved=defaultState(),draft={server:'Asia',dailyWaveplates:'123',unionLevel:''};
 const fields=new Map(Object.entries(saved.settings).map(([name,value])=>[name,{value:String(value)}]));
 restoreSettingsDraft({elements:{namedItem:name=>fields.get(name)}},draft);
 assert.equal(fields.get('dailyWaveplates').value,'123');
 assert.equal(fields.get('server').value,'Asia');
 assert.equal(fields.get('unionLevel').value,'');
 assert.equal(saved.settings.dailyWaveplates,240);
 assert.doesNotThrow(()=>restoreSettingsDraft(null,draft));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {allocate,newGoal,requirements,completeGoal,applyAutomaticSynthesis,automaticSynthesisSteps} from '../src/engine.js';
import {sortMaterials,materialFamily,craftCapacity} from '../src/materials.js';
import {defaultState,Store,parseBackup} from '../src/state.js';
const db=Object.fromEntries(await Promise.all(['catalog','rules','recipes'].map(async n=>[n,JSON.parse(await readFile(new URL('../data/'+n+'.json',import.meta.url)))])));
function fixture(){
 const state=defaultState(),g=newGoal('jinhsi','first');g.target.level=90;g.target.ascension=6;
 state.goals=[g];state.settings.unionLevel=80;
 const req=requirements(g,db);state.inventory={...req.cost,'potion-3':Math.ceil(req.xp/20000),'howler-0':1000,'howler-1':0,'howler-2':0,'howler-3':0};
 return state;
}
test('1000 common materials cover higher rarities without mutating stock or duplicating reservations',()=>{
 const s=fixture(),before=structuredClone(s),p=allocate(s.goals,s.inventory,db),r=p.goals[0];
 assert.equal(r.ready,true);assert.ok(r.rows.find(x=>x.id==='howler-3').crafted>0);assert.deepEqual(s,before);
 const cost=requirements(s.goals[0],db).cost;
 const units=[0,1,2,3].reduce((n,t)=>n+(cost['howler-'+t]||0)*3**t,0);
 assert.equal(r.consumption['howler-0'],units);
 assert.equal(p.unallocated['howler-0'],1000-units);
 const second=structuredClone(s.goals[0]);second.id='second';second.charId='jiyan';s.goals.push(second);
 s.inventory['howler-0']=units;
 const shared=allocate(s.goals,s.inventory,db);
 assert.equal(shared.goals[0].rows.find(x=>x.id==='howler-3').missing,0);
 assert.ok(shared.goals[1].rows.filter(x=>materialFamily(x.id)==='howler').every(x=>x.allocated===0));
});
test('explicit multi-tier synthesis preserves direct requirements and matches automatic completion',()=>{
 const s=fixture(),direct=completeGoal(s,'first',db);
 const crafted=applyAutomaticSynthesis(s,'howler-3',db);
 assert.ok(crafted.inventory['howler-1']>0&&crafted.inventory['howler-2']>0&&crafted.inventory['howler-3']>0);
 assert.equal(allocate(crafted.goals,crafted.inventory,db).goals[0].ready,true);
 const finished=completeGoal(crafted,'first',db);
 for(const id of new Set([...Object.keys(direct.inventory),...Object.keys(finished.inventory)]))assert.equal(finished.inventory[id]||0,direct.inventory[id]||0,id);
 assert.equal(s.inventory['howler-3'],0);
 const store=new Store(s,db,{getItem:()=>null,setItem(){}});store.commit(crafted);store.snapshot=null;store.undo();assert.deepEqual(store.state.inventory,s.inventory);
 assert.deepEqual(parseBackup(JSON.stringify(crafted),db).inventory,crafted.inventory);
});
test('without goals only free whole triples are synthesized, XP and unrelated families are untouched',()=>{
 const s=defaultState();s.inventory={'howler-0':1000,'whisper-0':8,'potion-0':10};
 const next=applyAutomaticSynthesis(s,'howler-3',db);
 assert.equal(next.inventory['howler-3'],37);assert.equal(next.inventory['howler-0'],1);
 assert.equal(next.inventory['whisper-0'],8);assert.equal(next.inventory['potion-0'],10);
 assert.deepEqual(automaticSynthesisSteps(s,'potion-1',db),[]);
 assert.equal(craftCapacity('howler-3',{'howler-0':26},db),0);
 assert.throws(()=>applyAutomaticSynthesis({...s,inventory:{'howler-0':2}},'howler-1',db),/suficientes/);
});
test('families stay together with ascending rarity, including different-named tiers',()=>{
 const rows=['howler-3','waveworn-0','howler-0','waveworn-3','potion-2','potion-0'].map(id=>({id}));
 const sorted=sortMaterials(rows,db).map(x=>x.id);
 for(const family of ['howler','waveworn','potion']){const entries=sorted.filter(id=>materialFamily(id)===family);assert.ok(entries[0]<entries[1]);assert.equal(sorted.indexOf(entries[1])-sorted.indexOf(entries[0]),1);}
 assert.equal(rows[0].id,'howler-3');
});

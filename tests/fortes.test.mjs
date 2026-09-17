import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {newGoal,requirements,completeGoal,allocate} from '../src/engine.js';
import {defaultState,parseBackup} from '../src/state.js';
import {nodeUnlocked,toggleForteNode} from '../src/forte-progress.js';
const db=Object.fromEntries(await Promise.all(['catalog','rules','sources','recipes','character-fortes'].map(async n=>[n,JSON.parse(await readFile(new URL('../data/'+n+'.json',import.meta.url)))])));
const goal=()=>{const g=newGoal('jinhsi','test');g.current.level=80;g.current.ascension=6;g.target=structuredClone(g.current);return g;};
test('all ten passive nodes cost exactly their incremental materials',()=>{
 const g=goal(),c=db.catalog.characters.find(c=>c.id===g.charId);g.target.unlocks=[1,1,2,2,2,2];
 assert.deepEqual(requirements(g,db).cost,{shell:630000,[c.forgery+'-1']:3,[c.enemy+'-1']:3,[c.weekly]:6,[c.forgery+'-2']:15,[c.enemy+'-2']:15,[c.forgery+'-3']:12,[c.enemy+'-3']:12});
 assert.deepEqual(requirements(g,db).missingData,[]);
 g.current.unlocks=[1,0,1,1,1,1];assert.equal(requirements(g,db).cost.shell,420000);assert.equal(requirements(g,db).cost[c.weekly],5);
 g.current.unlocks=[...g.target.unlocks];assert.deepEqual(requirements(g,db).cost,{});
});
test('passive-only completion consumes inventory once and persists unlocks',()=>{
 const g=goal();g.target.unlocks=[1,1,2,2,2,2];const s=defaultState();s.settings.unionLevel=80;s.goals=[g];s.inventory={...requirements(g,db).cost};
 const next=completeGoal(s,g.id,db);assert.deepEqual(next.goals[0].current.unlocks,g.target.unlocks);assert.ok(Object.values(next.inventory).every(n=>n===0));
 assert.deepEqual(parseBackup(JSON.stringify(next),db).goals[0].current.unlocks,g.target.unlocks);assert.throws(()=>completeGoal(next,g.id,db));
});
test('insufficient ascension or missing cost metadata prevents completion',()=>{
 const g=goal();g.target.unlocks[0]=1;const unknown=structuredClone(db);delete unknown.rules.unlockCosts;
 assert.ok(requirements(g,unknown).missingData.length);g.current.level=g.target.level=20;g.current.ascension=g.target.ascension=1;
 assert.match(requirements(g,db).missingData.join(' '),/ascensão 2/);assert.equal(allocate([g],requirements(g,db).cost,db).goals[0].ready,false);
});
test('selecting upper nodes includes lower ones; owned nodes stay in target',()=>{
 const zero=[0,0,0,0,0,0];let r=toggleForteNode(zero,zero,'target',2,2);assert.deepEqual(r.target,[1,1,0,0,0,0]);
 r=toggleForteNode(r.current,r.target,'target',2,1);assert.deepEqual(r.target,zero);
 r=toggleForteNode(zero,zero,'current',0,2);assert.equal(r.current[2],2);assert.equal(r.target[2],2);assert.equal(nodeUnlocked(r.current,0,1),true);
 r=toggleForteNode(r.current,r.target,'target',0,1);assert.equal(r.target[2],2);
 r=toggleForteNode(r.current,r.target,'current',0,1);assert.equal(r.current[2],0);assert.equal(r.target[2],2);
});
test('every catalog character has five branches, ten descriptions and Portuguese unique passives',()=>{
 for(const c of db.catalog.characters){const f=db['character-fortes'][c.id];assert.equal(f.branches.length,5,c.name);assert.deepEqual(f.branches.map(b=>b.type),['normal','skill','forte','ultimate','intro']);
  for(const b of f.branches){assert.equal(b.nodes.length,2);for(const n of b.nodes){assert.ok(n.description.length>10);assert.doesNotMatch(n.description,/\$[a-f0-9]+|<[^>]+>|\{Cus:/);}}
  assert.ok(f.branches[2].nodes.every(n=>n.descriptionPt?.length>10));
 }
});
test('the tree renders ten passive buttons and preserves all skill and unlock fields',async()=>{
 globalThis.document={addEventListener(){}};globalThis.window={addEventListener(){}};
 const {forteTree}=await import('../src/forte-tree.js');const g=goal(),html=forteTree(g,db['character-fortes'].jinhsi);
 assert.equal((html.match(/data-forte-column=/g)||[]).length,10);
 assert.equal((html.match(/name="unlock-/g)||[]).length,12);
 assert.equal((html.match(/role="combobox"/g)||[]).length,10);
 assert.equal((html.match(/role="option"/g)||[]).length,100);
 assert.match(html,/20% de bônus de dano Spectro/);assert.doesNotMatch(html,/Habilidade Outro|Ruptura de Sintonia/);
 for(const id of [...html.matchAll(/src="\.\/([^\"]+)"/g)].map(m=>m[1]))assert.ok((await readFile(new URL('../'+id,import.meta.url))).length>0);
});

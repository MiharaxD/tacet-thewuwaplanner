import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { requirements, newGoal, allocate, completeGoal } from '../src/engine.js';
import { defaultState, parseBackup } from '../src/state.js';
const db = {};
for (const name of ['catalog','rules','sources','recipes']) db[name] = JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const fullGoal = id => {
  const g = newGoal(id,id);
  g.target.level=90;g.target.ascension=6;g.target.skills=[10,10,10,10,10];
  return g;
};

test('every supplied character folder and Rover form has a usable catalog entry', async () => {
  const root = new URL('../assets/WUWA%20Assets/', import.meta.url);
  for (const folder of await readdir(root)) {
    if(folder==='Materials')continue;
    const entries=db.catalog.characters.filter(c=>decodeURIComponent(c.image).includes(`/WUWA Assets/${folder}/`));
    assert.equal(entries.length,folder==='Rover'?3:1,folder);
  }
  assert.equal(db.catalog.characters.length,57);
  assert.equal(new Set(db.catalog.characters.map(c=>c.id)).size,57);
});

test('all character and material artwork exists and is a real image', async () => {
  for(const record of [...db.catalog.characters,...db.catalog.materials]) {
    assert.ok(record.image,record.name);
    const bytes=await readFile(new URL(`../${record.image}`,import.meta.url));
    assert.ok(bytes.length>100,record.name);
    assert.ok(bytes.subarray(0,4).toString()==='RIFF'||bytes.subarray(1,4).toString()==='PNG',record.name);
  }
});

test('every character can calculate a full build with valid materials and source links', () => {
  const ids=new Set(db.catalog.materials.map(m=>m.id));
  assert.equal(ids.size,db.catalog.materials.length);
  const sourceIds=new Set(db.sources.map(s=>s.id));
  for(const c of db.catalog.characters) {
    const g=fullGoal(c.id),r=requirements(g,db);
    assert.deepEqual(r.missingData,[],c.name);
    assert.equal(r.cost[c.flower],60,c.name);
    assert.equal(r.cost[c.boss],c.sharedProgress?5:46,c.name);
    assert.equal(r.cost[c.weekly],20,c.name);
    assert.equal(r.cost.shell,2423300,c.name);
    for(const id of Object.keys(r.cost))assert.ok(ids.has(id),`${c.name}: ${id}`);
    for(const source of c.sources)assert.ok(sourceIds.has(source),source);
    const state=defaultState();state.goals=[g];state.inventory=Object.fromEntries(Object.keys(r.cost).map(id=>[id,1]));
    assert.deepEqual(parseBackup(JSON.stringify(state),db),state);
  }
});

test('Jinhsi keeps reviewed materials despite the Roccia rank table pasted in her file', () => {
  const r=requirements(fullGoal('jinhsi'),db);
  assert.equal(r.cost.pearl,60);assert.equal(r.cost.elegy,46);assert.equal(r.cost['howler-0'],29);
  assert.equal(r.cost['cleansing-conch'],undefined);
});

test('Luuk and new forgery/enemy families use their own materials', () => {
  const luuk=db.catalog.characters.find(c=>c.id==='luuk-herssen');
  const r=requirements(fullGoal(luuk.id),db);
  assert.equal(r.cost.edelschnee,60);assert.equal(r.cost['suncoveters-reach'],46);
  assert.equal(r.cost['waveworn-shard-3'],55);assert.equal(r.cost['fractured-exoswarm-pendant-3'],49);
  assert.equal(requirements(fullGoal('jingran'),db).cost['carved-crystal-3'],55);
});

test('Rover level and ascension are reserved once while each form keeps separate Fortes', () => {
  const a=fullGoal('rover-aero'),b=fullGoal('rover-havoc');
  const snapshot=structuredClone([a,b]);
  const p=allocate([a,b],{},db);
  assert.equal(p.totals.find(m=>m.id==='mysterious-code').needed,5);
  assert.equal(p.totals.find(m=>m.id==='pecok').needed,60);
  assert.equal(p.totals.find(m=>m.id==='xp-potion').needed,2438000);
  assert.equal(p.totals.find(m=>m.id==='drip-3').needed,110);
  assert.match(p.goals[1].missingData.join(' '),/meta anterior do Rover/);
  assert.deepEqual([a,b],snapshot);
  const reverse=allocate([b,a],{},db);
  assert.equal(reverse.totals.find(m=>m.id==='mysterious-code').needed,5);
});

test('completing Rover updates shared levels, consumes once, and leaves other Fortes unchanged', () => {
  const state=defaultState();state.settings.unionLevel=60;
  const a=fullGoal('rover-aero'),b=fullGoal('rover-havoc');state.goals=[a,b];
  const costs=requirements(a,db).cost;state.inventory={...costs,'potion-3':122};
  const next=completeGoal(state,a.id,db);
  assert.equal(next.inventory['mysterious-code'],0);
  assert.equal(next.goals[1].current.level,90);assert.equal(next.goals[1].current.ascension,6);
  assert.deepEqual(next.goals[1].current.skills,[1,1,1,1,1]);
  assert.equal(next.goals[1].done,false);
  const plan=allocate(next.goals,next.inventory,db);
  assert.equal(plan.goals[1].rows.find(r=>r.id==='mysterious-code'),undefined);
  assert.deepEqual(plan.goals[1].missingData,[]);
  assert.equal(state.goals[1].current.level,1);
});

test('Rover already leveled in a different form does not consume level materials again', () => {
  const state=defaultState();state.settings.unionLevel=60;
  const a=fullGoal('rover-aero');a.current={...a.current,level:90,ascension:6};a.target={...a.current};a.done=true;
  const b=newGoal('rover-havoc','havoc');b.current.level=40;b.current.ascension=2;b.target={...b.current,skills:[2,1,1,1,1]};
  state.goals=[a,b];state.inventory={shell:1500,'drip-0':2,'whisper-0':2};
  const next=completeGoal(state,b.id,db);
  assert.equal(next.goals[1].current.level,90);assert.equal(next.goals[1].current.skills[0],2);
  assert.equal(next.inventory.shell,0);
});

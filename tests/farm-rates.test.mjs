import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {farmRate,farmWaveplates} from '../src/farm-rates.js';
const db={catalog:JSON.parse(await readFile(new URL('../data/catalog.json',import.meta.url),'utf8'))};
test('defaults convert advanced consumables to EXP rather than item counts',()=>{
 for(const [id,item] of [['xp-potion','potion-2'],['xp-energy','energy-2']])assert.equal(farmRate({id},db),11.5*db.catalog.materials.find(m=>m.id===item).xp);
 assert.equal(farmRate({id:'shell'},db),80000);
 assert.equal(farmRate({activity:'boss'},db),2.5);
 assert.equal(farmRate({activity:'weekly'},db),3);
 assert.equal(farmRate({activity:'overworld'},db),0);
});
test('simultaneous forgery rarity drops count energy only once per family',()=>{
 const rows=[['waveworn-0',40],['waveworn-1',120],['waveworn-3',80],['helix-0',40]].map(([id,waveplates])=>({m:{id,activity:'forgery'},est:{waveplates}}));
 assert.equal(farmWaveplates(rows),160);
 assert.equal(farmRate({activity:'forgery',rarity:5},db),0.25);
});

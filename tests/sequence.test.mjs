import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {newGoal,requirements,validateGoal} from '../src/engine.js';
import {defaultState,parseBackup,validateState} from '../src/state.js';
const db=Object.fromEntries(await Promise.all(['catalog','rules'].map(async name=>[name,JSON.parse(await readFile(new URL(`../data/${name}.json`,import.meta.url),'utf8'))])));
test('resonance sequence survives backup round trips without changing material costs',()=>{
 const goal=newGoal('jinhsi','sequence-test'),before=requirements(goal,db);
 goal.sequence=6;const state=defaultState();state.goals.push(goal);
 const restored=parseBackup(JSON.stringify(validateState(state,db)),db);
 assert.equal(restored.goals[0].sequence,6);assert.deepEqual(requirements(restored.goals[0],db),before);
});
test('legacy goals without a sequence load as S0 without losing progress',()=>{
 const state=defaultState(),goal=newGoal('jinhsi','legacy');delete goal.sequence;goal.current.level=10;state.goals.push(goal);
 const restored=validateState(state,db);assert.equal(restored.goals[0].sequence,0);assert.equal(restored.goals[0].current.level,10);
});
test('invalid sequence values are rejected',()=>{
 for(const sequence of [-1,7,1.5,'3',null])assert.throws(()=>validateGoal({...newGoal('jinhsi','invalid'),sequence},db),/Cadeia/);
});

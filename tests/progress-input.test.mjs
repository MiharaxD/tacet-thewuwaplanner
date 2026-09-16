import test from 'node:test';
import assert from 'node:assert/strict';
import {ascensionChoices,resolveAscension} from '../src/progress-input.js';
const caps=[20,40,50,60,70,80,90];
test('each cap offers both valid ascension states, except the final cap',()=>{
 for(let i=0;i<6;i++){
  assert.deepEqual(ascensionChoices(caps[i],caps),[i,i+1]);
  assert.equal(resolveAscension(caps[i],i,caps),i);
  assert.equal(resolveAscension(caps[i],i+1,caps),i+1);
 }
 assert.deepEqual(ascensionChoices(90,caps),[6]);
});
test('typing levels infers valid stages without erasing cap selections',()=>{
 assert.equal(resolveAscension(41,0,caps),2);
 assert.equal(resolveAscension(10,6,caps),0);
 assert.deepEqual(ascensionChoices(70,caps,4),[4]);
 for(const level of [0,71,NaN,2.5])assert.deepEqual(ascensionChoices(level,caps,4),[]);
});

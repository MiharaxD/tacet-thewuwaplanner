import test from 'node:test';
import assert from 'node:assert/strict';
import {elementLabel,characterLabel,characterSearchText} from '../src/ui.js';

test('element presentation translates all canonical values and preserves unrelated names',()=>{
 const labels={Fusion:'Térmico',Glacio:'Criogênico',Aero:'Pneumático',Electro:'Voltaico',Spectro:'Fotônico',Havoc:'Aniquilante'};
 for(const [element,label] of Object.entries(labels)){
  assert.equal(elementLabel(element),label);
  const c={name:`Rover (${element})`,element};
  assert.equal(characterLabel(c),`Rover (${label})`);
  assert.ok(characterSearchText(c).includes(label.toLowerCase()));
  assert.ok(characterSearchText(c).includes(c.name.toLowerCase()));
  assert.equal(c.name,`Rover (${element})`);
 }
 for(const name of ['Fusion Accretion','Electro Sword','Jinhsi','Unknown']){
  assert.equal(elementLabel(name),name);
  assert.equal(characterLabel({name}),name);
 }
});

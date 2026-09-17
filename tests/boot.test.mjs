import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as engine from '../src/engine.js';
import * as state from '../src/state.js';
import * as time from '../src/time.js';
import * as ui from '../src/ui.js';
import * as forms from '../src/forms.js';
import * as official from '../src/official-events.js';

test('the actual app boots and accepts inventory edits when the storage getter throws',async()=>{
 const listeners=new Map(),app={innerHTML:'',querySelectorAll:()=>[]};
 const toast={textContent:'',classList:{add(){},remove(){}}};
 const modal={open:false,addEventListener(){}};
 const elements={'#app':app,'#modal':modal,'#toast':toast};
 const window={addEventListener(){},get localStorage(){throw new DOMException('Blocked','SecurityError');}};
 const context=vm.createContext({
  ...engine,...state,...time,...ui,...forms,...official,h:ui.escape,window,navigator:{},location:{hash:''},
  document:{querySelector:key=>elements[key]||null,addEventListener:(name,fn)=>listeners.set(name,fn),activeElement:null},
  registerPlannerTools(){},structuredClone,Intl,URL,crypto,
  setInterval(){},setTimeout(){},clearTimeout(){},
  fetch:async path=>({ok:true,json:async()=>JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'))})
 });
 // Run the real boot and event handlers with only browser I/O replaced.
 const source=(await readFile(new URL('../src/app.js',import.meta.url),'utf8'))
  .replace(/^import .*;\r?\n/gm,'').replace(/boot\(\);\s*$/,'globalThis.bootResult=boot();');
 vm.runInContext(source,context);await context.bootResult;
 assert.match(app.innerHTML,/Seu próximo avanço/);
 assert.match(app.innerHTML,/Armazenamento indisponível/);
 assert.doesNotMatch(app.innerHTML,/boot-error/);
 listeners.get('input')({target:{closest:()=>null,dataset:{stock:'shell'},value:'100',valueAsNumber:100,setCustomValidity(){}}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(vm.runInContext('state().inventory.shell',context),100);
 assert.match(app.innerHTML,/Exporte um backup/);
 assert.equal(vm.runInContext('store.storage',context),null);
 vm.runInContext(`db.events={version:1,events:[{id:'published-event',title:'Evento publicado',start:'2026-09-20T00:00:00Z',end:'2026-09-27T00:00:00Z'}]};route='events';render();`,context);
 assert.match(app.innerHTML,/Evento publicado/);assert.match(app.innerHTML,/data-official-event="published-event"/);
 assert.doesNotMatch(app.innerHTML,/new-event|edit-event|remove-event|Registrar recebimento/);
 listeners.get('change')({target:{closest:()=>null,dataset:{officialEvent:'published-event'},checked:true}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(vm.runInContext('state().eventCompletions["published-event"]',context),true);
  assert.equal(vm.runInContext('db.events.events[0].title',context),'Evento publicado');
  vm.runInContext(`db.events.events[0].permanent=true;delete db.events.events[0].end;db.events.events[0].start='2020-01-01T00:00:00Z';render();`,context);
  assert.match(app.innerHTML,/Permanente/);assert.doesNotMatch(app.innerHTML,/NaN|Invalid Date|Termina:/);
  vm.runInContext(`route='summary';render();`,context);
  assert.match(app.innerHTML,/Permanente/);assert.doesNotMatch(app.innerHTML,/NaN|Invalid Date/);
  vm.runInContext(`db.events.events[0].type='recurring';db.events.events[0].reset={anchor:'2020-01-01T00:00:00Z',everyHours:24};render();`,context);
  assert.match(app.innerHTML,/Reset em/);assert.doesNotMatch(app.innerHTML,/NaN|Invalid Date/);
  vm.runInContext(`db.events.events[0].type='event';route='events';render();`,context);
  assert.match(app.innerHTML,/<details class="completed-events">/);
  assert.doesNotMatch(app.innerHTML,/<details class="completed-events" open/);
  assert.doesNotMatch(app.innerHTML,/NaN/);
  vm.runInContext(`db.events.events[0].start='2020-01-01T00:00:00Z';db.events.events[0].end='2099-01-01T00:00:00Z';render();`,context);
  assert.doesNotMatch(app.innerHTML,/NaN/);
});

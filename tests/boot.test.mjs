import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as engine from '../src/engine.js';
import * as state from '../src/state.js';
import * as time from '../src/time.js';
import * as ui from '../src/ui.js';
import * as forms from '../src/forms.js';

test('the actual app boots and accepts inventory edits when the storage getter throws',async()=>{
 const listeners=new Map(),app={innerHTML:'',querySelectorAll:()=>[]};
 const toast={textContent:'',classList:{add(){},remove(){}}};
 const modal={open:false,addEventListener(){}};
 const elements={'#app':app,'#modal':modal,'#toast':toast};
 const window={addEventListener(){},get localStorage(){throw new DOMException('Blocked','SecurityError');}};
 const context=vm.createContext({
  ...engine,...state,...time,...ui,...forms,h:ui.escape,window,navigator:{},location:{hash:''},
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
});

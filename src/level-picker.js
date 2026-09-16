import {ascensionChoices} from './progress-input.js';
import {escape} from './ui.js';
export function skillField(id,value,label){
 return `<div class="level-field skill-field"><input id="${id}" name="${id}" type="number" min="1" max="10" value="${value}" required autocomplete="off" role="combobox" aria-label="${escape(label)}" aria-autocomplete="none" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-options"><div id="${id}-options" class="level-options" role="listbox" aria-label="${escape(label)}: escolher nível" hidden>${Array.from({length:10},(_,i)=>`<button type="button" role="option" tabindex="-1" id="${id}-option-${i+1}" data-level="${i+1}" aria-selected="false">${i+1}</button>`).join('')}</div></div>`;
}
const caps=[20,40,50,60,70,80,90];
const levels=[1,10,20,30,40,50,60,70,80,90];
export function levelField(prefix,value,max=90){
 const id=`${prefix}-level`;
 return `<div class="level-field"><label for="${id}">Nível</label><input id="${id}" name="${id}" type="number" min="1" max="${max}" value="${value}" required autocomplete="off" role="combobox" aria-autocomplete="none" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-options"><div id="${id}-options" class="level-options" role="listbox" aria-label="Sugestões de nível" hidden>${levels.filter(n=>n<=max).flatMap(n=>ascensionChoices(n,caps,caps.indexOf(max)).map((asc,i)=>`<button type="button" role="option" tabindex="-1" id="${id}-option-${n}-${asc}" data-ascension="${asc}" data-level="${n}" aria-selected="false">${n}<span class="level-option-star ${i||(!caps.includes(n)&&asc>0)||n===max?'lit':''}" aria-hidden="true">◇</span><small>${caps.includes(n)&&n<max?(i?'Após ascender':'Antes de ascender'):''}</small></button>`)).join('')}</div></div>`;
}
let active=null,index=-1;
function options(){return [...active.querySelectorAll('[data-level]')];}
function close(){if(!active)return;const input=active.querySelector('input');input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active.querySelector('.level-options').hidden=true;active=null;index=-1;}
function highlight(next){index=next;const list=options();list.forEach((b,i)=>b.setAttribute('aria-selected',String(i===index)));const input=active.querySelector('input');if(list[index]){input.setAttribute('aria-activedescendant',list[index].id);list[index].scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');}
function open(field){if(active===field)return;close();active=field;const input=field.querySelector('input');field.querySelector('.level-options').hidden=false;input.setAttribute('aria-expanded','true');highlight(-1);}
function select(button){const input=active.querySelector('input');input.value=button.dataset.level;const stage=active.closest('.combined-progress')?.querySelector('input[type=hidden]');if(stage)stage.value=button.dataset.ascension;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.focus();close();}
document.addEventListener('focusin',e=>{if(e.target.matches('.level-field input'))open(e.target.closest('.level-field'));else if(active&&!active.contains(e.target))close();});
document.addEventListener('click',e=>{const field=e.target.closest('.level-field');if(!field){close();return;}if(e.target.matches('input'))open(field);const option=e.target.closest('[data-level]');if(option){open(field);select(option);}});
document.addEventListener('pointerdown',e=>{if(e.target.closest('.level-options'))e.preventDefault();else if(active&&!active.contains(e.target))close();});
document.addEventListener('input',e=>{if(e.target.matches('.level-field input')){open(e.target.closest('.level-field'));highlight(-1);}});
document.addEventListener('keydown',e=>{
 if(!e.target.matches('.level-field input'))return;
 if(e.key==='Escape'&&active){e.preventDefault();e.stopPropagation();close();return;}
 if(e.key==='Tab'){close();return;}
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();open(e.target.closest('.level-field'));highlight(index<0?(e.key==='ArrowDown'?0:options().length-1):(index+(e.key==='ArrowDown'?1:-1)+options().length)%options().length);}
 if(e.key==='Enter'&&active&&index>=0){e.preventDefault();select(options()[index]);}
});

import {escape as h} from './ui.js';
const statNames={'ATK':'ATQ','ATK%':'ATQ','Crit. Rate':'Taxa Crítica','Crit. DMG':'Dano Crítico','Energy Regen':'Recarga de Energia','Energy Regen.':'Recarga de Energia','HP':'PV','DEF':'DEF'};
export function weaponGrid(weapons,selected,stats){
 return `<input type="hidden" name="weapon-id" value="${h(selected||'')}"><div class="weapon-grid-label"><span>Escolha sua arma</span><small>Passe o mouse para ver os atributos</small></div><div class="weapon-grid" role="group" aria-label="Armas compatíveis"><button type="button" class="weapon-tile weapon-none" data-weapon-choice="" aria-pressed="${!selected}"><span class="weapon-none-symbol">∅</span><span>Sem arma</span></button>${weapons.map(w=>{
 const info=stats?.[w.id],attributes=info?.stats.map(s=>`<div><span>${h(statNames[s.name]||s.name)}</span><strong>${h(s.value)}${s.percent?'%':''}</strong></div>`).join('');
 return `<button type="button" class="weapon-tile rarity-${w.rarity}" data-weapon-choice="${h(w.id)}" aria-pressed="${selected===w.id}" aria-label="Selecionar ${h(w.name)}"><img src="${h(w.image)}" alt="" loading="lazy"><span class="weapon-tile-stars">${'★'.repeat(w.rarity)}</span><span class="weapon-tile-name">${h(w.name)}</span><template><strong class="weapon-tooltip-name">${h(w.name)}</strong><span class="weapon-tooltip-level">${w.rarity}★ · Atributos no nível ${info?.level||1}</span><div class="weapon-tooltip-stats">${attributes||'Atributos não disponíveis'}</div>${info?.skill?`<strong class="weapon-tooltip-skill">${h(info.skill.name)} · R${info.skill.rank}</strong><p>${h(info.skill.description)}</p>`:''}</template></button>`;
 }).join('')}</div><div id="weapon-hover" class="weapon-tooltip" role="tooltip" hidden></div>`;
}
let trigger=null;
function hide(){const tooltip=document.getElementById('weapon-hover');if(tooltip)tooltip.hidden=true;trigger?.removeAttribute('aria-describedby');trigger=null;}
function show(tile){
 const content=tile.querySelector('template'),tooltip=document.getElementById('weapon-hover');if(!content||!tooltip){hide();return;}
 hide();trigger=tile;tooltip.innerHTML=content.innerHTML;tooltip.hidden=false;tile.setAttribute('aria-describedby','weapon-hover');
 const rect=tile.getBoundingClientRect(),width=Math.min(330,window.innerWidth-24);tooltip.style.width=width+'px';
 const height=tooltip.getBoundingClientRect().height;
 tooltip.style.left=Math.max(12,Math.min(rect.left,window.innerWidth-width-12))+'px';
 tooltip.style.top=Math.max(12,Math.min(rect.top-height-10<12?rect.bottom+10:rect.top-height-10,window.innerHeight-height-12))+'px';
}
document.addEventListener('pointerover',e=>{const tile=e.target.closest('[data-weapon-choice]');if(tile&&tile!==trigger)show(tile);});
document.addEventListener('pointerout',e=>{if(trigger&&!trigger.contains(e.relatedTarget))hide();});
document.addEventListener('focusin',e=>{const tile=e.target.closest('[data-weapon-choice]');if(tile)show(tile);else hide();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&trigger){e.preventDefault();e.stopPropagation();hide();}},true);
document.addEventListener('scroll',hide,true);
window.addEventListener('resize',hide);
document.addEventListener('click',e=>{
 const tile=e.target.closest('[data-weapon-choice]');if(!tile)return;
 const form=tile.closest('form'),input=form.querySelector('[name="weapon-id"]');
 if(input.value!==tile.dataset.weaponChoice){input.value=tile.dataset.weaponChoice;input.dispatchEvent(new Event('change',{bubbles:true}));}
 for(const button of form.querySelectorAll('[data-weapon-choice]'))button.setAttribute('aria-pressed',String(button===tile));
});

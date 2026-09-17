import {escape as h} from './ui.js';
import {skillField} from './level-picker.js';
import {nodeUnlocked,toggleForteNode} from './forte-progress.js';

const titles=['ATQ Normal','Habilidade de Ressonância','Circuito Ressonante','Liberação de Ressonância','Habilidade Intro'];
const statNames={'ATK':'ATQ','HP':'PV','DEF':'DEF','Crit. Rate':'Taxa CRIT','Crit. DMG':'Dano CRIT','Healing Bonus':'Bônus de cura','Energy Regen':'Recarga de Energia'};
export function statName(name){return name.replace(/\+$/,'').replace(/^(.*) DMG Bonus$/, 'Bônus de dano $1').replace(/^(ATK|HP|DEF|Crit\. Rate|Crit\. DMG|Healing Bonus|Energy Regen)$/,x=>statNames[x]);}
const generic=[
 '', '<path d="m12 3 8 9-8 9-8-9Z"/><path d="M8 12h8M12 8v8"/>',
 '<circle cx="12" cy="12" r="4"/><path d="m12 1 2 5 5-2-2 5 5 3-5 2 2 5-5-2-2 5-2-5-5 2 2-5-5-2 5-3-2-5 5 2Z"/>',
 '<path d="m13 2-7 11h5l-1 9 8-13h-5Z"/>', ''
];
function symbol(column,passive=false){
 if(column===0&&!passive)return '<img src="./assets/forte-icons/normal.webp" alt="">';
 if(column===4&&!passive)return '<img src="./assets/forte-icons/intro.webp" alt="">';
 if(passive&&column!==2)return `<img src="./assets/forte-icons/${column===1||column===3?'attack':'stat'}.webp" alt="">`;
 return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">${generic[column]}</svg>`;
}
export function forteTree(goal,data){
 return `<div class="forte-toolbar"><div><h3>Árvore de Fortes</h3><p>Marque as passivas que já tem ou quer liberar.</p></div><div class="forte-edit-mode" role="group" aria-label="Editar passivas"><button type="button" data-forte-mode="current" aria-pressed="false">Já tenho</button><button type="button" data-forte-mode="target" aria-pressed="true">Quero liberar</button></div></div>
 <div class="forte-legend"><span class="owned">◆ Já adquirido</span><span class="planned">◆ Na meta</span><span>◇ Não selecionado</span></div>
 <div class="forte-tree" data-edit-mode="target">
 ${['current','target'].flatMap(mode=>goal[mode].unlocks.map((v,i)=>`<input type="hidden" name="unlock-${mode}-${i}" value="${v}">`)).join('')}
 ${titles.map((title,column)=>`<div class="forte-branch forte-branch-${column}"><div class="forte-path" aria-hidden="true"></div>${[2,1].map(tier=>{
  const node=data?.branches[column]?.nodes[tier-1],name=node?(column===2?node.name:statName(node.name)):'Passiva';
  const owned=nodeUnlocked(goal.current.unlocks,column,tier),planned=nodeUnlocked(goal.target.unlocks,column,tier);
  return `<div class="forte-node-wrap tier-${tier}"><button type="button" class="forte-node ${column===2?'diamond':'circle'} ${owned?'owned':planned?'planned':''}" data-forte-column="${column}" data-forte-tier="${tier}" aria-label="${h(title+', '+name+', etapa '+tier)}" aria-pressed="${planned}" aria-describedby="forte-detail-${column}-${tier}">${symbol(column,true)}<span class="forte-node-check" aria-hidden="true">${owned?'✓':planned?'+':''}</span></button><span class="forte-node-caption">${column===2?'Passiva '+tier:h(node?.description.match(/[\d.]+%/)?.[0]||'Bônus')}</span><div id="forte-detail-${column}-${tier}" class="forte-detail" role="tooltip" popover="manual"><strong>${h(name)}</strong><span class="forte-detail-type">${column===2?'Passiva única':'Bônus de atributo'} · etapa ${tier}</span><p>${h(column===2?(node?.descriptionPt||node?.description||'Descrição indisponível.'):(node?statName(node.name)+' +'+(node.description.match(/[\d.]+%/)?.[0]||''):'Descrição indisponível.'))}</p><small>O nó superior inclui o inferior. Altere o modo para editar o que já possui.</small></div></div>`;
 }).join('')}<div class="forte-base diamond">${symbol(column)}</div><h4>${title}</h4><div class="forte-levels"><div><label for="skill-current-${column}">Atual</label>${skillField(`skill-current-${column}`,goal.current.skills[column],title+', atual')}</div><div><label for="skill-target-${column}">Meta</label>${skillField(`skill-target-${column}`,goal.target.skills[column],title+', meta')}</div></div></div>`).join('')}</div><p class="forte-help">Passe o mouse ou toque nas passivas para ver seus efeitos. Os materiais abaixo acompanham sua seleção.</p>`;
}
function progress(tree,mode){return Array.from({length:6},(_,i)=>Number(tree.querySelector(`[name="unlock-${mode}-${i}"]`).value));}
function refresh(tree){
 const current=progress(tree,'current'),target=progress(tree,'target'),mode=tree.dataset.editMode;
 tree.querySelectorAll('[data-forte-column]').forEach(button=>{const c=Number(button.dataset.forteColumn),t=Number(button.dataset.forteTier),owned=nodeUnlocked(current,c,t),planned=nodeUnlocked(target,c,t);
  button.classList.toggle('owned',owned);button.classList.toggle('planned',!owned&&planned);button.setAttribute('aria-pressed',String(nodeUnlocked(mode==='current'?current:target,c,t)));button.querySelector('.forte-node-check').textContent=owned?'✓':planned?'+':'';
 });
}
let shown=null,anchor=null,hideTimer;
function hide(){clearTimeout(hideTimer);if(shown?.isConnected&&shown.matches(':popover-open'))shown.hidePopover();shown=null;anchor=null;}
function show(button){
 const tip=document.getElementById(button.getAttribute('aria-describedby'));if(!tip||shown===tip)return;hide();shown=tip;anchor=button;tip.showPopover();
 const rect=button.getBoundingClientRect(),box=tip.getBoundingClientRect();
 tip.style.left=Math.max(12,Math.min(innerWidth-box.width-12,rect.left+rect.width/2-box.width/2))+'px';
 tip.style.top=Math.max(12,Math.min(innerHeight-box.height-12,rect.bottom+12))+'px';
}
document.addEventListener('click',event=>{
 const modeButton=event.target.closest('[data-forte-mode]');
 if(modeButton){const panel=modeButton.closest('[role=tabpanel]'),tree=panel.querySelector('.forte-tree');tree.dataset.editMode=modeButton.dataset.forteMode;panel.querySelectorAll('[data-forte-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===modeButton)));refresh(tree);hide();return;}
 const button=event.target.closest('[data-forte-column]');if(!button)return;
 const tree=button.closest('.forte-tree'),result=toggleForteNode(progress(tree,'current'),progress(tree,'target'),tree.dataset.editMode,Number(button.dataset.forteColumn),Number(button.dataset.forteTier));
 for(const mode of ['current','target'])result[mode].forEach((v,i)=>tree.querySelector(`[name="unlock-${mode}-${i}"]`).value=v);
 refresh(tree);show(button);tree.querySelector('input').dispatchEvent(new Event('input',{bubbles:true}));
});
document.addEventListener('pointerover',e=>{const b=e.target.closest('[data-forte-column]');if(b){clearTimeout(hideTimer);show(b);}else if(shown?.contains(e.target))clearTimeout(hideTimer);});
document.addEventListener('pointerout',e=>{if(shown&&(anchor?.contains(e.target)||shown.contains(e.target))&&!anchor?.contains(e.relatedTarget)&&!shown.contains(e.relatedTarget)){clearTimeout(hideTimer);hideTimer=setTimeout(hide,180);}});
document.addEventListener('focusin',e=>{const b=e.target.closest('[data-forte-column]');if(b)show(b);else if(shown&&!shown.contains(e.target))hide();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&shown){e.preventDefault();e.stopPropagation();hide();}},true);
document.addEventListener('scroll',e=>{if(shown&&!shown.contains(e.target))hide();},true);
window.addEventListener('resize',hide);

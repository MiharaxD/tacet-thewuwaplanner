export function activatePlannerTab(root, name, focus=false){
 for(const tab of root.querySelectorAll('[data-planner-tab]')){
  const selected=tab.dataset.plannerTab===name;
  tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
  if(selected&&focus)tab.focus();
 }
 for(const panel of root.querySelectorAll('[data-planner-panel]'))panel.hidden=panel.dataset.plannerPanel!==name;
}
document.addEventListener('click',e=>{
 const tab=e.target.closest('[data-planner-tab]');
 if(tab)activatePlannerTab(tab.closest('form'),tab.dataset.plannerTab);
});
document.addEventListener('keydown',e=>{
 const tab=e.target.closest('[data-planner-tab]');
 if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
 e.preventDefault();const root=tab.closest('form'),tabs=[...root.querySelectorAll('[data-planner-tab]')];
 const i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(tabs.indexOf(tab)+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
 activatePlannerTab(root,tabs[i].dataset.plannerTab,true);
});
// Reveal a hidden panel before the browser focuses an invalid field on submit.
document.addEventListener('invalid',e=>{
 const panel=e.target.closest('[data-planner-panel]');
 if(panel?.hidden)activatePlannerTab(panel.closest('form'),panel.dataset.plannerPanel);
},true);

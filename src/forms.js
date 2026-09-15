import {integer} from './engine.js';

export function rewardSlots(event){return Array.from({length:Math.max(3,Object.keys(event?.rewards||{}).length)},(_,i)=>i);}

export function readEventRewards(formData,event){
 if(event?.claimed)return {...event.rewards};
 const rewards={};
 for(const i of rewardSlots(event)){
  const material=formData.get(`reward-${i}`),n=Number(formData.get(`amount-${i}`));
  if(!integer(n))throw Error('Quantidade de recompensa inválida.');
  if(material&&n>0)rewards[material]=(rewards[material]||0)+n;
 }
 return rewards;
}

export function restoreSettingsDraft(form,draft){
 if(!form||!draft)return;
 for(const [name,value] of Object.entries(draft)){
  const field=form.elements.namedItem(name);
  if(field)field.value=value;
 }
}

export const SKILLS=['Ataque básico','Habilidade de Ressonância','Circuito Forte','Liberação de Ressonância','Habilidade de Introdução'];
export const UNLOCKS=['Habilidade inerente I','Habilidade inerente II','Bônus · ataque básico','Bônus · habilidade','Bônus · liberação','Bônus · introdução'];
export const clone=value=>structuredClone(value);
export function integer(value,min=0,max=1e9){return Number.isSafeInteger(value)&&value>=min&&value<=max;}
const add=(map,key,n)=>{if(n>0) map[key]=(map[key]||0)+n;};
export function emptyProgress(){return {level:1,ascension:0,xp:0,skills:[1,1,1,1,1],unlocks:[0,0,0,0,0,0]};}
export function newGoal(charId,id){return {id,charId,sequence:0,current:emptyProgress(),target:{...emptyProgress(),level:20},weapon:null,done:false};}

export function weaponRules(w,rules){return {...rules,caps:rules.caps.slice(0,(w.maxAscension??6)+1),floors:rules.floors.slice(0,(w.maxAscension??6)+1),weaponXp:rules.weaponXpByRarity?.[w.rarity]||rules.weaponXp};}
export function validateProgress(p,rules,weapon=false){
 if(!p||!integer(p.level,1,rules.caps.at(-1))||!integer(p.ascension,0,rules.caps.length-1)||!integer(p.xp,0,3000000)) throw Error('Nível, ascensão ou EXP inválidos.');
 if(p.level>rules.caps[p.ascension]||p.level<rules.floors[p.ascension]) throw Error(`Nível ${p.level} incompatível com ascensão ${p.ascension}.`);
 const table=weapon?rules.weaponXp:rules.resonatorXp;
 if(p.level===rules.caps[p.ascension] ? p.xp!==0 : p.xp>=table[p.level]-table[p.level-1]) throw Error('EXP parcial deve ser menor que a EXP para o próximo nível e zero no limite de ascensão.');
 if(!weapon){
  if(!Array.isArray(p.skills)||p.skills.length!==5||p.skills.some(n=>!integer(n,1,rules.skillCaps[p.ascension]))) throw Error(`Fortes incompatíveis com ascensão ${p.ascension}; limite ${rules.skillCaps[p.ascension]}.`);
  if(!Array.isArray(p.unlocks)||p.unlocks.length!==6||p.unlocks.some((n,i)=>!integer(n,0,i<2?1:2))) throw Error('Desbloqueios inválidos.');
 }
}
export function validateGoal(goal,db){
 if(goal?.sequence!==undefined&&!integer(goal.sequence,0,6))throw Error('Cadeia de Ressonância deve estar entre S0 e S6.');
 if(!goal||typeof goal.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(goal.id)||!db.catalog.characters.some(c=>c.id===goal.charId)||typeof goal.done!=='boolean') throw Error('Meta ou personagem inválido.');
 const pair=(a,b,weapon=false,rules=db.rules)=>{
  validateProgress(a,rules,weapon);validateProgress(b,rules,weapon);
  if(b.xp!==0) throw Error('A meta de EXP parcial deve ser zero.');
  if(b.level<a.level||b.ascension<a.ascension||(!weapon&&(b.skills.some((v,i)=>v<a.skills[i])||b.unlocks.some((v,i)=>v<a.unlocks[i])))) throw Error('A meta não pode ser inferior ao estado atual.');
 };
 pair(goal.current,goal.target);
 if(goal.weapon){
  const w=db.catalog.weapons.find(w=>w.id===goal.weapon.id),c=db.catalog.characters.find(c=>c.id===goal.charId);
  if(!w||w.type!==c.weapon) throw Error('Arma incompatível com o personagem.');
  pair(goal.weapon.current,goal.weapon.target,true,weaponRules(w,db.rules));
 }
 return true;
}

export function requirements(goal,db){
 validateGoal(goal,db);
 const c=db.catalog.characters.find(c=>c.id===goal.charId),cost={},missingData=[],r=db.rules;
 if(goal.done) return {cost,missingData,xp:0,weaponXp:0};
 for(let i=goal.current.ascension;i<goal.target.ascension;i++){
  if(!c.ascensionVerified||!(c.ascension||r.ascension)[i]) {missingData.push('Ascensão do personagem: não verificado');continue;}
  const [credit,flower,boss,tier,enemy]=(c.ascension||r.ascension)[i];
  add(cost,'shell',credit);add(cost,c.flower,flower);add(cost,c.boss,boss);add(cost,`${c.enemy}-${tier}`,enemy);
 }
 for(let s=0;s<5;s++) for(let i=goal.current.skills[s];i<goal.target.skills[s];i++){
  if(!c.forteVerified||!r.skills[i-1]) {missingData.push(`${SKILLS[s]}: não verificado`);continue;}
  const [credit,tier,forgery,enemy,weekly]=r.skills[i-1];
  add(cost,'shell',credit);add(cost,`${c.forgery}-${tier}`,forgery);add(cost,`${c.enemy}-${tier}`,enemy);add(cost,c.weekly,weekly);
 }
 for(let u=0;u<6;u++)for(let step=goal.current.unlocks[u];step<goal.target.unlocks[u];step++){
  const kind=u<2?'inherent':'stat',stage=u<2?u:step,entry=r.unlockCosts?.[kind]?.[stage];
  if(!r.unlocksVerified||!entry||!c.forgery||!c.enemy||!c.weekly){missingData.push('Materiais das passivas não verificados.');continue;}
  const [credit,tier,forgery,enemy,weekly]=entry;
  add(cost,'shell',credit);add(cost,`${c.forgery}-${tier}`,forgery);add(cost,`${c.enemy}-${tier}`,enemy);add(cost,c.weekly,weekly);
  const required=r.unlockAscensions?.[kind]?.[stage];
  if(required!==undefined&&goal.target.ascension<required)missingData.push(`${UNLOCKS[u]}: requer ascensão ${required} na meta.`);
 }
 if(goal.target.unlocks[1]&&!goal.target.unlocks[0])missingData.push('A segunda passiva única requer a primeira.');
 const getXp=(a,b,table)=>{
  if(a.level===b.level) return 0;
  if(table[a.level-1]==null||table[b.level-1]==null){missingData.push('Tabela de EXP: não verificado');return 0;}
  return Math.max(0,table[b.level-1]-table[a.level-1]-a.xp);
 };
 const xp=getXp(goal.current,goal.target,r.resonatorXp);
 add(cost,'shell',Math.ceil(xp*r.resonatorCreditPerXp));
 let weaponXp=0;
 if(goal.weapon){
  const w=db.catalog.weapons.find(w=>w.id===goal.weapon.id),a=goal.weapon.current,b=goal.weapon.target;
  for(let i=a.ascension;i<b.ascension;i++){
   if(w.ascensionCosts){
    if(!w.ascensionVerified||!w.ascensionCosts[i]){missingData.push(`${w.name}: custos de ascensão não verificados`);continue;}
    for(const [id,n] of Object.entries(w.ascensionCosts[i]))add(cost,id,n);
    continue;
   }
   if(!w.ascensionVerified||!r.weaponAscension[i]){missingData.push(`${w.name}: custos de ascensão não verificados`);continue;}
   const [credit,tier,enemy,ft,forgery]=r.weaponAscension[i];
   add(cost,'shell',credit);add(cost,`${w.enemy}-${tier}`,enemy);if(ft!==null)add(cost,`${w.forgery}-${ft}`,forgery);
  }
  weaponXp=getXp(a,b,weaponRules(w,r).weaponXp);add(cost,'shell',Math.ceil(weaponXp*r.weaponCreditPerXp));
 }
 return {cost,missingData:[...new Set(missingData)],xp,weaponXp};
}

// Bounded knapsack: smallest total EXP covering the requirement, then fewest items.
// Available quantities are capped by the largest useful sum, never expanded unboundedly.
export function selectExperience(required,stock,materials){
 if(required<=0)return {items:{},provided:0,allocated:0,missing:0,surplus:0};
 const cap=Math.ceil(required/1000)+20,dp=new Array(cap+1).fill(null);dp[0]={count:0,items:{}};
 for(const m of materials){
  const value=m.xp/1000;let available=Math.min(stock[m.id]||0,Math.ceil(cap/value)),chunk=1;
  while(available>0){
   const count=Math.min(chunk,available),weight=count*value;
   for(let sum=cap;sum>=weight;sum--){
    const prev=dp[sum-weight];if(!prev)continue;
    if(!dp[sum]||prev.count+count<dp[sum].count)dp[sum]={count:prev.count+count,items:{...prev.items,[m.id]:(prev.items[m.id]||0)+count}};
   }
   available-=count;chunk*=2;
  }
 }
 let selected=-1;for(let sum=Math.ceil(required/1000);sum<=cap;sum++)if(dp[sum]){selected=sum;break;}
 if(selected<0)for(let sum=Math.min(Math.floor(required/1000),cap);sum>=0;sum--)if(dp[sum]){selected=sum;break;}
 const provided=selected*1000;
 return {items:dp[selected].items,provided,allocated:Math.min(provided,required),missing:Math.max(0,required-provided),surplus:Math.max(0,provided-required)};
}

// Rover's attributes share level/ascension, while their Fortes remain independent.
function sharedGoal(goal,goals,db){
 const group=db.catalog.characters.find(c=>c.id===goal.charId)?.sharedProgress;
 if(!group)return {goal,dependencies:[]};
 const peers=goals.filter(g=>db.catalog.characters.find(c=>c.id===g.charId)?.sharedProgress===group);
 const effective=clone(goal),dependencies=[];
 const advance=p=>{
  const a=effective.current;
  if(p.level>a.level){a.level=p.level;a.xp=p.xp;}
  else if(p.level===a.level)a.xp=Math.max(a.xp,p.xp);
  a.ascension=Math.max(a.ascension,p.ascension);
 };
 for(const peer of peers)advance(peer.current);
 for(const peer of goals.slice(0,goals.indexOf(goal))){
  if(!peers.includes(peer)||peer.done)continue;
  if(peer.target.level>effective.current.level||peer.target.ascension>effective.current.ascension){dependencies.push(peer.id);advance(peer.target);}
 }
 effective.target.level=Math.max(effective.target.level,effective.current.level);
 effective.target.ascension=Math.max(effective.target.ascension,effective.current.ascension);
 return {goal:effective,dependencies};
}
export function allocate(goals,inventory,db){
 const bank={...inventory},totals={},results=[];
 for(const goal of goals){
  validateGoal(goal,db);
  const shared=sharedGoal(goal,goals,db);
  const req=requirements(shared.goal,db),rows=[],consumption={};
  if(!goal.done&&shared.dependencies.length)req.missingData.push('Nível e ascensão compartilhados: registre primeiro a meta anterior do Rover.');
  for(const [id,needed] of Object.entries(req.cost)){
   const available=bank[id]||0,allocated=Math.min(available,needed);bank[id]=available-allocated;add(consumption,id,allocated);
   rows.push({id,needed,available,allocated,missing:needed-allocated});
  }
  const exp=[];
  for(const [kind,needed] of [['potion',req.xp],['energy',req.weaponXp]]){
   if(!needed)continue;
   const materials=db.catalog.materials.filter(m=>m.xpKind===kind),available=materials.reduce((s,m)=>s+(bank[m.id]||0)*m.xp,0);
   const selection=selectExperience(needed,bank,materials);
   for(const [id,n] of Object.entries(selection.items)){bank[id]-=n;add(consumption,id,n);}
   rows.push({id:`xp-${kind}`,needed,available,allocated:selection.allocated,missing:selection.missing});
   exp.push({kind,needed,...selection});
  }
  for(const row of rows){
   if(!totals[row.id]) totals[row.id]={id:row.id,needed:0,allocated:0,missing:0,available:row.id.startsWith('xp-')?db.catalog.materials.filter(m=>m.xpKind===row.id.slice(3)).reduce((s,m)=>s+(inventory[m.id]||0)*m.xp,0):(inventory[row.id]||0)};
   for(const key of ['needed','allocated','missing']) totals[row.id][key]+=row[key];
  }
  let progress=rows.length?Math.round(rows.reduce((s,row)=>s+row.allocated/row.needed,0)/rows.length*100):(req.missingData.length?0:100);
  if(rows.some(r=>r.missing>0)||req.missingData.length)progress=Math.min(progress,99);
  results.push({goalId:goal.id,rows,consumption,exp,missingData:req.missingData,progress,ready:!req.missingData.length&&rows.every(r=>r.missing===0),hasWork:rows.length>0||req.missingData.length>0});
 }
 return {goals:results,totals:Object.values(totals),unallocated:bank};
}

export function synthesisSuggestions(plan,db){
 const free={...plan.unallocated},suggestions=[];
 for(const recipe of db.recipes.filter(r=>r.verified)){
  const [out,quantity]=Object.entries(recipe.outputs)[0],needed=plan.totals.find(t=>t.id===out)?.missing||0;
  const possible=Math.min(...Object.entries(recipe.inputs).map(([id,n])=>Math.floor((free[id]||0)/n)));
  const count=Math.min(possible,Math.ceil(needed/quantity));
  if(count>0){suggestions.push({recipe,count});for(const [id,n]of Object.entries(recipe.inputs))free[id]-=n*count;}
 }
 return suggestions;
}
export function applySynthesis(state,recipeId,count,db){
 if(!integer(count,1,1e6))throw Error('Quantidade de síntese inválida.');
 const recipe=db.recipes.find(r=>r.id===recipeId&&r.verified);if(!recipe)throw Error('Receita não verificada.');
 const next=clone(state),free=allocate(state.goals,state.inventory,db).unallocated;
 for(const [id,n]of Object.entries(recipe.inputs))if((free[id]||0)<n*count)throw Error('Esses recursos estão reservados para metas ou são insuficientes.');
 for(const [id,n]of Object.entries(recipe.inputs))next.inventory[id]=(next.inventory[id]||0)-n*count;
 for(const [id,n]of Object.entries(recipe.outputs))next.inventory[id]=(next.inventory[id]||0)+n*count;
 return next;
}
export function completeGoal(state,id,db,actual={}){
 const plan=allocate(state.goals,state.inventory,db),result=plan.goals.find(g=>g.goalId===id);
 if(!result?.ready||!result.hasWork)throw Error('A evolução exige todos os materiais e custos verificados.');
 const next=clone(state),goal=next.goals.find(g=>g.id===id);
 if(db.rules.union[goal.target.ascension]>state.settings.unionLevel||(goal.weapon&&db.rules.union[goal.weapon.target.ascension]>state.settings.unionLevel))throw Error('Nível de União insuficiente para registrar essa evolução.');
 const consumption={...result.consumption};
 // EXP estimates cannot predict overcap refunds. The UI can record the real ledger.
 if(actual.consumption){
  for(const [material,n]of Object.entries(actual.consumption)){
   const m=db.catalog.materials.find(m=>m.id===material);
   if(!m||(!m.xp&&material!=='shell')||!integer(n))throw Error('Consumo real inválido.');
   consumption[material]=n;
  }
 }
 for(const [material,n]of Object.entries(consumption)){
  if((state.inventory[material]||0)<n)throw Error('Estoque insuficiente para o consumo real informado.');
  next.inventory[material]=(next.inventory[material]||0)-n;
 }
 const refunds=actual.refunds||{};
 for(const [material,n]of Object.entries(refunds)){
  if(!db.catalog.materials.some(m=>m.id===material&&m.xp)||!integer(n))throw Error('Devolução de EXP inválida.');
  next.inventory[material]=(next.inventory[material]||0)+n;
 }
 const shared=sharedGoal(state.goals.find(g=>g.id===id),state.goals,db);
 goal.current=clone(shared.goal.current);goal.target=clone(shared.goal.target);
 const req=requirements(goal,db);
 const characterXp=actual.characterXp??(goal.current.level===goal.target.level?goal.current.xp:0);
 const weaponXp=actual.weaponXp??(goal.weapon?.current.level===goal.weapon?.target.level?goal.weapon?.current.xp||0:0);
 const extraCharacter=characterXp-(goal.current.level===goal.target.level?goal.current.xp:0);
 const extraWeapon=goal.weapon?weaponXp-(goal.weapon.current.level===goal.weapon.target.level?goal.weapon.current.xp:0):0;
 if(!integer(characterXp)||!integer(weaponXp)||extraCharacter<0||extraWeapon<0)throw Error('EXP parcial final inválida; não pode diminuir.');
 for(const [kind,needed]of [['potion',req.xp+extraCharacter],['energy',req.weaponXp+extraWeapon]]){
  const net=db.catalog.materials.filter(m=>m.xpKind===kind).reduce((sum,m)=>sum+((consumption[m.id]||0)-(refunds[m.id]||0))*m.xp,0);
  if(net<needed)throw Error('O consumo líquido de EXP é inferior à evolução. Confira os itens e devoluções.');
 }
 const minimumShell=(req.cost.shell||0)+Math.ceil(extraCharacter*db.rules.resonatorCreditPerXp)+Math.ceil(extraWeapon*db.rules.weaponCreditPerXp);
 if((consumption.shell||0)<minimumShell)throw Error('Os créditos consumidos não cobrem a evolução registrada.');
 goal.current=clone(goal.target);goal.current.xp=characterXp;
 if(goal.weapon){goal.weapon.current=clone(goal.weapon.target);goal.weapon.current.xp=weaponXp;}
 validateGoal(goal,db);goal.done=true;
 const group=db.catalog.characters.find(c=>c.id===goal.charId)?.sharedProgress;
 if(group)for(const peer of next.goals){
  if(peer===goal||db.catalog.characters.find(c=>c.id===peer.charId)?.sharedProgress!==group)continue;
  peer.current.level=goal.current.level;peer.current.ascension=goal.current.ascension;peer.current.xp=goal.current.xp;
  peer.target.level=Math.max(peer.target.level,peer.current.level);
  peer.target.ascension=Math.max(peer.target.ascension,peer.current.ascension);
  validateGoal(peer,db);
 }
 return next;
}
export function estimateFarm(missing,average,waveplates,dailyBudget){
 if(missing===0)return {runs:0,waveplates:0,days:0};
 if(!Number.isFinite(average)||average<=0||!Number.isFinite(dailyBudget)||dailyBudget<=0)return null;
 const runs=Math.ceil(missing/average),cost=runs*waveplates;
 return {runs,waveplates:cost,days:cost?Math.ceil(cost/dailyBudget):null};
}

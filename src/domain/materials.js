export const materialFamily=id=>id.replace(/-\d+$/,'');
export function sortMaterials(items,db){
 const byId=new Map(db.catalog.materials.map(m=>[m.id,m]));
 const key=m=>{const base=byId.get(materialFamily(m.id)+'-0')||m;return (m.category||'')+':'+(base.name||m.id);};
 return [...items].sort((a,b)=>{const x=byId.get(a.id)||a,y=byId.get(b.id)||b;return key(x).localeCompare(key(y),'pt-BR')||(x.rarity||0)-(y.rarity||0);});
}
export function recipeFor(id,db){return db.recipes.find(r=>r.verified&&Object.keys(r.outputs).length===1&&r.outputs[id]===1&&Object.keys(r.inputs).length===1);}
export function craftCapacity(id,bank,db,seen=new Set()){
 if(seen.has(id))throw Error('Ciclo de síntese inválido.');
 const recipe=recipeFor(id,db);if(!recipe)return bank[id]||0;
 const [input,cost]=Object.entries(recipe.inputs)[0];
 return (bank[id]||0)+Math.floor(craftCapacity(input,bank,db,new Set([...seen,id]))/cost);
}
// Consume original stock; intermediate crafting is recorded for explicit synthesis.
export function reserveMaterial(id,count,bank,consumption,steps,db){
 const direct=Math.min(count,bank[id]||0);bank[id]=(bank[id]||0)-direct;
 if(direct)consumption[id]=(consumption[id]||0)+direct;
 const remaining=count-direct;if(!remaining)return;
 const recipe=recipeFor(id,db);if(!recipe)throw Error('Materiais insuficientes para síntese.');
 const [input,cost]=Object.entries(recipe.inputs)[0];
 reserveMaterial(input,remaining*cost,bank,consumption,steps,db);
 steps.push({recipeId:recipe.id,output:id,count:remaining});
}
export function executeSynthesis(inventory,steps,db){
 const next={...inventory};
 for(const step of steps){const recipe=db.recipes.find(r=>r.id===step.recipeId&&r.verified);if(!recipe||!Number.isSafeInteger(step.count)||step.count<1)throw Error('Síntese inválida.');
  for(const [id,n]of Object.entries(recipe.inputs)){if((next[id]||0)<n*step.count)throw Error('Materiais insuficientes para síntese.');next[id]-=n*step.count;}
  for(const [id,n]of Object.entries(recipe.outputs)){next[id]=(next[id]||0)+n*step.count;if(next[id]>1e9)throw Error('Quantidade máxima excedida.');}
 }return next;
}

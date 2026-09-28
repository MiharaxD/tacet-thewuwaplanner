// Planning assumptions supplied by the project owner, for maximum difficulty.
// Forgery rates are direct drops; synthesis equivalents are not extra drops.
export function farmRate(material,db){
 if(material.id==='shell')return 80000;
 if(material.id==='xp-potion')return 11.5*(db.catalog.materials.find(m=>m.id==='potion-2')?.xp||0);
 if(material.id==='xp-energy')return 11.5*(db.catalog.materials.find(m=>m.id==='energy-2')?.xp||0);
 if(material.activity==='boss')return 2.5;
 if(material.activity==='weekly')return 3;
 if(material.activity==='forgery')return ({2:7,3:5,4:1.5,5:0.25})[material.rarity]||0;
 if(material.activity==='simulation'&&material.xp)return 11.5*(db.catalog.materials.find(m=>m.id===(material.xpKind==='potion'?'potion-2':'energy-2'))?.xp||0)/material.xp;
 return 0;
}
export function farmWaveplates(estimates){
 const groups=new Map();
 for(const {m,est}of estimates){
  if(!est)continue;
  // All rarities of the same family drop during the same forgery run.
  const key=m.activity==='forgery'?'forgery:'+m.id.replace(/-\d+$/,''):m.id;
  groups.set(key,Math.max(groups.get(key)||0,est.waveplates));
 }
 return [...groups.values()].reduce((a,b)=>a+b,0);
}

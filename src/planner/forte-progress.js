// The middle branch uses two booleans; each outer branch stores its unlocked depth.
export function nodeUnlocked(unlocks,column,tier){
 return column===2?Boolean(unlocks[tier-1]):unlocks[[2,3,null,4,5][column]]>=tier;
}
export function toggleForteNode(current,target,mode,column,tier){
 const result={current:[...current],target:[...target]},values=result[mode];
 const enabled=nodeUnlocked(values,column,tier);
 if(column===2){
  values[tier-1]=enabled?0:1;
  if(tier===2&&!enabled)values[0]=1;
  if(tier===1&&enabled)values[1]=0;
 }else values[[2,3,null,4,5][column]]=enabled?tier-1:tier;
 result.target=result.target.map((v,i)=>Math.max(v,result.current[i]));
 return result;
}

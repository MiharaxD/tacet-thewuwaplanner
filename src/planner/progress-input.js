// A cap can represent either side of an ascension; other levels have one stage.
export function ascensionChoices(level,caps,maxAscension=caps.length-1){
 if(!Number.isInteger(level)||level<1||level>caps[maxAscension])return [];
 const before=caps.findIndex(cap=>level<=cap);
 return caps[before]===level&&before<maxAscension?[before,before+1]:[before];
}
export function resolveAscension(level,previous,caps,maxAscension){
 const choices=ascensionChoices(level,caps,maxAscension);
 return choices.includes(previous)?previous:choices[0]??previous;
}

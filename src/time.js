export function eventStatus(event,now=Date.now()){
 return now<Date.parse(event.start)?'Futuro':now>=Date.parse(event.end)?'Encerrado':'Ativo';
}
export function countdown(time,now=Date.now()){
 const delta=Math.max(0,Date.parse(time)-now),minutes=Math.ceil(delta/60000);
 return minutes>=1440?`${Math.floor(minutes/1440)}d ${Math.floor(minutes%1440/60)}h`:`${Math.floor(minutes/60)}h ${minutes%60}min`;
}
export function nextReset(now,offset,weekly=false){
 const shifted=new Date(now+offset*3600000);
 let result=Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate(),4)-offset*3600000;
 if(result<=now)result+=86400000;
 if(weekly){while(new Date(result+offset*3600000).getUTCDay()!==1)result+=86400000;}
 return result;
}
export function serverDateToISO(value,offset){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Data inválida.');
 const raw=Date.parse(`${value}:00Z`);
 if(!Number.isFinite(raw)||new Date(raw).toISOString().slice(0,16)!==value)throw Error('Data inválida.');
 return new Date(raw-offset*3600000).toISOString();
}
export function isoToServerInput(value,offset){return new Date(Date.parse(value)+offset*3600000).toISOString().slice(0,16);}
export function dayKey(value,zone){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
export function formatDate(value,zone){return new Intl.DateTimeFormat('pt-BR',{timeZone:zone,dateStyle:'short',timeStyle:'short'}).format(new Date(value));}

const validInstant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
export function validateEventCatalog(catalog){
 if(!catalog||catalog.version!==1||!Array.isArray(catalog.events)||catalog.events.length>500)throw Error('Catálogo de eventos inválido.');
 const ids=new Set();
 return {...catalog,events:catalog.events.map(event=>{
  if(!event||typeof event.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(event.id)||ids.has(event.id)||typeof event.title!=='string'||!event.title.trim()||event.title.length>120||!validInstant(event.start)||!validInstant(event.end)||Date.parse(event.end)<=Date.parse(event.start))throw Error('Nome, identificador ou período de evento inválido.');
  if(event.servers!==undefined&&(!Array.isArray(event.servers)||!event.servers.length||event.servers.some(s=>!['America','Europe','Asia','SEA'].includes(s))))throw Error('Servidor de evento inválido.');
  ids.add(event.id);return {id:event.id,title:event.title.trim(),start:event.start,end:event.end,...(event.servers?{servers:[...new Set(event.servers)]}:{})};
 })};
}
export function officialEvents(catalog,server){return catalog.events.filter(e=>!e.servers||e.servers.includes(server)).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));}
export function eventDuration(event){
 const minutes=Math.ceil((Date.parse(event.end)-Date.parse(event.start))/60000),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60;
 return [days?`${days} ${days===1?'dia':'dias'}`:'',hours?`${hours} ${hours===1?'hora':'horas'}`:'',rest?`${rest} min`:''].filter(Boolean).join(' e ');
}
export function setEventCompleted(state,catalog,id,completed){
 if(typeof completed!=='boolean'||!officialEvents(catalog,state.settings.server).some(e=>e.id===id))throw Error('Evento indisponível.');
 return {...state,eventCompletions:{...(state.eventCompletions||{}),[id]:completed}};
}

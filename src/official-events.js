const validInstant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
export function validateEventCatalog(catalog){
 if(!catalog||catalog.version!==1||!Array.isArray(catalog.events)||catalog.events.length>500)throw Error('Catálogo de eventos inválido.');
 const ids=new Set();
 return {...catalog,events:catalog.events.map(event=>{
  if(!event||typeof event.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(event.id)||ids.has(event.id)||typeof event.title!=='string'||!event.title.trim()||event.title.length>120||!validInstant(event.start)||!validInstant(event.end)||Date.parse(event.end)<=Date.parse(event.start))throw Error('Nome, identificador ou período de evento inválido.');
  if(event.servers!==undefined&&(!Array.isArray(event.servers)||!event.servers.length||event.servers.some(s=>!['America','Europe','Asia','SEA'].includes(s))))throw Error('Servidor de evento inválido.');
  const imageOK=value=>typeof value==='string'&&value.length<2048&&(/^(?:\.\/)?assets\/[\w /().%-]+$/i.test(value)||/^https:\/\/[^\s<>"']+$/i.test(value));
  if(event.icon!==undefined&&!imageOK(event.icon))throw Error('Ícone de evento inválido. Use assets/ ou HTTPS.');
  if(event.type!==undefined&&!['event','banner','recurring'].includes(event.type))throw Error('Tipo de evento inválido.');
  if(event.banners!==undefined&&(!Array.isArray(event.banners)||event.banners.length>20||event.banners.some(b=>!b||!imageOK(b.image)||typeof b.name!=='string'||!b.name.trim()||b.name.length>120)))throw Error('Imagens de banner inválidas.');
  if(event.type==='recurring'&&(!event.reset||!validInstant(event.reset.anchor)||!Number.isFinite(event.reset.everyHours)||event.reset.everyHours<1||event.reset.everyHours>87600))throw Error('Informe a referência e o intervalo de reset em horas.');
  ids.add(event.id);return {...event,title:event.title.trim()};
 })};
}
export function officialEvents(catalog,server){return catalog.events.filter(e=>!e.servers||e.servers.includes(server)).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));}
export function eventDuration(event){
 const minutes=Math.ceil((Date.parse(event.end)-Date.parse(event.start))/60000),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60;
 return [days?`${days} ${days===1?'dia':'dias'}`:'',hours?`${hours} ${hours===1?'hora':'horas'}`:'',rest?`${rest} min`:''].filter(Boolean).join(' e ');
}
export function eventCycle(event,now=Date.now()){
 const start=Date.parse(event.start),end=Date.parse(event.end);
 if(event.type!=='recurring')return {start,end};
 const anchor=Date.parse(event.reset.anchor),interval=event.reset.everyHours*3600000;
 const boundary=anchor+Math.floor((now-anchor)/interval)*interval;
 return {start:Math.max(start,boundary),end:Math.min(end,boundary+interval)};
}
export function isEventCompleted(state,event,now=Date.now()){
 const value=state.eventCompletions?.[event.id];
 if(event.type!=='recurring')return value===true||typeof value==='string';
 const cycle=eventCycle(event,Math.min(now,Date.parse(event.end)-1));
 return typeof value==='string'&&Date.parse(value)>=cycle.start&&Date.parse(value)<cycle.end;
}
export function setEventCompleted(state,catalog,id,completed,now=Date.now()){
 const event=officialEvents(catalog,state.settings.server).find(e=>e.id===id);
 if(typeof completed!=='boolean'||!event)throw Error('Evento indisponível.');
 return {...state,eventCompletions:{...(state.eventCompletions||{}),[id]:completed&&event.type==='recurring'?new Date(now).toISOString():completed}};
}

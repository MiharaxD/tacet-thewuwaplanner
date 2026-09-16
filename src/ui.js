export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(n||0);
export const compact=n=>new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(n||0);
const paths={summary:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',characters:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',inventory:'m3 7 9-4 9 4v10l-9 4-9-4V7m0 0 9 4 9-4M12 11v10M7 5l10 4',farm:'m13 2-3 8H4l7 12 3-8h6L13 2z',events:'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2M7 14h2M12 14h2M7 18h2',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',plus:'M12 5v14M5 12h14',arrow:'M5 12h14m-6-6 6 6-6 6',search:'M21 21l-5-5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14',check:'m5 12 4 4L19 6',close:'m6 6 12 12M6 18 18 6',download:'M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4',upload:'M12 16V4m-5 5 5-5 5 5M5 17v4h14v-4',undo:'M3 10h10a7 7 0 0 1 7 7M3 10l5-5M3 10l5 5',leaf:'M20 3C9 1 1 8 6 15c5 7 16 0 14-12ZM4 21l10-12',diamond:'m12 2 9 10-9 10-9-10 9-10z',clock:'M12 8v5l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',info:'M12 11v6M12 7h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',menu:'M4 6h16M4 12h16M4 18h16'};
export const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]||paths.diamond}"/></svg>`;
export const button=(label,action,extra='',className='')=>`<button type="button" class="${className}" data-action="${action}" ${extra}>${label}</button>`;
export const badge=(text,type='')=>`<span class="badge ${type}">${escape(text)}</span>`;
export const empty=(title,text,action='')=>`<div class="empty"><span class="empty-icon">${icon('diamond')}</span><h3>${escape(title)}</h3><p>${escape(text)}</p>${action}</div>`;
export const bar=(value,label='Materiais reservados')=>`<div class="progress" role="progressbar" aria-label="${escape(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><span style="width:${value}%"></span></div>`;
export const weaponLabel=type=>({Broadblade:'Lâmina larga',Rectifier:'Retificador',Sword:'Espada',Pistols:'Pistolas',Gauntlets:'Manoplas'}[type]||type);
export function portrait(c,size=''){return `<span class="portrait ${size} ${c.element.toLowerCase()}"><span class="portrait-fallback">${escape(c.name.slice(0,2))}</span><img src="${escape(c.imageHighRes||c.image)}" alt="${escape(c.name)}" loading="lazy" width="256" height="256"></span>`;}
export function materialMeta(id,db){
 if(id.startsWith('xp-')){
  const character=id==='xp-potion';
  const representative=db.catalog.materials.find(m=>m.id===(character?'potion-2':'energy-2'));
  return {name:character?'EXP de personagem':'EXP de arma',category:'Experiência',origin:'Simulation Training',activity:'simulation',sources:[character?'level':'weapon-level'],rarity:null,image:representative?.image};
 }
 return db.catalog.materials.find(m=>m.id===id)||{name:id,origin:'Não verificado',category:'Não verificado',sources:[]};
}
export function materialIcon(m){return `<span class="material-icon rarity-${m.rarity||0}" aria-hidden="true">${icon(m.category==='Coleta'?'leaf':m.category==='Experiência'?'inventory':m.category==='Moeda'?'diamond':m.category==='Semanal'?'events':'farm')}${m.image?`<img src="${escape(m.image)}" alt="" loading="lazy" width="40" height="40">`:''}</span>`;}
export function materialTable(rows,db,{compactView=false}={}){
 if(!rows.length)return empty('Nenhum material necessário','Adicione uma meta ou ajuste o nível desejado.');
 return `<div class="table-scroll"><table class="materials-table"><thead><tr><th>Material / origem</th><th>Necessário</th>${compactView?'':'<th>Disponível¹</th>'}<th>Reservado</th><th>Falta</th></tr></thead><tbody>${rows.map(row=>{
 const m=materialMeta(row.id,db);return `<tr><td><div class="material-cell">${materialIcon(m)}<span><strong>${escape(m.name)}</strong><small>${escape(m.origin)}</small></span></div></td><td>${fmt(row.needed)}</td>${compactView?'':`<td>${fmt(row.available)}</td>`}<td>${fmt(row.allocated)}</td><td class="${row.missing?'missing':'complete'}">${row.missing?fmt(row.missing):'✓'}</td></tr>`;
 }).join('')}</tbody></table></div>`;
}

import {sortMaterials} from '../domain/materials.js';
import {escape as h,fmt,icon,button,empty,materialIcon} from '../ui/common.js';
import {topHeader} from '../ui/components.js';

export function inventory(ctx) {
   const {db,state,plan,search,category,usedOnly,synthesisButton}=ctx;
   const used = new Set(plan.totals.map(t => t.id)); for (const g of plan.goals) for (const k of Object.keys(g.consumption)) used.add(k);
   if (plan.totals.some(t => t.id === 'xp-potion')) db.catalog.materials.filter(m => m.xpKind === 'potion').forEach(m => used.add(m.id));
   if (plan.totals.some(t => t.id === 'xp-energy')) db.catalog.materials.filter(m => m.xpKind === 'energy').forEach(m => used.add(m.id));
   const materials = db.catalog.materials.filter(m => (!search || m.name.toLowerCase().includes(search.toLowerCase())) && (!category || m.category === category) && (!usedOnly || used.has(m.id)));
   return topHeader('Seu inventário', 'Um estoque compartilhado por todas as suas metas.', `<div class="button-group">${button(icon('upload') + ' Importar', 'import')}${button(icon('download') + ' Exportar', 'export')}</div>`) +
      `<div class="filter-bar"><label class="search-field">${icon('search')}<input id="search" data-filter="search" type="search" value="${h(search)}" placeholder="Pesquisar material" aria-label="Pesquisar material"></label><label class="select-label">Categoria<select id="category" data-filter="category"><option value="">Todas</option>${[...new Set(db.catalog.materials.map(m => m.category))].map(c => `<option ${c === category ? 'selected' : ''}>${h(c)}</option>`).join('')}</select></label><label class="check-label"><input id="used" data-filter="used" type="checkbox" ${usedOnly ? 'checked' : ''}>Usados nas metas</label></div>
 <p class="inline-info">${icon('info')} Quantidades salvas automaticamente. Criar uma meta reserva recursos; o estoque só diminui ao confirmar o consumo.</p><div class="inventory-grid">${sortMaterials(materials, db).map(m => {
         const stock = state().inventory[m.id] || 0, reserved = Math.max(0, stock - (plan.unallocated[m.id] || 0)), row = plan.totals.find(t => t.id === m.id);
         return `<article class="inventory-card">${materialIcon(m)}<div class="inventory-info"><h3>${h(m.name)}</h3><p>${h(m.category)} ${m.rarity ? '· ' + m.rarity + '★' : ''}</p><small>${used.has(m.id) ? `${fmt(reserved)} reservado${row?.missing ? ' · faltam ' + fmt(row.missing) : ''}` : 'Fora das metas atuais'}</small></div><label class="quantity">Estoque<input id="inv-${m.id}" data-stock="${m.id}" type="number" min="0" max="1000000000" step="1" value="${stock}" aria-label="Estoque de ${h(m.name)}">${synthesisButton(m.id)}</label></article>`;
      }).join('')}</div>${materials.length ? '' : empty('Nada por aqui', 'Ajuste a busca ou os filtros para encontrar um material.')}`;
}

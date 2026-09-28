import {characterSearchText,elementLabel,escape as h,icon,button,empty,weaponLabel} from '../ui/common.js';
import {topHeader,characterCard,goalCard} from '../ui/components.js';

export function filteredCharacters(ctx) {
   const {db,search,element,weaponFilter}=ctx; return db.catalog.characters.filter(c => (!search || characterSearchText(c).includes(search.toLowerCase())) && (!element || c.element === element) && (!weaponFilter || c.weapon === weaponFilter)); }

export function characters(ctx) {
   const {db,state,search,element,weaponFilter}=ctx;
   return topHeader('Ressonantes', 'Escolha quem vai receber seus próximos materiais.', button(icon('plus') + ' Nova meta', 'choose', '', 'primary')) +
      `<div class="filter-bar"><label class="search-field">${icon('search')}<input id="search" data-filter="search" type="search" value="${h(search)}" placeholder="Pesquisar personagem" aria-label="Pesquisar personagem"></label><label class="select-label">Elemento<select id="element" data-filter="element"><option value="">Todos</option>${['Aero', 'Electro', 'Fusion', 'Glacio', 'Havoc', 'Spectro'].map(v => `<option value="${v}" ${element === v ? 'selected' : ''}>${elementLabel(v)}</option>`).join('')}</select></label><label class="select-label">Arma<select id="weapon-filter" data-filter="weapon"><option value="">Todas</option>${['Broadblade', 'Rectifier', 'Sword', 'Pistols', 'Gauntlets'].map(v => `<option value="${v}" ${weaponFilter === v ? 'selected' : ''}>${weaponLabel(v)}</option>`).join('')}</select></label></div>
 ${state().goals.length ? `<div class="section-heading"><h2>Suas metas</h2><span class="muted">A ordem define a reserva de materiais</span></div><div class="goal-grid">${state().goals.map((g,i)=>goalCard(ctx,g,i)).join('')}</div>` : ''}<div class="section-heading"><h2>Catálogo de Ressonantes</h2></div><div class="characters-grid">${filteredCharacters(ctx).map(c=>characterCard(ctx,c)).join('')}</div>${!filteredCharacters(ctx).length ? empty('Nenhum personagem encontrado', `Tente outro filtro. O catálogo local contém ${db.catalog.characters.length} personagens verificados.`) : ''}`;
}

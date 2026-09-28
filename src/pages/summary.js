import {isEventCompleted} from '../domain/official-events.js';
import {eventStatus} from '../domain/time.js';
import {characterLabel,escape as h,compact,icon,button,materialMeta,materialTable} from '../ui/common.js';
import {topHeader,characterCard,goalCard} from '../ui/components.js';
import {publishedEvents,eventCard} from './events.js';

export function summary(ctx) {
   const {db,state,plan}=ctx;
   const active = state().goals.filter(g => !g.done);
   const pendingEvents = publishedEvents(ctx).filter(e => !isEventCompleted(state(), e, ctx.now(), db.rules) && eventStatus(e, ctx.now()) !== 'Encerrado');
   const first = active.find(g => ctx.resultFor(g).rows.some(r => r.missing > 0)) || active[0], c = first && db.catalog.characters.find(c => c.id === first.charId), missing = first ? ctx.resultFor(first).itemRows.filter(r => r.missing > 0) : [];
   return topHeader('Seu próximo avanço.', 'Menos tempo contando, Mais tempo em Solaris-3.', button(icon('plus') + ' Nova meta', 'choose', '', 'primary')) +
      `<section class="summary-events" aria-labelledby="summary-events-title"><div class="section-heading"><h2 id="summary-events-title">Eventos</h2><a href="#events">Ver agenda ${icon('arrow')}</a></div><div class="events-list">${pendingEvents.map(e=>eventCard(ctx,e)).join('') || '<p class="muted">Nenhum evento pendente por aqui.</p>'}</div></section>
 <div class="dashboard-grid"><div class="dashboard-main"><div class="section-heading"><h2>${state().goals.length ? 'Suas metas de evolução' : 'Escolha seu primeiro Ressonador'}</h2><a href="#characters">Ver ressonantes ${icon('arrow')}</a></div>${state().goals.length ? `<div class="goal-list">${state().goals.map((g,i)=>goalCard(ctx,g,i)).join('')}</div>` : `<p class="section-intro">Escolha um personagem para definir sua meta de evolução.</p><div class="characters-grid home-characters">${db.catalog.characters.slice(0, 3).map(c=>characterCard(ctx,c)).join('')}</div><div class="onboarding"><span>01 <strong>Defina sua meta</strong></span><span>02 <strong>Informe seu estoque</strong></span><span>03 <strong>Veja o que farmar</strong></span></div>`}
 <div class="section-heading"><h2>Visão dos materiais</h2><a href="#inventory">Abrir inventário ${icon('arrow')}</a></div><section class="panel">${materialTable(plan.itemTotals.slice(0, 6), db, { compactView: true })}${plan.itemTotals.length > 6 ? '<a class="panel-footer" href="#farm">Ver todos os materiais →</a>' : ''}</section></div>
 <aside class="dashboard-aside"><section class="focus-panel"><div class="eyebrow">${icon('farm')} PRÓXIMA PRIORIDADE</div><h2>${c ? h(characterLabel(c)) : 'Prepare o próximo passo'}</h2><p>${c ? 'Consulte os materiais restantes desta etapa e a reserva por prioridade.' : 'Seu plano de farm aparece aqui assim que você adicionar uma meta.'}</p>${missing.length ? `<ul class="priority-list">${missing.slice(0, 3).map(row => `<li><span>${h(materialMeta(row.id, db).name)}</span><strong>${compact(row.missing)}</strong></li>`).join('')}</ul>` : ''}<a class="focus-link" href="${c ? '#farm' : '#characters'}">${c ? 'Organizar meu farm' : 'Escolher personagem'} ${icon('arrow')}</a></section>
 </aside></div>`;
}

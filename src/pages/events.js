import {officialEvents,eventCycle,isEventCompleted} from '../domain/official-events.js';
import {eventStatus,countdown,formatDate,dayKey} from '../domain/time.js';
import {escape as h,button} from '../ui/common.js';
import {topHeader} from '../ui/components.js';

export function publishedEvents(ctx) { const {db,state}=ctx; return officialEvents(db.events, state().settings.server, ctx.now(), db.rules); }

export function eventTimeLabel(ctx, e, now = ctx.now()) {
   const {db,state}=ctx;
   const status = eventStatus(e, now); if (status === 'Encerrado') return 'Encerrado';
   if (status === 'Futuro') return 'Começa em ' + countdown(e.start, now);
   if (e.type === 'recurring') return 'Reset em ' + countdown(new Date(eventCycle(e, now, { server: state().settings.server, rules: db.rules }).end).toISOString(), now);
   return e.permanent ? 'Permanente' : countdown(e.end, now);
}

export function eventCard(ctx, e) {
   const {db,state}=ctx;
   const status = eventStatus(e, ctx.now()), done = isEventCompleted(state(), e, ctx.now(), db.rules), cycle = eventCycle(e, ctx.now(), { server: state().settings.server, rules: db.rules }), deadline = status === 'Futuro' ? e.start : Number.isFinite(cycle.end) ? new Date(cycle.end).toISOString() : null;
   return `<article class="event-row ${done ? 'event-is-complete' : ''}"><div class="event-row-main"><label class="event-check" title="${done ? 'Marcar como pendente' : 'Marcar como concluído'}"><input type="checkbox" aria-label="Concluí este evento: ${h(e.title)}" data-official-event="${h(e.id)}" ${done ? 'checked' : ''} ${status === 'Futuro' && !done ? 'disabled' : ''}><span aria-hidden="true">✓</span></label>${e.icon ? `<img class="event-row-icon" src="${h(e.icon)}" alt="">` : ''}<h3>${h(e.title)}</h3><span class="event-row-time" data-event-countdown="${h(e.id)}" title="${deadline ? (status === 'Futuro' ? 'Começa' : e.type === 'recurring' ? 'Próximo reset' : 'Termina') + ': ' + formatDate(deadline, state().settings.timeZone) : 'Evento permanente'}">${eventTimeLabel(ctx,e)}</span></div>${e.banners?.length ? `<div class="event-banner-images">${e.banners.map(b => `<figure><img src="${h(b.image)}" alt="${h(b.name)}" loading="lazy"><figcaption>${h(b.name)}</figcaption></figure>`).join('')}</div>` : ''}</article>`;
}

export function eventList(ctx, items) { const {db,state}=ctx; const pending = items.filter(e => !isEventCompleted(state(), e, ctx.now(), db.rules) && eventStatus(e, ctx.now()) !== 'Encerrado'), done = items.filter(e => isEventCompleted(state(), e, ctx.now(), db.rules)); return `<div class="events-list">${pending.map(e=>eventCard(ctx,e)).join('') || `<p class="muted">${done.length > 0 && done.length === items.length ? 'Tudo concluído por aqui.' : 'Nenhum evento ativo ou futuro.'}</p>`}</div>${done.length ? `<details class="completed-events"><summary>Eventos completos (${done.length})</summary><div class="events-list">${done.map(e=>eventCard(ctx,e)).join('')}</div></details>` : ''}`; }

export function currentCalendarMonth(ctx) { const {state}=ctx;
   const [year, month] = dayKey(ctx.now(), state().settings.timeZone).split('-').map(Number);
   ctx.eventMonth = new Date(year, month - 1, 1); ctx.eventMonthZone = state().settings.timeZone;
}

export function calendar(ctx) { const {state}=ctx;
   if (!ctx.eventMonth || ctx.eventMonthZone !== state().settings.timeZone) currentCalendarMonth(ctx);
   const year = ctx.eventMonth.getFullYear(), month = ctx.eventMonth.getMonth(), days = new Date(year, month + 1, 0).getDate(), start = (new Date(year, month, 1).getDay() + 6) % 7;
   const today = dayKey(ctx.now(), state().settings.timeZone);
   return `<section class="panel calendar-panel"><div class="calendar-heading">${button('‹', 'prev-month', 'aria-label="Mês anterior"', 'icon-button')}<h2>${new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(ctx.eventMonth)}</h2>${button('›', 'next-month', 'aria-label="Próximo mês"', 'icon-button')}</div><div class="calendar-grid">${['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map(d => `<span class="weekday">${d}</span>`).join('')}${Array.from({ length: start }, () => '<div class="calendar-day blank"></div>').join('')}${Array.from({ length: days }, (_, i) => {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, events = publishedEvents(ctx).filter(e => key >= dayKey(e.start, state().settings.timeZone) && (e.permanent || key <= dayKey(Date.parse(e.end) - 1, state().settings.timeZone)));
      return `<div class="calendar-day ${today === key ? 'today' : ''}"><span>${i + 1}</span>${events.map(e => button(h(e.title), 'view-event', `data-id="${e.id}"`, 'calendar-event')).join('')}</div>`;
   }).join('')}</div></section>`;
}

export function events(ctx) { const {state}=ctx;
   const events = publishedEvents(ctx); return topHeader('Eventos de Solaris-3', 'Acompanhe os prazos e marque o que você já concluiu.') +
      `<div class="events-toolbar"><div class="segmented">${button('Lista', 'event-list', `aria-pressed="${ctx.eventView === 'list'}"`, ctx.eventView === 'list' ? 'selected' : '')}${button('Calendário', 'event-calendar', `aria-pressed="${ctx.eventView === 'calendar'}"`, ctx.eventView === 'calendar' ? 'selected' : '')}</div><span class="muted">Exibição: ${h(state().settings.timeZone)} · servidor ${state().settings.server}</span></div>
 ${ctx.eventView === 'calendar' ? calendar(ctx) : eventList(ctx,events)}<p class="footnote">Suas marcações são pessoais e ficam salvas neste navegador.</p>`;
}

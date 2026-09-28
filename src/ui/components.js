import {farmRate} from '../domain/farm-rates.js';
import {estimateFarm} from '../domain/engine.js';
import {sortMaterials} from '../domain/materials.js';
import {elementLabel,characterLabel,escape as h,fmt,compact,icon,button,badge,bar,portrait,weaponLabel,materialMeta,materialIcon} from './common.js';

export function topHeader(title, subtitle, action = '') { return `<div class="page-heading"><div><span class="eyebrow">WUTHERING WAVES / PLANEJADOR</span><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`; }

export function characterCard(ctx, c) {
   const {db,state}=ctx;
   const added = state().goals.some(g => g.charId === c.id);
   return `<article class="character-card ${c.element.toLowerCase()}"><button type="button" class="character-art character-photo" data-action="${added ? 'edit-char' : 'add'}" data-id="${h(c.id)}" aria-label="${added ? 'Editar meta de' : 'Planejar'} ${h(characterLabel(c))} pela foto">${badge(elementLabel(c.element), 'element')}${portrait(c, 'large')}<span class="rarity">${'★'.repeat(c.rarity)}</span></button><div class="character-body"><div><h3>${h(characterLabel(c))}</h3><p>${weaponLabel(c.weapon)}</p></div>${button(added ? icon('check') : icon('plus'), added ? 'edit-char' : 'add', `data-id="${c.id}" aria-label="${added ? 'Editar meta de' : 'Planejar'} ${h(characterLabel(c))}"`, 'add-character')}</div></article>`;
}

export function goalFarmMaterials(ctx, result) {
   const {db,state}=ctx;
   const rows = sortMaterials(result.itemRows.filter(r => r.missing > 0), db); if (!rows.length) return '<p class="goal-farm-ready">Nenhum material faltante ✓</p>';
   return `<section class="goal-farm"><h4>Materiais que faltam</h4><div class="goal-farm-grid">${rows.map(row => { const m = materialMeta(row.id, db), cost = db.rules.activities[m.activity]?.waveplates || 0, average = farmRate(m, db), est = estimateFarm(row.missing, average, cost, state().settings.dailyWaveplates); return `<button type="button" class="goal-farm-item" data-action="edit-goal-stock" data-id="${h(row.id)}" data-stock-anchor="goal:${h(result.goalId)}:${h(row.id)}" aria-label="Editar estoque de ${h(m.name)}" title="${h(m.name)}"><span class="sr-only">${h(m.name)}</span>${materialIcon(m)}<strong aria-label="${fmt(row.missing)} faltando">${compact(row.missing)}</strong><small>${cost ? (est ? '≈ ' + fmt(est.runs) + ' tentativas' : 'Tentativas não estimadas') : 'Coleta livre'}</small><small>${cost ? (est ? fmt(est.waveplates) + ' Waveplates' : 'Waveplates não estimados') : '0 Waveplates'}</small></button>`; }).join('')}</div></section>`;
}

export function goalCard(ctx, goal, index) {
   const {db,state}=ctx;
   const c = db.catalog.characters.find(c => c.id === goal.charId), r = ctx.resultFor(goal);
   return `<article class="goal-card"><div class="goal-card-top">${button(portrait({ ...c, imageHighRes: db['character-art']?.[c.id]?.icon || c.image }), 'edit', `data-id="${h(goal.id)}" aria-label="Editar meta de ${h(characterLabel(c))} pela foto"`, 'goal-photo')}<div><div class="eyebrow">PRIORIDADE ${String(index + 1).padStart(2, '0')} ${goal.done ? '· CONCLUÍDA' : ''}</div><h3>${h(characterLabel(c))}</h3><span class="muted">${h(elementLabel(c.element))} · ${weaponLabel(c.weapon)}</span></div><div class="goal-order">${button('↑', 'move-up', `data-id="${goal.id}" aria-label="Aumentar prioridade de ${h(characterLabel(c))}" ${index === 0 ? 'disabled' : ''}`, 'icon-button')}${button('↓', 'move-down', `data-id="${goal.id}" aria-label="Diminuir prioridade de ${h(characterLabel(c))}" ${index === state().goals.length - 1 ? 'disabled' : ''}`, 'icon-button')}</div></div><div class="goal-level"><span>Nível <b>${goal.current.level}</b> <span class="muted">→</span> <b>${goal.target.level}</b></span><span>Ascensão ${goal.current.ascension} → ${goal.target.ascension}</span></div>${bar(r.progress)}<div class="progress-caption"><span>${r.missingData.length ? 'Cálculo parcial · verificar dados' : goal.done ? 'Evolução registrada' : 'Materiais reservados'}</span><strong>${r.progress}%</strong></div>${goalFarmMaterials(ctx,r)}<div class="goal-actions">${button('Ver materiais', 'detail', `data-id="${goal.id}"`, 'text-button')}${button(icon('settings'), 'edit', `data-id="${goal.id}" aria-label="Editar meta de ${h(characterLabel(c))}"`, 'icon-button')}${button(goal.done ? 'Reabrir' : 'Registrar evolução', goal.done ? 'reopen' : 'complete', `data-id="${goal.id}" ${(!goal.done && (!r.ready || !r.hasWork)) ? 'disabled' : ''}`, 'small-button')}</div></article>`;
}

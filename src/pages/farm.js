import {farmRate,farmWaveplates} from '../domain/farm-rates.js';
import {estimateFarm} from '../domain/engine.js';
import {escape as h,fmt,icon,button,empty,materialMeta,materialIcon,materialTable} from '../ui/common.js';
import {topHeader} from '../ui/components.js';

export function farm(ctx) {
   const {db,state,plan,synthesisButton}=ctx;
   const rows = plan.totals.filter(r => r.missing > 0), cfg = state().settings;
   let knownWave = 0, knownCount = 0;
   const estimates = rows.map(row => {
      const m = materialMeta(row.id, db), average = farmRate(m, db), activity = db.rules.activities[m.activity], est = estimateFarm(row.missing, average, activity?.waveplates || 0, cfg.dailyWaveplates);
      if (est) { knownWave += est.waveplates; knownCount++; }
      return { row, m, average, activity, est };
   });
   knownWave = farmWaveplates(estimates);
   return topHeader('Hora de farmar.', 'A lista segue a prioridade das suas metas.') +
      `<section class="farm-summary"><div>${icon('farm')}<span><strong>${fmt(knownWave)} Waveplates</strong><small>${knownCount}/${rows.length} recursos com estimativa automática</small></span></div><div><strong>${knownWave ? Math.ceil(knownWave / cfg.dailyWaveplates) + ' dias de energia' : '—'}</strong><small>Estimativa parcial · ${cfg.dailyWaveplates}/dia</small></div><div><strong>SOL3 ${Math.min(8, Math.floor(cfg.unionLevel / 10) + 1)}</strong><small>Nível de União ${cfg.unionLevel} · <a href="#settings">ajustar</a></small></div></section>
 <p class="inline-info">${icon('info')} Médias de dificuldade máxima, independentemente do seu Nível de União. Drops variam.</p>
 <div class="farm-list">${estimates.map(({ row, m, average, activity, est }, i) => `<article class="farm-card"><span class="rank">${String(i + 1).padStart(2, '0')}</span><button type="button" class="farm-stock-button" data-action="edit-goal-stock" data-id="${h(row.id)}" data-stock-anchor="farm-list:${h(row.id)}" aria-label="Editar estoque de ${h(m.name)}">${materialIcon(m)}<span class="farm-material"><strong>${h(m.name)}</strong><span class="farm-origin">${h(m.origin)}</span><small>Faltam ${row.id.startsWith('xp-') ? plan.itemTotals.filter(r => r.missing && materialMeta(r.id, db).xpKind === row.id.slice(3)).map(r => fmt(r.missing) + ' ' + h(materialMeta(r.id, db).name)).join(' + ') : '<b>' + fmt(row.missing) + '</b> unidades'} · ${activity?.waveplates || 0} Waveplates/tentativa</small></span></button><div class="yield-label"><span>Média por tentativa</span><strong>${average ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(row.id.startsWith('xp-') ? average / 8000 : average) : '—'} ${row.id.startsWith('xp-') ? 'itens avançados equivalentes' : 'itens'}</strong></div><div class="farm-estimate">${est ? `<strong>≈ ${fmt(est.runs)} tentativas</strong><small>${est.waveplates ? `${fmt(est.waveplates)} Waveplates · ≈ ${est.days} dias de energia` : 'Coleta sem Waveplates · dias não estimados'}</small>${m.activity === 'weekly' ? `<small>Limite compartilhado: ${3 - cfg.weeklyClaimsUsed} resgates restantes nesta semana.</small>` : ''}` : '<strong>Estimativa indisponível</strong><small>Coleta ou drop sem média definida; acompanhe a quantidade faltante.</small>'}</div>${button('Onde obter', 'source', `data-id="${row.id}"`, 'text-button')}</article>`).join('') || empty('Tudo no seu ritmo', 'Não há materiais faltantes. Adicione metas ou confira o inventário.', `<a class="primary button" href="#characters">Planejar personagem</a>`)}</div>
 <div class="section-heading"><h2>Síntese para as metas</h2></div><section class="panel synthesis">${[...new Set(plan.goals.flatMap(g => g.synthesis.map(s => s.output)))].map(id => `<div class="synthesis-row"><span>${h(materialMeta(id, db).name)}</span>${synthesisButton(id)}</div>`).join('') || '<p class="muted">Nenhuma conversão necessária com o estoque atual.</p>'}</section>
 <div class="section-heading"><h2>Distribuição completa</h2></div><section class="panel">${materialTable(plan.itemTotals, db, { editable: true, anchorPrefix: 'farm-table' })}</section>`;
}

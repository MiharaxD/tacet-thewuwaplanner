import { sortMaterials, materialFamily, recipeFor } from './domain/materials.js';
import { validateEventCatalog, officialEvents, eventCycle, isEventCompleted, setEventCompleted } from './domain/official-events.js';
import { forteTree } from './planner/forte-tree.js';
import { ascensionChoices, resolveAscension } from './planner/progress-input.js';
import { weaponGrid } from './planner/weapon-grid.js';
import './planner/planner-tabs.js';
import { levelField } from './planner/level-picker.js';
import { allocate, newGoal, clone, validateGoal, SKILLS, applySynthesis, applyAutomaticSynthesis, completeGoal, integer } from './domain/engine.js';
import { loadState, Store, parseBackup, mergeState, STORAGE_KEY, getStorage, withStorageLock } from './storage/state.js';
import { eventStatus, countdown, nextReset, dayKey } from './domain/time.js';
import { elementLabel, characterLabel, characterSearchText, escape as h, fmt, compact, icon, button, portrait, weaponLabel, materialMeta, materialIcon } from './ui/common.js';
import { restoreSettingsDraft } from './ui/forms.js';
import { registerPlannerTools } from './integrations/webmcp.js';
import { summary as renderSummary } from './pages/summary.js';
import { characters as renderCharacters, filteredCharacters as pageFilteredCharacters } from './pages/characters.js';
import { inventory as renderInventory } from './pages/inventory.js';
import { farm as renderFarm } from './pages/farm.js';
import { events as renderEvents, publishedEvents as pagePublishedEvents, eventTimeLabel as pageEventTimeLabel, eventCard as pageEventCard, currentCalendarMonth as pageCurrentCalendarMonth } from './pages/events.js';
import { settings as renderSettings } from './pages/settings.js';

const app = document.querySelector('#app'), modal = document.querySelector('#modal');
let db, store, plan, loadWarning = '', route = 'summary', search = '', element = '', weaponFilter = '', category = '', usedOnly = false, eventView = 'list', eventMonth = null, eventMonthZone = null, editingGoal = null, pendingImport = null, toastTimer;
let settingsDraft = null, renderedTimeKey = null, searchTimer, plannerRequest = 0;
const plannerLoads = {};
function cancelSearchRender() { clearTimeout(searchTimer); searchTimer = null; }
function scheduleSearchRender() { cancelSearchRender(); searchTimer = setTimeout(() => render(true), 125); }
function ensurePlannerData() {
   return Promise.all(['character-fortes', 'weapon-stats'].map(name => {
      if (db[name]) return db[name];
      if (!plannerLoads[name]) plannerLoads[name] = (async () => {
         const response = await fetch(`./data/${name}.json`);
         if (!response.ok) throw Error('Não foi possível carregar ' + name + '. Tente novamente.');
         db[name] = await response.json();
      })().finally(() => { delete plannerLoads[name]; });
      return plannerLoads[name];
   }));
}
const locked = action => withStorageLock(navigator.locks, action);
function showConflict() {
   if (!store?.conflicted || document.querySelector('#storage-conflict')) return;
   const notice = document.createElement('div'); notice.id = 'storage-conflict'; notice.className = 'notice error'; notice.setAttribute('role', 'alert');
   const message = document.createElement('p'); message.textContent = store.saveError; notice.append(message);
   const reload = document.createElement('button'); reload.type = 'button'; reload.textContent = 'Recarregar dados'; reload.addEventListener('click', () => location.reload()); notice.append(reload);
   document.querySelector('#main')?.prepend(notice);
}
const nav = [['summary', 'Resumo'], ['characters', 'Ressonantes'], ['inventory', 'Inventário'], ['farm', 'Farm'], ['events', 'Eventos'], ['settings', 'Configurações']];
function navigationIcon(key) { const file = { characters: 'ressonantes', inventory: 'inventario', farm: 'farm', events: 'eventos', settings: 'configuracoes' }[key]; return file ? `<img class="sidebar-symbol" src="./assets/ui/planner/nav-${file}.svg" width="24" height="24" alt="" aria-hidden="true">` : icon(key); }
const state = () => store.state;
const id = () => crypto.randomUUID();
function toast(text) { clearTimeout(toastTimer); const el = document.querySelector('#toast'); el.textContent = text; el.classList.add('show'); toastTimer = setTimeout(() => el.classList.remove('show'), 5000); }
function savedToast(message) { toast(store.saveError ? 'Alteração aplicada apenas em memória. Não foi possível salvar neste dispositivo. Exporte um backup antes de fechar.' : message); }
function commit(next, message) { store.commit(next); render(); if (message) savedToast(message); }
function openModal(content) { plannerRequest++; cancelSearchRender(); document.querySelector('[data-global-stock]')?.remove(); modal.classList.toggle('planner-modal', content.includes('id="goal-form"')); modal.innerHTML = content; if (!modal.open) modal.showModal(); modal.querySelector('input,select,button')?.focus(); }
const modalHeader = (title, sub = '') => `<header class="modal-header"><div><span class="eyebrow">TACET / PLANEJAMENTO</span><h2 id="modal-title">${h(title)}</h2>${sub ? `<p>${h(sub)}</p>` : ''}</div>${button(icon('close'), 'close', 'aria-label="Fechar janela"', 'icon-button')}</header>`;
function resetClosedModal() { plannerRequest++; closeStockEditor(); modal.innerHTML = ''; editingGoal = null; pendingImport = null; stockAnchor = null; }
function closeModal() { modal.close(); resetClosedModal(); }
modal.addEventListener('close', () => { if (!modal.open) resetClosedModal(); });
function resultFor(goal) { return plan.goals.find(g => g.goalId === goal.id); }
const pageCtx = {
   get db() { return db; }, get plan() { return plan; }, state, resultFor, synthesisButton,
   get store() { return store; }, get loadWarning() { return loadWarning; },
   get search() { return search; }, get element() { return element; }, get weaponFilter() { return weaponFilter; },
   get category() { return category; }, get usedOnly() { return usedOnly; },
   get eventView() { return eventView; }, get eventMonth() { return eventMonth; }, set eventMonth(value) { eventMonth = value; },
   get eventMonthZone() { return eventMonthZone; }, set eventMonthZone(value) { eventMonthZone = value; },
   now: () => Date.now()
};
function filteredCharacters() { return pageFilteredCharacters(pageCtx); }
function publishedEvents() { return pagePublishedEvents(pageCtx); }
function eventTimeLabel(e, now = Date.now()) { return pageEventTimeLabel(pageCtx, e, now); }
function eventCard(e) { return pageEventCard(pageCtx, e); }
function currentCalendarMonth() { return pageCurrentCalendarMonth(pageCtx); }

function render(preserve = false) {
   cancelSearchRender();
   renderedTimeKey = temporalKey();
   const previousIndicator = document.querySelector('.nav-indicator')?.getBoundingClientRect();
   const focus = preserve ? document.activeElement?.id : null, selection = preserve && document.activeElement?.type === 'search' ? [document.activeElement.selectionStart, document.activeElement.selectionEnd, document.activeElement.selectionDirection] : null;
   plan = allocate(state().goals, state().inventory, db);
   const daily = nextReset(Date.now(), db.rules.servers[state().settings.server], false, db.rules);
   app.innerHTML = `<aside class="sidebar"><a class="brand" href="#summary" aria-label="Tacet, resumo"><img src="./assets/brand/logo.png" width="1927" height="816" alt="Tacet"></a><div class="sidebar-label">SEU TERMINAL</div><nav aria-label="Navegação principal">${nav.map(([key, label]) => `<a href="#${key}" class="${route === key ? 'active' : ''}" ${route === key ? 'aria-current="page"' : ''}>${navigationIcon(key)}<span>${label}</span>${key === 'characters' && state().goals.length ? `<b>${state().goals.length}</b>` : ''}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="server-status">${icon('clock')}<div>Próximo reset<small data-reset-countdown>${countdown(new Date(daily).toISOString())} · ${state().settings.server}</small></div></div><div class="local-status">${icon('check')} ${store.saveError ? 'Falha ao salvar' : 'Salvo neste dispositivo'}</div><span class="version">TACET / v1.0 · FAN PROJECT</span></div></aside>
 <div class="workspace"><header class="topbar"><a class="mobile-brand" href="#summary" aria-label="Tacet, resumo"><img src="./assets/brand/logo.png" width="1927" height="816" alt="Tacet"></a><div class="breadcrumb">Terminal <span>/</span> <strong>${nav.find(n => n[0] === route)?.[1]}</strong></div><div class="topbar-right">${button(icon('undo'), 'undo', `aria-label="Desfazer última alteração" ${store.history.length ? '' : 'disabled'}`, 'icon-button')}<a class="union-badge" href="#settings">UL ${state().settings.unionLevel}</a><span class="avatar">R</span></div></header><main id="main" tabindex="-1">${store.saveError && !store.conflicted ? `<div class="notice error" role="alert" data-persistence-notice>${h(store.saveError)}</div>` : ''}${({ summary: renderSummary, characters: renderCharacters, inventory: renderInventory, farm: renderFarm, events: renderEvents, settings: renderSettings }[route] || renderSummary)(pageCtx)}</main><footer class="page-footer"><span>Feito com carinho por Yuri Mihara</span></footer></div>`;
   restoreSettingsDraft(document.querySelector('#settings-form'), settingsDraft);
   showConflict();
   const menu = document.querySelector('.sidebar nav');
   if (menu) {
      const index = Math.max(0, nav.findIndex(([key]) => key === route));
      const indicator = document.createElement('span'); indicator.className = 'nav-indicator'; indicator.setAttribute('aria-hidden', 'true');
      indicator.style.setProperty('--nav-index', index); indicator.style.setProperty('--nav-column', index % 3); indicator.style.setProperty('--nav-row', Math.floor(index / 3));
      menu.prepend(indicator);
      const current = indicator.getBoundingClientRect();
      if (previousIndicator && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
         const x = previousIndicator.left - current.left, y = previousIndicator.top - current.top;
         if (x || y) indicator.animate?.([{ transform: `translate(${x}px,${y}px)` }, { transform: 'translate(0,0)' }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
      }
   }
   if (focus) { const el = document.getElementById(focus); el?.focus(); if (selection !== null && el?.type === 'search') el.setSelectionRange(...selection); }
}

function choose() { openModal(modalHeader('Quem vamos evoluir?', 'Escolha um personagem da base local.') + `<div class="modal-content"><label class="search-field">${icon('search')}<input type="search" id="picker-search" placeholder="Pesquisar personagem" aria-label="Pesquisar no seletor de personagens"></label><p id="picker-empty" hidden>Nenhum personagem encontrado.</p><div class="picker-grid">${db.catalog.characters.map(c => `<button type="button" class="picker-character" data-search="${h(characterSearchText(c))}" data-action="${state().goals.some(g => g.charId === c.id) ? 'edit-char' : 'add'}" data-id="${c.id}">${portrait(c)}<strong>${h(characterLabel(c))}</strong><small>${h(elementLabel(c.element))} · ${weaponLabel(c.weapon)}</small></button>`).join('')}</div></div>`); }
function progressFields(prefix, p, heading, weapon = false) { const control = levelField(prefix, p.level, weapon?.maxLevel || 90).replace('<input ', '<div class="level-control"><input ').replace('<div id="' + prefix + '-level-options"', '<button type="button" class="ascension-toggle" data-action="toggle-ascension" aria-label="Ascensão"><img src="./assets/ui/planner/ascension-clear.png" alt=""></button></div><div id="' + prefix + '-level-options"'); return `<fieldset><legend>${heading}</legend><div class="combined-progress" data-progress="${prefix}" data-max-ascension="${weapon?.maxAscension ?? 6}">${control}<input type="hidden" name="${prefix}-ascension" value="${p.ascension}"><small class="ascension-hint"></small></div></fieldset>`; }
function syncAscensionFields() { document.querySelectorAll('.combined-progress').forEach(field => { const input = field.querySelector('input[type=number]'), stage = field.querySelector('input[type=hidden]'), button = field.querySelector('.ascension-toggle'), level = Number(input.value), max = Number(field.dataset.maxAscension), choices = ascensionChoices(level, db.rules.caps, max); stage.value = resolveAscension(level, Number(stage.value), db.rules.caps, max); const ascended = choices.length === 2 ? Number(stage.value) === choices[1] : Number(stage.value) > 0; button.disabled = choices.length !== 2; button.setAttribute('aria-pressed', String(ascended)); button.setAttribute('aria-label', choices.length === 2 ? (ascended ? 'Ascendido: voltar para antes da ascensão' : 'Sem ascensão: marcar como ascendido') : 'Ascensão definida pelo nível'); button.title = choices.length === 2 ? 'Clique para alternar antes/depois da ascensão' : 'A ascensão acompanha este nível'; field.querySelector('.ascension-hint').textContent = choices.length === 2 ? (ascended ? 'Depois da ascensão' : 'Antes da ascensão') : 'Ascensão ' + stage.value + ' · limite ' + db.rules.caps[stage.value]; }); }
async function goalForm(goal) {
   const request = ++plannerRequest;
   cancelSearchRender(); try { await ensurePlannerData(); } catch (error) { if (request !== plannerRequest) return false; toast(error.message); throw error; }
   if (request !== plannerRequest) return false;
   editingGoal = clone(goal); const c = db.catalog.characters.find(c => c.id === goal.charId), w = goal.weapon, art = db['character-art']?.[c.id];
   openModal(`<header class="planner-hero"><img class="planner-banner${art?.bannerKind ? ' planner-banner--splash' : ''}" style="--banner-position:${h(art?.bannerPosition || '50% 45%')}" src="${h(art?.banner || c.image)}" alt=""><div class="planner-identity"><img class="planner-avatar" src="${h(art?.icon || c.image)}" alt="${h(characterLabel(c))}"><div><span class="eyebrow">PLANEJAR EVOLUÇÃO</span><h2 id="modal-title">${h(characterLabel(c))}</h2><p>${h(elementLabel(c.element))} · ${weaponLabel(c.weapon)} <span class="planner-stars">${'★'.repeat(c.rarity)}</span></p></div></div>${button(icon('close'), 'close', 'aria-label="Fechar janela"', 'icon-button planner-close')}</header><form id="goal-form"><div class="sequence-bar"><div><strong>Cadeia de Ressonância</strong><span>Cópias extras do personagem</span></div><div class="sequence-options" role="radiogroup" aria-label="Cópias extras do personagem">${Array.from({ length: 7 }, (_, i) => `<label title="${i} cópias extras"><input type="radio" name="sequence" value="${i}" ${(goal.sequence ?? 0) === i ? 'checked' : ''}><span>S${i}</span></label>`).join('')}</div></div><div class="planner-tabs" role="tablist" aria-label="Etapas de evolução">${[['level', 'Nível'], ['forte', 'Fortes'], ['weapon', 'Arma']].map(([key, label], i) => `<button type="button" role="tab" id="planner-tab-${key}" data-planner-tab="${key}" aria-controls="planner-panel-${key}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><img src="./assets/ui/planner/${key}.png" alt="">${label}</button>`).join('')}</div><div class="modal-content planner-content"><section id="planner-panel-level" data-planner-panel="level" role="tabpanel" aria-labelledby="planner-tab-level">${c.sharedProgress ? '<p class="notice">O Rover compartilha nível e ascensão entre os elementos. Esses custos entram uma vez, por prioridade; os Fortes são separados.</p>' : ''}<div class="form-section-heading"><h3>Até onde vamos evoluir?</h3><span class="muted">Atual → Meta</span></div><div class="form-columns">${progressFields('current', goal.current, 'Estado atual')}${progressFields('target', goal.target, 'Meta desejada')}</div>
 </section><section id="planner-panel-forte" data-planner-panel="forte" role="tabpanel" aria-labelledby="planner-tab-forte" hidden>${forteTree(goal, db['character-fortes']?.[c.id])}</section>
 <section id="planner-panel-weapon" data-planner-panel="weapon" role="tabpanel" aria-labelledby="planner-tab-weapon" hidden><div class="form-section-heading"><h3>Prepare sua arma</h3><span class="muted">${weaponLabel(c.weapon)}</span></div>${weaponGrid(db.catalog.weapons.filter(item => item.type === c.weapon), w?.id, db['weapon-stats'])}<div id="weapon-info"></div><div id="weapon-progress" class="form-columns">${progressFields('weapon-current', w?.current || { level: 1, ascension: 0, xp: 0 }, 'Arma atual', db.catalog.weapons.find(x => x.id === w?.id))}${progressFields('weapon-target', w?.target || { level: 20, ascension: 0, xp: 0 }, 'Meta da arma', db.catalog.weapons.find(x => x.id === w?.id))}</div></section>
 <section class="goal-preview" id="goal-preview" aria-live="polite"></section><section id="goal-stock-editor" popover="auto" role="dialog" aria-labelledby="stock-editor-title"></section><p id="form-error" class="form-error" role="alert"></p></div><footer class="modal-footer">${state().goals.some(g => g.id === goal.id) ? button('Excluir meta', 'remove', `data-id="${goal.id}"`, 'text-button danger') : button('Voltar', 'choose', '', 'text-button')}<div>${button('Cancelar', 'close')}${button('Feito ✓', 'finish-goal', 'id="finish-goal" disabled', 'primary')}<button type="submit">Salvar meta ${icon('check')}</button></div></footer></form>`);
   updateGoalPreview();
   return true;
}
function updateWeaponInfo() {
   const el = document.querySelector('#weapon-info'); if (!el) return;
   const w = db.catalog.weapons.find(w => w.id === document.querySelector('[name="weapon-id"]').value);
   if (!w) { el.innerHTML = '<p class="footnote">Selecione uma arma para conferir seus materiais e configurar a evolução.</p>'; return; }
   const ids = [...new Set((w.ascensionCosts || []).flatMap(cost => Object.keys(cost)))].filter(id => id !== 'shell');
   el.innerHTML = `<div class="weapon-heading">${w.image ? `<img src="${h(w.image)}" alt="${h(w.name)}" width="72" height="72">` : ''}<div><h3>${h(w.name)}</h3><p>${w.rarity}★ · ${weaponLabel(w.type)} · nível máximo ${w.maxLevel || 90}</p></div></div><div class="weapon-materials">${ids.map(id => { const m = materialMeta(id, db); return `<span>${materialIcon(m)}<span>${h(m.name)}</span></span>`; }).join('')}</div>`;
}
function readGoal() {
   const fd = new FormData(document.querySelector('#goal-form')), g = clone(editingGoal), num = name => Number(fd.get(name));
   for (const k of ['current', 'target']) { g[k] = { level: num(k + '-level'), ascension: num(k + '-ascension'), xp: k === 'current' && num(k + '-level') === editingGoal.current.level && num(k + '-ascension') === editingGoal.current.ascension ? editingGoal.current.xp : 0, skills: SKILLS.map((_, i) => num(`skill-${k}-${i}`)), unlocks: Array.from({ length: 6 }, (_, i) => num(`unlock-${k}-${i}`)) }; }
   g.weapon = fd.get('weapon-id') ? { id: fd.get('weapon-id'), current: { level: num('weapon-current-level'), ascension: num('weapon-current-ascension'), xp: fd.get('weapon-id') === editingGoal.weapon?.id && num('weapon-current-level') === editingGoal.weapon.current.level && num('weapon-current-ascension') === editingGoal.weapon.current.ascension ? editingGoal.weapon.current.xp : 0 }, target: { level: num('weapon-target-level'), ascension: num('weapon-target-ascension'), xp: 0 } } : null; g.sequence = num('sequence'); g.done = false; return g;
}
function previewMaterials(rows, anchorPrefix) { return `<h3>Materiais para esta meta</h3><div class="material-tiles">${sortMaterials(rows, db).map(row => { const m = materialMeta(row.id, db), owned = state().inventory[row.id] || 0, label = m.name + ': ' + fmt(owned) + ' no inventário, ' + fmt(row.needed) + ' necessários' + (row.crafted ? ' · cobertura por síntese' : ''); return `<button type="button" class="material-tile ${row.missing ? 'is-missing' : 'is-covered'}" data-action="edit-goal-stock" data-id="${h(row.id)}" data-stock-anchor="${h(anchorPrefix)}:${h(row.id)}" aria-label="${h(label)}" title="${h(label)}"><span class="tile-owned">${compact(owned)}</span>${materialIcon(m)}<span class="tile-needed">${row.missing ? '⚑' : '✓'} ${compact(row.needed)}</span></button>`; }).join('')}</div>`; }
function updateGoalPreview() { syncAscensionFields(); updateWeaponInfo(); const el = document.querySelector('#goal-preview'); if (!el) return; const finish = document.querySelector('#finish-goal'); finish.disabled = true; try { const goal = readGoal(); validateGoal(goal, db); const goals = state().goals.map(g => g.id === goal.id ? goal : g); if (!goals.some(g => g.id === goal.id)) goals.push(goal); const result = allocate(goals, state().inventory, db).goals.find(g => g.goalId === goal.id); finish.disabled = !result.ready || !result.hasWork || db.rules.union[goal.target.ascension] > state().settings.unionLevel || (goal.weapon && db.rules.union[goal.weapon.target.ascension] > state().settings.unionLevel); finish.title = finish.disabled ? 'Reúna os materiais e confira o Nível de União para concluir' : 'Registrar evolução e consumir os materiais reservados'; el.innerHTML = `<div><strong>${result.itemRows.length} recursos</strong><span>${result.progress}% reservado · prioridade ${goals.findIndex(g => g.id === goal.id) + 1}</span></div>${result.missingData.length ? `<p class="warning-text">${h(result.missingData.join(' · '))}</p>` : ''}${previewMaterials(result.itemRows, 'planner:' + goal.id)}`; } catch (error) { el.innerHTML = `<p class="warning-text">${h(error.message)}</p>`; } }
function detail(goal) { const c = db.catalog.characters.find(c => c.id === goal.charId), r = resultFor(goal); openModal(modalHeader(characterLabel(c) + ' · materiais', 'Clique na imagem de um material para alterar seu estoque.') + `<div class="modal-content" data-detail-goal="${h(goal.id)}">${r.missingData.map(msg => `<p class="notice">${h(msg)}</p>`).join('')}${previewMaterials(r.itemRows, 'detail:' + goal.id)}<p class="footnote">Consumíveis por raridade: combinação sugerida para completar a meta. Ao editar o estoque, a combinação é recalculada.</p><section id="goal-stock-editor" popover="auto" role="dialog" aria-labelledby="stock-editor-title"></section></div><footer class="modal-footer">${button('Editar meta', 'edit', `data-id="${goal.id}"`)}${button('Registrar evolução', 'complete', `data-id="${goal.id}" ${!r.ready || !r.hasWork ? 'disabled' : ''}`, 'primary')}</footer>`); }
function completion(goal) { const r = resultFor(goal), c = db.catalog.characters.find(c => c.id === goal.charId); if (!r.ready || !r.hasWork) throw Error('Faltam materiais ou há dados não verificados.'); openModal(modalHeader(`Registrar evolução de ${h(characterLabel(c))}`, 'Confirme após realizar a evolução no jogo.') + `<form id="completion-form" data-id="${goal.id}"><div class="modal-content"><p>Estado: nível ${goal.current.level} → ${goal.target.level}, ascensão ${goal.current.ascension} → ${goal.target.ascension}. Estes recursos serão descontados (incluindo materiais usados na síntese automática):</p><ul class="consumption-list">${Object.entries(r.consumption).map(([id, n]) => `<li><span>${h(materialMeta(id, db).name)}</span><strong>${fmt(n)}</strong></li>`).join('')}</ul>${r.exp.some(x => x.surplus) ? `<div class="notice">Há EXP excedente na sugestão (${r.exp.map(x => `${x.kind === 'potion' ? 'personagem' : 'arma'}: ${fmt(x.surplus)}`).join('; ')}). Confira os consumíveis e eventuais devoluções no jogo. Esta reserva calcula créditos pela EXP necessária, sem prever devoluções. Se o consumo diferir, ajuste o consumo real e as devoluções abaixo.</div>` : ''}<div class="form-columns"><label>EXP parcial final do personagem<input name="characterXp" type="number" min="0" value="${goal.current.level === goal.target.level ? goal.current.xp : 0}" required></label>${goal.weapon ? '<label>EXP parcial final da arma<input name="weaponXp" type="number" min="0" value="' + (goal.weapon.current.level === goal.weapon.target.level ? goal.weapon.current.xp : 0) + '" required></label>' : ''}</div><label class="check-label"><input type="checkbox" required>Conferi o consumo acima e realizei esta evolução no jogo.</label><p class="footnote">Registre devoluções no ajuste de consumo real. Se ultrapassou o nível desejado, ajuste a meta antes de concluir. A operação pode ser desfeita.</p><p id="form-error" role="alert" class="form-error"></p></div><footer class="modal-footer">${button('Cancelar', 'close')}<button class="primary" type="submit">Confirmar evolução</button></footer></form>`); }

function addActualLedger(goalId) {
   const r = plan.goals.find(g => g.goalId === goalId); if (!r?.exp.length) return;
   const ledger = document.createElement('details'); ledger.className = 'form-details';
   const xpMaterials = db.catalog.materials.filter(m => r.exp.some(e => e.kind === m.xpKind));
   ledger.innerHTML = `<summary>Ajustar consumo real e devoluções de EXP</summary><p class="footnote">Se o jogo consumiu outra combinação ou devolveu itens ao atingir o limite, informe os valores reais. As ascensões e os Fortes mantêm seus custos verificados.</p><label>Shell Credits realmente consumidos<input name="actual-shell" type="number" min="0" max="1000000000" value="${r.consumption.shell || 0}"></label><div class="skills-grid"><span>Consumível</span><span>Consumido</span><span>Devolvido</span>${xpMaterials.map(m => `<label>${h(m.name)}</label><input name="actual-${m.id}" type="number" min="0" max="1000000000" value="${r.consumption[m.id] || 0}" aria-label="Consumo real de ${h(m.name)}"><input name="refund-${m.id}" type="number" min="0" max="1000000000" value="0" aria-label="Devolução de ${h(m.name)}">`).join('')}</div>`;
   document.querySelector('#completion-form .consumption-list').after(ledger);
}
function importDialog() { pendingImport = null; openModal(modalHeader('Importar backup', 'Escolha um arquivo JSON ou cole o conteúdo. Nada é substituído antes da revisão.') + `<div class="modal-content"><label>Arquivo JSON<input type="file" id="backup-file" accept=".json,application/json"></label><label>Conteúdo do backup<textarea id="backup-text" rows="6" maxlength="2000000" placeholder="Cole o JSON exportado pelo Tacet"></textarea></label><p id="form-error" role="alert" class="form-error"></p><div id="import-preview"></div></div><footer class="modal-footer">${button('Cancelar', 'close')}${button('Validar e revisar', 'validate-import', '', 'primary')}</footer>`); }
function download(text, name) { const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function confirmDialog(title, body, action, attrs = '') { openModal(modalHeader(title) + `<div class="modal-content">${body}</div><footer class="modal-footer">${button('Cancelar', 'close')}${button('Confirmar', 'confirm-' + action, attrs, 'primary')}</footer>`); }

function draftState() { const goal = readGoal(); validateGoal(goal, db); const next = clone(state()), index = next.goals.findIndex(g => g.id === goal.id); if (index < 0) next.goals.push(goal); else next.goals[index] = goal; return { next, goal }; }
let stockAnchor = null;
function findStockAnchor(materialId, anchorKey) { return [...document.querySelectorAll('[data-action=edit-goal-stock]')].find(el => el.dataset.id === materialId && el.dataset.stockAnchor === anchorKey); }
function closeStockEditor() { const editor = document.querySelector('#goal-stock-editor'); if (editor?.matches(':popover-open')) editor.hidePopover(); if (editor) editor.innerHTML = ''; }
function positionStockEditor() { const editor = document.querySelector('#goal-stock-editor'); if (!editor?.matches(':popover-open') || !stockAnchor?.isConnected) return; const rect = stockAnchor.getBoundingClientRect(), box = editor.getBoundingClientRect(), gap = 8, pad = 12; const left = Math.max(pad, Math.min(rect.left + (rect.width - box.width) / 2, window.innerWidth - box.width - pad)); const below = window.innerHeight - rect.bottom - pad, above = rect.top - pad; const top = below >= box.height || below >= above ? Math.min(rect.bottom + gap, window.innerHeight - box.height - pad) : Math.max(pad, rect.top - box.height - gap); editor.style.left = left + 'px'; editor.style.top = Math.max(pad, top) + 'px'; }
function synthesisButton(id) { return recipeFor(id, db) ? button('⚗', 'auto-synthesis', `data-id="${h(id)}" aria-label="Sintetizar ${h(materialMeta(id, db).name)}" title="Sintetizar materiais para as metas; sem demanda, converter o estoque livre"`, 'synthesis-button') : ''; }
function stockEditor(materialId, anchor) { const ids = sortMaterials(db.catalog.materials.filter(m => materialId.startsWith('xp-') ? m.xpKind === (materialId === 'xp-potion' ? 'potion' : 'energy') : materialFamily(m.id) === materialFamily(materialId)), db).map(m => m.id); let editor = document.querySelector('#goal-stock-editor'); if (!editor) { editor = document.createElement('section'); editor.id = 'goal-stock-editor'; editor.setAttribute('popover', 'auto'); editor.setAttribute('role', 'dialog'); editor.setAttribute('aria-labelledby', 'stock-editor-title'); editor.dataset.globalStock = 'true'; document.body.append(editor); } let previewPlan = plan; try { if (document.querySelector('#goal-form')) { const draft = draftState().next; previewPlan = allocate(draft.goals, draft.inventory, db); } } catch { } stockAnchor = anchor; editor.innerHTML = `<header class="stock-editor-heading"><h3 id="stock-editor-title">${h(materialMeta(materialId, db).name)}</h3>${button(icon('close'), 'cancel-goal-stock', 'aria-label="Fechar edição de estoque"', 'icon-button')}</header><p>Informe seu estoque. ⚗ converte os materiais de raridade menor e pode ser desfeito.</p><div class="stock-editor-items">${ids.map(id => { const m = materialMeta(id, db); return `<label>${materialIcon(m)}<span>${h(m.name)}<small>${fmt(previewPlan.itemTotals.find(r => r.id === id)?.needed || 0)} para as metas · ${fmt(previewPlan.itemTotals.find(r => r.id === id)?.missing || 0)} faltando</small></span><div class="stock-stepper">${button('−', 'step-goal-stock', 'data-step="-1" aria-label="Diminuir ' + h(m.name) + '"')}<input type="number" min="0" max="1000000000" step="1" required data-goal-stock="${h(id)}" value="${state().inventory[id] || 0}" aria-label="Estoque de ${h(m.name)}">${button('+', 'step-goal-stock', 'data-step="1" aria-label="Aumentar ' + h(m.name) + '"')}${synthesisButton(id)}</div></label>`; }).join('')}</div><div class="button-group">${button('Cancelar', 'cancel-goal-stock')}${button('Atualizar estoque', 'save-goal-stock', '', 'primary')}</div>`; if (!editor.matches(':popover-open')) editor.showPopover(); positionStockEditor(); editor.querySelector('input')?.focus({ preventScroll: true }); }
const actions = {
   'auto-synthesis': b => {
      const next = clone(state()); for (const input of document.querySelectorAll('[data-goal-stock]')) { if (input.value === '' || !integer(input.valueAsNumber)) throw Error('Informe quantidades inteiras válidas.'); next.inventory[input.dataset.goalStock] = input.valueAsNumber; }
      const planning = document.querySelector('#goal-form') ? draftState().next : next; planning.inventory = next.inventory;
      next.inventory = applyAutomaticSynthesis(planning, b.dataset.id, db).inventory;
      const detailId = document.querySelector('[data-detail-goal]')?.dataset.detailGoal, reopenId = document.querySelector('#goal-stock-editor')?.matches(':popover-open') ? stockAnchor?.dataset.id : null, reopenAnchor = stockAnchor?.dataset.stockAnchor; closeStockEditor(); store.commit(next); render(); if (detailId) detail(state().goals.find(g => g.id === detailId)); else updateGoalPreview(); if (reopenId) { const anchor = findStockAnchor(reopenId, reopenAnchor); if (anchor) stockEditor(reopenId, anchor); } savedToast('Síntese registrada. Você pode desfazer.');
   },
   'toggle-ascension': b => { const field = b.closest('.combined-progress'), stage = field.querySelector('input[type=hidden]'), choices = ascensionChoices(Number(field.querySelector('input[type=number]').value), db.rules.caps, Number(field.dataset.maxAscension)); if (choices.length === 2) stage.value = Number(stage.value) === choices[0] ? choices[1] : choices[0]; updateGoalPreview(); },
   'edit-goal-stock': b => stockEditor(b.dataset.id, b),
   'step-goal-stock': b => { const input = b.closest('.stock-stepper').querySelector('input'); input.value = Math.max(0, Math.min(1e9, (Number(input.value) || 0) + Number(b.dataset.step))); },
   'cancel-goal-stock': () => { closeStockEditor(); stockAnchor?.focus({ preventScroll: true }); },
   'save-goal-stock': () => { const editor = document.querySelector('#goal-stock-editor'), next = clone(state()); for (const input of editor.querySelectorAll('[data-goal-stock]')) { if (input.value === '' || !integer(input.valueAsNumber)) { input.reportValidity(); throw Error('Informe quantidades inteiras entre 0 e 1 bilhão.'); } next.inventory[input.dataset.goalStock] = input.valueAsNumber; } store.commit(next); const materialId = stockAnchor?.dataset.id, anchorKey = stockAnchor?.dataset.stockAnchor; closeStockEditor(); const detailId = document.querySelector('[data-detail-goal]')?.dataset.detailGoal; render(); if (detailId) detail(state().goals.find(g => g.id === detailId)); else updateGoalPreview(); findStockAnchor(materialId, anchorKey)?.focus({ preventScroll: true }); savedToast('Estoque atualizado.'); },
   'finish-goal': () => { const { next, goal } = draftState(); const completed = completeGoal(next, goal.id, db); store.commit(completed); closeModal(); render(); savedToast('Feito! Evolução registrada e materiais consumidos. Você pode desfazer.'); },
   close: closeModal, choose, add: b => goalForm(newGoal(b.dataset.id, id())), edit: b => goalForm(state().goals.find(g => g.id === b.dataset.id)),
   'edit-char': b => goalForm(state().goals.find(g => g.charId === b.dataset.id)), detail: b => detail(state().goals.find(g => g.id === b.dataset.id)), complete: b => { completion(state().goals.find(g => g.id === b.dataset.id)); addActualLedger(b.dataset.id); },
   reopen: b => { const next = clone(state()), g = next.goals.find(g => g.id === b.dataset.id); g.done = false; commit(next, 'Meta reaberta.'); },
   remove: b => confirmDialog('Excluir esta meta?', '<p>O inventário permanece como está. Você pode desfazer essa exclusão.</p>', 'remove', `data-id="${b.dataset.id}"`),
   'confirm-remove': b => { const next = clone(state()); next.goals = next.goals.filter(g => g.id !== b.dataset.id); closeModal(); commit(next, 'Meta excluída. Use Desfazer para restaurar.'); },
   'move-up': b => move(b.dataset.id, -1), 'move-down': b => move(b.dataset.id, 1),
   undo: () => { store.undo(); closeModal(); render(); savedToast('Última alteração desfeita.'); },
   export: () => { download(JSON.stringify(state(), null, 2), `tacet-backup-${new Date().toISOString().slice(0, 10)}.json`); toast('Backup exportado.'); },
   recovery: () => { const raw = store.storage?.getItem(`${STORAGE_KEY}:recovery`); if (!raw) throw Error('Nenhuma cópia de recuperação encontrada.'); download(raw, 'tacet-recuperacao.json'); },
   import: importDialog,
   'validate-import': () => { pendingImport = parseBackup(document.querySelector('#backup-text').value, db); document.querySelector('#form-error').textContent = ''; document.querySelector('#import-preview').innerHTML = `<h3>Backup válido</h3><p>${pendingImport.goals.length} metas, ${Object.keys(pendingImport.inventory).length} materiais e ${pendingImport.events.length} eventos.</p><p><b>Mesclar:</b> mantém metas, eventos e configurações atuais; adiciona itens novos e usa o maior estoque por material. Não soma duas cópias do mesmo estoque.</p><p><b>Substituir:</b> usa integralmente o backup validado. A operação pode ser desfeita.</p><div class="button-group">${button('Mesclar backup', 'merge-import', '', 'primary')}${button('Substituir pelo backup', 'replace-import')}</div>`; },
   'merge-import': () => { if (!pendingImport) throw Error('Valide o backup primeiro.'); const next = mergeState(state(), pendingImport, db); closeModal(); commit(next, 'Backup mesclado sem duplicar o estoque.'); },
   'replace-import': () => { if (!pendingImport) throw Error('Valide o backup primeiro.'); const next = pendingImport; closeModal(); commit(next, 'Backup importado.'); },
   source: b => { const m = materialMeta(b.dataset.id, db); openModal(modalHeader(m.name) + `<div class="modal-content"><h3>Onde obter</h3><p>${h(m.origin)}</p><p>${db.rules.activities[m.activity]?.waveplates || 0} Waveplates por resgate da atividade. As estimativas usam médias de dificuldade máxima.</p></div>`); },
   synthesize: b => { const recipe = db.recipes.find(r => r.id === b.dataset.id), count = Number(b.dataset.count); confirmDialog('Confirmar síntese', `<p>Registre após sintetizar no jogo:</p><ul>${Object.entries(recipe.inputs).map(([id, n]) => `<li>Consumir ${fmt(n * count)} ${h(materialMeta(id, db).name)}</li>`).join('')}${Object.entries(recipe.outputs).map(([id, n]) => `<li>Receber ${fmt(n * count)} ${h(materialMeta(id, db).name)}</li>`).join('')}</ul><p>Somente recursos livres. </p>`, 'synthesis', `data-id="${recipe.id}" data-count="${count}"`); },
   'confirm-synthesis': b => { const next = applySynthesis(state(), b.dataset.id, Number(b.dataset.count), db); closeModal(); commit(next, 'Síntese registrada; metas recalculadas.'); },
   'view-event': b => { const event = publishedEvents().find(e => e.id === b.dataset.id); if (!event) throw Error('Evento indisponível.'); openModal(modalHeader(event.title) + `<div class="modal-content">${eventCard(event)}</div><footer class="modal-footer">${button('Fechar', 'close')}</footer>`); },
   'event-list': () => { eventView = 'list'; render(); }, 'event-calendar': () => { if (eventView !== 'calendar') currentCalendarMonth(); eventView = 'calendar'; render(); },
   'prev-month': () => { eventMonth = new Date(eventMonth.getFullYear(), eventMonth.getMonth() - 1, 1); render(); }, 'next-month': () => { eventMonth = new Date(eventMonth.getFullYear(), eventMonth.getMonth() + 1, 1); render(); }
};
function move(goalId, delta) { const next = clone(state()), index = next.goals.findIndex(g => g.id === goalId); if (index + delta < 0 || index + delta >= next.goals.length) return;[next.goals[index], next.goals[index + delta]] = [next.goals[index + delta], next.goals[index]]; commit(next, 'Prioridade atualizada. Estoque redistribuído.'); }
document.addEventListener('error', e => { if (e.target instanceof HTMLImageElement) e.target.hidden = true; }, true);
const writingActions = new Set(['auto-synthesis', 'save-goal-stock', 'finish-goal', 'reopen', 'confirm-remove', 'move-up', 'move-down', 'undo', 'merge-import', 'replace-import', 'confirm-synthesis']);
document.addEventListener('click', e => { const b = e.target.closest('[data-action]'); if (!b) return; const action = () => actions[b.dataset.action]?.(b); Promise.resolve().then(() => writingActions.has(b.dataset.action) ? locked(action) : action()).catch(error => { showConflict(); const el = modal.open && modal.querySelector('#form-error'); if (el) el.textContent = error.message; else toast(error.message); }); });
document.addEventListener('input', e => {
   const el = e.target; if (el.closest('#settings-form')) { settingsDraft = Object.fromEntries(new FormData(el.form)); return; } if (el.closest('#goal-form')) { if (!el.dataset.goalStock) updateGoalPreview(); return; }
   if (el.id === 'backup-text') { pendingImport = null; const preview = document.querySelector('#import-preview'); if (preview) preview.innerHTML = ''; }
   if (el.id === 'picker-search') { const query = el.value.trim().toLowerCase(); let count = 0; modal.querySelectorAll('.picker-character').forEach(button => { button.hidden = !(button.textContent.toLowerCase() + ' ' + button.dataset.search).includes(query); if (!button.hidden) count++; }); modal.querySelector('#picker-empty').hidden = count > 0; return; }
   if (el.dataset.filter === 'search') { search = el.value; scheduleSearchRender(); return; }

});
document.addEventListener('change', e => {
   const el = e.target;
   if (el.dataset.stock) {
      const n = el.valueAsNumber; if (el.value === '') { el.setCustomValidity('Informe uma quantidade.'); return; } if (!integer(n)) { el.setCustomValidity('Informe um número inteiro entre 0 e 1 bilhão.'); el.reportValidity(); return; }
      el.setCustomValidity(''); locked(() => { if ((state().inventory[el.dataset.stock] || 0) === n) return; const hadSaveError = Boolean(store.saveError), next = clone(state()); next.inventory[el.dataset.stock] = n; store.commit(next); if (store.saveError) { savedToast('Estoque atualizado.'); const status = document.querySelector('.local-status'); if (status) status.textContent = 'Falha ao salvar · exporte um backup'; } else { if (hadSaveError) document.querySelector('#main [data-persistence-notice]')?.remove(); const status = document.querySelector('.local-status'); if (status) status.textContent = 'Salvo neste dispositivo'; } plan = allocate(state().goals, state().inventory, db); document.querySelectorAll('[data-stock]').forEach(input => { const caption = input.closest('.inventory-card')?.querySelector('.inventory-info small'); if (caption) { const row = plan.itemTotals.find(r => r.id === input.dataset.stock), reserved = (state().inventory[input.dataset.stock] || 0) - (plan.unallocated[input.dataset.stock] || 0); caption.textContent = fmt(reserved) + ' reservado' + (row?.missing ? ' · faltam ' + fmt(row.missing) : ''); } }); }).catch(error => { showConflict(); toast(error.message); });
      return;
   }
   if (el.name === 'weapon-id') { const w = db.catalog.weapons.find(x => x.id === el.value), saved = editingGoal.weapon?.id === el.value ? editingGoal.weapon : null; document.querySelector('#weapon-progress').innerHTML = progressFields('weapon-current', saved?.current || { level: 1, ascension: 0, xp: 0 }, 'Arma atual', w) + progressFields('weapon-target', saved?.target || { level: 20, ascension: 0, xp: 0 }, 'Meta da arma', w); updateGoalPreview(); }
   if (el.closest('#settings-form')) { settingsDraft = Object.fromEntries(new FormData(el.form)); return; }
   if (el.dataset.filter) { if (el.dataset.filter === 'element') element = el.value; if (el.dataset.filter === 'weapon') weaponFilter = el.value; if (el.dataset.filter === 'category') category = el.value; if (el.dataset.filter === 'used') usedOnly = el.checked; render(true); }
   if (el.dataset.officialEvent) locked(() => commit(setEventCompleted(state(), db.events, el.dataset.officialEvent, el.checked, Date.now(), db.rules), el.checked ? 'Evento marcado como concluído.' : 'Conclusão desmarcada.')).catch(error => { showConflict(); toast(error.message); });
   if (el.id === 'backup-file') { const file = el.files[0]; if (!file) return; Promise.resolve().then(async () => { if (file.size > 2000000) throw Error('Limite de 2 MB por backup.'); document.querySelector('#backup-text').value = await file.text(); pendingImport = null; document.querySelector('#import-preview').innerHTML = ''; }).catch(error => toast(error.message)); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-goal-stock]')) { e.preventDefault(); document.querySelector('[data-action=save-goal-stock]').click(); } });
document.addEventListener('submit', e => {
   e.preventDefault(); const form = e.target, fd = new FormData(form); locked(() => {
      if (form.id === 'goal-form') { const goal = readGoal(); validateGoal(goal, db); const next = clone(state()), index = next.goals.findIndex(g => g.id === goal.id); if (index >= 0) next.goals[index] = goal; else next.goals.push(goal); store.commit(next); closeModal(); render(); savedToast('Meta salva. Materiais recalculados.'); }
      if (form.id === 'completion-form') { const consumption = {}, refunds = {}; for (const [key, value] of fd) { if (key.startsWith('actual-')) consumption[key.slice(7)] = Number(value); if (key.startsWith('refund-')) refunds[key.slice(7)] = Number(value); } const next = completeGoal(state(), form.dataset.id, db, { characterXp: Number(fd.get('characterXp')), weaponXp: Number(fd.get('weaponXp')), consumption, refunds }); closeModal(); commit(next, 'Evolução registrada. Você pode desfazer.'); }
      if (form.id === 'settings-form') { const next = clone(state()), changed = next.settings.unionLevel !== Number(fd.get('unionLevel')); next.settings = { ...next.settings, server: fd.get('server'), timeZone: fd.get('timeZone'), unionLevel: Number(fd.get('unionLevel')), dailyWaveplates: Number(fd.get('dailyWaveplates')), weeklyClaimsUsed: Number(fd.get('weeklyClaimsUsed')), weeklyPeriod: new Date(nextReset(Date.now(), db.rules.servers[fd.get('server')], true, db.rules)).toISOString(), yields: changed ? {} : next.settings.yields }; store.commit(next); settingsDraft = null; render(); savedToast('Configurações salvas.'); }

   }).catch(error => { showConflict(); const el = form.querySelector('#form-error'); if (el) el.textContent = error.message; else toast(error.message); });
});
window.addEventListener('hashchange', () => { plannerRequest++; closeStockEditor(); route = nav.some(([key]) => key === location.hash.slice(1)) ? location.hash.slice(1) : 'summary'; search = ''; element = ''; weaponFilter = ''; category = ''; usedOnly = false; render(); window.scrollTo(0, 0); });
window.addEventListener('storage', e => { if (!store) return; store.observeStorage(e); showConflict(); });
modal.addEventListener('click', e => { if (e.target === modal) { const r = modal.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal(); } });
function refreshWeekly() { const next = new Date(nextReset(Date.now(), db.rules.servers[state().settings.server], true, db.rules)).toISOString(); if (state().settings.weeklyPeriod !== next) { store.assertWritable(); const updated = clone(state()); updated.settings.weeklyClaimsUsed = 0; updated.settings.weeklyPeriod = next; store.state = updated; store.persist(); } }
// Track only temporal boundaries that can change the rendered structure.
function temporalKey(now = Date.now()) {
   const cfg = state().settings, offset = db.rules.servers[cfg.server];
   return JSON.stringify([nextReset(now, offset, false, db.rules), cfg.weeklyPeriod,
   route === 'events' && eventView === 'calendar' ? dayKey(now, cfg.timeZone) : null,
   officialEvents(db.events, cfg.server, now, db.rules).map(e => [e.id, eventStatus(e, now),
   e.type === 'recurring' && eventStatus(e, now) === 'Ativo' ? eventCycle(e, now, { server: cfg.server, rules: db.rules }).start : null,
   isEventCompleted(state(), e, now, db.rules)])]);
}
function updateCountdowns(now = Date.now()) {
   const cfg = state().settings, reset = new Date(nextReset(now, db.rules.servers[cfg.server], false, db.rules)).toISOString();
   document.querySelectorAll('[data-reset-countdown]').forEach(el => { el.textContent = countdown(reset, now) + ' · ' + cfg.server; });
   document.querySelectorAll('[data-event-countdown]').forEach(el => {
      const event = db.events.events.find(e => e.id === el.dataset.eventCountdown);
      if (event) el.textContent = eventTimeLabel(event, now);
   });
}
function temporalTick() {
   return locked(() => {
      if (store.conflicted) { showConflict(); return; }
      refreshWeekly();
      const now = Date.now(), changed = temporalKey(now) !== renderedTimeKey;
      // Defer structural changes while editing; the unchanged key keeps them pending.
      if (changed && !modal.open && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) render();
      else updateCountdowns(now);
   }).catch(error => { showConflict(); toast(error.message); });
}
async function boot() {
   try {
      const names = ['catalog', 'rules', 'recipes', 'events', 'character-art'], loaded = await Promise.all(names.map(async name => { const response = await fetch(`./data/${name}.json`); if (!response.ok) throw Error('Não foi possível carregar ' + name); return response.json(); })); db = Object.fromEntries(names.map((name, i) => [name, loaded[i]])); db.events = validateEventCatalog(db.events); for (const c of db.catalog.characters) c.imageHighRes = db['character-art']?.[c.id]?.card;
      await locked(() => { const storage = getStorage(window), loadedState = loadState(storage, db); loadWarning = loadedState.warning || ''; store = new Store(loadedState.state, db, storage); refreshWeekly(); if (loadWarning) store.saveError = loadWarning; }); route = nav.some(([key]) => key === location.hash.slice(1)) ? location.hash.slice(1) : 'summary'; render(); if (loadWarning) toast(loadWarning);
      registerPlannerTools({ characters: db.catalog.characters, readPlan: () => ({ goals: state().goals.map(g => ({ id: g.id, character: g.charId, currentLevel: g.current.level, targetLevel: g.target.level, done: g.done })), materials: allocate(state().goals, state().inventory, db).totals }), startGoal: async characterId => { if (!db.catalog.characters.some(c => c.id === characterId)) throw Error('Personagem fora do catálogo.'); const opened = await goalForm(state().goals.find(g => g.charId === characterId) || newGoal(characterId, id())); return { opened, characterId, saved: false }; } });
      setInterval(temporalTick, 60000);
   } catch (error) { app.innerHTML = `<main class="boot-error"><h1>O terminal não carregou.</h1><p>${h(error.message)}</p><p>Abra a aplicação pelo servidor local; arquivos ES Modules não funcionam diretamente via file://.</p><button onclick="location.reload()">Tentar novamente</button></main>`; }
}

window.addEventListener('resize', positionStockEditor);
document.addEventListener('scroll', e => { if (e.target.matches?.('.planner-content')) closeStockEditor(); }, true);
document.addEventListener('click', e => { if (e.target.closest('[data-planner-tab]')) closeStockEditor(); });
document.addEventListener('toggle', e => { if (e.target.id === 'goal-stock-editor' && e.newState === 'closed') e.target.innerHTML = ''; }, true);

boot();

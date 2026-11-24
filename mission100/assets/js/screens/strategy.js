import { kpis, rules, experiments, saveIn, removeIn, products, product, db, propose, settings, learnings, adCostPerOrder } from '../state.js';
import { card, table, badge, icon, toast, busy, $, $$, esc, num, won, pct, areaChart, legend, modal, field, inp, sel, md, addDays, today } from '../ui.js';
import { chanceToReach, unitProfit } from '../calc.js';
import { claudeJSON } from '../api.js';
import { runTool } from '../agent.js';

const DEFAULT = [
  { name: 'Stay the course', levers: 'No change', mult: 1, extra: 0, cost: 0 },
  { name: 'Win the Item Winner', levers: 'Price −₩1,000 on the main product', mult: 1.25, extra: 0, cost: 7000 },
  { name: 'Add a second product', levers: 'Best Discovery candidate + long-tail ads', mult: 1, extra: 1.2, cost: 15000 },
  { name: 'Coupon + content push', levers: '₩1,000 coupon, new thumbnail, 3 posts/week', mult: 1.2, extra: 0.2, cost: 12000 },
  { name: 'Combined: price + new product', levers: 'Item Winner price and a second product', mult: 1.25, extra: 1.2, cost: 22000 },
];

export default {
  async render(root) {
    const k = kpis(), R = rules();
    const strategies = db.get('strategies', DEFAULT);
    const ps = products();
    const avgUnit = ps.length ? ps.reduce((s, p) => s + unitProfit(p), 0) / ps.length : 0;
    const cpo = adCostPerOrder();
    const rows = strategies.map((s) => {
      const rate = k.pace7 * s.mult + s.extra;
      const total = k.totalOrders + rate * k.daysLeft;
      return { ...s, rate, total, chance: chanceToReach(rate, k.daysLeft, k.need), profit: (avgUnit - cpo) * rate * k.daysLeft - s.cost };
    });
    const best = rows.slice().sort((a, b) => (b.chance - a.chance) || (b.profit - a.profit))[0];
    // path chart
    const days = []; for (let d = R.start; d <= R.deadline; d = addDays(d, 1)) days.push(d);
    let cum = 0; const byDay = Object.fromEntries(k.all.map((d) => [d.date, d.orders]));
    const actual = days.map((d) => (d <= today() ? (cum += byDay[d] || 0) : null));
    const ti = days.indexOf(today()), base = actual[ti] ?? k.totalOrders;
    const proj = (rate) => days.map((d, i) => (i < ti ? null : base + rate * (i - ti)));
    const exps = experiments();

    root.innerHTML = `
    ${card('Strategy options', `Need ${num(k.need)} more orders in ${k.daysLeft} days (${k.requiredPace.toFixed(1)}/day). Current pace ${k.pace7.toFixed(1)}/day. Chance = 1,000 simulated runs.`, table([
      { label: 'Strategy', fmt: (s) => `<b>${esc(s.name)}</b>${s === best ? ' ' + badge('recommended', 'teal') : ''}<div class="sub">${esc(s.levers)}</div>` },
      { label: 'Orders / day', align: 'r', fmt: (s) => num(s.rate, 1) }, { label: 'Expected total', align: 'r', fmt: (s) => num(s.total) },
      { label: 'Profit to deadline', align: 'r', fmt: (s) => `<span class="${s.profit >= 0 ? 'up' : 'down'}">${won(s.profit)}</span>` },
      { label: `Chance of ${R.goal}`, align: 'r', fmt: (s) => `<b style="font-size:15px" class="${s.chance >= 0.7 ? 'up' : s.chance < 0.3 ? 'down' : ''}">${pct(s.chance, 0)}</b>` },
      { label: '', align: 'r', fmt: (s, i) => `<button class="btn sm" data-pick="${i}">Choose</button> <button class="btn sm ghost" data-ed="${i}">${icon('edit', 11)}</button>` },
    ], rows, { hl: (s) => s === best }), { actions: `<div class="row"><button class="btn ghost sm" id="addS">${icon('plus', 12)} Add</button><button class="btn sm" id="ai">${icon('bot', 12)} Ask the agent</button></div>`, cls: 'mb' })}
    <div class="grid g32 mt">
      ${card(`Path to ${R.goal} orders`, 'Cumulative orders: actual, current pace and the recommended strategy', areaChart([
        { name: 'Actual', color: '#4FD1C5', values: actual },
        { name: 'Current pace', color: '#A0AEC0', values: proj(k.pace7), area: false, dash: '6 4', width: 2 },
        { name: best?.name || 'Recommended', color: '#2D3748', values: proj(best?.rate || 0), area: false, width: 2.5 },
      ], days, { h: 280, xfmt: md, fmt: (v) => Math.round(v), hline: { v: R.goal, label: `goal ${R.goal}`, color: '#F56565' } }), { actions: legend([['#4FD1C5', 'Actual'], ['#A0AEC0', 'Current pace'], ['#2D3748', 'Recommended']]) })}
      ${card('What we learned', 'Used by the agent in every plan', `<div class="stack">${learnings().map((l) => `<div class="row" style="flex-wrap:nowrap;align-items:flex-start"><span class="ibox sm">${icon('check', 13, 3)}</span><div style="font-size:13px">${esc(l.text)}<div class="sub">${md(l.at)}</div></div></div>`).join('') || '<div class="empty">No lessons yet</div>'}</div>`)}
    </div>
    ${card('Experiment log', 'Hypothesis → Action → Before → After → Effect → Learning (W3.5). One main change per product per week.', table([
      { label: 'Start', fmt: (e) => md(e.start) }, { label: 'Product', fmt: (e) => esc(product(e.productId)?.name?.slice(0, 14) || '–') },
      { label: 'Hypothesis', fmt: (e) => `<b>${esc(e.hypothesis)}</b><div class="sub">${esc(e.action || '')}</div>` },
      { label: 'Metric', k: 'metric' }, { label: 'Before', align: 'r', k: 'before' }, { label: 'After', align: 'r', k: 'after' },
      { label: 'Effect', align: 'r', fmt: (e) => `<b>${esc(e.effect || '')}</b>` }, { label: 'Learning', fmt: (e) => `<span class="sub">${esc(e.learning || '')}</span>` },
      { label: 'Status', fmt: (e) => badge(e.status, e.status === 'done' ? 'green' : 'orange') },
      { label: '', align: 'r', fmt: (e) => `<button class="btn sm ghost" data-ex="${e.id}">${icon('edit', 11)}</button>` },
    ], exps, { emptyText: 'No experiments yet' }), { actions: `<button class="btn sm" id="addE">${icon('plus', 12, 3)} New experiment</button>`, cls: 'mt' })}`;

    const save = (list) => db.set('strategies', list);
    $$('[data-pick]', root).forEach((b) => b.addEventListener('click', () => {
      const s = rows[+b.dataset.pick];
      propose({ kind: 'strategy', title: `Strategy: ${s.name}`, detail: `${s.levers}. ${s.rate.toFixed(1)} orders/day, ${pct(s.chance, 0)} chance of ${R.goal}.`, payload: { name: s.name, hypothesis: `${s.levers} raises orders to ${s.rate.toFixed(1)}/day` }, expectedProfit: Math.round(s.profit / Math.max(1, k.daysLeft / 7)) });
      toast('Sent for approval. Approving logs it as an experiment.', 'ok');
    }));
    $$('[data-ed]', root).forEach((b) => b.addEventListener('click', async () => { const i = +b.dataset.ed; const v = await editStrategy(strategies[i], true); if (v === 'del') { strategies.splice(i, 1); save(strategies); } else if (v) { strategies[i] = v; save(strategies); } this.render(root); }));
    $('#addS').onclick = async () => { const v = await editStrategy({ name: '', levers: '', mult: 1, extra: 0, cost: 0 }); if (v && v !== 'del') { strategies.push(v); save(strategies); this.render(root); } };
    $('#ai').onclick = (e) => busy(e.currentTarget, async () => {
      const ctx = { overview: await runTool('get_overview'), products: await runTool('list_products'), experiments: await runTool('list_experiments') };
      const out = await claudeJSON({ model: settings().models.orchestrator, max_tokens: 4000, prompt: `Propose 3 new sales strategies for our Coupang dropshipping project. Combine levers: price, coupon, bundle, new product, keyword set, content push. For each, estimate a multiplier on current daily orders and extra orders/day from new products, and a cost in KRW until the deadline. Be realistic and use this data:\n${JSON.stringify(ctx).slice(0, 12000)}`,
        schema: { type: 'object', properties: { strategies: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, levers: { type: 'string' }, mult: { type: 'number' }, extra: { type: 'number' }, cost: { type: 'number' } }, required: ['name', 'levers', 'mult', 'extra', 'cost'] } } }, required: ['strategies'] } });
      save([...strategies, ...out.strategies.map((s) => ({ ...s, ai: true }))]); this.render(root);
    });
    const exEdit = async (e) => {
      const v = await modal(e.id ? 'Edit experiment' : 'New experiment', `<div class="stack">${field('Product', sel('x_p', [['', '–'], ...ps.map((p) => [p.id, p.name])], e.productId || ''))}
        ${['hypothesis', 'action', 'metric', 'before', 'after', 'effect', 'learning'].map((f) => field(f[0].toUpperCase() + f.slice(1), inp('x_' + f, e[f] || ''))).join('')}
        <div class="fgrid">${field('Start', inp('x_start', e.start || today(), 'type="date"'))}${field('Status', sel('x_status', ['running', 'done'], e.status || 'running'))}</div>
        <label class="switch"><input type="checkbox" id="x_learn"><i></i>Also save the learning to agent memory</label></div>`,
      [...(e.id ? [{ label: 'Delete', value: 'del', cls: 'red' }] : []), { label: 'Cancel', value: null, cls: 'ghost' }, { label: 'Save', value: (bg) => { const g = (f) => bg.querySelector('#x_' + f); const o = { id: e.id, productId: g('p').value, start: g('start').value, status: g('status').value, _learn: g('learn').checked }; ['hypothesis', 'action', 'metric', 'before', 'after', 'effect', 'learning'].forEach((f) => (o[f] = g(f).value)); if (o.status === 'done' && !e.end) o.end = today(); return o; } }]);
      if (v === 'del') removeIn('experiments', e.id);
      else if (v) { const { _learn, ...o } = v; if (!o.id) delete o.id; saveIn('experiments', o, 'e'); if (_learn && o.learning) saveIn('learnings', { text: o.learning, at: today() }, 'l'); }
      this.render(root);
    };
    $('#addE').onclick = () => exEdit({});
    $$('[data-ex]', root).forEach((b) => b.addEventListener('click', () => exEdit(exps.find((x) => x.id === b.dataset.ex))));
  },
};

function editStrategy(s, canDelete = false) {
  return modal(s.name ? 'Edit strategy' : 'Add strategy', `<div class="stack">${field('Name', inp('s_n', s.name))}${field('Levers', inp('s_l', s.levers))}
    <div class="fgrid">${field('× daily orders', inp('s_m', s.mult, 'type="number" step="0.05"'))}${field('+ orders/day', inp('s_e', s.extra, 'type="number" step="0.1"'))}${field('Cost ₩', inp('s_c', s.cost, 'type="number"'))}</div></div>`,
  [...(canDelete ? [{ label: 'Delete', value: 'del', cls: 'red' }] : []), { label: 'Cancel', value: null, cls: 'ghost' }, { label: 'Save', value: (bg) => ({ name: bg.querySelector('#s_n').value, levers: bg.querySelector('#s_l').value, mult: +bg.querySelector('#s_m').value || 1, extra: +bg.querySelector('#s_e').value || 0, cost: +bg.querySelector('#s_c').value || 0 }) }]);
}

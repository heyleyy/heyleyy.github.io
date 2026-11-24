import { products, product, rules, weeklyOrders, adCostPerOrder, propose, saveProduct, db } from '../state.js';
import { card, table, won, pct, badge, icon, field, inp, toast, busy, $, $$, esc, num, areaChart, legend, stat, today } from '../ui.js';
import { optimizePrice, unitProfit, priceFloor } from '../calc.js';
import { naverShop } from '../api.js';
import { productPicker, needProducts } from '../widgets.js';

let pid = null;

export default {
  async render(root) {
    const ps = products(); if (!pid || !product(pid)) pid = ps[0]?.id;
    const p = product(pid);
    if (!p) { root.innerHTML = needProducts(); return; }
    const R = rules();
    const comp = db.get('competitors:' + p.id, { items: [], at: null, query: p.keywords?.[0] || p.name });
    const q0 = +(db.get('pricing:q0:' + p.id) ?? Math.max(1, weeklyOrders(p.id)));
    const cpo = +(db.get('pricing:cpo:' + p.id) ?? Math.round(adCostPerOrder(p.id)));
    const iw = p.competitorMin || null;
    const o = optimizePrice(p, { q0, adCostPerOrder: cpo, iwPrice: iw });
    const days = p.lastPriceChange ? Math.round((new Date(today()) - new Date(p.lastPriceChange)) / 864e5) : null;
    const canChange = days == null || days >= R.minDaysBetweenPriceChanges;
    const bi = o.curve.indexOf(o.best), ci = o.curve.indexOf(o.current);
    const scen = [...new Set([o.floor, o.nextStep, o.best?.price, p.price, p.price + 500, p.price - 500].filter((x) => x && x >= o.curve[0].price && x <= o.curve.at(-1).price))].sort((a, b) => a - b)
      .map((price) => o.curve.find((c) => c.price === price)).filter(Boolean);
    const cps = comp.items.map((i) => +i.lprice).filter(Boolean).sort((a, b) => a - b);

    root.innerHTML = `
    <div class="row mb"><div style="width:320px">${productPicker('pp', pid)}</div><span class="sub">Demand model: constant elasticity ${R.elasticity}, Item Winner bonus +${R.iwBonus * 100}% (edit in Settings).</span></div>
    <div class="grid g4">
      ${stat('Current price', won(p.price), `${won(o.current.profit)}/wk`, true, 'tag')}
      ${stat('Best price', won(o.best?.price), o.best ? `${o.best.profit >= o.current.profit ? '+' : ''}${won(o.best.profit - o.current.profit)}/wk` : '', (o.best?.profit || 0) >= o.current.profit, 'trend')}
      ${stat('Price floor', won(o.floor), `min profit ${won(R.minProfit)}`, true, 'alert')}
      ${stat('Next allowed step', won(o.nextStep), canChange ? 'can change now' : `wait ${R.minDaysBetweenPriceChanges - days} day(s)`, canChange, 'refresh')}
    </div>
    <div class="grid g21">
      ${card('Profit by price', 'Expected weekly profit after the weekly ad spend, for every price in ₩100 steps', areaChart(
        [{ name: 'Weekly profit', color: '#4FD1C5', values: o.curve.map((c) => (c.ok ? c.profit : null)) }, { name: 'Below floor', color: '#F56565', values: o.curve.map((c) => (c.ok ? null : c.profit)), area: false, width: 2, dash: '5 4' }],
        o.curve.map((c) => c.price), { h: 300, fmt: (v) => '₩' + Math.round(v / 1000) + 'k', xfmt: (x) => (x / 1000).toFixed(1) + 'k', hline: { v: 0, label: 'break-even', color: '#A0AEC0' },
          marks: [...(o.best ? [{ i: bi, v: o.best.profit, color: '#319795', label: 'best ' + won(o.best.price) }] : []), { i: ci, v: o.current.profit, color: '#2D3748', label: 'now ' + won(p.price), dy: 16 }] }),
        { actions: legend([['#4FD1C5', 'Allowed'], ['#F56565', 'Below floor']]) })}
      ${card('Model inputs', 'Defaults come from your last 7 days; adjust to test', `<div class="stack">
        ${field('Orders per week at current price', inp('q0', q0, 'type="number" step="0.5"'), `Observed: ${weeklyOrders(p.id)}`)}
        ${field('Ad cost per order ₩', inp('cpo', cpo, 'type="number"'), `From keyword data: ${won(adCostPerOrder(p.id))} · weekly ad budget = this × orders`)}
        ${field('Cheapest identical listing ₩ (Item Winner)', inp('iw', iw || '', 'type="number"'), 'Leave empty if unknown')}
        <button class="btn ghost" id="apply">${icon('refresh', 12)} Recalculate</button>
        <button class="btn" id="prop" ${!canChange || o.nextStep === p.price ? 'disabled' : ''}>${icon('send', 12)} Propose ${won(o.nextStep)}</button>
        <p class="note">Rules: profit ≥ ${won(R.minProfit)} per order, change ≤ ${won(R.maxPriceStep)}, ${R.minDaysBetweenPriceChanges}+ days apart${days != null ? ` (last change ${days} days ago)` : ''}. With under 7 days of data, treat the result as an A/B test.</p>
      </div>`)}
    </div>
    <div class="grid g2">
      ${card('Price scenarios', '7-day forecast; prices below the floor cannot be approved', table([
        { label: 'Price', fmt: (c) => `<b>${won(c.price)}</b> ${c.price === p.price ? badge('now', 'dark') : ''}${c === o.best ? badge('best', 'teal') : ''}${c.price === o.floor ? badge('floor', 'orange') : ''}` },
        { label: 'Profit / unit', align: 'r', fmt: (c) => won(c.unit) }, { label: 'Orders / wk', align: 'r', fmt: (c) => num(c.orders, 1) },
        { label: 'Profit / wk', align: 'r', fmt: (c) => `<b class="${c.profit >= o.current.profit ? 'up' : 'down'}">${won(c.profit)}</b>` },
        { label: '', align: 'r', fmt: (c) => (c.ok ? '' : badge('blocked', 'red')) }], scen, { hl: (c) => c === o.best }))}
      ${card('Competitor prices', comp.at ? `${cps.length} listings for “${esc(comp.query)}” · Naver Shopping` : 'Fetch prices of similar listings', `
        <div class="row mb"><input class="in" id="cq" value="${esc(comp.query)}" style="flex:1"><button class="btn ghost" id="fetch">${icon('search', 12)} Fetch</button></div>
        ${cps.length ? `<div class="kv mb"><dt>Lowest</dt><dd>${won(cps[0])}</dd><dt>Median</dt><dd>${won(cps[Math.floor(cps.length / 2)])}</dd><dt>Our rank</dt><dd>${cps.filter((x) => x < p.price).length + 1} of ${cps.length + 1}</dd></div>
        <div class="scroll" style="max-height:220px">${table([{ label: 'Listing', fmt: (i) => esc(String(i.title).replace(/<[^>]+>/g, '').slice(0, 40)) }, { label: 'Mall', k: 'mallName' }, { label: 'Price', align: 'r', fmt: (i) => `<span class="${+i.lprice < p.price ? 'down' : ''}">${won(+i.lprice)}</span>` }, { label: '', align: 'r', fmt: (i, k) => `<button class="btn sm ghost" data-iw="${i.lprice}" title="Use as Item Winner threshold">IW</button>` }], comp.items.slice().sort((a, b) => a.lprice - b.lprice))}</div>
        <p class="note mt">Press <b>IW</b> on the listing that sells the identical item to set the Item Winner threshold.</p>` : '<div class="empty">No competitor data yet</div>'}`)}
    </div>`;

    $('#pp').onchange = (e) => { pid = e.target.value; this.render(root); };
    $('#apply').onclick = () => { db.set('pricing:q0:' + p.id, +$('#q0').value); db.set('pricing:cpo:' + p.id, +$('#cpo').value); saveProduct({ id: p.id, competitorMin: +$('#iw').value || null }); this.render(root); };
    $('#prop').onclick = () => {
      const next = o.curve.find((c) => c.price === o.nextStep);
      const a = propose({ kind: 'price_change', title: `Change ${p.name} to ${won(o.nextStep)}`, detail: `Model: ${won(o.current.profit)} → ${won(next?.profit)} profit a week. Floor ${won(o.floor)}.`, payload: { productId: p.id, oldPrice: p.price, newPrice: o.nextStep, before: Math.round(o.current.profit) }, expectedProfit: Math.round((next?.profit || 0) - o.current.profit) });
      toast('Added to the approval queue', 'ok');
    };
    $('#fetch').onclick = (e) => busy(e.currentTarget, async () => { const q = $('#cq').value.trim(); const j = await naverShop(q, 40); db.set('competitors:' + p.id, { items: j.items || [], at: new Date().toISOString(), query: q }); this.render(root); });
    $$('[data-iw]', root).forEach((b) => b.addEventListener('click', () => { saveProduct({ id: p.id, competitorMin: +b.dataset.iw }); toast('Item Winner threshold set to ' + won(+b.dataset.iw), 'ok'); this.render(root); }));
  },
};

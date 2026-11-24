import { rules, db, saveProduct, audit, settings } from '../state.js';
import { card, table, won, pct, badge, icon, field, inp, toast, busy, $, $$, esc, num, kfmt, today } from '../ui.js';
import { productScore, demandScore, compLevel, to900 } from '../calc.js';
import { supplierSearch, normalizeSupplierItems, naverKeywords, naverShop, naverTrend, claudeJSON } from '../api.js';

const vol = (v) => (typeof v === 'number' ? v : String(v).includes('<') ? 5 : Number(v) || 0);

export default {
  async render(root) {
    const st = db.get('discovery', { keywords: '', category: '', markets: ['dome', 'supply'], minMargin: rules().minMargin, results: [], at: null });
    const res = st.results || [];
    const top = res.find((r) => r.pass);
    root.innerHTML = `
    <div class="grid g12">
      ${card('Search settings', 'Leave keywords empty and press “Suggest” for rising seasonal keywords', `<div class="stack">
        ${field('Keywords (comma separated, up to 3)', inp('kw', st.keywords, 'placeholder="침대밑 수납함, 서랍 정리함"'))}
        ${field('도매꾹 category code (optional)', inp('ca', st.category, 'placeholder="e.g. 01_06_00_00_00"'))}
        <div class="field"><span>Suppliers</span><div class="chips">${[['dome', '도매꾹'], ['supply', '도매매']].map(([k, l]) => `<span class="chip ${st.markets.includes(k) ? 'on' : ''}" data-m="${k}">${l}</span>`).join('')}</div></div>
        ${field('Minimum margin after fees', inp('mm', st.minMargin, 'type="number" step="0.01"'), 'Hard filter. 0.25 = 25%')}
        <div class="row"><button class="btn" id="go">${icon('search', 12, 3)} Search & score</button><button class="btn ghost" id="sug">${icon('bot', 12)} Suggest keywords</button></div>
        <p class="note">Score = 30% demand + 30% margin + 15% low competition + 15% rising trend + 10% fast shipping. Hard filters: margin, stock ≥ ${rules().minStock}, shipping ≤ 2 days, KC/brand risk words.</p>
      </div>`)}
      ${card('Why #1?', top ? esc(top.title) : 'Run a search to see the evidence for the top pick', top ? whyTop(top) : '<div class="empty">No results yet</div>')}
    </div>
    ${card('Ranked candidates', st.at ? `${res.length} products · ${new Date(st.at).toLocaleString('ko-KR')}` : 'Supplier products scored with Naver demand, competition, trend and competitor prices', table([
      { label: '#', fmt: (r, i) => `<b>${i + 1}</b>` },
      { label: 'Product', fmt: (r) => `<div class="row" style="flex-wrap:nowrap">${r.thumb ? `<img class="thumb" src="${esc(r.thumb)}" loading="lazy">` : ''}<div><a href="${esc(r.url)}" target="_blank" rel="noopener"><b>${esc(r.title)}</b></a><div class="sub">${r.market === 'supply' ? '도매매' : '도매꾹'} ${esc(r.no)} · ${esc(r.keyword)}</div></div></div>` },
      { label: 'Supply + ship', align: 'r', fmt: (r) => won(r.supply + r.shipping) },
      { label: 'Suggested price', align: 'r', fmt: (r) => won(r.price) },
      { label: 'Margin', align: 'r', fmt: (r) => `<b class="${r.margin >= st.minMargin ? 'up' : 'down'}">${pct(r.margin)}</b>` },
      { label: 'Searches / mo', align: 'r', fmt: (r) => kfmt(r.volume) },
      { label: 'Competition', align: 'c', fmt: (r) => badge(r.comp || '?', r.comp === '높음' ? 'red' : r.comp === '중간' ? 'orange' : 'green') },
      { label: 'Stock', align: 'r', fmt: (r) => num(r.stock) },
      { label: 'Score', align: 'r', fmt: (r) => (r.pass ? `<b style="font-size:15px">${r.score}</b>` : `<span class="sub" title="${esc(r.fail)}">${badge('filtered', 'gray')}<br>${esc(r.fail)}</span>`) },
      { label: '', align: 'r', fmt: (r, i) => (r.pass ? `<button class="btn sm ghost" data-add="${i}">${icon('plus', 12, 3)} Add</button>` : '') },
    ], res, { hl: (r) => r === top, emptyText: 'No candidates yet' }), { cls: 'mt' })}`;

    $$('[data-m]', root).forEach((c) => c.addEventListener('click', () => { const m = c.dataset.m; st.markets = st.markets.includes(m) ? st.markets.filter((x) => x !== m) : [...st.markets, m]; db.set('discovery', st); this.render(root); }));
    $('#go').onclick = (e) => busy(e.currentTarget, async () => {
      st.keywords = $('#kw').value; st.category = $('#ca').value; st.minMargin = +$('#mm').value || 0.25;
      const kws = st.keywords.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3);
      if (!kws.length) throw new Error('Enter at least one keyword, or press Suggest');
      st.results = await search(kws, st); st.at = new Date().toISOString();
      db.set('discovery', st); audit('discovery', `Searched ${kws.join(', ')}: ${st.results.length} results`); this.render(root);
    });
    $('#sug').onclick = (e) => busy(e.currentTarget, async () => {
      const out = await claudeJSON({ model: settings().models.skill, prompt: `Today is ${today()}. Suggest 6 Korean long-tail shopping keywords for products that sell well on Coupang in the next 4 weeks (season, holidays, weather) and can be dropshipped from 도매꾹 (cheap, light, no KC certification, no brands). ${$('#kw').value ? 'Stay close to: ' + $('#kw').value : ''}`,
        schema: { type: 'object', properties: { keywords: { type: 'array', items: { type: 'object', properties: { keyword: { type: 'string' }, reason: { type: 'string' } }, required: ['keyword', 'reason'] } } }, required: ['keywords'] } });
      const ks = out.keywords.map((k) => k.keyword);
      // validate with the keyword tool
      let info = {};
      try { (await naverKeywords(ks.slice(0, 5))).keywordList.forEach((k) => (info[k.relKeyword] = vol(k.monthlyPcQcCnt) + vol(k.monthlyMobileQcCnt))); } catch {}
      $('#kw').value = ks.slice(0, 3).join(', ');
      toast(out.keywords.map((k) => `${k.keyword}${info[k.keyword.replace(/\s/g, '')] ? ' (' + kfmt(info[k.keyword.replace(/\s/g, '')]) + '/mo)' : ''}`).join(' · '), 'ok');
    });
    $$('[data-add]', root).forEach((b) => b.addEventListener('click', () => {
      const r = res[+b.dataset.add];
      saveProduct({ name: r.title, price: r.price, supply: r.supply, shipping: r.shipping, stock: r.stock, status: 'draft', keywords: [r.keyword.replace(/\s/g, '')], supplier: { market: r.market, no: r.no, url: r.url } });
      audit('product', 'Added from discovery: ' + r.title); toast('Added to Products & Costs as a draft', 'ok');
    }));
  },
};

async function search(kws, st) {
  const R = rules();
  // 1) supplier products
  const items = [];
  for (const kw of kws) for (const m of st.markets) {
    const j = await supplierSearch({ kw, ca: st.category, market: m, sz: 40 });
    normalizeSupplierItems(j, m).forEach((it) => items.push({ ...it, keyword: kw }));
  }
  // 2) demand and competition (Naver keyword tool)
  const kinfo = {};
  try { for (const k of (await naverKeywords(kws)).keywordList || []) kinfo[k.relKeyword] = { volume: vol(k.monthlyPcQcCnt) + vol(k.monthlyMobileQcCnt), comp: k.compIdx }; } catch (e) { toast('Keyword tool: ' + e.message, 'err'); }
  // 3) trend (DataLab): last 8 weeks vs previous 8
  const trend = {};
  try { for (const r of (await naverTrend(kws, 16)).results || []) { const d = r.data.map((x) => x.ratio); const a = avg(d.slice(-8)), b = avg(d.slice(0, 8)) || 1; trend[r.title] = Math.max(0, Math.min(1, 0.5 + (a / b - 1))); } } catch (e) { console.warn(e); }
  // 4) market price (Naver Shopping median)
  const price = {};
  for (const kw of kws) { try { const ps = ((await naverShop(kw)).items || []).map((i) => +i.lprice).filter(Boolean).sort((a, b) => a - b); price[kw] = ps[Math.floor(ps.length * 0.4)] || null; } catch (e) { console.warn(e); } }

  const risk = /(나이키|아디다스|디즈니|산리오|포켓몬|정품|명품|전기|충전|배터리|유아|아기|식품|건강|의료|화장품)/;
  return items.map((it) => {
    const ki = kinfo[it.keyword.replace(/\s/g, '')] || {};
    const cost = it.supply + it.shipping;
    const market = price[it.keyword];
    const sp = to900(market && market > cost * 1.3 ? market * 0.98 : (cost / (1 - R.feeRate)) / (1 - st.minMargin), !market);
    const unit = sp * (1 - R.feeRate) - cost, mg = sp ? unit / sp : 0;
    let fail = '';
    if (mg < st.minMargin) fail = `margin ${pct(mg, 0)}`;
    else if (it.stock < R.minStock) fail = `stock ${it.stock}`;
    else if (it.ship > 2) fail = `ships in ${it.ship} days`;
    else if (risk.test(it.title)) fail = 'KC / brand risk';
    const score = productScore({ demand: demandScore(ki.volume), margin: Math.min(1, mg / 0.4), competition: compLevel(ki.comp), trend: trend[it.keyword] ?? 0.5, fulfil: it.ship <= 1 ? 1 : 0.6 });
    return { ...it, price: sp, margin: mg, unit, volume: ki.volume || 0, comp: ki.comp || '', trend: trend[it.keyword] ?? null, marketPrice: market, score, pass: !fail, fail };
  }).sort((a, b) => (b.pass - a.pass) || b.score - a.score).slice(0, 60);
}
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

function whyTop(r) {
  return `<div class="grid g2" style="margin:0">
    <div class="kv"><dt>Score</dt><dd><b style="font-size:20px">${r.score}</b> / 100</dd><dt>Profit per unit</dt><dd class="up">${won(r.unit)}</dd><dt>Margin</dt><dd>${pct(r.margin)}</dd><dt>Suggested price</dt><dd>${won(r.price)}</dd></div>
    <div class="kv"><dt>Searches / month</dt><dd>${num(r.volume)}</dd><dt>Competition</dt><dd>${esc(r.comp || '?')}</dd><dt>Trend (8 wk)</dt><dd>${r.trend == null ? '–' : r.trend > 0.55 ? '<span class="up">rising</span>' : r.trend < 0.45 ? '<span class="down">falling</span>' : 'flat'}</dd><dt>Market price (40th pct)</dt><dd>${won(r.marketPrice)}</dd></div>
  </div>
  <div class="callout mt">Safety checks passed: margin ≥ minimum, stock ${num(r.stock)}, ships in ${r.ship} day(s), no KC or brand-risk words. Check the supplier page for images you are allowed to reuse.</div>`;
}

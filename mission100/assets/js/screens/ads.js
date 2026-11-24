import { products, product, adKeywords, adDaily, db, rules, propose, kpis, audit } from '../state.js';
import { card, table, won, pct, badge, icon, toast, $, $$, esc, num, stat, field, inp, parseCSV, readFile, toNum, modal, sel, today, addDays } from '../ui.js';
import { keywordVerdict, maxBid, breakEvenRoas, couponMath } from '../calc.js';
import { productPicker } from '../widgets.js';

let pid = '';
// Header guesses for Coupang Ads report exports (Korean). The import dialog lets you correct them.
const GUESS = { keyword: /키워드|keyword/i, date: /날짜|일자|date/i, impressions: /노출/i, clicks: /클릭수|clicks?$/i, spend: /광고비|집행|비용|spend|cost/i, orders: /주문수|판매수|전환수|orders?/i, revenue: /매출|전환.?금액|revenue|sales/i, product: /상품명|광고.?상품|product/i };

export default {
  async render(root) {
    const R = rules(), k = kpis();
    const ks = adKeywords().filter((x) => !pid || x.productId === pid);
    const sum = (f) => ks.reduce((s, x) => s + (x[f] || 0), 0);
    const spend = sum('spend'), clicks = sum('clicks'), ords = sum('orders'), rev = sum('revenue');
    const p = pid ? product(pid) : products()[0];
    const be = p ? breakEvenRoas(p) : null;
    const roas = spend ? rev / spend : null;
    const coupon = db.get('coupon', { discount: 1000, days: 7 });
    const cm = p ? couponMath(p, coupon.discount) : null;
    const weekSpend = Object.entries(adDaily()).filter(([d]) => d > addDays(today(), -7)).reduce((s, [, v]) => s + (v.spend || 0), 0);

    root.innerHTML = `
    <div class="row mb"><div style="width:320px">${productPicker('pp', pid, { all: true })}</div><span class="sub">${ks.length ? `Report imported ${db.get('adImportedAt') ? new Date(db.get('adImportedAt')).toLocaleString('ko-KR') : ''}` : 'Coupang Ads has no public API: export the keyword report as CSV and import it here.'}</span></div>
    <div class="grid g4">
      ${stat('Ad spend (report)', won(spend), `${won(weekSpend)} last 7 days`, weekSpend <= R.weeklyAdCap, 'wallet')}
      ${stat('Avg. cost per click', won(clicks ? spend / clicks : null), p ? `max bid ${won(maxBid(p))}` : '', !clicks || spend / clicks <= (p ? maxBid(p) : 1e9), 'bolt')}
      ${stat('Ad conversion rate', pct(clicks ? ords / clicks : null), 'benchmark 2–5%', clicks && ords / clicks >= 0.02, 'cart')}
      ${stat('ROAS', pct(roas, 0), be ? `break-even ${pct(be, 0)}` : '', roas != null && be != null && roas >= be, 'rocket')}
    </div>
    ${card('Keyword bids', 'Verdict rules: pause after ' + R.pauseClicks + ' clicks with 0 orders · lower bid below break-even ROAS · raise when ROAS ≥ 1.3× break-even · exclude keywords that do not match the product (W5)', table([
      { label: 'Keyword', fmt: (x) => `<b>${esc(x.keyword)}</b><div class="sub">${esc(product(x.productId)?.name || 'unassigned')}</div>` },
      { label: 'Bid', align: 'r', fmt: (x) => won(x.bid) }, { label: 'Impr.', align: 'r', fmt: (x) => num(x.impressions) }, { label: 'Clicks', align: 'r', fmt: (x) => num(x.clicks) },
      { label: 'CTR', align: 'r', fmt: (x) => pct(x.impressions ? x.clicks / x.impressions : null, 2) }, { label: 'Orders', align: 'r', fmt: (x) => num(x.orders) },
      { label: 'Spend', align: 'r', fmt: (x) => won(x.spend) }, { label: 'ROAS', align: 'r', fmt: (x) => pct(x.spend ? x.revenue / x.spend : null, 0) },
      { label: 'Verdict', fmt: (x) => { const v = keywordVerdict(x, product(x.productId)); return `${badge(x.status !== 'active' && x.status ? x.status : v.v, x.status !== 'active' && x.status ? 'gray' : v.color)}<div class="sub">${esc(v.why)}</div>`; } },
      { label: '', align: 'r', fmt: (x, i) => { const v = keywordVerdict(x, product(x.productId)); return v.v !== 'keep' && (x.status === 'active' || !x.status) ? `<button class="btn sm ghost" data-kw="${i}">Propose</button>` : ''; } },
    ], ks, { hl: (x) => keywordVerdict(x, product(x.productId)).v === 'pause', emptyText: 'Import a Coupang Ads keyword report (CSV)' }),
      { actions: `<label class="btn sm">${icon('upload', 12)} Import report CSV<input type="file" id="csv" accept=".csv,text/csv" hidden></label>`, cls: 'mb' })}
    <div class="grid g2 mt">
      ${card('Coupon', p ? `For ${esc(p.name)} · keep it only if conversion rises enough within 7 days` : 'Select a product', p ? `
        <div class="fgrid">${field('Discount ₩', inp('cd', coupon.discount, 'type="number" step="100"'))}${field('Days', inp('cdays', coupon.days, 'type="number"'))}</div>
        <div class="kv mt"><dt>Profit per order now</dt><dd>${won(cm.u0)}</dd><dt>Profit per order with coupon</dt><dd class="${cm.ok ? 'up' : 'down'}">${won(cm.u1)}</dd><dt>Conversion lift needed to break even</dt><dd><b>${isFinite(cm.liftNeeded) ? '+' + pct(cm.liftNeeded, 0) : 'never'}</b></dd></div>
        ${cm.ok ? '' : `<div class="callout err mt">Profit per order would fall below ${won(R.minProfit)}. Use a smaller discount.</div>`}
        <div class="row mt"><button class="btn ghost" id="calc">Recalculate</button><button class="btn" id="cprop" ${cm.ok ? '' : 'disabled'}>${icon('send', 12)} Propose coupon</button></div>` : '')}
      ${card('Safety limits', 'From Settings → Business rules', `<div class="kv">
        <dt>Weekly ad cap</dt><dd>${won(R.weeklyAdCap)} <span class="sub">(${pct(weekSpend / R.weeklyAdCap, 0)} used)</span></dd>
        <dt>Daily ad cap</dt><dd>${won(R.dailyAdCap)}</dd><dt>Ad wallet (${pct(R.reinvestShare, 0)} of profit after ads)</dt><dd>${won(k.wallet)}</dd>
        <dt>Automatic pause</dt><dd>${R.pauseClicks} clicks, 0 orders</dd>
        ${products().map((x) => `<dt>Max bid · ${esc(x.name.slice(0, 18))}</dt><dd>${won(maxBid(x))} <span class="sub">(${won(Math.round(x.price * (1 - x.feeRate) - x.supply - x.shipping))} × ${pct(x.cvr, 1)})</span></dd>`).join('')}
      </div><div class="bar mt"><i style="width:${Math.min(100, (weekSpend / R.weeklyAdCap) * 100)}%;background:${weekSpend > R.weeklyAdCap ? 'var(--red)' : 'var(--teal)'}"></i></div>
      <p class="note mt">Budget split (W5): 50% manual long-tail keywords, 50% Coupang automatic campaign. The total never exceeds the ad wallet.</p>`)}
    </div>`;

    $('#pp').onchange = (e) => { pid = e.target.value; this.render(root); };
    $$('[data-kw]', root).forEach((b) => b.addEventListener('click', () => {
      const x = ks[+b.dataset.kw], pr = product(x.productId), v = keywordVerdict(x, pr);
      const bid = v.v === 'lower bid' || v.v === 'raise' ? Math.max(100, Math.round((pr ? maxBid(pr) : x.bid) / 10) * 10) : undefined;
      propose({ kind: 'keyword_change', title: `${v.v[0].toUpperCase() + v.v.slice(1)}: ${x.keyword}${bid ? ' → ' + won(bid) : ''}`, detail: v.why, payload: { productId: x.productId, keyword: x.keyword, verdict: v.v, bid }, expectedProfit: v.v === 'pause' || v.v === 'exclude' ? Math.round(x.spend / 2) : 0 });
      toast('Added to the approval queue', 'ok');
    }));
    $('#csv').onchange = async (e) => { const f = e.target.files[0]; if (f) await importReport(await readFile(f)); this.render(root); };
    if ($('#calc')) $('#calc').onclick = () => { db.set('coupon', { discount: +$('#cd').value, days: +$('#cdays').value }); this.render(root); };
    if ($('#cprop')) $('#cprop').onclick = () => { propose({ kind: 'coupon', title: `${won(coupon.discount)} coupon for ${p.name}`, detail: `Needs +${pct(cm.liftNeeded, 0)} conversion to pay back. ${coupon.days} days.`, payload: { productId: p.id, discount: coupon.discount, days: coupon.days, liftNeeded: cm.liftNeeded } }); toast('Added to the approval queue', 'ok'); };
  },
};

async function importReport(text) {
  const rows = parseCSV(text);
  if (!rows.length) return toast('Empty file', 'err');
  const heads = Object.keys(rows[0]);
  const map = Object.fromEntries(Object.entries(GUESS).map(([k, re]) => [k, heads.find((h) => re.test(h)) || '']));
  const ps = products();
  const m = await modal('Match the report columns', `<p class="note mb">${rows.length} rows. Check that each field points at the right column.</p><div class="fgrid">${Object.keys(GUESS).map((k) => field(k, sel('c_' + k, [['', '— none —'], ...heads], map[k]))).join('')}</div>
    ${field('Assign rows without a product to', sel('c_pid', [['', 'Leave unassigned'], ...ps.map((p) => [p.id, p.name])], ps[0]?.id || ''))}`,
  [{ label: 'Cancel', value: null, cls: 'ghost' }, { label: 'Import', value: (bg) => Object.fromEntries([...Object.keys(GUESS), 'pid'].map((k) => [k, bg.querySelector('#c_' + k).value])) }]);
  if (!m || !m.keyword) return m && toast('A keyword column is required', 'err');
  const byKw = {}, byDay = {};
  for (const r of rows) {
    const kw = (r[m.keyword] || '').trim(); if (!kw || /합계|total/i.test(kw)) continue;
    const pname = m.product ? r[m.product] : '';
    const prod = ps.find((p) => pname && (pname.includes(p.name) || p.name.includes(pname))) || ps.find((p) => p.id === m.pid);
    const key = kw + '|' + (prod?.id || '');
    const x = (byKw[key] ||= { keyword: kw, productId: prod?.id || '', bid: 0, impressions: 0, clicks: 0, spend: 0, orders: 0, revenue: 0, status: 'active' });
    const v = { impressions: toNum(r[m.impressions]), clicks: toNum(r[m.clicks]), spend: toNum(r[m.spend]), orders: toNum(r[m.orders]), revenue: toNum(r[m.revenue]) };
    for (const f in v) x[f] += v[f];
    x.bid = x.clicks ? Math.round(x.spend / x.clicks) : x.bid;
    if (m.date && r[m.date]) { const d = r[m.date].replace(/[./]/g, '-').slice(0, 10); const dd = (byDay[d] ||= { impressions: 0, clicks: 0, spend: 0, orders: 0, revenue: 0 }); for (const f in v) dd[f] += v[f]; }
  }
  const old = adKeywords();
  const merged = Object.values(byKw).map((x) => ({ ...x, status: old.find((o) => o.keyword === x.keyword && o.productId === x.productId)?.status || 'active' }));
  db.set('adKeywords', merged);
  if (Object.keys(byDay).length) db.set('adDaily', { ...adDaily(), ...byDay });
  db.set('adImportedAt', new Date().toISOString());
  audit('import', `Ads report: ${merged.length} keywords, ${Object.keys(byDay).length} days`);
  toast(`Imported ${merged.length} keywords${Object.keys(byDay).length ? ' and ' + Object.keys(byDay).length + ' days' : ''}`, 'ok');
}

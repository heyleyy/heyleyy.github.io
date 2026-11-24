import { products, saveProduct, deleteProduct, rules, weeklyOrders, audit, isLive, db } from '../state.js';
import { card, table, won, pct, badge, icon, field, inp, sel, modal, toast, busy, $, $$, esc, ago, stat, num } from '../ui.js';
import { unitProfit, breakEvenRoas, maxBid, priceFloor, margin } from '../calc.js';
import { coupang, supplierItem, normalizeSupplierItems } from '../api.js';
import { rerender } from '../app.js';

let selected = null;

export default {
  async render(root) {
    const ps = products(), R = rules();
    if (!selected || !ps.find((p) => p.id === selected)) selected = ps[0]?.id;
    const p = ps.find((x) => x.id === selected);
    const alerts = [];
    for (const x of ps) {
      if (x.stock != null && x.stock <= R.pauseStock) alerts.push(['red', 'alert', `${x.name}: supplier stock ${x.stock}`, 'Ads should be paused until restocked']);
      else if (x.stock != null && x.stock < R.minStock) alerts.push(['orange', 'alert', `${x.name}: low stock (${x.stock})`, 'Find a second supplier']);
      if (unitProfit(x) < R.minProfit) alerts.push(['red', 'wallet', `${x.name}: profit ${won(unitProfit(x))} below minimum`, `Minimum is ${won(R.minProfit)} per order`]);
      if (x.itemWinner === false) alerts.push(['orange', 'tag', `${x.name}: not the Item Winner`, 'Check the Price Optimizer']);
      if (x.supplyChanged) alerts.push(['orange', 'refresh', `${x.name}: supplier price changed to ${won(x.supplyChanged)}`, 'Update the cost and re-check the price']);
    }
    const avgMargin = ps.length ? ps.reduce((s, x) => s + margin(x), 0) / ps.length : null;

    root.innerHTML = `
    <div class="grid g4">
      ${stat('Live products', num(ps.filter((x) => x.status === 'live').length), '', true, 'box')}
      ${stat('Average margin', pct(avgMargin), '', true, 'chart')}
      ${stat('Orders this week', num(ps.reduce((s, x) => s + weeklyOrders(x.id), 0)), '', true, 'cart')}
      ${stat('Cost alerts', num(alerts.length), alerts.length ? 'check below' : '', !alerts.length, 'alert')}
    </div>
    ${card('Registered products', 'Profit per unit = price × (1 − fee) − supply − shipping. Break-even ROAS = price ÷ profit per unit.', table([
      { label: 'Product', fmt: (x) => `<a href="#" data-sel="${x.id}"><b>${esc(x.name)}</b></a><div class="sub">${x.supplier?.market === 'supply' ? '도매매' : '도매꾹'} ${esc(x.supplier?.no || '')} · read ${ago(x.lastRead)}</div>` },
      { label: 'Price', align: 'r', fmt: (x) => won(x.price) },
      { label: 'Profit / unit', align: 'r', fmt: (x) => `<b class="${unitProfit(x) >= R.minProfit ? 'up' : 'down'}">${won(unitProfit(x))}</b><div class="sub">${pct(margin(x))}</div>` },
      { label: 'Break-even ROAS', align: 'r', fmt: (x) => pct(breakEvenRoas(x), 0) },
      { label: 'Max bid', align: 'r', fmt: (x) => won(maxBid(x)) },
      { label: 'Floor', align: 'r', fmt: (x) => won(priceFloor(x)) },
      { label: 'Stock', align: 'r', fmt: (x) => (x.stock == null ? '–' : x.stock <= R.pauseStock ? badge(x.stock, 'red') : x.stock < R.minStock ? badge(x.stock, 'orange') : num(x.stock)) },
      { label: 'Item Winner', align: 'c', fmt: (x) => (x.itemWinner == null ? badge('?', 'gray') : x.itemWinner ? badge('Winner', 'green') : badge('Lost', 'red')) },
      { label: '', align: 'r', fmt: (x) => `<button class="btn sm ghost" data-edit="${x.id}">${icon('edit', 12)}</button>` },
    ], ps, { hl: (x) => x.id === selected, emptyText: 'No products yet. Add your first product or import from Coupang.' }),
      { actions: `<div class="row"><button class="btn ghost sm" id="imp">${icon('download', 12)} Import from Coupang</button><button class="btn ghost sm" id="stock">${icon('refresh', 12)} Refresh supplier stock</button><button class="btn sm" id="add">${icon('plus', 12, 3)} Add product</button></div>`, cls: 'mb' })}
    <div class="grid g2 mt">
      ${p ? card('Where the price goes', esc(p.name), breakdown(p)) : card('Where the price goes', '', '<div class="empty">Select a product</div>')}
      ${card('Cost alerts', 'Checked every morning and whenever data is refreshed', alerts.length ? alerts.map(([c, ic, t, s]) => `<div class="row" style="padding:9px 0;border-bottom:1px solid var(--line2)"><span class="ibox sm" style="background:var(--${c})">${icon(ic, 14)}</span><div><b style="font-size:13.5px">${esc(t)}</b><div class="sub">${s}</div></div></div>`).join('') : '<div class="empty"><b>All clear</b>No stock, cost or Item Winner problems.</div>')}
    </div>`;

    $$('[data-sel]', root).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); selected = a.dataset.sel; this.render(root); }));
    $$('[data-edit]', root).forEach((b) => b.addEventListener('click', () => editProduct(ps.find((x) => x.id === b.dataset.edit))));
    $('#add').onclick = () => editProduct({});
    $('#imp').onclick = (e) => busy(e.currentTarget, importFromCoupang);
    $('#stock').onclick = (e) => busy(e.currentTarget, refreshStock);
  },
};

function breakdown(p) {
  const fee = p.price * p.feeRate, u = unitProfit(p);
  const parts = [['Supply price', p.supply, '#2D3748'], ['Supplier shipping', p.shipping, '#718096'], [`Coupang fee ${(p.feeRate * 100).toFixed(1)}%`, fee, '#A0AEC0'], ['Profit', u, u >= 0 ? '#4FD1C5' : '#F56565']];
  return `<div style="display:flex;height:34px;border-radius:10px;overflow:hidden;margin-bottom:16px">${parts.map(([l, v, c]) => `<div title="${l}" style="width:${Math.max(0, (v / p.price) * 100)}%;background:${c}"></div>`).join('')}</div>
  ${parts.map(([l, v, c]) => `<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--line2)"><span class="row"><i style="width:12px;height:12px;border-radius:4px;background:${c};display:inline-block"></i>${l}</span><b>${won(v)} <span class="sub">${pct(v / p.price)}</span></b></div>`).join('')}
  <div class="row between mt"><span class="label">Selling price</span><b style="font-size:18px">${won(p.price)}</b></div>`;
}

async function editProduct(p) {
  const R = rules();
  const v = await modal(p.id ? 'Edit product' : 'Add product', `<div class="fgrid">
    ${field('Name (internal)', inp('f_name', p.name || ''))}${field('Selling price ₩', inp('f_price', p.price || '', 'type="number"'))}
    ${field('Supply price ₩', inp('f_supply', p.supply || '', 'type="number"'))}${field('Supplier shipping ₩', inp('f_ship', p.shipping ?? 3000, 'type="number"'))}
    ${field('Coupang fee rate', inp('f_fee', p.feeRate ?? R.feeRate, 'type="number" step="0.001"'), 'Check your category in WING')}
    ${field('Expected CVR', inp('f_cvr', p.cvr ?? R.defaultCvr, 'type="number" step="0.001"'))}
    ${field('Supplier stock', inp('f_stock', p.stock ?? '', 'type="number"'))}
    ${field('Item Winner', sel('f_iw', [['', 'Unknown'], ['true', 'Winner'], ['false', 'Lost']], p.itemWinner == null ? '' : String(p.itemWinner)))}
    ${field('Supplier', sel('f_market', [['dome', '도매꾹'], ['supply', '도매매'], ['other', 'Other']], p.supplier?.market || 'dome'))}
    ${field('Supplier item no.', inp('f_no', p.supplier?.no || ''))}
    ${field('Coupang sellerProductId', inp('f_spid', p.sellerProductId || ''))}${field('Coupang vendorItemId', inp('f_vid', p.vendorItemId || ''), 'Needed for price changes')}
    ${field('Cheapest identical competitor ₩', inp('f_cmin', p.competitorMin || '', 'type="number"'), 'Item Winner threshold')}
    ${field('Status', sel('f_status', ['live', 'draft', 'paused'], p.status || 'live'))}
    </div>${field('Main keywords (comma separated)', inp('f_kw', (p.keywords || []).join(', ')))}`,
  [...(p.id ? [{ label: 'Delete', value: 'del', cls: 'red' }] : []), { label: 'Cancel', value: null, cls: 'ghost' }, { label: 'Save', value: (bg) => {
    const g = (id) => bg.querySelector('#' + id).value;
    return { id: p.id, name: g('f_name'), price: +g('f_price'), supply: +g('f_supply'), shipping: +g('f_ship'), feeRate: +g('f_fee'), cvr: +g('f_cvr'), stock: g('f_stock') === '' ? null : +g('f_stock'),
      itemWinner: g('f_iw') === '' ? null : g('f_iw') === 'true', supplier: { ...(p.supplier || {}), market: g('f_market'), no: g('f_no') }, sellerProductId: g('f_spid'), vendorItemId: g('f_vid'),
      competitorMin: +g('f_cmin') || null, status: g('f_status'), keywords: g('f_kw').split(',').map((s) => s.trim()).filter(Boolean) };
  } }]);
  if (v === 'del') { deleteProduct(p.id); audit('product', 'Deleted ' + p.name); return rerender(); }
  if (!v) return;
  if (!v.name || !v.price) return toast('Name and price are required', 'err');
  if (!v.id) delete v.id;
  saveProduct(v); audit('product', 'Saved ' + v.name); rerender();
}

async function importFromCoupang() {
  if (!isLive()) throw new Error('Connect the Worker first (Settings & APIs)');
  const j = await coupang.products();
  const list = j.data || [];
  let n = 0;
  for (const sp of list) {
    const d = await coupang.product(sp.sellerProductId);
    const item = d.data?.items?.[0] || {};
    const existing = products().find((x) => String(x.sellerProductId) === String(sp.sellerProductId));
    saveProduct({ ...(existing ? { id: existing.id } : { supply: 0, shipping: 3000 }), name: d.data?.sellerProductName || sp.sellerProductName, title: d.data?.displayProductName || '', sellerProductId: String(sp.sellerProductId),
      vendorItemId: String(item.vendorItemId || ''), price: item.salePrice || existing?.price || 0, lastRead: new Date().toISOString() });
    n++;
  }
  audit('coupang', `Imported ${n} product(s)`);
  toast(`Imported ${n} product(s). Enter the supply price for new ones.`, 'ok'); rerender();
}

async function refreshStock() {
  if (!isLive()) throw new Error('Connect the Worker first (Settings & APIs)');
  let n = 0;
  for (const p of products().filter((x) => x.supplier?.no && x.supplier.market !== 'other')) {
    const j = await supplierItem(p.supplier.no, p.supplier.market);
    const it = normalizeSupplierItems({ list: [j.domeggook || j] }, p.supplier.market)[0] || {};
    const stock = Number(j?.domeggook?.qty?.inventory ?? it.stock);
    const supply = Number(j?.domeggook?.price?.dome ?? j?.domeggook?.price ?? it.supply);
    saveProduct({ id: p.id, stock: isNaN(stock) ? p.stock : stock, supplyChanged: supply && supply !== p.supply ? supply : null, lastRead: new Date().toISOString() });
    n++;
  }
  db.set('lastStockRefresh', new Date().toISOString());
  toast(`Refreshed ${n} product(s)`, 'ok'); rerender();
}

import { orders, upsertOrders, updateOrder, products, product, propose, isLive, db, audit } from '../state.js';
import { card, table, badge, icon, toast, busy, $, $$, esc, num, won, stat, sel, md, today, addDays, ago, modal, field, inp } from '../ui.js';
import { coupang } from '../api.js';

// Buyer name/phone/address are kept in memory only (never saved to the browser storage).
const receivers = new Map();
const COURIERS = [['CJGLS', 'CJ대한통운'], ['HANJIN', '한진택배'], ['HYUNDAI', '롯데택배'], ['EPOST', '우체국택배'], ['LOGEN', '로젠택배'], ['KDEXP', '경동택배']];
const STATUS = { new: ['New', 'red'], supplier_ordered: ['Supplier ordered', 'orange'], shipped: ['Shipped', 'blue'], delivered: ['Delivered', 'green'], cancelled: ['Cancelled', 'gray'] };
let filter = 'open';

/** Pull order sheets from Coupang for the last 7 days. Returns number of orders touched. */
export async function syncOrders() {
  if (!isLive()) throw new Error('Connect the Worker first (Settings & APIs)');
  const from = addDays(today(), -7), to = today();
  const ps = products(), list = [];
  for (const status of ['ACCEPT', 'INSTRUCT', 'DEPARTURE', 'DELIVERING', 'FINAL_DELIVERY']) {
    const j = await coupang.orders(from, to, status);
    for (const o of j.data || []) {
      if (o.receiver) receivers.set(String(o.shipmentBoxId), o.receiver);
      for (const it of o.orderItems || []) {
        const prod = ps.find((p) => String(p.vendorItemId) === String(it.vendorItemId));
        const prev = orders().find((x) => x.id === `${o.orderId}-${it.vendorItemId}`);
        let st = { ACCEPT: 'new', INSTRUCT: 'new', DEPARTURE: 'shipped', DELIVERING: 'shipped', FINAL_DELIVERY: 'delivered' }[status];
        if (st === 'new' && prev?.status === 'supplier_ordered') st = 'supplier_ordered';
        list.push({ id: `${o.orderId}-${it.vendorItemId}`, orderId: String(o.orderId), shipmentBoxId: String(o.shipmentBoxId), vendorItemId: String(it.vendorItemId), productId: prod?.id || '', name: it.vendorItemName || it.sellerProductName,
          qty: it.shippingCount || 1, price: it.salesPrice || it.orderPrice / (it.shippingCount || 1), orderedAt: o.orderedAt, shipBy: (it.estimatedShippingDate || addDays(String(o.orderedAt).slice(0, 10), 2)).slice(0, 10), status: st,
          tracking: o.invoiceNumber || prev?.tracking || '', courier: prev?.courier || 'CJGLS', coupangStatus: status, steps: { ack: status !== 'ACCEPT', uploaded: !!o.invoiceNumber } });
      }
    }
  }
  upsertOrders(list); db.set('lastOrderSync', new Date().toISOString()); audit('sync', `Orders: ${list.length}`);
  return list.length;
}

export default {
  async render(root) {
    const all = orders();
    const count = (s) => all.filter((o) => o.status === s).length;
    const open = all.filter((o) => ['new', 'supplier_ordered'].includes(o.status));
    const late = open.filter((o) => o.shipBy && o.shipBy <= addDays(today(), 1));
    const rows = filter === 'open' ? open : filter === 'all' ? all : all.filter((o) => o.status === filter);

    root.innerHTML = `
    <div class="grid g4">
      ${stat('New', num(count('new')), late.length ? `${late.length} due ≤ tomorrow` : '', !late.length, 'cart')}
      ${stat('Ordered from supplier', num(count('supplier_ordered')), '', true, 'box')}
      ${stat('Shipped', num(count('shipped')), '', true, 'truck')}
      ${stat('Delivered', num(count('delivered')), `of ${num(all.length)} total`, true, 'check')}
    </div>
    ${late.length ? `<div class="callout err mb">${icon('alert', 14)} ${late.length} order(s) must ship by tomorrow: ${late.map((o) => esc(o.orderId || o.id)).join(', ')}</div>` : ''}
    <div class="grid g21">
      ${card('Order queue', `Synced ${ago(db.get('lastOrderSync'))} · buyer details are held in memory only`, `
        <div class="row mb"><div class="tabs">${[['open', 'Open'], ['all', 'All'], ['shipped', 'Shipped'], ['delivered', 'Delivered']].map(([k, l]) => `<button class="${filter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div></div>
        ${table([
          { label: '', fmt: (o) => (o.status === 'new' && !o.steps?.ack ? `<input type="checkbox" data-ck="${o.id}">` : '') },
          { label: 'Order', fmt: (o) => `<b>${esc(o.orderId || o.id)}</b><div class="sub">${md((o.orderedAt || '').slice(0, 10))} · ${esc(String(o.name || '').slice(0, 26))} × ${o.qty}</div>` },
          { label: 'Ship by', fmt: (o) => `<span class="${o.shipBy <= addDays(today(), 1) && ['new', 'supplier_ordered'].includes(o.status) ? 'down' : ''}">${md(o.shipBy)}</span>` },
          { label: 'Amount', align: 'r', fmt: (o) => won(o.price * o.qty) },
          { label: 'Status', fmt: (o) => badge(...(STATUS[o.status] || [o.status, 'gray'])) },
          { label: 'Tracking', fmt: (o) => (o.tracking ? `<span class="sub">${esc(o.courier)}</span> ${esc(o.tracking)}` : '–') },
          { label: '', align: 'r', fmt: (o) => `<button class="btn sm ghost" data-open="${o.id}">Steps</button>` },
        ], rows, { hl: (o) => late.includes(o), emptyText: 'No orders here' })}
        <div class="row mt"><button class="btn ghost" id="sync">${icon('refresh', 12)} Sync from Coupang</button><button class="btn" id="ack">${icon('check', 12, 3)} Confirm selected (상품준비중)</button><button class="btn ghost" id="addm">${icon('plus', 12)} Add manually</button></div>`)}
      ${card('Order checklist', 'The four dropshipping steps for every order (course guide)', `<div class="tl">
        ${[['1. Confirm the order', 'Set 상품준비중 in WING (or Confirm selected)', 'ack'], ['2. Order from the supplier', 'Same option and quantity, buyer safe number and address. A team member pays.', 'supplier'], ['3. Get the tracking number', 'From the supplier order page (usually next day)', 'tracking'], ['4. Upload tracking to Coupang', 'Before the ship-by date', 'uploaded']]
          .map(([t, s, k]) => { const done = all.filter((o) => o.steps?.[k]).length; return `<div class="tl-i"><div class="d" style="background:${done === all.length && all.length ? 'var(--green)' : 'var(--teal)'}">${icon('check', 11, 3)}</div><div><b>${t}</b><span>${s}<br>${done} of ${all.length} done</span></div></div>`; }).join('')}
      </div><p class="note">The agent checks for tracking numbers and alerts 24 hours before a ship-by date. Paying the supplier is always done by a person.</p>`)}
    </div>`;

    $$('[data-f]', root).forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; this.render(root); }));
    $('#sync').onclick = (e) => busy(e.currentTarget, async () => { const n = await syncOrders(); toast(`Synced ${n} order line(s)`, 'ok'); this.render(root); });
    $('#ack').onclick = () => {
      const ids = $$('[data-ck]:checked', root).map((c) => c.dataset.ck); if (!ids.length) return toast('Select new orders first', 'err');
      const os = all.filter((o) => ids.includes(o.id));
      propose({ kind: 'order_ack', title: `Confirm ${os.length} order(s) (상품준비중)`, detail: os.map((o) => o.orderId).join(', '), payload: { shipmentBoxIds: [...new Set(os.map((o) => Number(o.shipmentBoxId)))], orderIds: ids } });
      toast('Added to the approval queue', 'ok');
    };
    $('#addm').onclick = () => manualOrder().then(() => this.render(root));
    $$('[data-open]', root).forEach((b) => b.addEventListener('click', () => steps(all.find((o) => o.id === b.dataset.open)).then(() => this.render(root))));
  },
};

async function steps(o) {
  const rc = receivers.get(String(o.shipmentBoxId));
  const p = product(o.productId);
  const r = await modal(`Order ${esc(o.orderId || o.id)}`, `
    <div class="kv mb"><dt>Product</dt><dd>${esc(o.name)} × ${o.qty}</dd><dt>Ship by</dt><dd>${o.shipBy}</dd><dt>Supplier</dt><dd>${p?.supplier?.url ? `<a href="${esc(p.supplier.url)}" target="_blank" rel="noopener">${esc(p.supplier.no || 'open')}</a>` : '–'}</dd></div>
    ${rc ? `<div class="callout mb"><b>Ship to</b> (memory only)<br>${esc(rc.name)} · ${esc(rc.safeNumber || rc.receiverNumber || '')}<br>${esc(rc.postCode || '')} ${esc(rc.addr1 || '')} ${esc(rc.addr2 || '')}<div class="mt"><button class="btn sm ghost" id="cp">${icon('copy', 11)} Copy for supplier order</button></div></div>` : '<p class="note mb">Buyer details are not in memory. Sync from Coupang to load them for this session.</p>'}
    <div class="stack">${[['ack', 'Order confirmed in WING'], ['supplier', 'Ordered and paid at the supplier']].map(([k, l]) => `<label class="switch"><input type="checkbox" data-s="${k}" ${o.steps?.[k] ? 'checked' : ''}><i></i>${l}</label>`).join('')}
    <div class="fgrid">${field('Courier', sel('cour', COURIERS, o.courier || 'CJGLS'))}${field('Tracking number', inp('trk', o.tracking || ''))}</div></div>`,
  [{ label: 'Cancel', value: null, cls: 'ghost' }, { label: 'Save', value: 'save', cls: 'ghost' }, { label: 'Save & upload tracking', value: 'upload' }], (bg) => {
    const cp = bg.querySelector('#cp');
    if (cp) cp.onclick = () => { navigator.clipboard.writeText(`${rc.name}\t${rc.safeNumber || rc.receiverNumber || ''}\t${rc.postCode || ''}\t${rc.addr1 || ''} ${rc.addr2 || ''}`); toast('Copied', 'ok'); };
    bg.querySelectorAll('[data-s]').forEach((c) => c.addEventListener('change', () => { o.steps = { ...o.steps, [c.dataset.s]: c.checked }; }));
    bg.querySelector('#cour').onchange = (e) => (o.courier = e.target.value);
    bg.querySelector('#trk').oninput = (e) => (o.tracking = e.target.value.trim());
  });
  if (!r) return;
  const status = o.status === 'new' && o.steps?.supplier ? 'supplier_ordered' : o.status;
  updateOrder(o.id, { steps: { ...o.steps, tracking: !!o.tracking }, courier: o.courier, tracking: o.tracking, status });
  if (r === 'upload') {
    if (!o.tracking) return toast('Enter a tracking number first', 'err');
    propose({ kind: 'invoice_upload', title: `Upload tracking for ${o.orderId || o.id}`, detail: `${o.courier} ${o.tracking}`, payload: { orderIds: [o.id], items: [{ shipmentBoxId: Number(o.shipmentBoxId), orderId: Number(o.orderId), vendorItemId: Number(o.vendorItemId), deliveryCompanyCode: o.courier, invoiceNumber: o.tracking, splitShipping: false, preSplitShipped: false, estimatedShippingDate: '' }] } });
    toast('Added to the approval queue', 'ok');
  }
}

async function manualOrder() {
  const ps = products();
  const v = await modal('Add an order manually', `<div class="fgrid">${field('Product', sel('mo_p', ps.map((p) => [p.id, p.name])))}${field('Order no.', inp('mo_id', ''))}${field('Date', inp('mo_d', today(), 'type="date"'))}${field('Quantity', inp('mo_q', 1, 'type="number"'))}${field('Price ₩', inp('mo_pr', ps[0]?.price || '', 'type="number"'))}</div>`,
    [{ label: 'Cancel', value: null, cls: 'ghost' }, { label: 'Add', value: (bg) => ({ p: bg.querySelector('#mo_p').value, id: bg.querySelector('#mo_id').value, d: bg.querySelector('#mo_d').value, q: +bg.querySelector('#mo_q').value, pr: +bg.querySelector('#mo_pr').value }) }]);
  if (!v || !v.p) return;
  const p = product(v.p);
  upsertOrders([{ id: v.id || 'M' + Date.now(), orderId: v.id || '', productId: p.id, name: p.name, qty: v.q || 1, price: v.pr || p.price, orderedAt: v.d + 'T12:00:00', shipBy: addDays(v.d, 2), status: 'new', steps: {} }]);
  audit('order', 'Manual order added');
}

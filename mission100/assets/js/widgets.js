// Shared widgets used by several screens.
import { approvals, product, products } from './state.js';
import { approve, reject, KINDS } from './actions.js';
import { esc, won, badge, icon, toast, empty, $$, ago, sel } from './ui.js';

const color = { price_change: 'teal', coupon: 'orange', keyword_change: 'blue', title_change: 'dark', instagram_post: 'orange', threads_post: 'dark', order_ack: 'green', invoice_upload: 'green', strategy: 'blue', note: 'gray' };

/** HTML for approval cards. Call wireApprovals(root, onDone) after inserting. */
export function approvalCards(list = approvals().filter((a) => a.status === 'pending'), { limit = 50 } = {}) {
  if (!list.length) return empty('Nothing waiting for approval', 'New proposals from the agent and the daily check appear here.');
  return list.slice(0, limit).map((a) => `<div class="approval" data-aid="${a.id}">
    <div class="row between"><span>${badge(KINDS[a.kind]?.label || a.kind, color[a.kind])} ${a.source === 'agent' ? badge('AI', 'soft') : a.source === 'rule' ? badge('Rule', 'soft') : ''}</span>${a.expectedProfit ? `<span class="up" style="font-size:12.5px">+${won(a.expectedProfit)}/wk</span>` : ''}</div>
    <div class="t mt" style="margin-top:8px">${esc(a.title)}</div>
    <div class="m">${esc(a.detail || '')}${a.payload?.productId && product(a.payload.productId) ? ` · ${esc(product(a.payload.productId).name)}` : ''} · ${ago(a.createdAt)}</div>
    ${a.status === 'pending' ? `<div class="row"><button class="btn sm" data-ok="${a.id}">${icon('check', 12, 3)} Approve</button><button class="btn sm ghost" data-no="${a.id}">Reject</button></div>`
      : `<div class="m">${badge(a.status, a.status === 'done' ? 'green' : a.status === 'failed' ? 'red' : 'gray')} ${esc(a.result || '')}</div>`}
  </div>`).join('');
}
export function wireApprovals(root, onDone = () => {}) {
  $$('[data-ok]', root).forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { const r = await approve(b.dataset.ok); if (r) toast(r, 'ok'); } catch (e) { toast(e.message, 'err'); }
    onDone();
  }));
  $$('[data-no]', root).forEach((b) => b.addEventListener('click', () => { reject(b.dataset.no); toast('Rejected'); onDone(); }));
}

export const productPicker = (id, value, { all = false } = {}) => sel(id, (all ? [['', 'All products']] : []).concat(products().map((p) => [p.id, p.name])), value);

export function needProducts() {
  return products().length ? '' : `<div class="callout warn mb">No products yet. Add one in <a href="#/products">Products & Costs</a>, or load demo data in <a href="#/settings">Settings & APIs</a>.</div>`;
}

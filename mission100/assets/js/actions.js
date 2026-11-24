// The approval gate. Every change to a live platform is an "action" in the queue.
// Only approve() — called from an Approve button — executes it.
import { approvals, updateApproval, audit, product, saveProduct, updateOrder, saveIn, settings, isLive, db, adKeywords } from './state.js';
import { coupang, publishInstagram, publishThreads } from './api.js';
import { modal, esc, won, today } from './ui.js';

/** kind → { label, auto: autonomy flag that allows running without a click, run(payload) → result text } */
export const KINDS = {
  price_change: {
    label: 'Price change', auto: 'priceChange',
    async run(p) {
      const prod = product(p.productId);
      if (!prod) throw new Error('Product not found');
      if (isLive() && prod.vendorItemId) await coupang.changePrice(prod.vendorItemId, p.newPrice);
      else if (!(await manual(`Change the price in WING`, `Set <b>${esc(prod.name)}</b> to <b>${won(p.newPrice)}</b> in WING → 상품관리 → 상품 조회/수정.`))) return null;
      saveProduct({ id: prod.id, price: p.newPrice, lastPriceChange: today() });
      saveIn('experiments', { productId: prod.id, hypothesis: p.hypothesis || `Price ${won(p.oldPrice)} → ${won(p.newPrice)} raises weekly profit`, action: `Price ${won(p.oldPrice)} → ${won(p.newPrice)}`, metric: 'weekly profit', before: p.before ?? null, start: today(), status: 'running' }, 'e');
      return isLive() && prod.vendorItemId ? 'Price changed on Coupang' : 'Marked done (manual)';
    },
  },
  coupon: {
    label: 'Coupon', auto: 'coupon',
    async run(p) {
      const prod = product(p.productId);
      if (!(await manual('Create the coupon in WING', `WING → 프로모션 → 즉시할인 쿠폰 → 쿠폰 만들기<br>Product: <b>${esc(prod?.name)}</b><br>Discount: <b>${won(p.discount)}</b> · ${p.days || 7} days<br>Name: ${esc(p.name || 'Mission100 쿠폰')}`))) return null;
      saveIn('experiments', { productId: p.productId, hypothesis: `A ${won(p.discount)} coupon lifts conversion by more than ${Math.round((p.liftNeeded || 0) * 100)}%`, action: `Coupon ${won(p.discount)}`, metric: 'conversion rate', start: today(), status: 'running' }, 'e');
      return 'Coupon created (manual)';
    },
  },
  keyword_change: {
    label: 'Keyword bid', auto: 'pauseLoser',
    async run(p) {
      const autoPause = p.verdict === 'pause' && settings().autonomy.pauseLoser;
      if (!autoPause && !(await manual('Apply in Coupang Ads', `Coupang Ads has no public API. In the ads console:<br><b>${esc(p.keyword)}</b> → ${esc(p.verdict)}${p.bid ? ` · bid ${won(p.bid)}` : ''}`))) return null;
      db.set('adKeywords', adKeywords().map((k) => (k.keyword === p.keyword && (k.productId || '') === (p.productId || '') ? { ...k, status: p.verdict, bid: p.bid ?? k.bid } : k)));
      return autoPause ? 'Paused (checklist item created for the ads console)' : 'Applied (manual)';
    },
  },
  title_change: {
    label: 'Product name', auto: null,
    async run(p) {
      if (!(await manual('Update the product name in WING', `WING → 상품관리 → 수정 → 노출상품명:<br><b>${esc(p.title)}</b>`))) return null;
      saveProduct({ id: p.productId, title: p.title });
      return 'Title updated (manual)';
    },
  },
  instagram_post: {
    label: 'Instagram post', auto: 'publish',
    async run(p) {
      if (!p.imageUrl) throw new Error('Instagram needs a public image URL');
      const r = await publishInstagram(p.imageUrl, p.caption);
      saveIn('posts', { id: p.postId, status: 'posted', postedAt: new Date().toISOString(), remoteId: r.id }, 'post');
      return `Posted (id ${r.id})`;
    },
  },
  threads_post: {
    label: 'Threads post', auto: 'publish',
    async run(p) {
      const r = await publishThreads(p.text, p.imageUrl || undefined);
      saveIn('posts', { id: p.postId, status: 'posted', postedAt: new Date().toISOString(), remoteId: r.id }, 'post');
      return `Posted (id ${r.id})`;
    },
  },
  order_ack: {
    label: 'Confirm orders', auto: 'orderAck',
    async run(p) {
      await coupang.acknowledge(p.shipmentBoxIds);
      p.orderIds.forEach((id) => updateOrder(id, { steps: { ack: true } }));
      return `${p.shipmentBoxIds.length} order(s) set to 상품준비중`;
    },
  },
  invoice_upload: {
    label: 'Upload tracking', auto: null,
    async run(p) {
      await coupang.uploadInvoice(p.items);
      p.orderIds.forEach((id) => updateOrder(id, { status: 'shipped', steps: { uploaded: true } }));
      return 'Tracking uploaded to Coupang';
    },
  },
  strategy: {
    label: 'Strategy', auto: null,
    async run(p) { saveIn('experiments', { productId: p.productId || '', hypothesis: p.hypothesis || p.name, action: p.name, metric: 'orders / week', start: today(), status: 'running' }, 'e'); return 'Strategy started and logged'; },
  },
  note: { label: 'Task', auto: null, async run() { return 'Done'; } },
};

function manual(title, html) {
  return modal(title, `<div class="callout">${html}</div><p class="note mt">This change has no API, so a team member applies it by hand. Click <b>Done</b> after you have made it.</p>`,
    [{ label: 'Cancel', value: false, cls: 'ghost' }, { label: 'Done', value: true }]);
}

export async function approve(id) {
  const a = approvals().find((x) => x.id === id);
  if (!a || a.status !== 'pending') return;
  const kind = KINDS[a.kind] || KINDS.note;
  try {
    const result = await kind.run(a.payload || {});
    if (result === null) return; // cancelled in a manual step
    updateApproval(id, { status: 'done', decidedAt: new Date().toISOString(), result });
    audit('approved', a.title, { approvalId: id, result });
    return result;
  } catch (e) {
    updateApproval(id, { status: 'failed', decidedAt: new Date().toISOString(), result: e.message });
    audit('failed', a.title, { approvalId: id, error: e.message });
    throw e;
  }
}
export function reject(id, why = '') {
  const a = approvals().find((x) => x.id === id);
  updateApproval(id, { status: 'rejected', decidedAt: new Date().toISOString(), result: why });
  audit('rejected', a?.title || id);
}
/** Actions whose kind is allowed by the autonomy switches run immediately (used for "pause losing keyword"). */
export async function autoRun(item) {
  const k = KINDS[item.kind];
  if (k?.auto && settings().autonomy[k.auto] && item.payload?.verdict === 'pause') return approve(item.id);
}

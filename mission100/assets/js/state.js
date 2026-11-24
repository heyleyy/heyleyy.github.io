// Local data store. Everything lives in this browser (localStorage + IndexedDB for media).
// Use Settings → Export to move data between team members' browsers.
import { today, addDays } from './ui.js';

const NS = 'm100:';
const listeners = new Set();

export const DEFAULT_SETTINGS = {
  workerUrl: '', teamToken: '', team: 'Team 2', member: '',
  models: { orchestrator: 'claude-opus-5-5', skill: 'claude-sonnet-5-5', check: 'claude-haiku-5-5' },
  autonomy: { read: true, draft: true, pauseLoser: true, priceChange: false, coupon: false, publish: false, orderAck: false },
  autoSyncMinutes: 30,
};
export const DEFAULT_RULES = {
  goal: 100, start: '2026-11-09', deadline: '2026-12-12',
  feeRate: 0.108, minProfit: 2500, minMargin: 0.25, reinvestShare: 0.4,
  weeklyAdCap: 70000, dailyAdCap: 10000, maxPriceStep: 1000, minDaysBetweenPriceChanges: 7,
  elasticity: -4, iwBonus: 0.3, defaultCvr: 0.03, pauseClicks: 20, minStock: 20, pauseStock: 2,
};

export const db = {
  get(k, d = null) { try { const v = localStorage.getItem(NS + k); return v == null ? structuredClone(d) : JSON.parse(v); } catch { return structuredClone(d); } },
  set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { console.error('Storage full?', e); } listeners.forEach((f) => f(k)); },
  del(k) { localStorage.removeItem(NS + k); },
  keys() { return Object.keys(localStorage).filter((k) => k.startsWith(NS)).map((k) => k.slice(NS.length)); },
};
export const onChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const settings = () => { const s = db.get('settings', DEFAULT_SETTINGS); return { ...DEFAULT_SETTINGS, ...s, models: { ...DEFAULT_SETTINGS.models, ...s.models }, autonomy: { ...DEFAULT_SETTINGS.autonomy, ...s.autonomy } }; };
export const rules = () => ({ ...DEFAULT_RULES, ...db.get('rules', {}) });
export const isLive = () => !!(settings().workerUrl && settings().teamToken);

// ---------- collections ----------
export const products = () => db.get('products', []);
export const product = (id) => products().find((p) => p.id === id);
export function saveProduct(p) {
  const all = products(); const i = all.findIndex((x) => x.id === p.id);
  if (i >= 0) all[i] = { ...all[i], ...p }; else all.push({ id: uid('p'), status: 'live', keywords: [], feeRate: rules().feeRate, cvr: rules().defaultCvr, ...p });
  db.set('products', all); return i >= 0 ? all[i] : all.at(-1);
}
export const deleteProduct = (id) => db.set('products', products().filter((p) => p.id !== id));

export const orders = () => db.get('orders', []);
export function upsertOrders(list) {
  const all = orders(); const byId = new Map(all.map((o) => [o.id, o]));
  for (const o of list) byId.set(o.id, { ...(byId.get(o.id) || {}), ...o, steps: { ...(byId.get(o.id)?.steps || {}), ...(o.steps || {}) } });
  db.set('orders', [...byId.values()].sort((a, b) => (b.orderedAt || '').localeCompare(a.orderedAt || '')));
}
export function updateOrder(id, patch) { upsertOrders([{ id, ...patch }]); }

export const adKeywords = () => db.get('adKeywords', []);
export const adDaily = () => db.get('adDaily', {});
export const experiments = () => db.get('experiments', []);
export const learnings = () => db.get('learnings', []);
export const posts = () => db.get('posts', []);
export const snapshots = () => db.get('snapshots', {}); // manual daily inputs: {date: {impressions, clicks}}

export function saveIn(key, item, prefix = 'x') {
  const all = db.get(key, []); const i = all.findIndex((x) => x.id === item.id);
  if (i >= 0) all[i] = { ...all[i], ...item }; else all.unshift({ id: uid(prefix), createdAt: new Date().toISOString(), ...item });
  db.set(key, all); return i >= 0 ? all[i] : all[0];
}
export const removeIn = (key, id) => db.set(key, db.get(key, []).filter((x) => x.id !== id));

// ---------- audit log & approvals ----------
export function audit(type, detail, extra = {}) {
  const log = db.get('audit', []);
  log.unshift({ at: new Date().toISOString(), who: settings().member || settings().team, type, detail, ...extra });
  db.set('audit', log.slice(0, 500));
}
export const approvals = () => db.get('approvals', []);
export const pending = () => approvals().filter((a) => a.status === 'pending');
/** Put a change in the approval queue. Nothing that changes a live platform runs without passing here. */
export function propose(a) {
  const item = { id: uid('a'), status: 'pending', createdAt: new Date().toISOString(), expectedProfit: 0, source: 'user', ...a };
  const all = approvals();
  // de-duplicate identical pending proposals
  const dup = all.find((x) => x.status === 'pending' && x.kind === item.kind && JSON.stringify(x.payload) === JSON.stringify(item.payload));
  if (dup) return dup;
  all.unshift(item); db.set('approvals', all);
  audit('proposed', item.title, { approvalId: item.id, source: item.source });
  return item;
}
export function updateApproval(id, patch) { db.set('approvals', approvals().map((a) => (a.id === id ? { ...a, ...patch } : a))); }

// ---------- derived metrics ----------
export function unitProfitOf(p, price = p?.price) { if (!p) return 0; return price * (1 - (p.feeRate ?? rules().feeRate)) - (p.supply || 0) - (p.shipping || 0); }

/** Daily series between two dates (inclusive): orders, revenue, gross profit, ad spend, impressions, clicks. */
export function dailySeries(from, to) {
  const ps = new Map(products().map((p) => [p.id, p]));
  const ad = adDaily(), snap = snapshots(), out = [];
  const byDay = {};
  for (const o of orders()) {
    if (o.status === 'cancelled') continue;
    const d = (o.orderedAt || '').slice(0, 10); if (!d) continue;
    const p = ps.get(o.productId);
    const unit = p ? unitProfitOf(p, o.price) : 0;
    (byDay[d] ||= { orders: 0, revenue: 0, gross: 0 });
    byDay[d].orders += o.qty || 1; byDay[d].revenue += (o.price || 0) * (o.qty || 1); byDay[d].gross += unit * (o.qty || 1);
  }
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const a = ad[d] || {}, s = snap[d] || {}, b = byDay[d] || {};
    out.push({ date: d, orders: b.orders || 0, revenue: b.revenue || 0, gross: b.gross || 0, spend: a.spend || 0,
      impressions: a.impressions ?? s.impressions ?? 0, clicks: a.clicks ?? s.clicks ?? 0, adOrders: a.orders || 0, adRevenue: a.revenue || 0 });
  }
  return out;
}
const sum = (arr, k) => arr.reduce((s, x) => s + (x[k] || 0), 0);

export function kpis() {
  const r = rules(), t = today();
  const all = dailySeries(r.start, t > r.deadline ? r.deadline : t);
  const last7 = all.slice(-7), prev7 = all.slice(-14, -7);
  const totalOrders = sum(all, 'orders'), gross = sum(all, 'gross'), spend = sum(all, 'spend');
  const daysLeft = Math.max(0, Math.round((new Date(r.deadline) - new Date(t)) / 864e5) + 1);
  const pace7 = sum(last7, 'orders') / Math.max(1, last7.length);
  const need = Math.max(0, r.goal - totalOrders);
  const roas7 = sum(last7, 'spend') ? sum(last7, 'adRevenue') / sum(last7, 'spend') : null;
  const roasPrev = sum(prev7, 'spend') ? sum(prev7, 'adRevenue') / sum(prev7, 'spend') : null;
  return {
    all, last7, prev7, totalOrders, need, daysLeft, pace7,
    requiredPace: daysLeft ? need / daysLeft : need,
    revenue: sum(all, 'revenue'), revenue7: sum(last7, 'revenue'), revenuePrev: sum(prev7, 'revenue'),
    profit: gross - spend, profit7: sum(last7, 'gross') - sum(last7, 'spend'), profitPrev: sum(prev7, 'gross') - sum(prev7, 'spend'),
    orders7: sum(last7, 'orders'), ordersPrev: sum(prev7, 'orders'),
    gross, spend, spend7: sum(last7, 'spend'), roas7, roasPrev,
    wallet: Math.max(0, r.reinvestShare * (gross - spend)), // share of profit after ads that refills the ad budget
    forecast: totalOrders + pace7 * daysLeft,
  };
}

/** Ad-cost per order for one product over the last 7 days of keyword data (fallback: overall). */
export function adCostPerOrder(productId) {
  const ks = adKeywords().filter((k) => !productId || k.productId === productId || !k.productId);
  const spend = sum(ks, 'spend'), ords = sum(ks, 'orders');
  return ords ? spend / ords : 0;
}
export function weeklyOrders(productId) {
  const since = addDays(today(), -7);
  return orders().filter((o) => o.productId === productId && (o.orderedAt || '') >= since && o.status !== 'cancelled').reduce((s, o) => s + (o.qty || 1), 0);
}

// ---------- IndexedDB for images and videos ----------
let _idb;
function idb() {
  return (_idb ||= new Promise((res, rej) => {
    const r = indexedDB.open('mission100', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('assets', { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
async function tx(mode, fn) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction('assets', mode); const s = t.objectStore('assets'); const q = fn(s); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); }
const withTimeout = (p, ms, fallback) => Promise.race([p, new Promise((r) => setTimeout(() => r(fallback), ms))]);
export const assets = { put: (a) => tx('readwrite', (s) => s.put({ id: uid('m'), createdAt: new Date().toISOString(), ...a })), all: () => withTimeout(tx('readonly', (s) => s.getAll()), 2500, []), del: (id) => tx('readwrite', (s) => s.delete(id)), get: (id) => tx('readonly', (s) => s.get(id)) };

// ---------- export / import ----------
export function exportAll() { const o = {}; for (const k of db.keys()) if (k !== 'settings') o[k] = db.get(k); return JSON.stringify({ app: 'mission100', exportedAt: new Date().toISOString(), data: o }, null, 1); }
export function importAll(text) { const j = JSON.parse(text); if (j.app !== 'mission100') throw new Error('Not a Mission 100 export file'); for (const [k, v] of Object.entries(j.data)) db.set(k, v); }
export function clearData() { for (const k of db.keys()) if (k !== 'settings') db.del(k); db.set('demo', false); }

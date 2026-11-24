// Client for the Mission 100 proxy Worker. The browser never holds API keys:
// it sends the team token, and the Worker adds the real keys.
import { settings, db, isLive } from './state.js';

export class ApiError extends Error {}

async function call(path, { method = 'GET', body, query } = {}) {
  const s = settings();
  if (!isLive()) throw new ApiError('Not connected. Open Settings & APIs and enter the Worker URL and team token.');
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)) : '';
  let r;
  try {
    r = await fetch(s.workerUrl.replace(/\/$/, '') + path + qs, {
      method, headers: { 'Content-Type': 'application/json', 'X-Team-Token': s.teamToken }, body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) { throw new ApiError(`Cannot reach the Worker (${e.message}). Check the URL and ALLOWED_ORIGINS.`); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new ApiError(j.error || `HTTP ${r.status}`); e.status = r.status; e.detail = j.detail; throw e; }
  return j;
}
const demo = () => !isLive() && db.get('demo', false);

export const health = () => call('/health');

// ---------- Claude ----------
/** Calls the model through the Worker (POSTECH GenAI or Anthropic) and records POSTECH credit usage. */
export async function claude(params) {
  const res = await call('/claude', { method: 'POST', body: params });
  if (res._credits) db.set('credits', { ...res._credits, at: new Date().toISOString() });
  return res;
}
/**
 * Ask for structured JSON. POSTECH GenAI does not support forced tool calls on Opus/Sonnet,
 * so the schema goes into the prompt, the reply is parsed, and a bad reply is retried once.
 */
export async function claudeJSON({ model, system, prompt, schema, max_tokens = 4000 }) {
  const sys = `${system ? system + '\n\n' : ''}Reply with ONE JSON object only (no markdown, no text before or after) that matches this JSON Schema:\n${JSON.stringify(schema)}`;
  const messages = [{ role: 'user', content: prompt }];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await claude({ model: model || settings().models.skill, max_tokens, system: sys, messages });
    if (res.stop_reason === 'max_tokens') throw new ApiError('The answer was cut off (max_tokens). Try a shorter request.');
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const obj = parseJSON(text);
    const missing = obj && (schema.required || []).filter((k) => !(k in obj));
    if (obj && !missing.length) return obj;
    messages.push({ role: 'assistant', content: text || '(empty)' }, { role: 'user', content: obj ? `Missing keys: ${missing.join(', ')}. Reply again with the full JSON object only.` : 'That was not valid JSON. Reply again with the JSON object only.' });
  }
  throw new ApiError('The model did not return valid JSON. Try again.');
}
function parseJSON(t) {
  const s = String(t).replace(/```(?:json)?/gi, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

// ---------- Gemini images ----------
export const geminiImage = ({ prompt, images = [], model }) => call('/gemini/image', { method: 'POST', body: { prompt, images, model } });

// ---------- Coupang WING ----------
const cp = (method, path, { query, body, write = false } = {}) => call('/coupang', { method: 'POST', body: { method, path, query, body, write } });
export const coupang = {
  /** Registered products (paged by nextToken). */
  products: (nextToken = '') => cp('GET', '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products', { query: { vendorId: '{vendorId}', maxPerPage: 50, nextToken } }),
  product: (sellerProductId) => cp('GET', `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${sellerProductId}`),
  /** Order sheets by status: ACCEPT, INSTRUCT, DEPARTURE, DELIVERING, FINAL_DELIVERY */
  orders: (from, to, status) => cp('GET', '/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/ordersheets', { query: { createdAtFrom: from, createdAtTo: to, status, maxPerPage: 50 } }),
  // ----- write calls: only used from the approval queue -----
  changePrice: (vendorItemId, price) => cp('PUT', `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/${vendorItemId}/prices/${price}`, { write: true }),
  acknowledge: (shipmentBoxIds) => cp('PUT', '/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/ordersheets/acknowledgement', { body: { vendorId: '{vendorId}', shipmentBoxIds }, write: true }),
  uploadInvoice: (items) => cp('POST', '/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/orders/invoices', { body: { vendorId: '{vendorId}', orderSheetInvoiceApplyDtos: items }, write: true }),
};

// ---------- Naver ----------
export async function naverKeywords(hints) {
  if (demo()) return demoKeywords(hints);
  return call('/naver/keywords', { query: { hint: hints.slice(0, 5).join(',') } });
}
export async function naverShop(query, display = 40) {
  if (demo()) return demoShop(query);
  return call('/naver/shop', { query: { query, display } });
}
export async function naverTrend(keywords, weeks = 26) {
  const end = new Date().toISOString().slice(0, 10), start = new Date(Date.now() - weeks * 7 * 864e5).toISOString().slice(0, 10);
  if (demo()) return { results: keywords.map((k, i) => ({ title: k, data: Array.from({ length: weeks }, (_, w) => ({ period: '', ratio: 40 + w * (i % 2 ? 1.6 : 0.6) + Math.sin(w) * 5 })) })) };
  return call('/naver/datalab', { method: 'POST', body: { startDate: start, endDate: end, timeUnit: 'week', keywordGroups: keywords.slice(0, 5).map((k) => ({ groupName: k, keywords: [k] })) } });
}

// ---------- 도매꾹 / 도매매 ----------
export async function supplierSearch({ kw, ca, market = 'dome', pg = 1, sz = 50 }) {
  if (demo()) return demoSupplier(kw);
  return call('/supplier', { query: { mode: 'getItemList', market, kw, ca, pg, sz } });
}
export const supplierItem = (no, market = 'dome') => call('/supplier', { query: { mode: 'getItemView', no, market } });

/** The 도매꾹 JSON shape differs by version, so find the item array wherever it is. */
export function normalizeSupplierItems(j, market = 'dome') {
  const found = [];
  (function walk(x) {
    if (Array.isArray(x)) { if (x.length && typeof x[0] === 'object' && ('no' in x[0] || 'title' in x[0])) { found.push(...x); return; } x.forEach(walk); }
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  })(j);
  return found.map((it) => ({
    no: String(it.no ?? it.itemNo ?? ''), title: String(it.title ?? it.name ?? ''),
    supply: Number(it.price ?? it.priceDome ?? it.amt ?? 0), shipping: Number(it.deli?.fee ?? it.deliFee ?? it.dlvFee ?? 3000) || 3000,
    stock: Number(it.qty?.inventory ?? it.inventory ?? it.qty ?? it.stock ?? 999), thumb: it.thumb || it.image || it.img || '',
    url: it.url || (it.no ? `https://${market === 'supply' ? 'domemedb.domeggook.com/index/item/supplyView.php?sId=' : 'domeggook.com/'}${it.no}` : ''),
    ship: Number(it.deli?.days ?? it.dlvDays ?? 2), market,
  })).filter((x) => x.title);
}

// ---------- Meta ----------
export const publishInstagram = (image_url, caption) => call('/meta/instagram', { method: 'POST', body: { image_url, caption } });
export const publishThreads = (text, image_url) => call('/meta/threads', { method: 'POST', body: { text, image_url } });

// ---------- demo responses (only when demo data is loaded and no Worker is connected) ----------
function demoKeywords(hints) {
  const base = ['침대밑수납함', '침대밑수납', '리빙박스', '침대밑정리함', '바퀴달린수납함', '이불수납함', '수납박스', '옷정리함', '대용량리빙박스', '틈새수납장', '서랍정리함', '칸막이정리함'];
  const set = [...new Set([...hints.map((h) => h.replace(/\s/g, '')), ...base])].slice(0, 14);
  return { keywordList: set.map((k, i) => ({ relKeyword: k, monthlyPcQcCnt: 300 + ((i * 937) % 4000), monthlyMobileQcCnt: 900 + ((i * 2731) % 9000) + (k === '리빙박스' ? 60000 : 0), compIdx: k === '리빙박스' || k === '수납박스' ? '높음' : i % 3 ? '중간' : '낮음', plAvgDepth: 8 })) };
}
function demoShop(q) {
  const prices = [14900, 15400, 15900, 16200, 16500, 16900, 17500, 18900, 13900, 15200, 19800, 16000, 14500, 21000, 15800, 17200, 16400, 18000, 15600, 16800, 14800, 22900, 17900];
  return { items: prices.map((p, i) => ({ title: `${q} 판매자${i + 1}`, lprice: String(p), mallName: i % 3 ? '스마트스토어' : '쿠팡', productId: String(1000 + i) })) };
}
function demoSupplier(kw) {
  const t = kw || '수납';
  const rows = [['침대밑 수납함 바퀴형 2P', 7400, 3000, 340], [`${t} 접이식 정리함 3단`, 5200, 3000, 1200], ['서랍 칸막이 정리함 6P', 3100, 2500, 2100], ['이불 압축 수납백 대형', 4300, 3000, 80], ['틈새 수납장 4단 슬림', 14800, 4000, 45], ['옷 정리함 투명 리빙박스', 6900, 3000, 520], ['차량용 트렁크 정리함', 8800, 3000, 15], ['신발 정리 랙 10단', 9900, 3500, 230]];
  return { list: { item: rows.map(([title, price, fee, qty], i) => ({ no: String(48210 + i * 37), title, price, deli: { fee, days: i % 4 ? 1 : 3 }, qty: { inventory: qty }, thumb: '' })) } };
}

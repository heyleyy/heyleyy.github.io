// All money calculations live here, in code. The AI explains results; it never computes them.
import { rules, unitProfitOf } from './state.js';

export const unitProfit = unitProfitOf;
export const margin = (p, price = p.price) => (price ? unitProfit(p, price) / price : 0);
export const breakEvenRoas = (p, price = p.price) => { const u = unitProfit(p, price); return u > 0 ? price / u : Infinity; };
/** Highest CPC that still leaves profit at the expected conversion rate. */
export const maxBid = (p) => Math.max(0, unitProfit(p) * (p.cvr || rules().defaultCvr));
/** Round to a price ending in 900 (down by default). */
export const to900 = (x, up = false) => { const b = Math.floor(x / 1000) * 1000 + 900; return up ? (b >= x ? b : b + 1000) : b <= x ? b : b - 1000; };
/** Lowest price that keeps the minimum profit per order. */
export function priceFloor(p, minProfit = rules().minProfit) { const fee = p.feeRate ?? rules().feeRate; return to900((minProfit + (p.supply || 0) + (p.shipping || 0)) / (1 - fee), true); }
export function breakEvenPrice(p) { const fee = p.feeRate ?? rules().feeRate; return ((p.supply || 0) + (p.shipping || 0)) / (1 - fee); }

/**
 * Demand model: constant elasticity around the current price and observed weekly orders
 * (commodity listings on Coupang are very price-sensitive, default −4),
 * plus an Item Winner bonus when our price is below the cheapest identical competitor.
 */
export function expectedOrders(price, { p0, q0, elasticity, iwPrice, iwBonus }) {
  let q = q0 * Math.pow(price / p0, elasticity);
  if (iwPrice && price < iwPrice) q *= 1 + iwBonus;
  return q;
}

/** Test every price in ₩100 steps and return the curve and the best price (prefers x900). */
export function optimizePrice(p, { q0, adCostPerOrder = 0, iwPrice = null, min = null, max = null } = {}) {
  const r = rules();
  const p0 = p.price, q = Math.max(q0 || 0, 0.5);
  const lo = min ?? Math.max(1000, Math.round(p0 * 0.7 / 100) * 100), hi = max ?? Math.round(p0 * 1.3 / 100) * 100;
  const floor = priceFloor(p), curve = [];
  const adWeek = adCostPerOrder * q; // this week's ad budget, treated as fixed across prices
  for (let price = lo; price <= hi; price += 100) {
    const orders = expectedOrders(price, { p0, q0: q, elasticity: r.elasticity, iwPrice, iwBonus: r.iwBonus });
    const unit = unitProfit(p, price);
    curve.push({ price, orders, unit, profit: unit * orders - adWeek, ok: price >= floor });
  }
  const ok = curve.filter((c) => c.ok);
  const pick = (arr) => arr.reduce((b, c) => (c.profit > b.profit ? c : b), arr[0]);
  const best = ok.length ? pick(ok) : null;
  // prefer an x900 price within 1% of the optimum
  const c900 = best ? ok.filter((c) => c.price % 1000 === 900 && c.profit >= best.profit * 0.99) : [];
  const best900 = c900.length ? pick(c900) : best;
  const cur = curve.reduce((b, c) => (Math.abs(c.price - p0) < Math.abs(b.price - p0) ? c : b), curve[0]);
  // respect the max step per change
  let next = best900 ? best900.price : p0;
  if (Math.abs(next - p0) > r.maxPriceStep) next = to900(p0 + Math.sign(next - p0) * r.maxPriceStep, next > p0 ? false : true);
  return { curve, best: best900, current: cur, floor, breakEven: breakEvenPrice(p), nextStep: next };
}

/** Product score 0..100 (Discovery). Inputs on a 0..1 scale. */
export const productScore = ({ demand = 0, margin = 0, competition = 0.5, trend = 0.5, fulfil = 0.5 }) =>
  Math.round(100 * (0.3 * demand + 0.3 * margin + 0.15 * (1 - competition) + 0.15 * trend + 0.1 * fulfil));
export const compLevel = (c) => (c === '높음' || c === 'high' ? 1 : c === '중간' || c === 'medium' ? 0.5 : 0.15);
/** Demand on 0..1: peaks for long-tail volume 1k–10k (W4), lower outside. */
export function demandScore(vol) { if (!vol) return 0; if (vol < 1000) return Math.max(0.1, vol / 1000 * 0.7); if (vol <= 10000) return 0.7 + 0.3 * Math.min(1, (vol - 1000) / 4000); return Math.max(0.4, 1 - Math.log10(vol / 10000) * 0.4); }

/** Monte-Carlo: chance to reach `need` orders in `days` with daily Poisson(rate). */
export function chanceToReach(rate, days, need, runs = 1000) {
  if (need <= 0) return 1;
  let hit = 0;
  for (let i = 0; i < runs; i++) { let s = 0; for (let d = 0; d < days; d++) s += poisson(rate); if (s >= need) hit++; }
  return hit / runs;
}
function poisson(l) { if (l <= 0) return 0; const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }

/** Keyword verdict for the Ads screen. */
export function keywordVerdict(k, p) {
  const r = rules();
  const be = p ? breakEvenRoas(p) : 4;
  const roas = k.spend ? k.revenue / k.spend : null;
  const words = (p?.keywords || []).concat((p?.name || '').split(/\s+/)).map((w) => w.replace(/\s/g, ''));
  const rel = !p || words.some((w) => w && (k.keyword.replace(/\s/g, '').includes(w) || w.includes(k.keyword.replace(/\s/g, ''))));
  if (!rel && k.clicks >= 5) return { v: 'exclude', color: 'dark', why: 'Does not match the product (W5 negative keyword)' };
  if (k.clicks >= r.pauseClicks && !k.orders) return { v: 'pause', color: 'red', why: `${k.clicks} clicks, 0 orders` };
  if (roas != null && k.orders && roas < be) return { v: 'lower bid', color: 'orange', why: `ROAS ${(roas * 100).toFixed(0)}% < break-even ${(be * 100).toFixed(0)}%` };
  if (roas != null && roas >= be * 1.3 && k.orders >= 2) return { v: 'raise', color: 'green', why: `ROAS ${(roas * 100).toFixed(0)}% well above break-even` };
  return { v: 'keep', color: 'teal', why: k.clicks < 10 ? 'Not enough clicks yet' : 'Within limits' };
}

/** Coupon economics: profit left after discount and conversion lift needed to break even. */
export function couponMath(p, discount) {
  const u0 = unitProfit(p), u1 = u0 - discount;
  return { u0, u1, liftNeeded: u1 > 0 ? u0 / u1 - 1 : Infinity, ok: u1 >= rules().minProfit };
}

/** Rough CTR estimate for a thumbnail, corrected later by A/B results. Clearly labelled as an estimate. */
export function ctrEstimate({ base = 0.0103, mood = 'clean', hasText = false, hasPeople = false }) {
  let x = base * (mood === 'lifestyle' ? 1.35 : mood === 'clean' ? 1.15 : 1.05);
  if (hasText) x *= 1.1; if (hasPeople) x *= 1.1;
  return x;
}

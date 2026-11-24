// Agent Copilot: Claude tool-use loop + rule-based daily check.
// Read tools run freely. The only "write" tools add items to the local approval queue
// or memory; nothing reaches Coupang, Meta or a supplier until a person clicks Approve.
import { settings, rules, products, orders, adKeywords, experiments, learnings, kpis, propose, saveIn, audit, product, adCostPerOrder, weeklyOrders, db, isLive, approvals } from './state.js';
import { unitProfit, breakEvenRoas, maxBid, optimizePrice, keywordVerdict, chanceToReach, priceFloor } from './calc.js';
import { claude, supplierSearch, normalizeSupplierItems, naverKeywords, naverShop } from './api.js';
import { today, addDays } from './ui.js';
import { autoRun } from './actions.js';

const r0 = (x) => Math.round(x);

export const TOOLS = [
  { name: 'get_overview', description: 'Mission progress: orders vs goal, required daily pace, last-7-day revenue, profit after ads, ad spend, ROAS, ad wallet, days left, and the business rules.', input_schema: { type: 'object', properties: {} } },
  { name: 'list_products', description: 'All products with price, unit profit, margin, break-even ROAS, max CPC bid, supplier stock, Item Winner status, weekly orders and ad cost per order.', input_schema: { type: 'object', properties: {} } },
  { name: 'get_orders', description: 'Order pipeline counts and orders at risk of missing the ship-by date.', input_schema: { type: 'object', properties: { days: { type: 'integer', description: 'Look-back window in days (default 14)' } } } },
  { name: 'get_ad_keywords', description: 'Imported Coupang Ads keyword results with the rule-based verdict (keep, raise, lower bid, pause, exclude).', input_schema: { type: 'object', properties: { productId: { type: 'string' } } } },
  { name: 'optimize_price', description: 'Run the price model for one product: profit-maximising price, price floor, current price, recommended next step (within the max step rule).', input_schema: { type: 'object', properties: { productId: { type: 'string' }, competitorMin: { type: 'number', description: 'Cheapest identical competitor price, if known (Item Winner threshold)' } }, required: ['productId'] } },
  { name: 'competitor_prices', description: 'Naver Shopping prices for a search query: min, median, max and count.', input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'keyword_research', description: 'Naver Search Ad keyword tool: monthly search volume and competition for up to 5 hint keywords and related keywords.', input_schema: { type: 'object', properties: { hints: { type: 'array', items: { type: 'string' }, maxItems: 5 } }, required: ['hints'] } },
  { name: 'search_suppliers', description: 'Search 도매꾹 (market=dome) or 도매매 (market=supply) for dropshipping products. Returns supply price, shipping, stock.', input_schema: { type: 'object', properties: { keyword: { type: 'string' }, market: { type: 'string', enum: ['dome', 'supply'] } }, required: ['keyword'] } },
  { name: 'list_experiments', description: 'Experiment log (hypothesis, action, before, after, effect, learning) and saved learnings.', input_schema: { type: 'object', properties: {} } },
  { name: 'simulate_strategy', description: 'Chance of reaching the order goal by the deadline if daily orders change by a factor (Monte-Carlo, 1000 runs).', input_schema: { type: 'object', properties: { label: { type: 'string' }, dailyOrderMultiplier: { type: 'number', description: 'e.g. 1.3 for +30% orders/day' }, extraDailyOrders: { type: 'number', description: 'Additional orders per day, e.g. from a new product' } }, required: ['label'] } },
  { name: 'propose_action', description: 'Put a change into the human approval queue. This does NOT execute anything. Use for every change you recommend.', input_schema: { type: 'object', properties: {
    kind: { type: 'string', enum: ['price_change', 'coupon', 'keyword_change', 'title_change', 'strategy', 'note'] },
    title: { type: 'string', description: 'Short imperative title' }, detail: { type: 'string', description: 'Evidence and expected effect' },
    productId: { type: 'string' }, expectedWeeklyProfit: { type: 'number' },
    newPrice: { type: 'number', description: 'price_change only' }, discount: { type: 'number', description: 'coupon only (KRW)' },
    keyword: { type: 'string', description: 'keyword_change only' }, verdict: { type: 'string', enum: ['pause', 'exclude', 'raise', 'lower bid'], description: 'keyword_change only' }, bid: { type: 'number' },
    newTitle: { type: 'string', description: 'title_change only' } }, required: ['kind', 'title', 'detail'] } },
  { name: 'save_learning', description: 'Save a lesson to experiment memory so future plans use it.', input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
];

export async function runTool(name, input = {}) {
  const R = rules();
  switch (name) {
    case 'get_overview': {
      const k = kpis();
      return { today: today(), goal: R.goal, deadline: R.deadline, ordersSoFar: k.totalOrders, ordersNeeded: k.need, daysLeft: k.daysLeft, requiredPacePerDay: +k.requiredPace.toFixed(2), last7AvgPerDay: +k.pace7.toFixed(2), forecastAtDeadline: r0(k.forecast),
        revenueTotal: r0(k.revenue), profitAfterAdsTotal: r0(k.profit), last7: { orders: k.orders7, revenue: r0(k.revenue7), profitAfterAds: r0(k.profit7), adSpend: r0(k.spend7), roas: k.roas7 }, prev7: { orders: k.ordersPrev, revenue: r0(k.revenuePrev), profitAfterAds: r0(k.profitPrev) },
        adWallet: r0(k.wallet), rules: R, pendingApprovals: approvals().filter((a) => a.status === 'pending').map((a) => a.title) };
    }
    case 'list_products':
      return products().map((p) => ({ id: p.id, name: p.name, price: p.price, supply: p.supply, shipping: p.shipping, feeRate: p.feeRate, unitProfit: r0(unitProfit(p)), margin: +(unitProfit(p) / p.price).toFixed(3),
        breakEvenRoas: +breakEvenRoas(p).toFixed(2), maxCpcBid: r0(maxBid(p)), priceFloor: priceFloor(p), stock: p.stock, itemWinner: p.itemWinner, weeklyOrders: weeklyOrders(p.id), adCostPerOrder: r0(adCostPerOrder(p.id)), keywords: p.keywords, lastPriceChange: p.lastPriceChange || null }));
    case 'get_orders': {
      const since = addDays(today(), -(input.days || 14));
      const os = orders().filter((o) => (o.orderedAt || '') >= since);
      const count = (s) => os.filter((o) => o.status === s).length;
      return { new: count('new'), supplierOrdered: count('supplier_ordered'), shipped: count('shipped'), delivered: count('delivered'),
        atRisk: os.filter((o) => !['shipped', 'delivered', 'cancelled'].includes(o.status) && o.shipBy <= addDays(today(), 1)).map((o) => ({ id: o.id, product: o.name, shipBy: o.shipBy, status: o.status })) };
    }
    case 'get_ad_keywords':
      return adKeywords().filter((k) => !input.productId || k.productId === input.productId).map((k) => { const p = product(k.productId); const v = keywordVerdict(k, p); return { ...k, ctr: k.impressions ? +(k.clicks / k.impressions).toFixed(4) : null, cvr: k.clicks ? +(k.orders / k.clicks).toFixed(4) : null, roas: k.spend ? +(k.revenue / k.spend).toFixed(2) : null, verdict: v.v, reason: v.why }; });
    case 'optimize_price': {
      const p = product(input.productId); if (!p) return { error: 'Unknown productId' };
      const o = optimizePrice(p, { q0: Math.max(1, weeklyOrders(p.id)), adCostPerOrder: adCostPerOrder(p.id), iwPrice: input.competitorMin || p.competitorMin || null });
      return { currentPrice: p.price, currentWeeklyProfit: r0(o.current.profit), bestPrice: o.best?.price, bestWeeklyProfit: r0(o.best?.profit || 0), expectedOrdersAtBest: +(o.best?.orders || 0).toFixed(1), priceFloor: o.floor, breakEvenPrice: r0(o.breakEven), recommendedNextPrice: o.nextStep,
        daysSinceLastChange: p.lastPriceChange ? Math.round((new Date(today()) - new Date(p.lastPriceChange)) / 864e5) : null, rules: { maxStep: R.maxPriceStep, minDaysBetweenChanges: R.minDaysBetweenPriceChanges, minProfit: R.minProfit }, model: 'constant elasticity ' + R.elasticity + ' + Item Winner bonus ' + R.iwBonus };
    }
    case 'competitor_prices': {
      const j = await naverShop(input.query);
      const ps = (j.items || []).map((i) => Number(i.lprice)).filter(Boolean).sort((a, b) => a - b);
      return { count: ps.length, min: ps[0], median: ps[Math.floor(ps.length / 2)], max: ps.at(-1), sample: (j.items || []).slice(0, 8).map((i) => ({ title: String(i.title).replace(/<[^>]+>/g, ''), price: Number(i.lprice), mall: i.mallName })) };
    }
    case 'keyword_research': {
      const j = await naverKeywords(input.hints || []);
      return (j.keywordList || []).slice(0, 25).map((k) => ({ keyword: k.relKeyword, monthly: vol(k.monthlyPcQcCnt) + vol(k.monthlyMobileQcCnt), competition: k.compIdx }));
    }
    case 'search_suppliers': {
      const j = await supplierSearch({ kw: input.keyword, market: input.market || 'dome', sz: 30 });
      return normalizeSupplierItems(j, input.market).slice(0, 15);
    }
    case 'list_experiments':
      return { experiments: experiments().slice(0, 20), learnings: learnings().map((l) => l.text) };
    case 'simulate_strategy': {
      const k = kpis();
      const rate = k.pace7 * (input.dailyOrderMultiplier || 1) + (input.extraDailyOrders || 0);
      return { label: input.label, ordersPerDay: +rate.toFixed(2), chanceToReachGoal: chanceToReach(rate, k.daysLeft, k.need), expectedTotal: r0(k.totalOrders + rate * k.daysLeft) };
    }
    case 'propose_action': {
      const payload = { productId: input.productId };
      const p = input.productId ? product(input.productId) : null;
      if (input.kind === 'price_change') {
        if (!p || !input.newPrice) return { error: 'price_change needs productId and newPrice' };
        if (input.newPrice < priceFloor(p)) return { error: `Rejected: below the price floor ${priceFloor(p)}` };
        if (Math.abs(input.newPrice - p.price) > R.maxPriceStep) return { error: `Rejected: change larger than ${R.maxPriceStep}` };
        Object.assign(payload, { oldPrice: p.price, newPrice: input.newPrice });
      }
      if (input.kind === 'coupon') Object.assign(payload, { discount: input.discount, days: 7 });
      if (input.kind === 'keyword_change') Object.assign(payload, { keyword: input.keyword, verdict: input.verdict, bid: input.bid });
      if (input.kind === 'title_change') Object.assign(payload, { title: input.newTitle });
      if (input.kind === 'strategy') Object.assign(payload, { name: input.title, hypothesis: input.detail });
      const a = propose({ kind: input.kind, title: input.title, detail: input.detail, payload, expectedProfit: input.expectedWeeklyProfit || 0, source: 'agent' });
      return { queued: true, approvalId: a.id, note: 'Waiting for a team member to approve' };
    }
    case 'save_learning':
      saveIn('learnings', { text: input.text, at: today() }, 'l');
      return { saved: true };
    default: return { error: 'Unknown tool ' + name };
  }
}
const vol = (v) => (typeof v === 'number' ? v : String(v).includes('<') ? 5 : Number(v) || 0);

function systemPrompt() {
  const R = rules();
  return `You are the Mission 100 marketing agent for ${settings().team} in POSTECH IMEN491W Advertising Engineering.
Goal: reach ${R.goal} orders on Coupang by ${R.deadline} with the most profit. All products are dropshipped from 도매꾹/도매매. Profit is reinvested into ads (ad wallet = ${R.reinvestShare * 100}% of profit after ads).

How you work
- Always look at data with tools before recommending anything. Never invent numbers; quote tool results.
- Money is calculated by the tools, not by you. Use unitProfit, breakEvenRoas, maxCpcBid and optimize_price outputs as given.
- Diagnose with the funnel Sales = Exposure × CTR × CVR × AOV and name the weakest step. Benchmarks (W5): CTR 1–2.5%, CVR 2–5%, ROAS ≥ break-even.
- Keywords (W4): prefer long-tail keywords with 1,000–10,000 monthly searches and low/medium competition; exclude keywords that do not match product attributes.
- Every change goes through propose_action. You cannot change Coupang, ads, prices or social accounts yourself; a person approves each item.
- Hard rules: profit per order ≥ ₩${R.minProfit}; price change ≤ ₩${R.maxPriceStep} and at most every ${R.minDaysBetweenPriceChanges} days; only one main change per product per week; weekly ad cap ₩${R.weeklyAdCap}.
- Each experiment follows Hypothesis → Action → Before → After → Effect → Learning. Save real lessons with save_learning.

Answer format: start with a one-line diagnosis, then the plan as numbered actions with expected effect in ₩, then what you queued for approval. Be concise. Reply in the language the user writes in (Korean product names stay in Korean). Today is ${today()}.`;
}

export const WEEKLY_PROMPT = 'Write this week\'s Comprehensive Marketing Judgment. Check the overview, products, ad keywords, orders and experiments. Diagnose the bottleneck, decide the 3 most profitable actions for this week, queue them with propose_action, and state the chance of reaching the goal with and without the plan.';

/**
 * Run one user turn. history: API message array (mutated). onEvent({type:'text'|'tool'|'result'|'error', ...})
 */
export async function runAgent(history, userText, onEvent) {
  history.push({ role: 'user', content: userText });
  const s = settings();
  for (let step = 0; step < 14; step++) {
    const res = await claude({
      model: s.models.orchestrator, max_tokens: 8000, thinking: { type: 'adaptive' },
      system: [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }],
      tools: TOOLS, messages: history,
    });
    history.push({ role: 'assistant', content: res.content });
    for (const b of res.content) if (b.type === 'text' && b.text.trim()) onEvent({ type: 'text', text: b.text });
    if (res.stop_reason === 'max_tokens') { onEvent({ type: 'error', text: 'The answer hit the length limit.' }); break; }
    if (res.stop_reason !== 'tool_use') break;
    const results = [];
    for (const b of res.content.filter((x) => x.type === 'tool_use')) {
      onEvent({ type: 'tool', name: b.name, input: b.input });
      let out, isErr = false;
      try {
        if (!TOOLS.some((t) => t.name === b.name) || typeof b.input !== 'object') throw new Error('Invalid tool call');
        out = await runTool(b.name, b.input);
      } catch (e) { out = { error: e.message }; isErr = true; }
      audit('tool', b.name, { input: b.input });
      onEvent({ type: 'result', name: b.name, output: out });
      results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out).slice(0, 20000), is_error: isErr || undefined });
    }
    history.push({ role: 'user', content: results });
  }
}

/** Rule-based morning check (no AI cost). Runs once a day when the app opens. */
export async function dailyCheck() {
  const R = rules(), t = today();
  const made = [];
  for (const p of products().filter((x) => x.status === 'live')) {
    if (p.stock != null && p.stock <= R.pauseStock) made.push(propose({ kind: 'note', title: `Pause ads: ${p.name} supplier stock is ${p.stock}`, detail: `Stock at or below ${R.pauseStock}. Pause its ad campaigns and check the supplier.`, payload: { productId: p.id }, expectedProfit: 0, source: 'rule' }));
    else if (p.stock != null && p.stock < R.minStock) made.push(propose({ kind: 'note', title: `Low stock: ${p.name} (${p.stock})`, detail: 'Find a second supplier or reduce ad budget.', payload: { productId: p.id }, source: 'rule' }));
    const days = p.lastPriceChange ? (new Date(t) - new Date(p.lastPriceChange)) / 864e5 : 99;
    const q0 = weeklyOrders(p.id);
    if (days >= R.minDaysBetweenPriceChanges && q0 >= 3) {
      const o = optimizePrice(p, { q0, adCostPerOrder: adCostPerOrder(p.id), iwPrice: p.competitorMin || null });
      const nextRow = o.curve.find((c) => c.price === o.nextStep);
      const gain = nextRow ? nextRow.profit - o.current.profit : 0;
      if (o.nextStep !== p.price && gain > 2000) made.push(propose({ kind: 'price_change', title: `Change ${p.name} to ₩${o.nextStep.toLocaleString()}`, detail: `Price model: +₩${Math.round(gain).toLocaleString()} profit a week (floor ₩${o.floor.toLocaleString()}).`, payload: { productId: p.id, oldPrice: p.price, newPrice: o.nextStep }, expectedProfit: Math.round(gain), source: 'rule' }));
    }
  }
  for (const k of adKeywords().filter((x) => x.status === 'active')) {
    const v = keywordVerdict(k, product(k.productId));
    if (v.v === 'pause' || v.v === 'exclude') {
      const a = propose({ kind: 'keyword_change', title: `${v.v === 'pause' ? 'Pause' : 'Exclude'} keyword ${k.keyword}`, detail: v.why, payload: { productId: k.productId, keyword: k.keyword, verdict: v.v }, expectedProfit: Math.round(k.spend / 2), source: 'rule' });
      made.push(a); try { await autoRun(a); } catch {}
    }
  }
  const late = orders().filter((o) => ['new', 'supplier_ordered'].includes(o.status) && o.shipBy && o.shipBy <= addDays(t, 1));
  if (late.length) made.push(propose({ kind: 'note', title: `${late.length} order(s) must ship by tomorrow`, detail: late.map((o) => o.id).join(', '), payload: { orderIds: late.map((o) => o.id) }, source: 'rule' }));
  db.set('lastDailyCheck', t);
  audit('daily-check', `${made.length} proposal(s)`);
  return made;
}

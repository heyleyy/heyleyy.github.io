import { kpis, rules, pending, db, products } from '../state.js';
import { stat, card, won, num, pct, icon, ring, barChart, areaChart, legend, md, timeline, ago, esc, kfmt, $ } from '../ui.js';
import { approvalCards, wireApprovals } from '../widgets.js';

const delta = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
const dtxt = (d) => (d == null ? '' : (d >= 0 ? '+' : '') + d.toFixed(0) + '%');

export default {
  async render(root) {
    const k = kpis(), R = rules();
    const last14 = k.all.slice(-14);
    const top = pending().sort((a, b) => (b.expectedProfit || 0) - (a.expectedProfit || 0))[0];
    const imp = last14.reduce((s, d) => s + d.impressions, 0), clk = last14.reduce((s, d) => s + d.clicks, 0), ord = last14.reduce((s, d) => s + d.orders, 0), spend = last14.reduce((s, d) => s + d.spend, 0);
    const ctr = imp ? clk / imp : null, cvr = clk ? last14.reduce((s, d) => s + d.adOrders, 0) / clk : null;
    const gap = k.pace7 - k.requiredPace;
    const roasD = k.roas7 != null && k.roasPrev != null ? (k.roas7 - k.roasPrev) * 100 : null;
    const steps = [
      ['Exposure', imp ? kfmt(imp / Math.max(1, last14.length)) + '/day' : '–', imp / Math.max(1, last14.length) >= 1000, 'Impressions per day ≥ 1,000'],
      ['CTR', pct(ctr, 2), ctr != null && ctr >= 0.01, 'Benchmark 1–2.5%'],
      ['CVR', pct(cvr, 1), cvr != null && cvr >= 0.02, 'Benchmark 2–5%'],
      ['AOV', won(k.revenue7 / Math.max(1, k.orders7)), true, 'Average order value'],
    ];
    const weakest = steps.find((s) => !s[2]);
    const log = db.get('audit', []).slice(0, 6);

    root.innerHTML = `
    ${!products().length ? `<div class="callout warn mb">Start here: add your products in <a href="#/products">Products & Costs</a> and connect the APIs in <a href="#/settings">Settings & APIs</a>. To see the app with sample numbers, load demo data in Settings.</div>` : ''}
    <div class="grid g4">
      ${stat('Revenue · 7 days', won(k.revenue7), dtxt(delta(k.revenue7, k.revenuePrev)), k.revenue7 >= k.revenuePrev, 'wallet')}
      ${stat('Profit after ads · 7 days', won(k.profit7), dtxt(delta(k.profit7, k.profitPrev)), k.profit7 >= k.profitPrev, 'chart')}
      ${stat(`Orders (goal ${R.goal})`, num(k.totalOrders), k.orders7 ? '+' + k.orders7 + ' this week' : '', true, 'cart')}
      ${stat('Ad ROAS · 7 days', k.roas7 == null ? '–' : pct(k.roas7, 0), roasD == null ? '' : (roasD >= 0 ? '+' : '') + roasD.toFixed(0) + ' pts', (roasD || 0) >= 0, 'rocket')}
    </div>
    <div class="grid g21">
      <section class="card"><div class="grid g2" style="margin:0;align-items:center">
        <div>
          <div class="label">Final project goal</div>
          <div class="big" style="margin:4px 0 8px">${num(k.totalOrders)} of ${R.goal} orders</div>
          <p class="note" style="font-size:13.5px">We need <b>${k.requiredPace.toFixed(1)} orders a day</b> for ${k.daysLeft} days. The last 7 days averaged <b>${k.pace7.toFixed(1)}</b>.
          ${gap >= 0 ? 'We are on pace.' : `At this pace we finish near <b>${Math.round(k.forecast)}</b> orders, so the agent proposes a bigger move in the Strategy Lab.`}</p>
          <div class="bar mt"><i style="width:${Math.min(100, (k.totalOrders / R.goal) * 100)}%"></i></div>
          <a class="btn link mt" href="#/strategy">View the plan to ${R.goal} ${icon('send', 12)}</a>
        </div>
        <div class="card teal" style="text-align:center;box-shadow:none">${ring(k.totalOrders, R.goal, num(k.totalOrders), `/ ${R.goal} orders`)}<div style="font-weight:700;font-size:13px;margin-top:6px">Ad wallet ${won(k.wallet)}</div></div>
      </div></section>
      <section class="media-card">
        <div style="font-size:18px;font-weight:700;margin-bottom:6px">Today's top action</div>
        ${top ? `<div style="font-size:13.5px;opacity:.95">${esc(top.title)}${top.expectedProfit ? `. Expected <b>+${won(top.expectedProfit)}</b> profit a week.` : ''}</div>
        <div class="row mt"><button class="btn sm" data-ok="${top.id}">${icon('check', 12, 3)} Approve</button><a class="btn sm ghost" href="#/agent">Review all (${pending().length})</a></div>`
        : `<div style="font-size:13.5px;opacity:.9">Nothing is waiting. Ask the Copilot for this week's plan.</div><div class="mt"><a class="btn sm ghost" href="#/agent">Open Copilot</a></div>`}
      </section>
    </div>
    <div class="grid g23">
      <section class="card">
        <div class="card dark" style="padding:16px 12px 8px;box-shadow:none">${barChart(last14.map((d) => d.orders), last14.map((d) => md(d.date)), { h: 190 })}</div>
        <div class="card-h mt" style="margin-bottom:0"><div><h2>Daily orders</h2><p><span class="${k.orders7 >= k.ordersPrev ? 'up' : 'down'}">(${k.orders7 - k.ordersPrev >= 0 ? '+' : ''}${k.orders7 - k.ordersPrev})</span> than last week</p></div></div>
        <div class="mini">
          ${[['Impressions', kfmt(imp), 'search', Math.min(1, imp / 20000)], ['Clicks', kfmt(clk), 'bolt', Math.min(1, clk / 500)], ['Orders', num(ord), 'cart', Math.min(1, ord / 50)], ['Ad spend', '₩' + kfmt(spend), 'wallet', Math.min(1, spend / R.weeklyAdCap / 2)]]
            .map(([l, v, ic, f]) => `<div><div class="l"><span class="ibox sm">${icon(ic, 14)}</span>${l}</div><div class="v">${v}</div><div class="bar"><i style="width:${f * 100}%"></i></div></div>`).join('')}
        </div>
      </section>
      ${card('Revenue vs. ad spend', `<span class="${k.revenue7 >= k.revenuePrev ? 'up' : 'down'}">${dtxt(delta(k.revenue7, k.revenuePrev)) || '–'}</span> revenue this week · ad spend capped by the wallet`,
        areaChart([{ name: 'Revenue', color: '#4FD1C5', values: last14.map((d) => d.revenue) }, { name: 'Ad spend', color: '#2D3748', values: last14.map((d) => d.spend) }], last14.map((d) => d.date), { h: 280, xfmt: md }), { actions: legend([['#4FD1C5', 'Revenue'], ['#2D3748', 'Ad spend']]) })}
    </div>
    <div class="grid g3">
      ${card('Funnel bottleneck', 'Sales = Exposure × CTR × CVR × AOV (last 14 days)',
        steps.map(([l, v, ok, h]) => `<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line2)"><div><b style="font-size:13.5px">${l}</b><div class="sub">${h}</div></div><div class="row"><b>${v}</b>${ok ? '<span class="badge green">OK</span>' : '<span class="badge red">Fix</span>'}</div></div>`).join('') +
        `<p class="note mt">${weakest ? `Weakest step: <b>${weakest[0]}</b>. ${weakest[0] === 'CTR' ? 'Test a new main image in Content Studio.' : weakest[0] === 'CVR' ? 'Improve the detail page or price.' : 'Add long-tail keywords or a second product.'}` : 'No step is below benchmark.'}</p>`)}
      ${card('Approval queue', `${pending().length} waiting`, `<div id="dq">${approvalCards(undefined, { limit: 3 })}</div>`)}
      ${card('Recent activity', 'Audit log', timeline(log.map((l) => ({ title: esc(l.type) + ' · ' + esc(String(l.detail).slice(0, 60)), sub: ago(l.at), color: l.type === 'failed' ? 'var(--red)' : l.type === 'approved' ? 'var(--green)' : 'var(--teal)', icon: l.type === 'tool' ? 'bot' : 'check' }))))}
    </div>`;
    wireApprovals(root, () => this.render(root));
  },
};

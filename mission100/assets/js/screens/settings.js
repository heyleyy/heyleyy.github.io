import { settings, rules, db, DEFAULT_RULES, exportAll, importAll, clearData, audit } from '../state.js';
import { card, field, inp, sw, sel, table, badge, icon, toast, busy, $, $$, esc, download, readFile, modal, ago } from '../ui.js';
import { health } from '../api.js';
import { loadDemo } from '../demo.js';
import { rerender } from '../app.js';

const SERVICES = [
  ['claude', 'Claude via POSTECH GenAI', 'Copilot, weekly judgment, copywriting', 'POSTECH_API_KEYS (or ANTHROPIC_API_KEY)'],
  ['gemini', 'Gemini image', 'Ad images from product photos', 'GEMINI_API_KEY'],
  ['coupang', 'Coupang WING Open API', 'Products, prices, orders, tracking', 'COUPANG_ACCESS_KEY · COUPANG_SECRET_KEY · COUPANG_VENDOR_ID'],
  ['naverAds', 'Naver Search Ad', 'Keyword volume and competition', 'NAVER_AD_API_KEY · NAVER_AD_SECRET · NAVER_AD_CUSTOMER_ID'],
  ['naverOpen', 'Naver Open API', 'Shopping prices, DataLab trends', 'NAVER_CLIENT_ID · NAVER_CLIENT_SECRET'],
  ['domeggook', '도매꾹 / 도매매', 'Supplier products and stock', 'DOMEGGOOK_API_KEY'],
  ['instagram', 'Instagram Graph API', 'Publish approved posts', 'IG_USER_ID · META_ACCESS_TOKEN'],
  ['threads', 'Threads API', 'Publish approved posts', 'THREADS_USER_ID · THREADS_ACCESS_TOKEN'],
];
const AUTONOMY = [
  ['read', 'Read data from all services', true], ['draft', 'Write drafts (titles, posts, images)', true], ['pauseLoser', `Pause a keyword with ≥ ${DEFAULT_RULES.pauseClicks} clicks and 0 orders`, false],
  ['priceChange', 'Change prices', false], ['coupon', 'Create coupons', false], ['publish', 'Publish social posts', false], ['orderAck', 'Confirm new orders (상품준비중)', false],
];
const RULES = [
  ['goal', 'Order goal', 'number'], ['start', 'Project start', 'date'], ['deadline', 'Deadline', 'date'], ['feeRate', 'Coupang fee (0.108 = 10.8%)', 'number'],
  ['minProfit', 'Min profit per order (₩)', 'number'], ['minMargin', 'Min margin for new products', 'number'], ['reinvestShare', 'Share of profit for ads', 'number'],
  ['weeklyAdCap', 'Weekly ad cap (₩)', 'number'], ['dailyAdCap', 'Daily ad cap (₩)', 'number'], ['maxPriceStep', 'Max price change (₩)', 'number'],
  ['minDaysBetweenPriceChanges', 'Days between price changes', 'number'], ['elasticity', 'Price elasticity (demand model)', 'number'], ['iwBonus', 'Item Winner order bonus', 'number'],
  ['defaultCvr', 'Expected conversion rate', 'number'], ['pauseClicks', 'Pause after N clicks, 0 orders', 'number'], ['minStock', 'Low-stock alert', 'number'], ['pauseStock', 'Pause ads at stock', 'number'],
];

/** Weekly POSTECH credit use: from the last AI reply, plus every key's state from /health. */
function creditMeter(h) {
  const last = db.get('credits', null);
  const keys = h?.ai?.provider === 'postech' ? (h.ai.credits || []) : [];
  const rows = keys.length ? keys.map((c, i) => [i + 1, c]) : last ? [[last.key, last]] : [];
  if (h?.ai && h.ai.provider !== 'postech') return `<p class="note">AI provider: <b>${esc(h.ai.provider)}</b>. Set <code>POSTECH_API_KEYS</code> on the Worker to use POSTECH credits.</p>`;
  if (!rows.length) return `<p class="note">POSTECH credit use appears here after the first AI reply${h?.ai?.keys ? ` (${h.ai.keys} key(s) on the Worker; the next key is used when one runs out)` : ''}.</p>`;
  return `<div><div class="sub mb">POSTECH weekly credits${h?.ai?.keys ? ` · ${h.ai.keys} key(s), switches automatically` : ''}</div>${rows.map(([k, c]) => {
    const r = c?.limit ? c.usage / c.limit : null;
    const color = c?.exhausted || (r ?? 0) >= 0.95 ? 'var(--red)' : (r ?? 0) >= 0.8 ? 'var(--orange, #ED8936)' : 'var(--teal)';
    return `<div class="row between" style="font-size:12.5px"><span>Key ${k}${c?.exhausted ? ' ' + badge('used up', 'red') : ''}</span><span>${c?.limit ? `${Math.round(c.usage).toLocaleString()} / ${Math.round(c.limit).toLocaleString()}` : 'not used yet'}</span></div>
      <div class="bar mb"><i style="width:${Math.min(100, (r || 0) * 100)}%;background:${color}"></i></div>`;
  }).join('')}${last ? `<p class="note">Last reply used key ${last.key} · ${ago(last.at)}</p>` : ''}</div>`;
}

export default {
  async render(root) {
    const s = settings(), R = rules();
    const h = db.get('health', null);
    root.innerHTML = `
    <div class="grid g12">
      ${card('Connection', 'The website talks only to your proxy Worker. All API keys are stored on the Worker as secrets.', `
        <div class="stack">
          ${field('Worker URL', inp('workerUrl', s.workerUrl, 'placeholder="https://mission100-proxy.<you>.workers.dev"'))}
          ${field('Team token', inp('teamToken', s.teamToken, 'type="password" placeholder="same value as TEAM_TOKEN on the Worker"'), 'Saved only in this browser. Never put it in the GitHub repository.')}
          <div class="fgrid">${field('Team name', inp('team', s.team))}${field('Your name', inp('member', s.member, 'placeholder="for the audit log"'))}</div>
          <div class="row"><button class="btn" id="save">${icon('check', 12, 3)} Save</button><button class="btn ghost" id="test">${icon('refresh', 12)} Test connection</button></div>
        </div>`)}
      ${card('Connected services', h ? `Last checked ${ago(h.time)}` : 'Press “Test connection” to check which keys the Worker has', table(
        [{ label: 'Service', fmt: (r) => `<b>${r[1]}</b><div class="sub">${r[2]}</div>` }, { label: 'Worker secret(s)', fmt: (r) => `<code style="font-size:11.5px">${r[3]}</code>` },
         { label: 'Status', align: 'r', fmt: (r) => (h ? (h.services?.[r[0]] ? badge('Connected', 'green') : badge('Missing key', 'red')) : badge('Unknown', 'gray')) }], SERVICES))}
    </div>
    <div class="grid g2">
      ${card('Autonomy switches', 'What the agent may do without a person clicking Approve', `<div class="stack">${AUTONOMY.map(([k, l, fixed]) => `<div class="row between">${sw('au_' + k, l, s.autonomy[k])}${fixed ? badge('always on', 'soft') : ''}</div>`).join('')}</div>
        <p class="note mt">Recommended: keep price, coupon, publishing and order confirmation off. Coupang Ads has no public API, so keyword changes become a checklist either way.</p>`)}
      ${card('AI models', 'Claude model per role · runs on POSTECH GenAI weekly credits (Opus uses about 2× the credits of Sonnet)', `<div class="stack">
        ${creditMeter(h)}
        ${field('Copilot chat', sel('m_orchestrator', ['claude-sonnet-5-5', 'claude-opus-5-5'], s.models.orchestrator))}
        ${field('Weekly Comprehensive Marketing Judgment', sel('m_weekly', ['claude-opus-5-5', 'claude-sonnet-5-5'], s.models.weekly))}
        ${field('Skills (titles, detail pages, captions, prompts)', sel('m_skill', ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'], s.models.skill))}
        ${field('Checks (compliance, matching)', sel('m_check', ['claude-haiku-5-5', 'claude-sonnet-5-5'], s.models.check))}
        ${field('Auto-sync orders every (minutes)', inp('autoSync', s.autoSyncMinutes, 'type="number" min="5"'))}</div>`)}
    </div>
    ${card('Business rules', 'Every proposal is checked against these before it reaches the approval queue', `<div class="fgrid">${RULES.map(([k, l, t]) => field(l, inp('r_' + k, R[k], `type="${t}" step="any"`))).join('')}</div>
      <div class="row mt"><button class="btn" id="saveRules">Save rules</button><button class="btn ghost" id="resetRules">Reset to defaults</button></div>`, { cls: 'mb' })}
    <div class="grid g2 mt">
      ${card('Data', 'Data is stored in this browser. Export it to share with teammates or as a backup.', `<div class="row">
        <button class="btn ghost" id="exp">${icon('download', 12)} Export JSON</button>
        <label class="btn ghost">${icon('upload', 12)} Import JSON<input type="file" id="imp" accept=".json" hidden></label>
        <button class="btn ghost" id="demo">${icon('play', 12)} Load demo data</button>
        <button class="btn red" id="clear">${icon('trash', 12)} Clear all data</button></div>
        <p class="note mt">Demo data is simulated (two products, 14 days of orders and ads) and is labelled <b>DEMO</b> in the top bar.</p>`)}
      ${card('Audit log', 'Every tool call, proposal and approval', `<div class="scroll" style="max-height:260px">${table([{ label: 'When', fmt: (r) => ago(r.at) }, { label: 'Who', k: 'who' }, { label: 'Type', fmt: (r) => badge(r.type, r.type === 'failed' ? 'red' : r.type === 'approved' ? 'green' : 'gray') }, { label: 'Detail', fmt: (r) => esc(String(r.detail).slice(0, 70)) }], db.get('audit', []).slice(0, 80))}</div>`)}
    </div>`;

    const saveConn = () => {
      const n = settings();
      n.workerUrl = $('#workerUrl').value.trim().replace(/\/$/, ''); n.teamToken = $('#teamToken').value.trim(); n.team = $('#team').value.trim() || 'Team 2'; n.member = $('#member').value.trim();
      AUTONOMY.forEach(([k]) => (n.autonomy[k] = $('#au_' + k).checked)); n.autonomy.read = n.autonomy.draft = true;
      n.models = { orchestrator: $('#m_orchestrator').value, weekly: $('#m_weekly').value, skill: $('#m_skill').value, check: $('#m_check').value };
      n.autoSyncMinutes = Math.max(5, +$('#autoSync').value || 30);
      db.set('settings', n); audit('settings', 'Connection / autonomy saved');
    };
    $('#save').onclick = () => { saveConn(); toast('Saved', 'ok'); rerender(); };
    $$('[id^=au_], [id^=m_]', root).forEach((el) => el.addEventListener('change', () => { saveConn(); toast('Saved', 'ok'); }));
    $('#test').onclick = (e) => busy(e.currentTarget, async () => { saveConn(); const j = await health(); db.set('health', j); toast('Worker reachable', 'ok'); rerender(); });
    $('#saveRules').onclick = () => { const n = {}; RULES.forEach(([k, , t]) => (n[k] = t === 'date' ? $('#r_' + k).value : +$('#r_' + k).value)); db.set('rules', n); audit('rules', 'Business rules saved'); toast('Rules saved', 'ok'); };
    $('#resetRules').onclick = () => { db.set('rules', {}); rerender(); };
    $('#exp').onclick = () => download(`mission100-${new Date().toISOString().slice(0, 10)}.json`, exportAll());
    $('#imp').onchange = async (e) => { try { importAll(await readFile(e.target.files[0])); toast('Imported', 'ok'); rerender(); } catch (er) { toast(er.message, 'err'); } };
    $('#demo').onclick = async () => { if (await modal('Load demo data?', 'This replaces products, orders, ads and posts in this browser with simulated data.', [{ label: 'Cancel', value: false, cls: 'ghost' }, { label: 'Load', value: true }])) { loadDemo(); db.set('lastDailyCheck', null); toast('Demo data loaded', 'ok'); location.hash = '#/dashboard'; } };
    $('#clear').onclick = async () => { if (await modal('Clear all data?', 'Products, orders, ads, posts, experiments and the audit log in this browser will be deleted. Export first if you need a backup. Settings are kept.', [{ label: 'Cancel', value: false, cls: 'ghost' }, { label: 'Delete', value: true, cls: 'red' }])) { clearData(); toast('Cleared'); rerender(); } };
  },
};

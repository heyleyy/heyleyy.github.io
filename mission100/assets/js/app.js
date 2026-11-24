// App shell: sidebar, top bar, hash router, background jobs.
import { $, $$, icon, toast, today, esc } from './ui.js';
import { settings, pending, isLive, db, onChange } from './state.js';
import { dailyCheck } from './agent.js';
import { approvalCards, wireApprovals } from './widgets.js';
import { modal } from './ui.js';

export const SCREENS = [
  ['dashboard', 'Dashboard', 'home'], ['discovery', 'Product Discovery', 'search'], ['products', 'Products & Costs', 'box'],
  ['pricing', 'Price Optimizer', 'tag'], ['listing', 'Listing Builder', 'edit'], ['studio', 'Content Studio', 'image'],
  ['ads', 'Ads & Coupons', 'mega'], ['social', 'Social Posts', 'share'], ['orders', 'Orders', 'truck'],
  ['strategy', 'Strategy Lab', 'flask'], ['agent', 'Agent Copilot', 'bot'],
];
const ACCOUNT = [['settings', 'Settings & APIs', 'gear']];
const cache = {};
let current = '';

function sidebar() {
  const n = pending().length;
  const item = ([id, label, ic]) => `<a href="#/${id}" class="${current === id ? 'active' : ''}"><span class="ib">${icon(ic, 15)}</span>${label}${id === 'agent' && n ? `<span class="cnt">${n}</span>` : ''}</a>`;
  $('#sidebar').innerHTML = `<div class="brand"><span class="logo">${icon('bolt', 16)}</span>MISSION 100 AGENT</div><div class="sep"></div>
  <nav class="nav">${SCREENS.map(item).join('')}<div class="nav-h">ACCOUNT PAGES</div>${ACCOUNT.map(item).join('')}</nav>
  <div class="help"><div class="q">?</div><b>Ask the Agent</b><span>Plans, drafts, you approve</span><button onclick="location.hash='#/agent'">OPEN COPILOT</button></div>`;
}

function topbar(label) {
  $('#crumb').textContent = label; $('#pageTitle').textContent = label;
  const s = settings(), live = isLive(), demo = db.get('demo', false);
  const pill = $('#modePill');
  pill.textContent = live ? (demo ? 'LIVE API · DEMO DATA' : 'LIVE API') : demo ? 'DEMO DATA · OFFLINE' : 'OFFLINE';
  pill.style.background = live ? 'var(--green)' : demo ? 'var(--orange)' : 'var(--muted)';
  $('#teamBtn').innerHTML = `${icon('user', 15)} ${esc(s.member || s.team)}`;
  const n = pending().length;
  $('#bellBtn').innerHTML = icon('bell', 16) + (n ? '<span class="dot"></span>' : '');
}

async function route() {
  const id = (location.hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard');
  const all = [...SCREENS, ...ACCOUNT];
  const def = all.find((s) => s[0] === id) || all[0];
  current = def[0];
  document.body.classList.remove('nav-open');
  sidebar(); topbar(def[1]);
  const view = $('#view');
  try {
    const mod = cache[current] ||= (await import(`./screens/${current}.js`)).default;
    view.innerHTML = '';
    await mod.render(view);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="callout err">Could not load this screen: ${esc(e.message)}</div>`;
  }
  window.scrollTo(0, 0);
}
export const rerender = () => route();

// ---------- top bar actions ----------
$('#menuBtn').innerHTML = icon('menu', 20);
$('#searchIcon').innerHTML = icon('search', 14);
$('#setBtn').innerHTML = icon('gear', 16);
$('#menuBtn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
$('#setBtn').addEventListener('click', () => (location.hash = '#/settings'));
$('#teamBtn').addEventListener('click', () => (location.hash = '#/settings'));
$('#globalSearch').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.value.trim()) { sessionStorage.setItem('m100:ask', e.target.value.trim()); e.target.value = ''; location.hash = '#/agent'; if (current === 'agent') route(); }
});
$('#bellBtn').addEventListener('click', () => {
  modal('Approval queue', `<div id="apq">${approvalCards()}</div>`, [{ label: 'Open Copilot', value: 'go', cls: 'ghost' }, { label: 'Close', value: null }], (root) => wireApprovals(root, () => { root.remove(); route(); }))
    .then((v) => { if (v === 'go') location.hash = '#/agent'; });
});

// ?demo=1 loads simulated data once (handy for presentations)
if (new URLSearchParams(location.search).get('demo') === '1' && !db.get('demo', false)) {
  const { loadDemo } = await import('./demo.js');
  loadDemo();
}

onChange((k) => { if (k === 'approvals') { sidebar(); topbar($('#crumb').textContent); } });
window.addEventListener('hashchange', route);
route();

// ---------- background jobs (while the app is open) ----------
async function morning() {
  if (db.get('lastDailyCheck') === today()) return;
  const made = await dailyCheck();
  if (made.length) toast(`Daily check: ${made.length} item(s) in the approval queue`, 'ok');
}
async function autoSync() {
  if (!isLive()) return;
  try { const { syncOrders } = await import('./screens/orders.js'); const n = await syncOrders(); if (n) toast(`Synced ${n} order(s) from Coupang`, 'ok'); } catch (e) { console.warn('Order sync:', e.message); }
}
setTimeout(morning, 800);
setTimeout(autoSync, 2500);
setInterval(autoSync, Math.max(5, settings().autoSyncMinutes) * 60 * 1000);

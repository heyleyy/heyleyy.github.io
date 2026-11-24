import { db, learnings, approvals, settings, isLive } from '../state.js';
import { card, icon, toast, $, $$, esc, mdToHtml, ago, badge } from '../ui.js';
import { runAgent, WEEKLY_PROMPT, dailyCheck } from '../agent.js';
import { approvalCards, wireApprovals } from '../widgets.js';

// The full API history (incl. thinking and tool blocks) is kept for this tab only.
let history = [];
let running = false;

const QUICK = [
  ['Weekly judgment', WEEKLY_PROMPT],
  ['What should we do today?', 'What is the single most profitable thing we should do today? Check the data first.'],
  ['Why is ROAS low?', 'Diagnose our ad performance by keyword and tell me which keywords to pause, lower or raise.'],
  ['Next product', 'Search suppliers for a second product that fits our customers, check keyword demand and margin, and recommend one.'],
];

export default {
  async render(root) {
    const transcript = db.get('chat', []);
    const tab = db.get('agentTab', 'pending');
    const list = tab === 'pending' ? approvals().filter((a) => a.status === 'pending') : approvals().filter((a) => a.status !== 'pending').slice(0, 30);

    root.innerHTML = `
    <div class="grid g21">
      ${card('Comprehensive marketing judgment', `Chat with the agent · every tool call is shown · model ${settings().models.orchestrator}`, `
        ${isLive() ? '' : '<div class="callout warn mb">Connect the Worker in Settings & APIs to use the AI. The rule-based daily check works offline.</div>'}
        <div class="chips mb">${QUICK.map(([l], i) => `<span class="chip" data-q="${i}">${l}</span>`).join('')}</div>
        <div class="chat" id="chat">${transcript.length ? transcript.map(render1).join('') : `<div class="empty"><b>Ask anything about the project</b>For example: “What should we change this week to reach 100 orders?”</div>`}</div>
        <div class="composer"><textarea class="in" id="q" placeholder="Ask the agent… (Enter to send, Shift+Enter for a new line)"></textarea><button class="btn" id="send">${icon('send', 13)}</button></div>
        <div class="row between mt"><span class="sub">Rules, costs and product facts are cached between requests to cut cost.</span><div class="row"><button class="btn sm ghost" id="daily">${icon('refresh', 11)} Run daily check</button><button class="btn sm ghost" id="clr">Clear chat</button></div></div>`)}
      <div>
        ${card('Approval queue', 'Nothing changes on Coupang or social media until someone approves', `
          <div class="tabs mb"><button class="${tab === 'pending' ? 'on' : ''}" data-t="pending">Waiting (${approvals().filter((a) => a.status === 'pending').length})</button><button class="${tab === 'done' ? 'on' : ''}" data-t="done">History</button></div>
          <div class="scroll" style="max-height:440px">${approvalCards(list)}</div>`)}
        <div style="height:22px"></div>
        ${card('What the agent learned', 'From the experiment log', `<div class="stack">${learnings().slice(0, 5).map((l) => `<div style="font-size:13px">${icon('check', 12, 3)} ${esc(l.text)}</div>`).join('') || '<div class="sub">Nothing yet</div>'}</div>`)}
      </div>
    </div>`;

    const chat = $('#chat'); chat.scrollTop = chat.scrollHeight;
    wireApprovals(root, () => this.render(root));
    $$('[data-t]', root).forEach((b) => b.addEventListener('click', () => { db.set('agentTab', b.dataset.t); this.render(root); }));
    $$('[data-q]', root).forEach((c) => c.addEventListener('click', () => ask(QUICK[+c.dataset.q][1], QUICK[+c.dataset.q][0])));
    $('#send').onclick = () => ask($('#q').value.trim());
    $('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask($('#q').value.trim()); } });
    $('#clr').onclick = () => { db.set('chat', []); history = []; this.render(root); };
    $('#daily').onclick = async () => { const n = await dailyCheck(); toast(`${n.length} item(s) checked into the queue`, 'ok'); this.render(root); };

    const self = this;
    async function ask(text, label) {
      if (!text || running) return;
      if (!isLive()) return toast('Connect the Worker first (Settings & APIs)', 'err');
      running = true; $('#q').value = '';
      const t = db.get('chat', []);
      const push = (m) => { t.push(m); db.set('chat', t.slice(-200)); const empty = chat.querySelector('.empty'); if (empty) empty.remove(); chat.insertAdjacentHTML('beforeend', render1(m)); chat.scrollTop = chat.scrollHeight; };
      push({ role: 'user', text: label || text });
      chat.insertAdjacentHTML('beforeend', '<div class="trace" id="thinking"><span class="spin dk"></span> Thinking…</div>');
      const mark = history.length;
      try {
        await runAgent(history, text, (ev) => {
          $('#thinking')?.remove();
          if (ev.type === 'text') push({ role: 'ai', text: ev.text });
          else if (ev.type === 'tool') push({ role: 'tool', name: ev.name, input: ev.input });
          else if (ev.type === 'result') push({ role: 'result', name: ev.name, output: ev.output });
          else if (ev.type === 'error') push({ role: 'ai', text: '⚠ ' + ev.text });
          chat.insertAdjacentHTML('beforeend', '<div class="trace" id="thinking"><span class="spin dk"></span> Working…</div>');
        });
      } catch (e) { push({ role: 'ai', text: '⚠ ' + e.message }); history.length = mark; }
      finally { $('#thinking')?.remove(); running = false; self.render(root); }
    }
    const queued = sessionStorage.getItem('m100:ask');
    if (queued) { sessionStorage.removeItem('m100:ask'); ask(queued); }
  },
};

function render1(m) {
  if (m.role === 'user') return `<div class="msg user">${esc(m.text)}</div>`;
  if (m.role === 'ai') return `<div class="msg ai">${mdToHtml(m.text)}</div>`;
  if (m.role === 'tool') return `<div class="trace">${icon('bolt', 11)} ${esc(m.name)}(${esc(JSON.stringify(m.input || {})).slice(0, 120)})</div>`;
  if (m.role === 'result') return `<div class="trace"><details><summary>↳ ${esc(m.name)} result${m.output?.error ? ' ' + badge('error', 'red') : ''}</summary><pre>${esc(JSON.stringify(m.output, null, 1)).slice(0, 3000)}</pre></details></div>`;
  return '';
}

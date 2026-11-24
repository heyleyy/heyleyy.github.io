import { products, product, propose, db, settings, audit, assets } from '../state.js';
import { card, table, badge, icon, toast, busy, $, $$, esc, num, kfmt, download } from '../ui.js';
import { naverKeywords, claudeJSON } from '../api.js';
import { productPicker, needProducts } from '../widgets.js';

let pid = null;
const BANNED = ['최고', '최상', '1위', '최저가', '유일', '완벽', '무료배송', '100%', '특가', '세일', '정품', '명품'];
const vol = (v) => (typeof v === 'number' ? v : String(v).includes('<') ? 5 : Number(v) || 0);

/** Where a keyword belongs (W4): title for long-tail 1k–10k low/medium, ads for big/high, tag otherwise. */
const useOf = (k) => (k.volume >= 1000 && k.volume <= 10000 && k.comp !== '높음' ? 'title' : k.volume > 10000 || k.comp === '높음' ? 'ad bid only' : 'tag');

export function scoreTitle(t, plan) {
  const s = t.replace(/\s/g, '');
  const target = plan.filter((k) => k.use === 'title').slice(0, 6);
  const hit = target.filter((k) => s.includes(k.keyword)).length;
  const words = t.split(/\s+/); const dup = words.length - new Set(words).size;
  const banned = BANNED.filter((b) => t.includes(b));
  let score = 40 + (target.length ? (hit / target.length) * 45 : 25) + (t.length <= 50 ? 15 : t.length <= 70 ? 5 : -10) - dup * 8 - banned.length * 15;
  return { score: Math.max(0, Math.min(100, Math.round(score))), hit, total: target.length, banned, dup, len: t.length };
}

export default {
  async render(root) {
    const ps = products(); if (!pid || !product(pid)) pid = ps[0]?.id;
    const p = product(pid);
    if (!p) { root.innerHTML = needProducts(); return; }
    const st = db.get('listing:' + p.id, { plan: [], titles: [], page: null });
    const cur = p.title || p.name;
    const cs = scoreTitle(cur, st.plan);
    const imgs = (await assets.all().catch(() => [])).filter((a) => a.productId === p.id && a.kind === 'image');
    const img = imgs[0] ? URL.createObjectURL(imgs[0].blob) : '';

    root.innerHTML = `
    <div class="row mb"><div style="width:320px">${productPicker('pp', pid)}</div></div>
    <div class="grid g2">
      ${card('Product name', 'W4 formula: brand + main keyword + long-tail keywords + attribute. Banned and repeated words lower the score.', `
        <div class="label">Current title</div>
        <div class="row between" style="padding:10px 0 14px;border-bottom:1px solid var(--line2)"><b style="font-size:14px">${esc(cur)}</b>${badge(cs.score + ' / 100', cs.score >= 75 ? 'green' : cs.score >= 55 ? 'orange' : 'red')}</div>
        <div class="stack mt">${st.titles.length ? st.titles.map((t, i) => { const s = scoreTitle(t.title, st.plan); return `<div class="approval"><div class="row between"><b style="font-size:13.5px">${esc(t.title)}</b>${badge(s.score + ' / 100', s.score >= 75 ? 'green' : 'orange')}</div>
          <div class="m">${s.hit}/${s.total} target keywords · ${s.len} chars${s.banned.length ? ' · banned: ' + s.banned.join(', ') : ''} · ${esc(t.why || '')}</div><button class="btn sm" data-use="${i}">${icon('send', 12)} Propose this title</button></div>`; }).join('') : '<div class="empty">Build the keyword plan, then generate titles</div>'}</div>
        <div class="row mt"><button class="btn" id="gen">${icon('bot', 12)} Suggest 3 titles</button></div>`)}
      ${card('Keyword plan', 'Naver keyword tool · long-tail 1k–10k searches with low/medium competition go in the title (W4)', `
        <div class="row mb"><input class="in" id="hints" style="flex:1" value="${esc((p.keywords || []).join(', '))}" placeholder="up to 5 seed keywords"><button class="btn ghost" id="plan">${icon('search', 12)} Analyze</button></div>
        <div class="scroll" style="max-height:340px">${table([{ label: 'Keyword', fmt: (k) => `<b>${esc(k.keyword)}</b>` }, { label: 'Searches/mo', align: 'r', fmt: (k) => kfmt(k.volume) },
          { label: 'Competition', align: 'c', fmt: (k) => badge(k.comp, k.comp === '높음' ? 'red' : k.comp === '중간' ? 'orange' : 'green') },
          { label: 'Use in', align: 'r', fmt: (k) => badge(k.use, k.use === 'title' ? 'teal' : k.use === 'tag' ? 'gray' : 'dark') }], st.plan, { emptyText: 'Press Analyze' })}</div>`)}
    </div>
    <div class="grid g32">
      ${card('Detail page draft', 'Problem → Agitate → Solution, then size and specifications as text (readable by search engines, W6)', st.page ? `
        <div class="stack">${['headline', 'problem', 'agitate', 'solution'].map((k) => `<label class="field"><span>${k}</span><textarea class="in" data-pg="${k}" rows="${k === 'headline' ? 1 : 3}">${esc(st.page[k])}</textarea></label>`).join('')}
        <label class="field"><span>Key points (one per line)</span><textarea class="in" data-pg="bullets" rows="4">${esc((st.page.bullets || []).join('\n'))}</textarea></label>
        <label class="field"><span>Specifications (name: value per line)</span><textarea class="in" data-pg="specs" rows="4">${esc((st.page.specs || []).map((s) => s.name + ': ' + s.value).join('\n'))}</textarea></label></div>
        <div class="row mt"><button class="btn ghost" id="savepg">Save edits</button><button class="btn ghost" id="html">${icon('download', 12)} Download HTML</button><button class="btn" id="genpg">${icon('bot', 12)} Regenerate</button></div>`
        : `<div class="empty"><b>No draft yet</b>The agent writes it from the product facts, keyword plan and common complaints.</div><div class="field mb"><span>Facts the agent must use (size, material, options)</span><textarea class="in" id="facts" rows="3">${esc(st.facts || '')}</textarea></div><button class="btn" id="genpg">${icon('bot', 12)} Write detail page</button>`)}
      ${card('Mobile preview', 'How shoppers see it on Coupang', `<div class="phone"><div class="pg">${st.page ? pageHTML(st.page, img, cur) : '<div class="empty">Preview appears here</div>'}</div></div>`)}
    </div>`;

    const save = () => db.set('listing:' + p.id, st);
    $('#pp').onchange = (e) => { pid = e.target.value; this.render(root); };
    $('#plan').onclick = (e) => busy(e.currentTarget, async () => {
      const hints = $('#hints').value.split(',').map((s) => s.trim()).filter(Boolean);
      const j = await naverKeywords(hints);
      st.plan = (j.keywordList || []).map((k) => ({ keyword: k.relKeyword, volume: vol(k.monthlyPcQcCnt) + vol(k.monthlyMobileQcCnt), comp: k.compIdx })).map((k) => ({ ...k, use: useOf(k) }))
        .sort((a, b) => (a.use === 'title' ? -1 : 0) - (b.use === 'title' ? -1 : 0) || b.volume - a.volume).slice(0, 40);
      save(); this.render(root);
    });
    $('#gen').onclick = (e) => busy(e.currentTarget, async () => {
      if (!st.plan.length) throw new Error('Run the keyword plan first');
      const out = await claudeJSON({ model: settings().models.skill,
        prompt: `Write 3 Coupang product titles in Korean for: ${p.name}. Current title: ${cur}.\nTarget keywords (use most of them naturally): ${st.plan.filter((k) => k.use === 'title').slice(0, 6).map((k) => k.keyword).join(', ')}.\nFormula: brand(optional) + main keyword + long-tail keywords + key attribute (size, quantity, material). Max 50 characters. No promotional words (${BANNED.join(', ')}), no repeated words.`,
        schema: { type: 'object', properties: { titles: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, why: { type: 'string', description: 'one short reason in English' } }, required: ['title', 'why'] } } }, required: ['titles'] } });
      st.titles = out.titles.slice(0, 3); save(); audit('draft', 'Title suggestions for ' + p.name); this.render(root);
    });
    $$('[data-use]', root).forEach((b) => b.addEventListener('click', () => {
      const t = st.titles[+b.dataset.use].title;
      propose({ kind: 'title_change', title: `Rename ${p.name}`, detail: t, payload: { productId: p.id, title: t } }); toast('Added to the approval queue', 'ok');
    }));
    $('#genpg').onclick = (e) => busy(e.currentTarget, async () => {
      if ($('#facts')) st.facts = $('#facts').value;
      const out = await claudeJSON({ model: settings().models.skill, max_tokens: 3000,
        prompt: `Write a Coupang detail page in Korean for "${cur}" (price ₩${p.price}).\nFacts (only use these; do not invent certifications or rankings): ${st.facts || p.name}\nKeywords to use naturally: ${st.plan.slice(0, 8).map((k) => k.keyword).join(', ')}\nStructure: PAS (Problem, Agitate, Solution). Answer the most common complaints shoppers have about this kind of product. No claims like 1위, 최고, health or safety claims.`,
        schema: { type: 'object', properties: { headline: { type: 'string' }, problem: { type: 'string' }, agitate: { type: 'string' }, solution: { type: 'string' }, bullets: { type: 'array', items: { type: 'string' } }, specs: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name', 'value'] } } }, required: ['headline', 'problem', 'agitate', 'solution', 'bullets', 'specs'] } });
      st.page = out; save(); audit('draft', 'Detail page for ' + p.name); this.render(root);
    });
    if ($('#savepg')) $('#savepg').onclick = () => { $$('[data-pg]', root).forEach((t) => { const k = t.dataset.pg; st.page[k] = k === 'bullets' ? t.value.split('\n').filter(Boolean) : k === 'specs' ? t.value.split('\n').filter(Boolean).map((l) => { const [n, ...v] = l.split(':'); return { name: n.trim(), value: v.join(':').trim() }; }) : t.value; }); save(); toast('Saved', 'ok'); this.render(root); };
    if ($('#html')) $('#html').onclick = () => download(`detail-${p.id}.html`, `<!doctype html><meta charset="utf-8"><div style="max-width:860px;margin:auto;font-family:sans-serif">${pageHTML(st.page, '', cur)}</div>`, 'text/html');
  },
};

function pageHTML(pg, img, title) {
  return `${img ? `<img src="${img}">` : ''}<h3 style="font-size:18px">${esc(pg.headline)}</h3><p style="color:#718096">${esc(title)}</p>
  <h3>이런 고민 있으셨죠?</h3><p>${esc(pg.problem)}</p><p>${esc(pg.agitate)}</p><h3>그래서 만들었습니다</h3><p>${esc(pg.solution)}</p>
  <ul style="padding-left:18px;margin:8px 0">${(pg.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
  <h3>상품 정보</h3><table style="width:100%;border-collapse:collapse;font-size:12px">${(pg.specs || []).map((s) => `<tr><td style="border:1px solid #E2E8F0;padding:6px;background:#F7FAFC;width:35%">${esc(s.name)}</td><td style="border:1px solid #E2E8F0;padding:6px">${esc(s.value)}</td></tr>`).join('')}</table>`;
}

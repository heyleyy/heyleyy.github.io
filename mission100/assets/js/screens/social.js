import { products, product, posts, saveIn, removeIn, propose, settings, audit } from '../state.js';
import { card, table, badge, icon, toast, busy, $, $$, esc, num, field, inp, sel, today, addDays, md } from '../ui.js';
import { claudeJSON } from '../api.js';
import { productPicker, needProducts } from '../widgets.js';

let pid = null, editing = null;
const BANNED = /(1위|최고|최저가|완벽|유일|치료|효능|의학|무조건|100%)/;

export default {
  async render(root) {
    const ps = products(); if (!pid || !product(pid)) pid = ps[0]?.id;
    const p = product(pid);
    if (!p) { root.innerHTML = needProducts(); return; }
    const all = posts();
    const ig = editing && editing.channel === 'instagram' ? editing : all.find((x) => x.channel === 'instagram' && x.status === 'draft' && x.productId === p.id) || { channel: 'instagram', caption: '', hashtags: '', imageUrl: '', scheduledFor: addDays(today(), 1), productId: p.id, status: 'draft' };
    const th = editing && editing.channel === 'threads' ? editing : all.find((x) => x.channel === 'threads' && x.status === 'draft' && x.productId === p.id) || { channel: 'threads', caption: '', imageUrl: '', scheduledFor: addDays(today(), 2), productId: p.id, status: 'draft' };
    const week = Array.from({ length: 7 }, (_, i) => addDays(today(), i));

    root.innerHTML = `
    <div class="row mb"><div style="width:320px">${productPicker('pp', pid)}</div><span class="sub">Nothing is posted until a team member approves it. Captions use PAS and natural-language hashtags (W6).</span></div>
    <div class="grid g2">
      ${card('Instagram draft', 'Image post · Instagram needs a public image URL', `
        <div class="row" style="align-items:flex-start;flex-wrap:nowrap;gap:16px">
          <div style="width:180px;flex:none"><div style="aspect-ratio:4/5;border-radius:12px;background:var(--bg) center/cover no-repeat;${ig.imageUrl ? `background-image:url('${esc(ig.imageUrl)}')` : ''}" class="${ig.imageUrl ? '' : 'empty'}">${ig.imageUrl ? '' : 'No image'}</div></div>
          <div class="stack" style="flex:1">
            <label class="field"><span>Caption</span><textarea class="in" id="igc" rows="6">${esc(ig.caption)}</textarea></label>
            ${field('Hashtags', inp('igh', ig.hashtags))}
            ${field('Public image URL', inp('igu', ig.imageUrl, 'placeholder="https://<you>.github.io/media/ad1.jpg"'), 'Download an image from Content Studio and put it in your github.io repo under /media')}
            ${field('Post on', inp('igd', ig.scheduledFor, 'type="date"'))}
          </div></div>
        ${BANNED.test(ig.caption) ? '<div class="callout err mt">The caption contains a claim we cannot prove. Edit it before posting.</div>' : ''}
        <div class="row mt"><button class="btn ghost" id="igg">${icon('bot', 12)} Write caption</button><button class="btn ghost" id="igs">Save draft</button><button class="btn" id="igp">${icon('send', 12)} Send for approval</button></div>`)}
      ${card('Threads draft', 'Conversational post, 500 characters max', `
        <label class="field"><span>Post</span><textarea class="in" id="thc" rows="7" maxlength="500">${esc(th.caption)}</textarea></label>
        <div class="fgrid mt">${field('Image URL (optional)', inp('thu', th.imageUrl))}${field('Post on', inp('thd', th.scheduledFor, 'type="date"'))}</div>
        <div class="row mt"><button class="btn ghost" id="thg">${icon('bot', 12)} Write post</button><button class="btn ghost" id="ths">Save draft</button><button class="btn" id="thp">${icon('send', 12)} Send for approval</button></div>
        <div class="label mt" style="margin-top:18px">This week</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:8px">${week.map((d) => { const ds = all.filter((x) => x.scheduledFor === d); return `<div style="border:1px solid var(--line);border-radius:10px;padding:6px;min-height:64px;font-size:11px"><b>${md(d)}</b>${ds.map((x) => `<div style="margin-top:4px">${badge(x.channel === 'instagram' ? 'IG' : 'TH', x.status === 'posted' ? 'green' : x.status === 'pending' ? 'orange' : 'gray')}</div>`).join('')}</div>`; }).join('')}</div>`)}
    </div>
    ${card('Which posts sold', 'Reach and link clicks from Instagram/Threads insights; orders credited when they arrive within 2 hours of a click spike (an estimate)', table([
      { label: 'Date', fmt: (x) => md(x.scheduledFor) }, { label: 'Channel', fmt: (x) => badge(x.channel, x.channel === 'instagram' ? 'orange' : 'dark') },
      { label: 'Post', fmt: (x) => `<a href="#" data-edit="${x.id}">${esc(String(x.caption).slice(0, 48))}…</a>` }, { label: 'Status', fmt: (x) => badge(x.status, x.status === 'posted' ? 'green' : x.status === 'pending' ? 'orange' : 'gray') },
      { label: 'Reach', align: 'r', fmt: (x) => `<input class="in" style="width:80px;padding:4px 8px" data-m="reach" data-id="${x.id}" value="${x.reach || 0}">` },
      { label: 'Link clicks', align: 'r', fmt: (x) => `<input class="in" style="width:70px;padding:4px 8px" data-m="clicks" data-id="${x.id}" value="${x.clicks || 0}">` },
      { label: 'Est. orders', align: 'r', fmt: (x) => `<input class="in" style="width:60px;padding:4px 8px" data-m="orders" data-id="${x.id}" value="${x.orders || 0}">` },
      { label: '', align: 'r', fmt: (x) => `<button class="btn sm ghost" data-del="${x.id}">${icon('trash', 11)}</button>` },
    ], all, { emptyText: 'No posts yet' }), { cls: 'mt' })}`;

    $('#pp').onchange = (e) => { pid = e.target.value; editing = null; this.render(root); };
    const readIG = () => ({ ...ig, caption: $('#igc').value, hashtags: $('#igh').value, imageUrl: $('#igu').value.trim(), scheduledFor: $('#igd').value });
    const readTH = () => ({ ...th, caption: $('#thc').value, imageUrl: $('#thu').value.trim(), scheduledFor: $('#thd').value });
    $('#igs').onclick = () => { editing = saveIn('posts', readIG(), 'post'); toast('Saved', 'ok'); this.render(root); };
    $('#ths').onclick = () => { editing = saveIn('posts', readTH(), 'post'); toast('Saved', 'ok'); this.render(root); };
    $('#igp').onclick = () => {
      const x = readIG(); if (!x.imageUrl) return toast('Add a public image URL first', 'err'); if (BANNED.test(x.caption)) return toast('Remove unprovable claims first', 'err');
      const saved = saveIn('posts', { ...x, status: 'pending' }, 'post');
      propose({ kind: 'instagram_post', title: `Instagram post for ${p.name} (${md(x.scheduledFor)})`, detail: x.caption.slice(0, 120), payload: { postId: saved.id, imageUrl: x.imageUrl, caption: `${x.caption}\n\n${x.hashtags}`.trim() } });
      editing = null; toast('Sent for approval', 'ok'); this.render(root);
    };
    $('#thp').onclick = () => {
      const x = readTH(); if (!x.caption) return toast('Write the post first', 'err'); if (BANNED.test(x.caption)) return toast('Remove unprovable claims first', 'err');
      const saved = saveIn('posts', { ...x, status: 'pending' }, 'post');
      propose({ kind: 'threads_post', title: `Threads post for ${p.name} (${md(x.scheduledFor)})`, detail: x.caption.slice(0, 120), payload: { postId: saved.id, text: x.caption, imageUrl: x.imageUrl } });
      editing = null; toast('Sent for approval', 'ok'); this.render(root);
    };
    const gen = (channel) => claudeJSON({ model: settings().models.skill, prompt: `Write a Korean ${channel} post for "${p.title || p.name}" sold on Coupang (₩${p.price}). Structure: Problem → Agitate → Solution, friendly tone of a 20s student living alone, end with "쿠팡에서 '${p.keywords?.[0] || p.name}' 검색". ${channel === 'Instagram' ? 'Under 600 characters plus 5–8 natural-language hashtags.' : 'Under 450 characters, no hashtags, ask a question to invite replies.'} No claims like 1위/최고/최저가/health effects.`,
      schema: { type: 'object', properties: { caption: { type: 'string' }, hashtags: { type: 'string' } }, required: ['caption', 'hashtags'] } });
    $('#igg').onclick = (e) => busy(e.currentTarget, async () => { const o = await gen('Instagram'); editing = { ...readIG(), caption: o.caption, hashtags: o.hashtags }; audit('draft', 'Instagram caption'); this.render(root); });
    $('#thg').onclick = (e) => busy(e.currentTarget, async () => { const o = await gen('Threads'); editing = { ...readTH(), caption: o.caption }; audit('draft', 'Threads post'); this.render(root); });
    $$('[data-m]', root).forEach((i) => i.addEventListener('change', () => saveIn('posts', { id: i.dataset.id, [i.dataset.m]: +i.value || 0 })));
    $$('[data-del]', root).forEach((b) => b.addEventListener('click', () => { removeIn('posts', b.dataset.del); this.render(root); }));
    $$('[data-edit]', root).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); editing = all.find((x) => x.id === a.dataset.edit); pid = editing.productId || pid; this.render(root); }));
  },
};

import { products, product, db, settings, assets, audit, saveIn } from '../state.js';
import { card, table, badge, icon, toast, busy, $, $$, esc, pct, sel, field, readFile, modal, today } from '../ui.js';
import { claudeJSON, geminiImage } from '../api.js';
import { ctrEstimate } from '../calc.js';
import { productPicker, needProducts } from '../widgets.js';

let pid = null;
const FORMATS = { thumb: ['Coupang thumbnail 1:1', 1000, 1000], feed: ['Instagram feed 4:5', 1080, 1350], reels: ['Reels / Shorts 9:16', 720, 1280] };
const MOODS = [['clean', 'Clean studio'], ['lifestyle', 'Lifestyle (real room)'], ['bold', 'Bold colour + text']];
const BANNED = /(1위|최고|최저가|완벽|유일|치료|효능|의학|무조건|100%)/g;
const urls = [];
const blobURL = (b) => { const u = URL.createObjectURL(b); urls.push(u); return u; };

export default {
  async render(root) {
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    const ps = products(); if (!pid || !product(pid)) pid = ps[0]?.id;
    const p = product(pid);
    if (!p) { root.innerHTML = needProducts(); return; }
    const st = db.get('studio:' + p.id, { format: 'thumb', mood: 'lifestyle', prompt: '', storyboard: [], ab: [] });
    const all = (await assets.all().catch(() => [])).filter((a) => a.productId === p.id);
    const source = all.filter((a) => a.kind === 'source');
    const imgs = all.filter((a) => a.kind === 'image');
    const vids = all.filter((a) => a.kind === 'video');

    root.innerHTML = `
    <div class="row mb"><div style="width:320px">${productPicker('pp', pid)}</div><span class="sub">Images use Gemini via the Worker. Videos are built in your browser from the images (free).</span></div>
    <div class="grid g12">
      ${card('Content settings', 'The real product photo is kept, so the ad shows exactly what we sell', `<div class="stack">
        <div class="field"><span>Product photo (from the supplier or your own)</span>
          <div class="row">${source.map((s) => `<img class="thumb" src="${blobURL(s.blob)}" title="source">`).join('')}<label class="btn ghost sm">${icon('upload', 12)} Upload<input type="file" id="src" accept="image/*" hidden></label></div></div>
        ${field('Format', sel('fmt', Object.entries(FORMATS).map(([k, v]) => [k, v[0]]), st.format))}
        ${field('Mood', sel('mood', MOODS, st.mood))}
        <label class="field"><span>Image prompt (editable)</span><textarea class="in" id="prompt" rows="5">${esc(st.prompt)}</textarea></label>
        <div class="row"><button class="btn ghost" id="wp">${icon('bot', 12)} Write prompt</button><button class="btn" id="gi">${icon('image', 12)} Generate 2 images</button></div>
      </div>`)}
      ${card('Image variants', 'Predicted CTR is a rough estimate until our own A/B test replaces it. Pick two for the A/B test.', imgs.length ? `<div class="imgs">${imgs.map((a) => `<div class="im ${st.ab.includes(a.id) ? 'on' : ''}" data-ab="${a.id}"><img src="${blobURL(a.blob)}"><div class="cap"><span>${a.mood || ''}</span><b>${a.ctr ? pct(a.ctr, 2) : ''}</b></div>
          <div class="row" style="padding:0 8px 8px"><button class="btn sm ghost" data-dl="${a.id}">${icon('download', 11)}</button><button class="btn sm ghost" data-del="${a.id}">${icon('trash', 11)}</button></div></div>`).join('')}</div>
          <div class="row mt"><span class="sub">${st.ab.length}/2 selected</span><button class="btn sm" id="abgo" ${st.ab.length === 2 ? '' : 'disabled'}>${icon('flask', 12)} Start A/B test</button></div>` : '<div class="empty"><b>No images yet</b>Upload a product photo, write a prompt, then generate.</div>')}
    </div>
    <div class="grid g32">
      ${card('Reels storyboard', '15-second video plan: scene, caption and Korean voice-over', `
        ${st.storyboard.length ? table([{ label: 'Sec', fmt: (s) => `<b>${s.seconds}s</b>` }, { label: 'Visual', k: 'visual' }, { label: 'Caption', fmt: (s) => `<b>${esc(s.caption)}</b>${String(s.caption).match(BANNED) ? ' ' + badge('check claim', 'red') : ''}` }, { label: 'Voice-over', k: 'voice' }], st.storyboard) : '<div class="empty">No storyboard yet</div>'}
        <div class="row mt"><button class="btn ghost" id="sb">${icon('bot', 12)} Write storyboard</button><button class="btn ghost" id="vo" ${st.storyboard.length ? '' : 'disabled'}>${icon('play', 12)} Hear voice-over</button><button class="btn" id="mk" ${st.storyboard.length && imgs.length ? '' : 'disabled'}>${icon('video', 12)} Make video</button></div>
        <p class="note mt">The video is a slideshow of your images with captions, rendered in the browser (WebM). Record the voice-over on a phone or with a TTS tool and add it in CapCut if needed. Captions are checked for claims we cannot prove (1위, 최고, health effects).</p>`)}
      ${card('Videos', `${vids.length} saved`, vids.length ? `<div class="imgs">${vids.map((v) => `<div class="im"><video src="${blobURL(v.blob)}" controls muted playsinline></video><div class="row" style="padding:6px 8px"><button class="btn sm ghost" data-dl="${v.id}">${icon('download', 11)}</button><button class="btn sm ghost" data-del="${v.id}">${icon('trash', 11)}</button></div></div>`).join('')}</div>` : '<div class="empty">No videos yet</div>')}
    </div>`;

    const save = () => db.set('studio:' + p.id, st);
    $('#pp').onchange = (e) => { pid = e.target.value; this.render(root); };
    $('#fmt').onchange = (e) => { st.format = e.target.value; save(); };
    $('#mood').onchange = (e) => { st.mood = e.target.value; save(); };
    $('#prompt').onchange = (e) => { st.prompt = e.target.value; save(); };
    $('#src').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; await assets.put({ kind: 'source', productId: p.id, blob: f, name: f.name }); this.render(root); };
    $('#wp').onclick = (e) => busy(e.currentTarget, async () => {
      const out = await claudeJSON({ model: settings().models.skill, prompt: `Write an English image-generation prompt for a ${FORMATS[st.format][0]} ad image of this product: ${p.title || p.name}. Mood: ${MOODS.find((m) => m[0] === st.mood)[1]}. The attached product photo must stay exactly the same (shape, colour, logo); only change background, lighting and props. Korean home setting, natural light, no text unless mood is bold (then max 6 Korean words).`,
        schema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] } });
      st.prompt = out.prompt; save(); this.render(root);
    });
    $('#gi').onclick = (e) => busy(e.currentTarget, async () => {
      st.prompt = $('#prompt').value.trim(); save();
      if (!st.prompt) throw new Error('Write or generate a prompt first');
      const src = source.at(-1);
      const images = src ? [{ mime: src.blob.type || 'image/jpeg', data: (await readFile(src.blob, 'dataurl')).split(',')[1] }] : [];
      const [w, h] = FORMATS[st.format].slice(1);
      for (let i = 0; i < 2; i++) {
        const r = await geminiImage({ prompt: `${st.prompt}\nAspect ratio ${w}:${h}. Variation ${i + 1}.${src ? ' Use the attached photo as the exact product.' : ''}`, images });
        for (const im of r.images) {
          const blob = await (await fetch(`data:${im.mime};base64,${im.data}`)).blob();
          await assets.put({ kind: 'image', productId: p.id, blob, prompt: st.prompt, mood: st.mood, format: st.format, ctr: ctrEstimate({ mood: st.mood, hasText: st.mood === 'bold' }) * (0.95 + Math.random() * 0.1) });
        }
        if (!r.images.length) toast('Model returned no image: ' + (r.text || '').slice(0, 120), 'err');
      }
      audit('draft', 'Generated images for ' + p.name); this.render(root);
    });
    $$('[data-ab]', root).forEach((el) => el.addEventListener('click', (e) => { if (e.target.closest('button')) return; const id = el.dataset.ab; st.ab = st.ab.includes(id) ? st.ab.filter((x) => x !== id) : [...st.ab, id].slice(-2); save(); this.render(root); }));
    $$('[data-dl]', root).forEach((b) => b.addEventListener('click', async () => { const a = await assets.get(b.dataset.dl); const u = URL.createObjectURL(a.blob); const l = document.createElement('a'); l.href = u; l.download = `${p.id}-${a.id}.${a.kind === 'video' ? 'webm' : (a.blob.type.split('/')[1] || 'png')}`; l.click(); }));
    $$('[data-del]', root).forEach((b) => b.addEventListener('click', async () => { await assets.del(b.dataset.del); this.render(root); }));
    if ($('#abgo')) $('#abgo').onclick = () => { saveIn('experiments', { productId: p.id, hypothesis: 'Thumbnail B gets a higher CTR than A', action: `A/B test images ${st.ab.join(' vs ')}`, metric: 'CTR', before: '', start: today(), status: 'running' }, 'e'); toast('A/B test logged in Strategy Lab. Upload both images in WING.', 'ok'); };
    $('#sb').onclick = (e) => busy(e.currentTarget, async () => {
      const out = await claudeJSON({ model: settings().models.skill, prompt: `Write a 15-second Instagram Reels storyboard in Korean for "${p.title || p.name}" (₩${p.price}). 4–5 scenes. Hook in the first 2 seconds, problem → solution → call to action (쿠팡에서 검색). No claims like 1위/최고/health effects.`,
        schema: { type: 'object', properties: { scenes: { type: 'array', items: { type: 'object', properties: { seconds: { type: 'number' }, visual: { type: 'string', description: 'what the image shows (English)' }, caption: { type: 'string', description: 'on-screen Korean caption, max 14 chars' }, voice: { type: 'string', description: 'Korean voice-over' } }, required: ['seconds', 'visual', 'caption', 'voice'] } } }, required: ['scenes'] } });
      st.storyboard = out.scenes; save(); this.render(root);
    });
    $('#vo').onclick = () => { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(st.storyboard.map((s) => s.voice).join(' ')); u.lang = 'ko-KR'; speechSynthesis.speak(u); };
    $('#mk').onclick = (e) => busy(e.currentTarget, async () => {
      const blob = await makeSlideshow(imgs.map((a) => a.blob), st.storyboard, FORMATS.reels.slice(1));
      await assets.put({ kind: 'video', productId: p.id, blob }); audit('draft', 'Video for ' + p.name); toast('Video saved', 'ok'); this.render(root);
    });
  },
};

/** Slideshow video: Ken-Burns zoom on each image, caption bar, recorded with MediaRecorder (WebM). */
async function makeSlideshow(blobs, scenes, [W, H]) {
  if (!window.MediaRecorder) throw new Error('This browser cannot record video. Use Chrome or Edge.');
  const ims = await Promise.all(blobs.map((b) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = URL.createObjectURL(b); })));
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const stream = c.captureStream(30);
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4e6 });
  const chunks = []; rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  rec.start();
  for (let s = 0; s < scenes.length; s++) {
    const im = ims[s % ims.length], dur = Math.max(1.5, +scenes[s].seconds || 3) * 1000, t0 = performance.now();
    await new Promise((res) => {
      (function frame() {
        const t = Math.min(1, (performance.now() - t0) / dur), z = 1.05 + 0.08 * t;
        const sc = Math.max(W / im.width, H / im.height) * z, w = im.width * sc, h = im.height * sc;
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
        g.fillStyle = 'rgba(21,25,40,.72)'; g.fillRect(0, H * 0.72, W, H * 0.14);
        g.fillStyle = '#fff'; g.font = `700 ${Math.round(W / 14)}px "Noto Sans KR", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(scenes[s].caption, W / 2, H * 0.79, W * 0.9);
        if (t < 1) requestAnimationFrame(frame); else res();
      })();
    });
  }
  rec.stop(); await done;
  return new Blob(chunks, { type: 'video/webm' });
}

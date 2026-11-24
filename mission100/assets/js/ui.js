// UI helpers: formatting, Purity-style components, SVG charts, toasts and modals.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const num = (n, d = 0) => (n == null || isNaN(n) ? '–' : Number(n).toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: d }));
export const won = (n) => (n == null || isNaN(n) ? '–' : (n < 0 ? '-₩' : '₩') + Math.round(Math.abs(n)).toLocaleString('ko-KR'));
export const pct = (n, d = 1) => (n == null || !isFinite(n) ? '–' : (n * 100).toFixed(d) + '%');
export const kfmt = (n) => (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : num(n));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
// Dates are plain 'YYYY-MM-DD' strings in local (Korea) time; arithmetic is done in UTC to avoid time-zone drift.
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const addDays = (d, n) => { const x = new Date(String(d).slice(0, 10) + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const md = (d) => (d ? d.slice(5).replace('-', '/') : '');
export const ago = (iso) => { if (!iso) return 'never'; const s = (Date.now() - new Date(iso)) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : Math.floor(s / 86400) + ' d ago'; };

// ---------- icons (stroke icons, 24 grid) ----------
const P = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM21 21l-4.3-4.3',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  image: 'M3 5h18v14H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 19',
  mega: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  truck: 'M1 4h14v12H1zM15 9h4l3 3v4h-7M5.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  flask: 'M9 3h6M10 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4a1.5 1.5 0 0 0 1.3-2l-6-10V3M7 14h10',
  bot: 'M12 3v3M5 8h14v11H5zM9 13h.01M15 13h.01M9 16.5h6M2 12v3M22 12v3',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  wallet: 'M3 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 6l13-3v3M17 13h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  cart: 'M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM20 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6',
  rocket: 'M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1zM12 15l-3-3a22 22 0 0 1 2-4A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2zM9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5',
  check: 'M20 6L9 17l-5-5', x: 'M18 6L6 18M6 6l12 12', plus: 'M12 5v14M5 12h14',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  play: 'M5 3l14 9-14 9z', send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9z', menu: 'M3 12h18M3 6h18M3 18h18',
  alert: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  trend: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6', copy: 'M9 9h13v13H9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  trash: 'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2',
  video: 'M23 7l-7 5 7 5zM1 5h15v14H1z', key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zM15.5 7.5l3 3L22 7l-3-3',
};
export const icon = (n, s = 16, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${P[n] || P.box}"/></svg>`;

// ---------- components ----------
export const card = (title, sub, body, { cls = '', actions = '', id = '' } = {}) =>
  `<section class="card ${cls}" ${id ? `id="${id}"` : ''}>${title ? `<div class="card-h"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div><div class="sp"></div>${actions}</div>` : ''}${body}</section>`;

export const stat = (label, value, delta = '', up = true, ic = 'chart') =>
  `<section class="card"><div class="stat"><div class="t"><div class="l">${label}</div><div class="v">${value}${delta !== '' ? ` <small class="${up ? 'up' : 'down'}">${delta}</small>` : ''}</div></div><div class="ibox">${icon(ic, 20)}</div></div></section>`;

export const badge = (text, color = 'gray') => `<span class="badge ${color}">${esc(text)}</span>`;
export const empty = (title, text = '', action = '') => `<div class="empty"><b>${title}</b>${text}${action ? `<div class="mt">${action}</div>` : ''}</div>`;
export const field = (label, input, hint = '') => `<label class="field"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ''}</label>`;
export const inp = (id, value = '', attrs = '') => `<input class="in" id="${id}" value="${esc(value)}" ${attrs}>`;
export const sel = (id, opts, value) => `<select class="in" id="${id}">${opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
export const sw = (id, label, on) => `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i>${label}</label>`;

/** cols: [{k, label, align, fmt(row)}] */
export function table(cols, rows, { hl = () => false, emptyText = 'No data yet' } = {}) {
  if (!rows.length) return empty(emptyText);
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th class="${c.align || ''}">${c.label}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r, i) => `<tr class="${hl(r, i) ? 'hl' : ''}">${cols.map((c) => `<td class="${c.align || ''}">${c.fmt ? c.fmt(r, i) : esc(r[c.k])}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
}

export function timeline(items) {
  if (!items.length) return empty('Nothing yet');
  return `<div class="tl">${items.map((t) => `<div class="tl-i"><div class="d" style="background:${t.color || 'var(--teal)'}">${icon(t.icon || 'check', 11, 3)}</div><div><b>${t.title}</b><span>${t.sub || ''}</span></div></div>`).join('')}</div>`;
}

export function ring(value, max, label, sub) {
  const r = 62, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, value / max));
  return `<svg class="ring" viewBox="0 0 150 150"><circle cx="75" cy="75" r="${r}" stroke="rgba(255,255,255,.3)" stroke-width="10" fill="none"/><circle cx="75" cy="75" r="${r}" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="${c * f} ${c}" transform="rotate(-90 75 75)"/><text x="75" y="78" text-anchor="middle" font-size="34" font-weight="700" fill="#fff">${label}</text><text x="75" y="102" text-anchor="middle" font-size="12" fill="#fff" opacity=".85">${sub}</text></svg>`;
}

// ---------- charts ----------
/** Dark "Active users" style bar chart (white bars). */
export function barChart(values, labels = [], { h = 200 } = {}) {
  const W = 520, H = h, pad = 26, max = Math.max(1, ...values), n = Math.max(1, values.length), bw = Math.min(14, ((W - pad - 10) / n) * 0.45);
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  let s = ticks.map((t) => { const y = H - 22 - (t / max) * (H - 40); return `<text x="0" y="${y + 4}" fill="#fff" font-size="11">${t}</text>`; }).join('');
  values.forEach((v, i) => {
    const x = pad + ((W - pad - 10) / n) * (i + 0.5) - bw / 2, bh = Math.max(2, (v / max) * (H - 40)), y = H - 22 - bh;
    s += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${Math.min(8, bw / 2)}" fill="#fff"><title>${labels[i] || ''}: ${v}</title></rect>`;
    if (labels[i] && (n <= 14 || i % 2 === 0)) s += `<text x="${x + bw / 2}" y="${H - 6}" fill="#A0AEC0" font-size="10" text-anchor="middle">${labels[i]}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">${s}</svg>`;
}

/** Sales-overview style area/line chart. series: [{name, color, values, area}] */
export function areaChart(series, labels, { h = 260, fmt = kfmt, marks = [], hline = null, xfmt = (l) => l } = {}) {
  const W = 760, H = h, L = 52, R = 14, T = 14, B = 28;
  const all = series.flatMap((s) => s.values).concat(hline ? [hline.v] : []).filter((v) => v != null && isFinite(v));
  let lo = Math.min(0, ...all), hi = Math.max(1, ...all); if (hi === lo) hi = lo + 1; hi += (hi - lo) * 0.08;
  const n = labels.length, X = (i) => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R)), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  let s = `<defs>${series.map((se, k) => `<linearGradient id="ag${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${se.color}" stop-opacity=".8"/><stop offset="1" stop-color="${se.color}" stop-opacity="0"/></linearGradient>`).join('')}</defs>`;
  for (let t = 0; t <= 4; t++) { const v = lo + ((hi - lo) * t) / 4, y = Y(v); s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="#E2E8F0" stroke-dasharray="5"/><text x="${L - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#A0AEC0">${fmt(v)}</text>`; }
  const step = Math.max(1, Math.ceil(n / 8));
  labels.forEach((l, i) => { if (i % step === 0 || i === n - 1) s += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#A0AEC0">${xfmt(l)}</text>`; });
  if (hline) s += `<line x1="${L}" x2="${W - R}" y1="${Y(hline.v)}" y2="${Y(hline.v)}" stroke="${hline.color || '#F56565'}" stroke-width="1.5" stroke-dasharray="6 4"/><text x="${W - R}" y="${Y(hline.v) - 6}" text-anchor="end" font-size="11" fill="${hline.color || '#F56565'}">${hline.label || ''}</text>`;
  series.forEach((se, k) => {
    const pts = se.values.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean);
    if (!pts.length) return;
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    if (se.area !== false) s += `<path d="${d} L${pts.at(-1)[0]} ${Y(Math.max(lo, 0))} L${pts[0][0]} ${Y(Math.max(lo, 0))}Z" fill="url(#ag${k})" opacity=".55"/>`;
    s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.width || 3}" ${se.dash ? `stroke-dasharray="${se.dash}"` : ''}/>`;
  });
  marks.forEach((m) => { s += `<line x1="${X(m.i)}" x2="${X(m.i)}" y1="${T}" y2="${H - B}" stroke="${m.color}" stroke-dasharray="4 3"/><circle cx="${X(m.i)}" cy="${Y(m.v)}" r="5" fill="${m.color}" stroke="#fff" stroke-width="2"/><text x="${X(m.i) + 6}" y="${T + 12 + (m.dy || 0)}" font-size="11.5" font-weight="700" fill="${m.color}">${m.label}</text>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="height:auto">${s}</svg>`;
}
export const legend = (items) => `<div class="legend">${items.map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div>`;

// ---------- feedback ----------
export function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), type === 'err' ? 7000 : 3500);
}

/** modal(title, html, [{label, value, cls}]) -> Promise<value|null> ; onMount(root) optional */
export function modal(title, html, buttons = [{ label: 'Close', value: null, cls: 'ghost' }], onMount) {
  return new Promise((resolve) => {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal"><h3>${title}</h3><div class="mb">${html}</div><div class="row end">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${b.label}</button>`).join('')}</div></div>`;
    const close = (v) => { bg.remove(); resolve(v); };
    bg.addEventListener('click', (e) => { if (e.target === bg) close(null); });
    $$('[data-i]', bg).forEach((b) => b.addEventListener('click', () => { const btn = buttons[b.dataset.i]; close(typeof btn.value === 'function' ? btn.value(bg) : btn.value); }));
    document.body.appendChild(bg);
    onMount && onMount(bg);
  });
}

/** Run an async task while showing a spinner on the button. */
export async function busy(btn, fn) {
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Working`;
  try { return await fn(); } catch (e) { toast(e.message, 'err'); console.error(e); } finally { btn.disabled = false; btn.innerHTML = old; }
}

/** Very small markdown → HTML for agent replies. */
export function mdToHtml(t) {
  return esc(t)
    .replace(/^### (.*)$/gm, '<h4>$1</h4>').replace(/^## (.*)$/gm, '<h3>$1</h3>').replace(/^# (.*)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const readFile = (file, as = 'text') => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; as === 'dataurl' ? r.readAsDataURL(file) : r.readAsText(file, 'utf-8'); });

/** Parse CSV (handles quotes) → array of objects using the first row as headers. */
export function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const clean = rows.filter((r) => r.some((x) => x.trim()));
  if (!clean.length) return [];
  const head = clean[0].map((h) => h.trim());
  return clean.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
export const toNum = (v) => { if (typeof v === 'number') return v; const n = parseFloat(String(v ?? '').replace(/[₩,%\s원]/g, '')); return isNaN(n) ? 0 : n; };

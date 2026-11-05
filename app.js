(() => {
'use strict';
const ZX = window.ZX;
const CW = 64, CH = 52;           // grid cell size (px)
const KEY = 'zx-draw-doc-v1';        // old single-canvas autosave (read once, for migration)
const WS_KEY = 'zx-draw-ws-v1';      // workspace: every tab of the open canvas
const $ = (s, r = document) => r.querySelector(s);
const vp = $('#viewport'), world = $('#world'), insp = $('#insp'), pop = $('#pop'), marq = $('#marquee');
const isPhone = () => matchMedia('(max-width: 640px)').matches;

// ---------- icons ----------
const ico = (d, w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  play: ico('<circle cx="12" cy="12" r="9"/><path d="M10.2 8.8l5 3.2-5 3.2z"/>', 16),
  pointer: ico('<path d="M5.2 4.3a.7.7 0 01.92-.9l13.3 5.4a.7.7 0 01-.07 1.32l-5.2 1.6a1.4 1.4 0 00-.93.93l-1.6 5.2a.7.7 0 01-1.32.07z"/>'),
  hand: ico('<path d="M18 11V6a2 2 0 00-4 0v5"/><path d="M14 10V4a2 2 0 00-4 0v6"/><path d="M10 10.5V6a2 2 0 00-4 0v8"/><path d="M18 8a2 2 0 114 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15"/>'),
  minus: ico('<path d="M5 12h14"/>', 16),
  text: ico('<path d="M6 6.5V5h12v1.5M12 5v14M9.5 19h5"/>'),
  chevL: ico('<path d="M14.5 6l-6 6 6 6"/>', 16),
  chevR: ico('<path d="M9.5 6l6 6-6 6"/>', 16),
  wire: ico('<path d="M6 18L18 6"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="5.5" r="2"/>'),
  undo: ico('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>'),
  redo: ico('<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>'),
  trash: ico('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 16),
  copy: ico('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>', 15),
  sliders: ico('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>', 15),
  grip: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  plus: ico('<path d="M12 5v14M5 12h14"/>', 16),
  fit: ico('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  tidy: ico('<rect x="3" y="7" width="6" height="10" rx="1.5"/><rect x="15" y="7" width="6" height="10" rx="1.5"/><path d="M11 12h2"/>'),
  eye: ico('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path class="eye-cut" d="M4.5 4.5l15 15"/><path class="eye-slash" d="M4.5 4.5l15 15"/>'),
  help: ico('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 014.9.6c0 1.8-2.5 2.1-2.5 3.7"/><path d="M12 17h.01"/>'),
  folder: ico('<path d="M3 7.5A1.5 1.5 0 014.5 6h4l2 2h9A1.5 1.5 0 0121 9.5v8a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5z"/>'),
  file: ico('<path d="M14 3H6.5A1.5 1.5 0 005 4.5v15A1.5 1.5 0 006.5 21h11a1.5 1.5 0 001.5-1.5V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>'),
  down: ico('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 16),
  up: ico('<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>', 16),
  loop: ico('<path d="M12 20v-7"/><path d="M12 13c-4.5-.5-5.5-8 0-8s4.5 7.5 0 8"/>', 16),
  marrow: '<svg width="22" height="18" viewBox="0 0 26 18"><path d="M1.5 9h23" stroke="currentColor" stroke-width="2.6"/><path d="M8.6 4.4h4.6l4.3 4.6-4.3 4.6H8.6L12.6 9z" fill="#b9b9c2" stroke="currentColor" stroke-width="1.3" stroke-linejoin="miter"/></svg>',
  unfold: ico('<path d="M3 12h4M17 12h4"/><circle cx="9.5" cy="7" r="1.6"/><circle cx="9.5" cy="17" r="1.6"/><circle cx="14.5" cy="7" r="1.6"/><circle cx="14.5" cy="17" r="1.6"/><path d="M11 7h2M11 8l2 8M11 16l2-8"/>', 16),
  rev: ico('<path d="M7 8h13l-3-3M17 16H4l3 3"/>', 16),
  map: ico('<path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>', 16),
  close: ico('<path d="M7 7l10 10M17 7L7 17"/>', 13),
  dot: '<svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.6" fill="currentColor"/><path d="M3.5 12h5M15.5 12h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".45"/></svg>',
  lock: ico('<rect class="lk-b" x="5" y="11" width="14" height="9.5" rx="2.2"/><path class="lk-sh" d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  lockS: ico('<rect x="5" y="11" width="14" height="9.5" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 11),
  clock: ico('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', 16),
  play: '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l9.6-6.2a.8.8 0 0 0 0-1.4L9.2 5.1A.8.8 0 0 0 8 5.8z" fill="currentColor"/></svg>',
  tick: ico('<path d="M5.5 12.5l4 4 9-9"/>', 13),
  wrap: ico('<path d="M4 6h16M4 12h12.5a3.5 3.5 0 010 7H11"/><path d="M13.5 16.5L11 19l2.5 2.5M4 18h3.5"/>'),
  wand: ico('<path d="M4 20L14.5 9.5"/><path d="M13 5.5V3.5M18.5 11h2M16.8 7.2l1.5-1.5M16.8 14.8l1.5 1.5M9.2 7.2L7.7 5.7"/>', 15),
  matrix: ico('<path d="M8 4H5v16h3M16 4h3v16h-3"/><circle cx="10" cy="9.5" r=".6" fill="currentColor"/><circle cx="14" cy="9.5" r=".6" fill="currentColor"/><circle cx="10" cy="14.5" r=".6" fill="currentColor"/><circle cx="14" cy="14.5" r=".6" fill="currentColor"/>', 15),
  rot: ico('<path d="M19.5 12.5a7.5 7.5 0 1 1-2.2-6.1"/><path d="M19.5 3.5v4.5H15"/>', 15),
  okc: ico('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.3l2.4 2.4 4.6-5"/>', 15),
  swap: ico('<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>', 16),
};
const curveIco = (d) => `<svg width="22" height="16" viewBox="0 0 24 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">${d}</svg>`;
const CURVES = [
  ['', 'Straight', curveIco('<path d="M3 9h18"/>')],
  ['bend left', 'Bend left', curveIco('<path d="M3 13Q12 1 21 13"/>')],
  ['bend right', 'Bend right', curveIco('<path d="M3 5Q12 17 21 5"/>')],
  ['s', 'S-curve (s)', curveIco('<path d="M3 15C12 15 12 3 21 3"/>')],
  ["o'", "Cap (o')", curveIco('<path d="M5 15C5 2 19 2 19 15"/>')],
  ['o.', 'Cup (o.)', curveIco('<path d="M5 3C5 16 19 16 19 3"/>')],
  ['C', 'C-curve (C)', curveIco('<path d="M17 2C5 2 5 16 17 16"/>')],
];
const PHASES = [['π', '\\pi'], ['π/2', '\\frac{\\pi}{2}'], ['−π/2', '-\\frac{\\pi}{2}'], ['π/4', '\\frac{\\pi}{4}'], ['α', '\\alpha'], ['−α', '-\\alpha'], ['β', '\\beta'], ['α⊕β', '\\alpha\\oplus\\beta'], ['0', '']];
const RULES = ['(sp)', '(id)', '(\\pi)', '(cc)', '(b)', '(hh)', '(sc)', '(eu)', '(h)', '(c)'];
const RELS = [['None', ''], ['=', '='], [':=', ':='], ['∝', '\\propto'], ['≈', '\\approx'], ['⇒', '\\Rightarrow']];

const EXAMPLE = String.raw`\[
    \zx[row sep=3mm, column sep=4mm]{
      \zxN{} \ar[rrr] & & & \zxX{} \ar[rr] \ar[dd] & & \zxZ{} \rar \dar & \zxN{} \\
      & & & & & \zxH{} \dar & \\
      \zxN{} \rar & \zxX{} \rar \dar & \zxH{} \rar & \zxZ{} \rar & \zxH{} \rar & \zxZ{} \rar & \zxN{} \\
      \zxZ{} \rar & \zxZ{} \ar[rr] & & \zxX{\pi} \ar[rr] & & \zxX{} &
    }
    \stackrel{\mathbf{(sp)}}{=}
    \zx[row sep=3mm, column sep=4mm]{
      \zxN{} \ar[rrr] & & & \zxX{} \ar[rr] \ar[dd] & & \zxZ{} \rar \dar & \zxN{} \\
      & & & & & \zxH{} \dar & \\
      \zxN{} \rar & \zxX{} \rar \dar & \zxH{} \rar & \zxZ{} \rar & \zxH{} \rar & \zxZ{} \rar & \zxN{} \\
                  & \zxZ{} \ar[rrrr] & &   & & \zxX{\pi} &
    }
    \stackrel{\mathbf{(id)(sp)}}{=}
    \zx[row sep=3mm, column sep=4mm]{
      \zxN{} \ar[rrr] & & & \zxX{} \ar[rr] \ar[dd] & & \zxZ{} \rar \dar & \zxN{} \\
      & & & & & \zxH{} \dar & \\
      \zxN{} \rar & \zxX{\pi} \rar & \zxH{} \rar & \zxZ{} \rar & \zxH{} \rar & \zxZ{} \rar & \zxN{} \\
    }
\]`;

// ---------- state ----------
let doc = { diagrams: [], seps: [] };
let wirePend = null; // wire tool: first node of a click-click connection
let sel = new Set(), tool = 'select', cam = { x: 0, y: 0, k: 1 }, preview = false;
let drag = null, pinch = null, spaceDown = false, holdS = false, lastWorld = null, activeDi = 0, clip = null;
let hist = [], redoStack = [];
const pointers = new Map();
// A canvas holds several tabs (pages). `doc` is always the open tab's diagrams; each tab keeps
// its own camera and undo history (history lives in memory only).
let ws = { tabs: [], active: 0 }, wsPrev = null;
const tabHist = new Map();
const curTab = () => ws.tabs[ws.active];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const texCache = new Map();
function tex(s) {
  if (!s) return '';
  if (texCache.has(s)) return texCache.get(s);
  let h;
  try {
    h = window.katex ? katex.renderToString(s, { throwOnError: false }) : esc(fallbackTex(s));
  } catch (_) { h = esc(s); }
  texCache.set(s, h);
  return h;
}
const fallbackTex = (s) => s.replace(/\\pi/g, 'π').replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\oplus/g, '⊕')
  .replace(/\\propto/g, '∝').replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2').replace(/\\stackrel\{(.*)\}\{(.*)\}/, '$2 $1').replace(/\\mathbf|[{}\\]/g, '');

// ---------- model helpers ----------
const pos = (d, n) => ({ x: d.ox + n.c * CW, y: d.oy + n.r * CH });
const at = (d, r, c) => d.nodes.find((n) => n.r === r && n.c === c);
const cellOf = (d, p) => ({ r: Math.round((p.y - d.oy) / CH), c: Math.round((p.x - d.ox) / CW) });
const makeNode = (t, r, c) => Object.assign({ id: ZX.newId('n'), r, c, t, label: t === 'T' ? '\\vdots' : '', cmd: '', v: '', st: '' },
  t === 'M' ? { label: 'A', lin: '', lout: '', mat: null } : {});
function findNode(id) { for (const d of doc.diagrams) { const n = d.nodes.find((m) => m.id === id); if (n) return { n, d }; } return null; }
function findEdge(id) { for (const d of doc.diagrams) { const e = d.edges.find((m) => m.id === id); if (e) return { e, d }; } return null; }
function frameRect(d) {
  const b = ZX.bounds(d);
  return { x0: d.ox + b.c0 * CW - CW / 2, y0: d.oy + b.r0 * CH - CH / 2, x1: d.ox + b.c1 * CW + CW / 2, y1: d.oy + b.r1 * CH + CH / 2 };
}
const DOT_GLYPH = { '\\vdots': '⋮', '\\cdots': '⋯', '\\dots': '…', '\\ldots': '…', '\\ddots': '⋱' };
const DOTS = /^\\(v|c|d|l)?dots$/;
function setType(n, t) {
  n.t = t; n.cmd = ''; n.v = '';
  if (t === 'H' || t === 'N' || t === 'P') n.label = '';
  if (t === 'T' && !n.label) n.label = '\\vdots';
  if (t !== 'T' && DOTS.test(n.label)) n.label = '';
}

function pickDiagram(p) {
  if (!doc.diagrams.length) {
    const d = ZX.newDiagram('');
    d.ox = Math.round(p.x / CW) * CW; d.oy = Math.round(p.y / CH) * CH;
    doc.diagrams.push(d);
    return d;
  }
  let best = null, bd = Infinity;
  for (const d of doc.diagrams) {
    const f = frameRect(d);
    const dist = Math.hypot(Math.max(f.x0 - p.x, 0, p.x - f.x1), Math.max(f.y0 - p.y, 0, p.y - f.y1));
    if (dist < bd) { bd = dist; best = d; }
  }
  return best;
}

// Which diagrams start a new line: a manual break (d.br) or the per-tab "diagrams per line" (doc.wrap).
function lineStarts(dc = doc) {
  const st = []; let n = 0;
  dc.diagrams.forEach((d, i) => {
    const b = i > 0 && (d.br || (dc.wrap > 0 && n >= dc.wrap));
    if (b) n = 0;
    st.push(b); n++;
  });
  return st;
}
const ROW_GAP = 3;   // empty grid rows between two lines of diagrams
// Lay the chain out left to right, wrapping onto new lines. A wrapped line is indented by the
// relation that links it to the previous diagram (the same look as the LaTeX per-line export).
function tidy() {
  const ds = doc.diagrams;
  if (!ds.length) return;
  const st = lineStarts(), rows = [];
  ds.forEach((d, i) => { if (i === 0 || st[i]) rows.push([]); rows[rows.length - 1].push(i); });
  const b0 = ZX.bounds(ds[0]), X0 = ds[0].ox + b0.c0 * CW;
  let cy = ds[0].oy + Math.round((b0.r0 + b0.r1) / 2) * CH, prevDown = 0;
  rows.forEach((row, k) => {
    const bs = row.map((i) => ZX.bounds(ds[i])), mids = bs.map((b) => Math.round((b.r0 + b.r1) / 2));
    const up = Math.max(...bs.map((b, j) => mids[j] - b.r0)), down = Math.max(...bs.map((b, j) => b.r1 - mids[j]));
    if (k > 0) cy += (prevDown + ROW_GAP + up) * CH;
    let x = k === 0 ? X0 : X0 + sepGap(doc.seps[row[0] - 1]) * CW;
    row.forEach((i, j) => {
      const d = ds[i], b = bs[j];
      if (i > 0) { d.ox = x - b.c0 * CW; d.oy = cy - mids[j] * CH; }
      x = d.ox + b.c1 * CW + sepGap(doc.seps[i]) * CW;
    });
    prevDown = down;
  });
}
// Where the relation between diagram i and i+1 is drawn (a wrapped line shows it in its indent).
function sepPoint(i, rects, st) {
  const a = rects[i], b = rects[i + 1];
  if (st[i + 1]) return { x: b.x0 - sepGap(sepOf(i)) * CW / 2, y: (b.y0 + b.y1) / 2 };
  return { x: (a.x1 + b.x0) / 2, y: ((a.y0 + a.y1) / 2 + (b.y0 + b.y1) / 2) / 2 };
}
// Grid cells between two diagrams: just enough room for the relation drawn between them.
function sepGap(s) {
  if (s == null) s = '=';
  if (!s.trim()) return 2;
  const shown = s.replace(/\\(stackrel|mathbf|mathrm|text|overset)/g, '').replace(/\\[a-zA-Z]+/g, 'x').replace(/[{}\s]/g, '');
  return shown.length <= 7 ? 2 : 3;
}
const sepOf = (i) => (doc.seps[i] == null ? '=' : doc.seps[i]);

// ---------- history / persistence ----------
function snapshot() { if (isLocked()) { lockedNote(); throw LOCKED; } wsPrev = null; hist.push(JSON.stringify(doc)); if (hist.length > 300) hist.shift(); redoStack = []; }
function save() {
  const t = curTab();
  if (t) { t.doc = doc; t.cam = { x: cam.x, y: cam.y, k: cam.k }; }
  const raw = JSON.stringify(ws);
  if (!storeRaw(WS_KEY, raw)) return;
  autoBackup(raw);
}
// ---------- safe storage: backups that survive a bad save or an unreadable autosave ----------
const BK_KEY = 'zx-draw-backups-v1', BK_AUTO_MS = 5 * 60 * 1000, BK_AUTO_KEEP = 3, BK_MAX = 8;
let storeWarned = false, lastAutoBk = 0;
function loadBackups() { try { const a = JSON.parse(localStorage.getItem(BK_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
// write; when the browser is full, drop the oldest automatic backups and try again
function storeRaw(key, raw) {
  for (let tries = 0; tries < 4; tries++) {
    try { localStorage.setItem(key, raw); storeWarned = false; return true; } catch (e) {
      const a = loadBackups(), k = a.map((b) => b.reason).lastIndexOf('auto');
      if (key === BK_KEY || k < 0) break;
      a.splice(k, 1);
      try { localStorage.setItem(BK_KEY, JSON.stringify(a)); } catch (_) { break; }
    }
  }
  if (!storeWarned) { storeWarned = true; toast('Browser storage is full — export the canvas (.zxd) to keep your work'); }
  return false;
}
function pushBackup(raw, reason) {
  const a = loadBackups();
  if (a.length && a[0].raw === raw) return;
  a.unshift({ t: Date.now(), reason, raw });
  // keep every rescue copy, but only the newest few automatic ones
  let autos = 0;
  const kept = a.filter((b) => b.reason !== 'auto' || ++autos <= BK_AUTO_KEEP).slice(0, BK_MAX);
  storeRaw(BK_KEY, JSON.stringify(kept));
}
// a snapshot every few minutes while you work (only when something changed)
function autoBackup(raw) {
  const now = Date.now();
  if (now - lastAutoBk < BK_AUTO_MS) return;
  if (!lastAutoBk) { lastAutoBk = now; return; }   // not right after opening
  lastAutoBk = now;
  pushBackup(raw, 'auto');
}
// what a backup holds (pages / diagrams), or null when it cannot be read
function backupInfo(b) {
  try {
    const w = JSON.parse(b.raw);
    const tabs = Array.isArray(w.tabs) ? w.tabs : (parseCanvas(b.raw) || {}).tabs;
    if (!tabs || !tabs.length) return null;
    return { tabs: tabs.map((t) => ({ name: t.name || 'Page', doc: cleanDoc(JSON.parse(JSON.stringify(t.doc || null))), locked: !!t.locked })), active: Math.min(w.active | 0, tabs.length - 1) };
  } catch (_) { return null; }
}
function commit() { errMark = null; save(); render(); queueMatSpot(); }
function mutate(fn) { snapshot(); fn(); commit(); }
function pruneSel() { sel = new Set([...sel].filter((id) => (id[0] === 'n' ? findNode(id) : findEdge(id)))); }
// ⌘Z on an untouched page made by Simplify (new page / simplify all) removes that page again
function undoPage() {
  const t = curTab(), back = ws.tabs.findIndex((x) => x.id === t.madeFrom);
  const i = ws.active;
  ws.tabs.splice(i, 1); tabHist.delete(t.id);
  ws.active = back >= 0 ? (back > i ? back - 1 : back) : Math.max(0, i - 1);
  loadTab();
  toast(`Removed “${t.name}”`);
}
function undo() { if (lockedStop()) return; if (!hist.length) return wsPrev ? restoreWorkspace() : curTab() && curTab().madeFrom && ws.tabs.length > 1 ? undoPage() : toast('Nothing to undo'); redoStack.push(JSON.stringify(doc)); doc = JSON.parse(hist.pop()); pruneSel(); commit(); }
function redo() { if (lockedStop()) return; if (!redoStack.length) return; hist.push(JSON.stringify(doc)); doc = JSON.parse(redoStack.pop()); pruneSel(); commit(); }

// ---------- geometry of edges ----------
// Matrix arrow ports: one per column of A on the input side, one per row on the output side.
// L / R are the drawn sides (inputs are on the left unless the arrow points left).
const M_BAR = 20, M_PORT = 30;
// bundled sides (arrow → arrow, port j to port j): one bold wire, no ports drawn
function mBundled(d, n) {
  const out = { in: false, out: false };
  if (!d) return out;
  const b = ZX.matBundles(d);
  if (!b.size) return out;
  b.forEach((x) => { if (x.a === n.id) out.out = true; if (x.b === n.id) out.in = true; });
  return out;
}
function mSlots(d, n) {
  const R = n.mat ? n.mat.length : 0, C = n.mat && n.mat[0] ? n.mat[0].length : 0;
  let si, so;
  if (d) { const s = ZX.matSides(d, n); si = s.inSlots; so = s.outSlots; } else { si = []; so = []; }
  const pad = (S, k) => { const out = S.slice(); while (out.length < Math.max(k, 1)) out.push(null); return out; };
  // no matrix yet: one free port more than the wires drawn, so there is always somewhere to connect
  const ki = n.mat ? C : si.filter(Boolean).length + 1, ko = n.mat ? R : so.filter(Boolean).length + 1;
  const I = pad(si, ki), O = pad(so, ko), fl = n.v === '<', bu = mBundled(d, n);
  return { I, O, L: fl ? O : I, R: fl ? I : O, Lside: fl ? 'out' : 'in', Rside: fl ? 'in' : 'out', bL: fl ? bu.out : bu.in, bR: fl ? bu.in : bu.out };
}
const mGap = (k) => (k > 1 ? Math.min(10, 40 / (k - 1)) : 0);
const mPortY = (k, j) => (j - (k - 1) / 2) * mGap(k);
const mHeight = (sl) => { const kL = sl.bL ? 1 : sl.L.length, kR = sl.bR ? 1 : sl.R.length; return Math.max(30, Math.max(kL - 1, kR - 1, 0) * Math.max(mGap(kL), mGap(kR)) + 16); };
// where wire e meets arrow n drawn at p
let mTipHalf = 0;   // image export: wires meet the two ends of the bar, as in LaTeX
function mTip(d, n, e, p) {
  const sl = mSlots(d, n);
  for (const [S, sx, bu] of [[sl.L, -1, sl.bL], [sl.R, 1, sl.bR]]) {
    const j = S.findIndex((x) => x && x.e.id === e.id);
    if (j >= 0 && mTipHalf) return { x: p.x + sx * mTipHalf, y: p.y };
    if (j >= 0 && bu) return { x: p.x + sx * M_PORT, y: p.y };
    if (j >= 0) return { x: p.x + sx * M_PORT, y: p.y + mPortY(S.length, j) };
  }
  return p;
}
// the port nearest to world point q on arrow n: { side: 'in' | 'out', j, x, y }
function pickPort(d, n, q) {
  const p = pos(d, n), sl = mSlots(d, n), left = q.x < p.x, S = left ? sl.L : sl.R, k = S.length;
  let j = 0, best = Infinity;
  for (let i = 0; i < k; i++) { const dy = Math.abs(q.y - (p.y + mPortY(k, i))); if (dy < best) { best = dy; j = i; } }
  return { side: left ? sl.Lside : sl.Rside, j, x: p.x + (left ? -M_PORT : M_PORT), y: p.y + mPortY(k, j), id: n.id, L: left };
}
function rawGeom(d, e, A, B, P = pos) {
  let p0 = P(d, A), p1 = P(d, B);
  if (A !== B && A.t === 'M') p0 = mTip(d, A, e, p0);
  if (A !== B && B.t === 'M') p1 = mTip(d, B, e, p1);
  const toks = ZX.splitOpts(e.o);
  const hbox = toks.includes('H');
  const cubic = (c1, c2) => ({
    d: `M${p0.x} ${p0.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p1.x} ${p1.y}`,
    m: { x: (p0.x + 3 * c1.x + 3 * c2.x + p1.x) / 8, y: (p0.y + 3 * c1.y + 3 * c2.y + p1.y) / 8 }, h: hbox,
    pts: [p0, c1, c2, p1],
  });
  if (A === B) {
    const lt = toks.find((t) => t.startsWith('loop'));
    const dm = lt && /(above|below|left|right)/.exec(lt);
    const v = { above: [0, -1], below: [0, 1], left: [-1, 0], right: [1, 0] }[dm ? dm[1] : 'above'];
    const L = 36, W = 17, px = -v[1], py = v[0];
    return cubic({ x: p0.x + v[0] * L + px * W, y: p0.y + v[1] * L + py * W }, { x: p0.x + v[0] * L - px * W, y: p0.y + v[1] * L - py * W });
  }
  const dx = p1.x - p0.x, dy = p1.y - p0.y, L = Math.hypot(dx, dy) || 1, k = L * 0.3915;
  const ux = dx / L, uy = dy / L;
  const rot = (x, y, a) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });
  let m;
  const bend = toks.map((t) => /^bend\s+(left|right)(?:\s*=\s*(-?[\d.]+))?/.exec(t)).find(Boolean);
  const out = toks.map((t) => /^out\s*=\s*(-?[\d.]+)/.exec(t)).find(Boolean);
  const inn = toks.map((t) => /^in\s*=\s*(-?[\d.]+)/.exec(t)).find(Boolean);
  const tang = toks.find((t) => /^[<>'.]{2}$/.test(t));
  if (bend) {
    const th = ((bend[2] ? +bend[2] : 30) * Math.PI / 180) * (bend[1] === 'left' ? -1 : 1);
    const a = rot(ux, uy, th), b = rot(-ux, -uy, -th);
    return cubic({ x: p0.x + k * a.x, y: p0.y + k * a.y }, { x: p1.x + k * b.x, y: p1.y + k * b.y });
  }
  if (out || inn) {
    const ao = (out ? +out[1] : Math.atan2(-dy, dx) * 180 / Math.PI) * Math.PI / 180;
    const ai = (inn ? +inn[1] : Math.atan2(dy, -dx) * 180 / Math.PI) * Math.PI / 180;
    return cubic({ x: p0.x + k * Math.cos(ao), y: p0.y - k * Math.sin(ao) }, { x: p1.x + k * Math.cos(ai), y: p1.y - k * Math.sin(ai) });
  }
  if (tang) {
    const h0 = /[<>]/.test(tang[0]), h1 = /[<>]/.test(tang[1]);
    return cubic(h0 ? { x: p0.x + dx * 0.6, y: p0.y } : { x: p0.x, y: p0.y + dy * 0.6 },
                 h1 ? { x: p1.x - dx * 0.6, y: p1.y } : { x: p1.x, y: p1.y - dy * 0.6 });
  }
  if (toks.some((t) => /^(s|S|ss|s'|s\.|S'|S\.)$/.test(t))) {
    if (Math.abs(dx) >= Math.abs(dy) || !dy) return cubic({ x: p0.x + dx / 2, y: p0.y }, { x: p0.x + dx / 2, y: p1.y });
    return cubic({ x: p0.x, y: p0.y + dy / 2 }, { x: p1.x, y: p0.y + dy / 2 });
  }
  if ((m = toks.find((t) => /^(o'|o\.|o-|o\||C|C'|C\.|C-)$/.test(t)))) {
    const kk = Math.max(Math.abs(dx), Math.abs(dy)) * 0.66 + 6;
    const off = { "o'": [0, -1], 'o-': [0, -1], 'o.': [0, 1], 'o|': [0, 1], C: [-1, 0], "C'": [1, 0], 'C.': [0, 1], 'C-': [0, -1] }[m];
    return cubic({ x: p0.x + off[0] * kk, y: p0.y + off[1] * kk }, { x: p1.x + off[0] * kk, y: p1.y + off[1] * kk });
  }
  return { d: `M${p0.x} ${p0.y}L${p1.x} ${p1.y}`, m: { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }, h: hbox,
    pts: [p0, { x: p0.x + dx / 3, y: p0.y + dy / 3 }, { x: p0.x + 2 * dx / 3, y: p0.y + 2 * dy / 3 }, p1], line: true };
}

// Wires between the same two nodes must never sit exactly on top of each other.
// Wires with an identical shape are fanned out sideways (loops grow outward); crossings are fine.
const PAR_GAP = 16;
function edgeGeom(d, e, A, B, P = pos) {
  const g = rawGeom(d, e, A, B, P);
  const sib = d.edges.filter((f) => (f.a === e.a && f.b === e.b) || (f.a === e.b && f.b === e.a));
  if (sib.length < 2) return g;
  // shape key in a fixed direction (lower node id first), so a→b bend left matches b→a bend right
  const fwd = String(A.id) <= String(B.id);
  const key = (f, gg) => {
    const q = (f.a === e.a) === fwd ? gg.pts : [...gg.pts].reverse();
    return q.map((p) => Math.round(p.x * 2) + ',' + Math.round(p.y * 2)).join(' ') + (gg.h ? 'H' : '');
  };
  const me = key(e, g);
  const same = sib.filter((f) => f === e || key(f, rawGeom(d, f, f.a === e.a ? A : B, f.a === e.a ? B : A, P)) === me);
  const n = same.length;
  if (n < 2) return g;
  const i = same.indexOf(e);
  const [p0, c1, c2, p1] = g.pts;
  let a, b;
  if (A === B) {                                  // stacked loops: each one a bit larger
    const s = 1 + 0.45 * i;
    a = { x: p0.x + (c1.x - p0.x) * s, y: p0.y + (c1.y - p0.y) * s };
    b = { x: p0.x + (c2.x - p0.x) * s, y: p0.y + (c2.y - p0.y) * s };
  } else {
    // offset perpendicular to the chord, measured in the fixed direction so both ends agree
    const L = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
    const sg = (e.a === A.id) === fwd ? 1 : -1;
    const nx = -(p1.y - p0.y) / L * sg, ny = (p1.x - p0.x) / L * sg;
    const o = (i - (n - 1) / 2) * PAR_GAP * 1.33;  // control offset → ~PAR_GAP apart at the middle
    a = { x: c1.x + nx * o, y: c1.y + ny * o };
    b = { x: c2.x + nx * o, y: c2.y + ny * o };
  }
  return {
    d: `M${p0.x} ${p0.y}C${a.x} ${a.y} ${b.x} ${b.y} ${p1.x} ${p1.y}`,
    m: { x: (p0.x + 3 * a.x + 3 * b.x + p1.x) / 8, y: (p0.y + 3 * a.y + 3 * b.y + p1.y) / 8 }, h: g.h, pts: [p0, a, b, p1],
  };
}

// ---------- motion: every layout change can glide (nodes, wires and frames together) ----------
let tween = null, tweenK = 1, raf = 0;
const lastDisp = new Map();               // where each node was last drawn
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
function dpos(d, n) {
  const p = pos(d, n);
  if (!tween || tweenK >= 1) return p;
  const f = tween.from.get(n.id);
  if (!f) return { x: p.x, y: p.y, s: 0.45 + 0.55 * tweenK };   // newly created: pop in
  return { x: f.x + (p.x - f.x) * tweenK, y: f.y + (p.y - f.y) * tweenK };
}
function dispRect(d) {
  if (!tween || !d.nodes.length) return frameRect(d);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  d.nodes.forEach((n) => { const p = dpos(d, n); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
  return { x0: x0 - CW / 2, y0: y0 - CH / 2, x1: x1 + CW / 2, y1: y1 + CH / 2 };
}
// Run a model change, then animate from the old drawn positions to the new ones.
function animate(fn, dur = 360) {
  const from = new Map(lastDisp);
  fn();
  save();
  tween = { from, t0: performance.now(), dur };
  tweenK = 0;
  if (!raf) raf = requestAnimationFrame(tick);
}
function tick() {
  raf = 0;
  if (!tween) return;
  const t = Math.min(1, (performance.now() - tween.t0) / tween.dur);
  tweenK = easeOut(t);
  if (t >= 1) { tween = null; tweenK = 1; }
  render();
  if (tween) raf = requestAnimationFrame(tick);
}

// ---------- render ----------
// Matrix arrow: bold wire with a chevron, labels n (inputs) · A · m (outputs), and a port per wire on each side.
// While wiring near it the ports grow and show their numbers (mNear / mHot; the animation keeps its phase across redraws).
let mNear = null, mHot = null;
function mArrowInner(n, d) {
  const fl = n.v === '<', sl = mSlots(d, n), H = mHeight(sl), L = ZX.matLabels(n);
  const lab = (t, k) => (t ? `<span class="ml ${k}">${tex(t)}</span>` : '');
  const near = mNear && mNear.id === n.id, hot = mHot && mHot.id === n.id ? mHot : null;
  const ports = [];
  [[sl.L, -1, sl.Lside, sl.bL], [sl.R, 1, sl.Rside, sl.bR]].forEach(([S, sx, side, bu]) => {
    if (bu) { ports.push(`<path d="M${sx * M_BAR} 0H${sx * (M_PORT + 1)}" class="m-bar"/>`); return; }   // bundle: the bar runs on
    const k = S.length;
    S.forEach((x, j) => {
      const y = mPortY(k, j), h = hot && hot.side === side && hot.j === j;
      ports.push(`<path class="m-fan" d="M${sx * M_BAR} 0L${sx * (M_PORT - 3)} ${y}L${sx * M_PORT} ${y}"/>`);
      ports.push(`<circle class="m-pt${x ? ' on' : ''}${h ? ' hot' : ''}" cx="${sx * M_PORT}" cy="${y}" r="2.4" style="--i:${j}"/>`);
      if (near) ports.push(`<text class="m-num${h ? ' hot' : ''}" x="${sx * (M_PORT + 7)}" y="${y + 3}" text-anchor="middle" style="--i:${j}">${j + 1}</text>`);
    });
  });
  const age = near ? -(performance.now() - mNear.t0) | 0 : 0;
  return `<svg class="marr${near ? ' near' : ''}" width="${2 * M_PORT}" height="${H}" viewBox="${-M_PORT} ${-H / 2} ${2 * M_PORT} ${H}" style="--age:${age}ms">`
    + `<path d="M${-M_BAR} 0H${M_BAR}" class="m-bar"/>${ports.join('')}<path class="m-chev" transform="scale(${fl ? -1 : 1} 1)" d="M-5.6 -5.6H0.6L6.2 0 0.6 5.6H-5.6L-0.4 0Z"/></svg>`
    + lab(n.label, 'ml-a') + (sl.bL && !(fl ? n.lout : n.lin) ? '' : lab(fl ? L.lout : L.lin, 'ml-l')) + (sl.bR && !(fl ? n.lin : n.lout) ? '' : lab(fl ? L.lin : L.lout, 'ml-r'));
}
function nodeHTML(n, p, s, io, d) {
  let cls = 'node t' + n.t, inner = '', warn = '', hs = '';
  if (n.t === 'M') {
    inner = mArrowInner(n, d); warn = d ? matWarn(d, n) : '';
    if (warn) cls += ' warn';
    hs = `;height:${mHeight(mSlots(d, n))}px`;
  }
  if (io) cls += io[0] === 'i' ? ' bin' : ' bout';
  if (n.t === 'Z' || n.t === 'X') {
    if ((n.cmd === 'Ctrl' || n.cmd === 'Not') && !n.label) cls += ' tiny';
    else if (n.label) { cls += ' lab'; inner = tex(n.label); }
    else cls += ' empty';
  }
  if (n.t === 'T') {
    // dots are drawn as plain glyphs: KaTeX's \vdots carries a strut that some browsers paint as a black block
    const g = DOT_GLYPH[(n.label || '').trim()];
    inner = g ? `<span class="dots">${g}</span>` : tex(n.label || '\\cdot');
  }
  if (s) cls += ' sel';
  const fx = p.s != null ? `;transform:translate(-50%,-50%) scale(${p.s.toFixed(3)});opacity:${Math.min(1, p.s * 1.4).toFixed(3)}` : '';
  return `<div class="${cls}" data-node="${n.id}"${io ? ` data-io="${io}"` : ''}${warn ? ` data-warn="${esc(warn)}"` : ''} style="left:${p.x}px;top:${p.y}px${hs}${fx}">${inner}</div>`;
}

function render() {
  const F = [], S = [], N = [], T = [], H = [];
  if (doc.single && doc.diagrams.length > 1) doc.single = false;   // e.g. an import added diagrams
  const single = !!doc.single;
  world.classList.toggle('single', single); syncSingle(); syncLock();
  const rects = doc.diagrams.map(dispRect);
  barRects = rects;
  if (activeDi >= doc.diagrams.length) activeDi = Math.max(0, doc.diagrams.length - 1);
  doc.diagrams.forEach((d, di) => {
    const f = rects[di], act = di === activeDi && doc.diagrams.length > 1;
    F.push(`<div class="frame${act ? ' active' : ''}" style="left:${f.x0}px;top:${f.y0}px;width:${f.x1 - f.x0}px;height:${f.y1 - f.y0}px"></div>`);
    T.push(`<div class="fbar${act ? ' active' : ''}${di === hovDi ? ' hov' : ''}" data-fb="${di}" style="left:${f.x0}px;top:${f.y0 - 30}px">
      <span class="grip" data-grip="${di}"${single ? ` data-stat="${di}"` : ''} title="Drag to move this diagram">${I.grip}</span>${single ? '' : `<span class="fl" data-stat="${di}" title="Click for details · rename there">${d.name ? esc(d.name) : di + 1}</span>
      <button data-act="dup" data-fi="${di}" title="Duplicate as the next step">${I.copy}</button>`}
      <button data-act="opts" data-fi="${di}" title="TikZ options (row/column sep)">${I.sliders}</button>
      <button data-act="rot" data-fi="${di}" title="Rotate 180° — inputs and outputs swap (O)">${I.rot}</button>
      <button data-act="simp" data-fi="${di}" title="Simplify step by step">${I.wand}</button>
      <button data-act="mat" data-fi="${di}" title="Matrix of this diagram">${I.matrix}</button>
      <button data-act="del" data-fi="${di}" class="danger" title="Delete diagram">${I.trash}</button></div>`);
    const byId = new Map(d.nodes.map((n) => [n.id, n]));
    const bun = ZX.matBundles(d);
    d.edges.forEach((e) => {
      const A = byId.get(e.a), B = byId.get(e.b);
      if (!A || !B) return;
      const bu = bun.get(e.id);
      if (bu && !bu.lead) return;
      if (bu) {
        const g = rawGeom(d, e, A, B, dpos), on = [...bun].some(([id, x]) => x.a === bu.a && x.b === bu.b && sel.has(id));
        S.push(`<g class="edge bundle${on ? ' sel' : ''}" data-edge="${e.id}"><path class="hit" d="${g.d}"/><path class="wire-p" d="${g.d}"/></g>`);
        return;
      }
      const g = edgeGeom(d, e, A, B, dpos);
      S.push(`<g class="edge${sel.has(e.id) ? ' sel' : ''}${drag && drag.dropId === e.id ? ' drop' : ''}${wireLook(e)}" data-edge="${e.id}"${e.col ? ` style="--wc:${wcol(e.col)}"` : ''}><path class="hit" d="${g.d}"/><path class="wire-p" d="${g.d}"/>${g.h ? `<rect class="hbox" x="${g.m.x - 7}" y="${g.m.y - 7}" width="14" height="14"/>` : ''}</g>`);
      const bh = tool === 'select' && sel.size === 1 && sel.has(e.id) && (!tween || tweenK >= 1) && bendHandle(d, e, A, B, g);
      if (bh) {
        const on = drag && drag.type === 'bend' && drag.e === e;
        H.push(`<g class="bend-h${on ? ' on' : ''}" data-bend="${e.id}"><circle class="bh-hit" cx="${bh.x}" cy="${bh.y}" r="14"/><circle class="bh-dot${g.h ? ' ring' : ''}" cx="${bh.x}" cy="${bh.y}" r="${g.h ? 12 : 5.5}"/>${on ? `<text x="${bh.x + 14}" y="${bh.y - 12}">${drag.deg ? drag.deg + '°' : 'straight'}</text>` : ''}</g>`);
      }
    });
    const io = ioMap(d);
    d.nodes.forEach((n) => { const p = dpos(d, n); lastDisp.set(n.id, { x: p.x, y: p.y }); const h = nodeHTML(n, p, sel.has(n.id), io.get(n.id), d); N.push((wirePend && wirePend.n === n) || (tool === 'edge' && sel.size > 1 && sel.has(n.id)) ? h.replace('class="node', 'class="node wfrom') : h); });
  });
  const starts = lineStarts();
  for (let i = 0; i + 1 < rects.length; i++) {
    const { x, y } = sepPoint(i, rects, starts);
    const sv = sepOf(i);
    T.push(sv ? `<div class="sep" data-sep="${i}" style="left:${x}px;top:${y}px" title="Click to edit">${tex(sv)}${sepBadge(i)}</div>`
      : `<div class="sep empty" data-sep="${i}" style="left:${x}px;top:${y}px" title="No relation — click to add one">${I.plus}</div>`);
    T.push(`<button class="sepins" data-ins="${i}" style="left:${x}px;top:${y + (sv && /stackrel/.test(sv) ? 50 : 40)}px" title="Insert an empty diagram here">${I.plus}</button>`);
  }
  if (errMark) {
    // light red dashed box around the nodes a calculation complained about; the animation keeps its phase across redraws
    doc.diagrams.forEach((d) => {
      const ns = d.nodes.filter((n) => errMark.ids.has(n.id));
      if (!ns.length) return;
      const ps = ns.map((n) => dpos(d, n)), pad = 22;
      const x0 = Math.min(...ps.map((p) => p.x)) - pad, x1 = Math.max(...ps.map((p) => p.x)) + pad, y0 = Math.min(...ps.map((p) => p.y)) - pad, y1 = Math.max(...ps.map((p) => p.y)) + pad;
      T.push(`<div class="errbox" style="left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px;animation-delay:${-(performance.now() - errMark.born) | 0}ms,${-(performance.now() - errMark.born) | 0}ms"></div>`);
    });
  }
  if (rects.length && !single) {
    const l = rects[rects.length - 1];
    T.push(`<button class="addd" data-add style="left:${l.x1 + CW * 1.4}px;top:${(l.y0 + l.y1) / 2}px" title="Add a diagram">${I.plus}</button>`);
  }
  if (drag && drag.type === 'edge' && drag.tp) {
    S.push(`<path class="ghost-line" d="M${drag.p0.x} ${drag.p0.y}L${drag.tp.x} ${drag.tp.y}"/>`);
    if (!drag.tgt.node) S.push(`<circle class="ghost-dot" cx="${drag.tp.x}" cy="${drag.tp.y}" r="6"/>`);
  }
  if (!drag && tool === 'edge' && fanTp) {
    const fd = doc.diagrams.find((d) => d.nodes.some((n) => sel.has(n.id)));
    const ss = fd ? fanSources(fd) : [];
    if (ss.length >= fanMin()) ss.forEach((n) => { const q = pos(fd, n); S.push(`<path class="ghost-line fan" d="M${q.x} ${q.y}L${fanTp.x} ${fanTp.y}"/>`); });
  }
  if (!drag && wirePend && wirePend.tp && doc.diagrams.includes(wirePend.d)) {
    const q = wirePend.port || pos(wirePend.d, wirePend.n);
    S.push(`<path class="ghost-line" d="M${q.x} ${q.y}L${wirePend.tp.x} ${wirePend.tp.y}"/>`);
  }
  if (drag && drag.type === 'ghost' && drag.tp) N.push(nodeHTML(drag.n, drag.tp, false).replace('class="node', 'class="node ghost'));
  world.innerHTML = F.join('') + `<svg class="edges" width="1" height="1">${S.join('')}</svg>` + N.join('') + (H.length ? `<svg class="edges handles" width="1" height="1">${H.join('')}</svg>` : '') + T.join('');
  $('#hint').hidden = doc.diagrams.some((d) => d.nodes.length);
  $('#dUndo').disabled = !hist.length;
  $('#dRedo').disabled = !redoStack.length;
  $('#dDel').disabled = !sel.size;
  if (liveCheck) updateCheckBtn();
  const wb = $('#btnWrap'); wb.classList.toggle('on', doc.wrap > 0); wb.dataset.n = doc.wrap > 0 ? doc.wrap : '';
  applyCam();
  updateInspector();
}

function applyCam() {
  world.style.transform = `translate(${cam.x}px,${cam.y}px) scale(${cam.k})`;
  // grid dots: lighter and sparser when zoomed out, darker when zoomed in
  const k = cam.k, step = k < 0.3 ? 4 : k < 0.55 ? 2 : 1;
  const alpha = Math.max(0.1, Math.min(0.8, 0.12 + 0.45 * k)), rad = Math.max(0.85, Math.min(1.7, 0.8 + 0.55 * k));
  vp.style.setProperty('--gi', `radial-gradient(circle, rgba(112,112,104,${alpha.toFixed(3)}) ${rad.toFixed(2)}px, transparent ${(rad + 0.45).toFixed(2)}px)`);
  vp.style.setProperty('--gs', `${CW * k * step}px ${CH * k * step}px`);
  vp.style.setProperty('--gp', `${cam.x - CW * k * step / 2}px ${cam.y - CH * k * step / 2}px`);
  positionInsp();
  positionPop();
  const zp = $('#zPct'); if (zp) zp.textContent = Math.round(cam.k * 100) + '%';
  queueMinimap();
}

function toWorld(cx, cy) { const R = vp.getBoundingClientRect(); return { x: (cx - R.left - cam.x) / cam.k, y: (cy - R.top - cam.y) / cam.k }; }
function toScreen(p) { return { x: p.x * cam.k + cam.x, y: p.y * cam.k + cam.y }; }

function fit(instant, only) {
  const W = innerWidth, H = innerHeight;
  const go = (t) => { if (instant === true) { cam = t; applyCam(); } else flyTo(t, 380); };
  if (!doc.diagrams.length) return go({ x: W / 2, y: H / 2, k: 1 });
  const rs = (only != null && doc.diagrams[only] ? [doc.diagrams[only]] : doc.diagrams).map(frameRect);
  const x0 = Math.min(...rs.map((r) => r.x0)) - 30, x1 = Math.max(...rs.map((r) => r.x1)) + 30;
  const y0 = Math.min(...rs.map((r) => r.y0)) - 40, y1 = Math.max(...rs.map((r) => r.y1)) + 20;
  const top = 64, bot = isPhone() ? 150 : 90;
  const k = Math.max(0.2, Math.min(1.6, W / (x1 - x0), (H - top - bot) / (y1 - y0)));
  go({ k, x: W / 2 - ((x0 + x1) / 2) * k, y: top + (H - top - bot) / 2 - ((y0 + y1) / 2) * k });
}
function zoomAt(cx, cy, f) {
  const R = vp.getBoundingClientRect();
  const k = Math.max(0.15, Math.min(5, cam.k * f));
  const wx = (cx - R.left - cam.x) / cam.k, wy = (cy - R.top - cam.y) / cam.k;
  cam.k = k; cam.x = cx - R.left - wx * k; cam.y = cy - R.top - wy * k;
  applyCam();
}

// ---------- navigation: smooth camera, zoom bar, minimap ----------
let camAnim = 0;
const clampK = (k) => Math.max(0.15, Math.min(5, k));
// Fly the camera to `target`, keeping the motion of the screen centre natural (log-zoom).
function flyTo(target, dur = 260) {
  cancelAnimationFrame(camAnim);
  const W = innerWidth / 2, H = innerHeight / 2, k0 = cam.k, k1 = target.k, t0 = performance.now();
  const c0 = { x: (W - cam.x) / k0, y: (H - cam.y) / k0 }, c1 = { x: (W - target.x) / k1, y: (H - target.y) / k1 };
  const step = () => {
    const t = Math.min(1, (performance.now() - t0) / dur), e = easeOut(t);
    const k = k0 * Math.pow(k1 / k0, e), cx = c0.x + (c1.x - c0.x) * e, cy = c0.y + (c1.y - c0.y) * e;
    cam = { k, x: W - cx * k, y: H - cy * k };
    applyCam();
    if (t < 1) camAnim = requestAnimationFrame(step);
  };
  camAnim = requestAnimationFrame(step);
}
// Clicking the % cycles: fit the current diagram → show the whole page → 100%.
// Any other camera move starts the cycle again from the first step.
const ZCYCLE = [['fit', 'Fit diagram'], ['all', 'Show all'], ['100', '100%']];
let zStep = -1, zCam = null;
function cycleZoom() {
  if (!zCam || Math.abs(zCam.k - cam.k) > 1e-3 || Math.abs(zCam.x - cam.x) > 1 || Math.abs(zCam.y - cam.y) > 1) zStep = -1;
  if (doc.diagrams.length < 2 && zStep === -1) zStep = 0;   // one diagram: fit = show all, skip a step
  zStep = (zStep + 1) % ZCYCLE.length;
  const [m, label] = ZCYCLE[zStep];
  if (m === 'fit') fit(false, Math.min(activeDi, doc.diagrams.length - 1));
  else if (m === 'all') fit();
  else zoomTo(1);
  setTimeout(() => { zCam = { ...cam }; }, 420);
  const zp = $('#zPct');
  zp.title = `Now: ${label} · click for ${ZCYCLE[(zStep + 1) % ZCYCLE.length][1]}`;
  zp.classList.remove('flash'); void zp.offsetWidth; zp.classList.add('flash');
  toast(label);
}
function zoomBy(f, cx = innerWidth / 2, cy = innerHeight / 2) {
  const k = clampK(cam.k * f), wx = (cx - cam.x) / cam.k, wy = (cy - cam.y) / cam.k;
  flyTo({ k, x: cx - wx * k, y: cy - wy * k }, 220);
}
function zoomTo(k) { zoomBy(k / cam.k); }
const viewRect = () => ({ x0: -cam.x / cam.k, y0: -cam.y / cam.k, x1: (innerWidth - cam.x) / cam.k, y1: (innerHeight - cam.y) / cam.k });

const mm = $('#minimap'), mmc = $('#mmc');
let mmQueued = false, mmView = null, mmDrag = null;
function queueMinimap() { if (!mmQueued) { mmQueued = true; requestAnimationFrame(drawMinimap); } }
function drawMinimap() {
  mmQueued = false;
  if (getComputedStyle(mm).display === 'none') return;
  if (mmCollapsed) { mm.classList.toggle('empty', !doc.diagrams.some((d) => d.nodes.length)); return; }
  const W = mm.clientWidth, H = mm.clientHeight, dpr = devicePixelRatio || 1;
  if (mmc.width !== Math.round(W * dpr) || mmc.height !== Math.round(H * dpr)) {
    mmc.width = Math.round(W * dpr); mmc.height = Math.round(H * dpr); mmc.style.width = W + 'px'; mmc.style.height = H + 'px';
  }
  const g = mmc.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const live = doc.diagrams.filter((d) => d.nodes.length);
  mm.classList.toggle('empty', !live.length);
  if (!live.length) return;
  const v = viewRect();
  if (!mmDrag) {
    const rs = live.map(dispRect);
    const U = {
      x0: Math.min(v.x0, ...rs.map((r) => r.x0)), y0: Math.min(v.y0, ...rs.map((r) => r.y0)),
      x1: Math.max(v.x1, ...rs.map((r) => r.x1)), y1: Math.max(v.y1, ...rs.map((r) => r.y1)),
    };
    const pad = 8, s = Math.min((W - 2 * pad) / (U.x1 - U.x0), (H - 2 * pad) / (U.y1 - U.y0));
    mmView = { s, ox: pad + ((W - 2 * pad) - (U.x1 - U.x0) * s) / 2 - U.x0 * s, oy: pad + ((H - 2 * pad) - (U.y1 - U.y0) * s) / 2 - U.y0 * s };
  }
  const { s, ox, oy } = mmView, X = (x) => ox + x * s, Y = (y) => oy + y * s;
  live.forEach((d) => {
    const by = new Map(d.nodes.map((n) => [n.id, n]));
    g.strokeStyle = 'rgba(30,30,30,.5)'; g.lineWidth = 1;
    g.beginPath();
    d.edges.forEach((e) => {
      const A = by.get(e.a), B = by.get(e.b);
      if (!A || !B || A === B) return;
      const p = dpos(d, A), q = dpos(d, B);
      g.moveTo(X(p.x), Y(p.y)); g.lineTo(X(q.x), Y(q.y));
    });
    g.stroke();
    d.nodes.forEach((n) => {
      if (n.t === 'N' || n.t === 'T' || n.t === 'P') return;
      const p = dpos(d, n), r = Math.max(1.7, (n.label ? 13 : 8) * s);
      g.fillStyle = { Z: '#c6efc6', X: '#e3a0a0', H: '#f5ee94' }[n.t];
      g.strokeStyle = 'rgba(30,30,30,.55)'; g.lineWidth = 0.6;
      g.beginPath();
      if (n.t === 'H') g.rect(X(p.x) - r * 0.9, Y(p.y) - r * 0.9, r * 1.8, r * 1.8); else g.arc(X(p.x), Y(p.y), r, 0, Math.PI * 2);
      g.fill(); g.stroke();
    });
  });
  const vx = X(v.x0), vy = Y(v.y0), vw = (v.x1 - v.x0) * s, vh = (v.y1 - v.y0) * s;
  g.fillStyle = 'rgba(91,91,214,.07)';
  g.fillRect(vx, vy, vw, vh);
  g.setLineDash([4, 3]); g.strokeStyle = '#5b5bd6'; g.lineWidth = 1.2;
  g.strokeRect(vx + 0.5, vy + 0.5, vw - 1, vh - 1);
  g.setLineDash([]);
}
function mmToWorld(e) { const R = mmc.getBoundingClientRect(); return { x: (e.clientX - R.left - mmView.ox) / mmView.s, y: (e.clientY - R.top - mmView.oy) / mmView.s }; }
function centerOn(w, anim) {
  const t = { k: cam.k, x: innerWidth / 2 - w.x * cam.k, y: innerHeight / 2 - w.y * cam.k };
  if (anim) flyTo(t, 240); else { cancelAnimationFrame(camAnim); cam = t; applyCam(); }
}
// "–" in the corner folds the map into a small button; the choice is remembered.
let mmCollapsed = false;
try { mmCollapsed = localStorage.getItem('zx-draw-mm-min') === '1'; } catch (_) {}
const mmTog = $('#mmTog');
function setMinimap(c) {
  mmCollapsed = c;
  mm.classList.toggle('collapsed', c);
  mmTog.innerHTML = c ? I.map : I.minus;
  mmTog.title = c ? 'Show map' : 'Hide map';
  try { localStorage.setItem('zx-draw-mm-min', c ? '1' : '0'); } catch (_) {}
  queueMinimap();
}
mmTog.addEventListener('pointerdown', (e) => e.stopPropagation());
mmTog.addEventListener('click', (e) => { e.stopPropagation(); setMinimap(!mmCollapsed); });
mm.addEventListener('transitionend', (e) => { if (e.propertyName === 'width') queueMinimap(); });
mm.addEventListener('pointerdown', (e) => {
  if (!mmView || mmCollapsed) return;
  e.preventDefault();
  try { mm.setPointerCapture(e.pointerId); } catch (_) {}
  const w = mmToWorld(e), v = viewRect();
  const inside = w.x >= v.x0 && w.x <= v.x1 && w.y >= v.y0 && w.y <= v.y1;
  mmDrag = { off: inside ? { x: w.x - (v.x0 + v.x1) / 2, y: w.y - (v.y0 + v.y1) / 2 } : { x: 0, y: 0 } };
  mm.classList.add('dragging');
  if (!inside) centerOn(w, true);
});
mm.addEventListener('pointermove', (e) => { if (mmDrag) { const w = mmToWorld(e); centerOn({ x: w.x - mmDrag.off.x, y: w.y - mmDrag.off.y }, false); } });
const mmEnd = () => { if (!mmDrag) return; mmDrag = null; mm.classList.remove('dragging'); queueMinimap(); };
mm.addEventListener('pointerup', mmEnd);
mm.addEventListener('pointercancel', mmEnd);

// ---------- sliding highlight (dock + segmented controls) ----------
const pillMem = {};
function setPillBox(pill, r) { pill.style.transform = `translate(${r.x}px,${r.y}px)`; pill.style.width = r.w + 'px'; pill.style.height = r.h + 'px'; }
// Move the group's pill under `target` (default: its .on button). A freshly built group
// starts from the remembered position of the same data-seg key, so rebuilt panels still slide.
function syncPill(seg, target) {
  if (!seg) return;
  const btn = target || seg.querySelector(':scope > button.on');
  let pill = seg.querySelector(':scope > .pill');
  const fresh = !pill;
  if (fresh) { pill = document.createElement('span'); pill.className = 'pill'; seg.prepend(pill); }
  if (!btn) { pill.style.opacity = '0'; return; }
  const r = { x: btn.offsetLeft, y: btn.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight };
  const key = seg.dataset.seg;
  if (fresh) {
    pill.style.transition = 'none';
    setPillBox(pill, (key && pillMem[key]) || r);
    void pill.offsetWidth;
    pill.style.transition = '';
  }
  pill.style.opacity = '1';
  setPillBox(pill, r);
  if (key) pillMem[key] = r;
}
const syncAllPills = (root) => root.querySelectorAll('.seg').forEach((s) => syncPill(s));
// Any segmented group added anywhere (modals, popovers, panels) gets its pill under the
// selected button automatically, measured on the next frame once it is laid out.
const pillPending = new Set();
let pillRaf = 0;
new MutationObserver((muts) => {
  for (const m of muts) for (const n of m.addedNodes) {
    if (n.nodeType !== 1 || n.classList.contains('pill')) continue;
    if (n.matches('.seg')) pillPending.add(n);
    n.querySelectorAll && n.querySelectorAll('.seg').forEach((g) => pillPending.add(g));
    const up = n.parentElement && n.parentElement.closest('.seg'); if (up) pillPending.add(up);   // a button added into a group
  }
  if (pillPending.size && !pillRaf) pillRaf = requestAnimationFrame(() => {
    pillRaf = 0;
    pillPending.forEach((g) => { if (g.isConnected) syncPill(g); });
    pillPending.clear();
  });
}).observe(document.body, { childList: true, subtree: true });

// Press and slide across a group: the pill follows the finger, release picks.
let slide = null;
const slideItem = (seg, el) => { const b = el && el.closest && el.closest('button'); return b && b.parentElement === seg && (seg.id !== 'dock' || b.dataset.tool) ? b : null; };
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const seg = e.target.closest('.seg, #dock');
  const b = seg && slideItem(seg, e.target);
  slide = b ? { seg, start: b, over: b, sx: e.clientX, sy: e.clientY, armed: false } : null;
});
window.addEventListener('pointermove', (e) => {
  if (!slide) return;
  if (!slide.armed) { if (Math.hypot(e.clientX - slide.sx, e.clientY - slide.sy) < 8) return; slide.armed = true; }
  const b = slideItem(slide.seg, document.elementFromPoint(e.clientX, e.clientY));
  if (!b || b === slide.over) return;
  slide.seg.querySelectorAll(':scope > .pv').forEach((x) => x.classList.remove('pv'));
  if (!b.classList.contains('on')) b.classList.add('pv');
  slide.over = b;
  syncPill(slide.seg, b);
});
function endSlide(pick) {
  if (!slide) return;
  const s = slide; slide = null;
  s.seg.querySelectorAll(':scope > .pv').forEach((x) => x.classList.remove('pv'));
  if (pick && s.armed && s.over !== s.start) s.over.click();
  else if (s.over !== s.start) syncPill(s.seg);
}
window.addEventListener('pointerup', () => endSlide(true));
window.addEventListener('pointercancel', () => endSlide(false));

// ---------- tools ----------
function setTool(t) {
  tool = t;
  wirePend = null; mNear = mHot = null;
  document.querySelectorAll('.tool[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  syncPill($('#dock'));
  vp.classList.toggle('place', ['Z', 'X', 'H', 'N', 'T', 'P', 'M'].includes(t));
  vp.classList.toggle('wire', t === 'edge');
  vp.classList.toggle('hand', t === 'hand');
}

function placeNode(p, t) {
  animate(() => {
    snapshot();
    const d = pickDiagram(p);
    activeDi = doc.diagrams.indexOf(d);
    const c = cellOf(d, p), ex = at(d, c.r, c.c);
    if (ex) sel = new Set([ex.id]);
    else { const n = makeNode(t, c.r, c.c); if (t === 'M') n.label = nextMatName(); d.nodes.push(n); sel = new Set([n.id]); if (t === 'M') { inspOpen = true; mFocus = true; return; } }
    inspOpen = false;
  }, 220);
}

// Insert node n into wire e near point p. Uses a free grid cell on the wire,
// otherwise opens a new column (or row) so it fits.
function insertIntoEdge(d, e, p, n) {
  const A = d.nodes.find((m) => m.id === e.a), B = d.nodes.find((m) => m.id === e.b);
  const dr = B.r - A.r, dc = B.c - A.c, click = cellOf(d, p);
  let cell = null;
  if (!dr || !dc) {
    const steps = Math.max(Math.abs(dr), Math.abs(dc)), free = [];
    for (let k = 1; k < steps; k++) { const r = A.r + Math.sign(dr) * k, c = A.c + Math.sign(dc) * k; if (!at(d, r, c)) free.push({ r, c }); }
    const dist = (q) => Math.hypot(q.r - click.r, q.c - click.c);
    if (free.length) cell = free.reduce((a, b) => (dist(a) <= dist(b) ? a : b));
  } else if (!at(d, click.r, click.c)) cell = click;
  if (!cell) {
    if (!dr) { const cut = Math.max(A.c, B.c); d.nodes.forEach((m) => { if (m.c >= cut) m.c++; }); cell = { r: A.r, c: cut }; }
    else if (!dc) { const cut = Math.max(A.r, B.r); d.nodes.forEach((m) => { if (m.r >= cut) m.r++; }); cell = { r: cut, c: A.c }; }
    else { const L = A.c < B.c ? A : B, cut = L.c + 1; d.nodes.forEach((m) => { if (m.c >= cut) m.c++; }); cell = { r: L.r, c: cut }; }
  }
  n.r = cell.r; n.c = cell.c;
  if (!d.nodes.includes(n)) d.nodes.push(n);
  d.edges = d.edges.filter((x) => x !== e);
  const look = { ...(e.col ? { col: e.col } : {}), ...(e.ls ? { ls: e.ls } : {}) };   // the halves keep the wire's colour and style
  d.edges.push({ id: ZX.newId('e'), a: e.a, b: n.id, o: '', ...look }, { id: ZX.newId('e'), a: n.id, b: e.b, o: '', ...look });
}
// ---------- wire colour and line style (for your own eyes: no meaning, not in LaTeX) ----------
const WIRE_COLS = ['', '#f07c7c', '#f4a261', '#e9c46a', '#7cc68d', '#5ec4b6', '#6cb2f0', '#8b8ff0', '#b58be8', '#ef8fc0'];
// wires coloured with the first palette keep their slot
const OLD_COLS = { '#e5484d': 1, '#f76b15': 2, '#e2a336': 3, '#30a46c': 4, '#12a594': 5, '#0090ff': 6, '#5b5bd6': 7, '#8e4ec6': 8, '#d6409f': 9 };
const wcol = (c) => (c && OLD_COLS[c] ? WIRE_COLS[OLD_COLS[c]] : c || '');
const WIRE_LS = [['', 'Solid', 'M2 8H22'], ['dash', 'Dashed', 'M2 8H22'], ['dot', 'Dotted', 'M2 8H22']];
const wireLook = (e) => (e.col ? ' colored' : '') + (e.ls ? ' ls-' + e.ls : '');
function wireLookRow() {
  return `<div class="row wlook"><div class="wcols">${WIRE_COLS.map((c, i) => `<button class="wc${c ? '' : ' none'}" data-i="wcol" data-v="${c}" style="--c:${c || '#3a3a3c'}" title="${c ? 'Colour ' + i : 'Default'}"></button>`).join('')}</div><span class="vsep"></span>
    <div class="seg sm" data-seg="ls">${WIRE_LS.map(([v, t, d]) => `<button data-i="wls" data-v="${v}" title="${t}"><svg width="24" height="16" viewBox="0 0 24 16"><path d="${d}" class="lsi${v ? ' ls-' + v : ''}"/></svg></button>`).join('')}</div></div>`;
}
function syncWireLook(edges) {
  if (!edges.length) return;
  const col = edges.every((x) => wcol(x.e.col) === wcol(edges[0].e.col)) ? wcol(edges[0].e.col) : null;
  const ls = edges.every((x) => (x.e.ls || '') === (edges[0].e.ls || '')) ? edges[0].e.ls || '' : null;
  insp.querySelectorAll('[data-i="wcol"]').forEach((b) => b.classList.toggle('on', b.dataset.v === col));
  insp.querySelectorAll('[data-i="wls"]').forEach((b) => b.classList.toggle('on', b.dataset.v === ls));
}
// Take node n out of the diagram; if it sat on a wire (one in, one out) the wire is rejoined.
function detachNode(d, n) {
  const inc = d.edges.filter((e) => e.a === n.id || e.b === n.id);
  if (inc.length === 2 && inc.every((e) => e.a !== e.b)) {
    const [a, b] = inc.map((e) => (e.a === n.id ? e.b : e.a));
    if (a !== b) d.edges.push({ id: ZX.newId('e'), a, b, o: inc.filter((e) => ZX.splitOpts(e.o).includes('H')).length % 2 ? 'H' : '' });
  }
  d.edges = d.edges.filter((e) => !inc.includes(e));
  d.nodes = d.nodes.filter((m) => m !== n);
}
function splitEdge(d, e, p, t) {
  if (e.a === e.b) return;
  animate(() => {
    snapshot();
    const n = makeNode(t, 0, 0);
    insertIntoEdge(d, e, p, n);
    sel = new Set([n.id]); inspOpen = false;
  }, 300);
  showSuggest();
}
// While dragging a single node that sits on a wire (or has no wires), find another wire under the pointer.
function dropTarget(D, p) {
  if (D.ids.length !== 1) return null;
  const n = D.d.nodes.find((x) => x.id === D.ids[0]);
  if (!n) return null;
  const inc = D.d.edges.filter((e) => e.a === n.id || e.b === n.id);
  if (!(inc.length === 0 || (inc.length === 2 && inc.every((e) => e.a !== e.b)))) return null;
  return wireUnder(D.d, p, n.id);
}
// The wire (straight-line approximation) nearest to p, away from its ends; skips wires of node `skip`.
function wireUnder(d, p, skip) {
  const by = new Map(d.nodes.map((m) => [m.id, m]));
  let best = null, bd = 14 / Math.min(1, cam.k);
  for (const e of d.edges) {
    if ((skip && (e.a === skip || e.b === skip)) || e.a === e.b) continue;
    const A = by.get(e.a), B = by.get(e.b);
    if (!A || !B) continue;
    const a = pos(d, A), b = pos(d, B), dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
    if (!L2) continue;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2;
    if (t < 0.12 || t > 0.88) continue;
    const dist = Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y);
    if (dist < bd) { bd = dist; best = e; }
  }
  return best;
}

// ---------- auto layout ----------
// 1) drop empty rows/columns, 2) spread nodes that only sit on a straight wire
//    evenly between their anchored neighbours (in rows, then in columns).
function autoLayout(d) {
  if (!d.nodes.length) return;
  const b = ZX.bounds(d);
  const rows = [...new Set(d.nodes.map((n) => n.r))].sort((x, y) => x - y);
  const cols = [...new Set(d.nodes.map((n) => n.c))].sort((x, y) => x - y);
  const rm = new Map(rows.map((r, i) => [r, b.r0 + i])), cm = new Map(cols.map((c, i) => [c, b.c0 + i]));
  d.nodes.forEach((n) => { n.r = rm.get(n.r); n.c = cm.get(n.c); });
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const nbrs = (n) => d.edges.filter((e) => e.a === n.id || e.b === n.id).map((e) => byId.get(e.a === n.id ? e.b : e.a));
  const spread = (axis) => {               // axis 'r': move along rows (change c); 'c': along columns (change r)
    const line = axis === 'r' ? 'r' : 'c', along = axis === 'r' ? 'c' : 'r';
    const groups = new Map();
    d.nodes.forEach((n) => { if (!groups.has(n[line])) groups.set(n[line], []); groups.get(n[line]).push(n); });
    groups.forEach((list) => {
      list.sort((x, y) => x[along] - y[along]);
      const free = (n, i) => {
        if (i === 0 || i === list.length - 1) return false;
        const ns = nbrs(n);
        return ns.length > 0 && ns.length <= 2 && ns.every((m) => m && m !== n && m[line] === n[line]);
      };
      let a = 0;
      for (let j = 1; j < list.length; j++) {
        if (free(list[j], j)) continue;
        const k = j - a - 1, span = list[j][along] - list[a][along];
        if (k > 0 && span >= k + 1) for (let m = 1; m <= k; m++) list[a + m][along] = list[a][along] + Math.round((m * span) / (k + 1));
        a = j;
      }
    });
  };
  spread('r');
  spread('c');
}
function tidyAll() {
  if (lockedStop()) return;
  hideSuggest();
  if (!doc.diagrams.length) return;
  animate(() => { snapshot(); doc.diagrams.forEach(autoLayout); tidy(); }, 460);
}
let sgT = 0;
// Would Tidy actually move anything? Runs it on a copy and compares the result.
function layoutSig(dc) {
  return JSON.stringify(dc.diagrams.map((d) => {
    if (!d.nodes.length) return [];
    const b = ZX.bounds(d);
    return [Math.round(d.ox + b.c0 * CW), Math.round(d.oy + b.r0 * CH), d.nodes.map((n) => [n.id, n.r - b.r0, n.c - b.c0]).sort()];
  }));
}
function tidyWouldChange() {
  if (!doc.diagrams.some((d) => d.nodes.length)) return false;
  const saved = doc, before = layoutSig(saved);
  let after = before;
  try {
    doc = JSON.parse(JSON.stringify(saved));
    doc.diagrams.forEach(autoLayout); tidy();
    after = layoutSig(doc);
  } catch (_) { after = before; } finally { doc = saved; }
  return after !== before;
}
// The top chip: "tidy the layout?" by default, or any other one-click offer.
function showChip(text, btn, go) {
  const s = $('#suggest');
  s.querySelector('.sg-text').textContent = text;
  $('#sgGo').textContent = btn; $('#sgGo').onclick = () => { hideSuggest(); go(); };
  s.classList.remove('closing'); s.hidden = false;
  clearTimeout(sgT); sgT = setTimeout(hideSuggest, 9000);
}
function showSuggest() {
  if (!tidyWouldChange()) return hideSuggest();
  showChip('Layout changed — tidy it up?', 'Tidy layout', tidyAll);
}
function hideSuggest() {
  const s = $('#suggest');
  if (s.hidden || s.classList.contains('closing')) return;
  s.classList.add('closing');
  clearTimeout(sgT); sgT = setTimeout(() => { s.hidden = true; s.classList.remove('closing'); }, 180);
}

function deleteSel() {
  if (!sel.size) return;
  if (lockedStop()) return;
  const dn = new Set([...sel].filter((i) => i[0] === 'n')), de = new Set([...sel].filter((i) => i[0] === 'e'));
  doc.diagrams.forEach((d) => { const b = ZX.matBundles(d); b.forEach((x, id) => { if (de.has(id)) b.forEach((y, id2) => { if (y.a === x.a && y.b === x.b) de.add(id2); }); }); });
  const w0 = doc.diagrams.map(dWidth);
  let removed = 0;
  mutate(() => {
    doc.diagrams.forEach((d) => {
      // A deleted node with exactly one wire in and one out leaves a single wire behind.
      d.nodes.filter((n) => dn.has(n.id)).forEach((n) => {
        const inc = d.edges.filter((e) => (e.a === n.id || e.b === n.id) && !de.has(e.id));
        if (inc.length !== 2 || inc.some((e) => e.a === e.b)) return;
        const [a, b] = inc.map((e) => (e.a === n.id ? e.b : e.a));
        if (a === b) return;
        const h = inc.filter((e) => ZX.splitOpts(e.o).includes('H')).length % 2 ? 'H' : '';
        d.edges = d.edges.filter((e) => !inc.includes(e));
        d.edges.push({ id: ZX.newId('e'), a, b, o: h });
      });
      const touched = new Set();
      d.edges = d.edges.filter((e) => {
        const kill = de.has(e.id) || dn.has(e.a) || dn.has(e.b);
        if (kill) { touched.add(e.a); touched.add(e.b); }
        return !kill;
      });
      // drop wire points left dangling by this delete
      d.nodes = d.nodes.filter((n) => !dn.has(n.id) && !((n.t === 'N' || n.t === 'P') && touched.has(n.id) && !d.edges.some((e) => e.a === n.id || e.b === n.id)));
    });
    // a diagram whose every node was deleted goes too (with the relation that led to it)
    for (let i = doc.diagrams.length - 1; i >= 0; i--) {
      if (w0[i] < 0 || doc.diagrams[i].nodes.length) continue;
      const [gone] = doc.diagrams.splice(i, 1);
      if (gone.br && doc.diagrams[i]) doc.diagrams[i].br = true;
      if (doc.seps.length) doc.seps.splice(i > 0 ? i - 1 : 0, 1);
      removed++;
    }
    if (activeDi >= doc.diagrams.length) activeDi = Math.max(0, doc.diagrams.length - 1);
    sel.clear();
  });
  // a diagram that got narrower (or was removed) gives its space back to the chain
  const w1 = doc.diagrams.map(dWidth);
  if (removed || w1.some((w, k) => w !== w0[k])) respace();
  if (removed) toast(`Removed ${removed} empty diagram${removed === 1 ? '' : 's'} — ⌘Z to undo`);
  if (dn.size) showSuggest();
}
const dWidth = (d) => { const b = ZX.bounds(d); return d.nodes.length ? b.c1 - b.c0 : -1; };

// W with exactly two nodes selected: they trade places, the wires stay put,
// so each node takes over the other's connections.
function swapNodes(idA, idB) {
  const fa = findNode(idA), fb = findNode(idB);
  if (!fa || !fb) return;
  if (fa.d === fb.d) {
    const d = fa.d, A = fa.n, B = fb.n;
    snapshot();
    animate(() => {
      [A.r, B.r] = [B.r, A.r]; [A.c, B.c] = [B.c, A.c];
      d.edges.forEach((e) => {
        if (e.a === A.id) e.a = B.id; else if (e.a === B.id) e.a = A.id;
        if (e.b === A.id) e.b = B.id; else if (e.b === B.id) e.b = A.id;
      });
    }, 340);
  } else {
    // in different diagrams: swap what the two nodes are (type, phase, style); places and wires stay
    mutate(() => {
      const keys = ['t', 'label', 'cmd', 'v', 'st'];
      keys.forEach((k) => { [fa.n[k], fb.n[k]] = [fb.n[k], fa.n[k]]; });
    });
  }
  toast('Swapped — each node now has the other’s wires');
}
function swapColour() {
  const ns = [...sel].filter((i) => i[0] === 'n').map(findNode).filter((x) => x && (x.n.t === 'Z' || x.n.t === 'X'));
  if (!ns.length) return;
  mutate(() => ns.forEach(({ n }) => {
    n.t = n.t === 'Z' ? 'X' : 'Z';
    if (n.cmd === 'Ctrl') n.cmd = 'Not'; else if (n.cmd === 'Not') n.cmd = 'Ctrl';
  }));
}

function nudge(dr, dc) {
  if (lockedStop()) return;
  const ns = [...sel].filter((i) => i[0] === 'n').map(findNode).filter(Boolean);
  if (!ns.length) return;
  const ids = new Set(ns.map((x) => x.n.id));
  const ok = ns.every(({ n, d }) => { const o = at(d, n.r + dr, n.c + dc); return !o || ids.has(o.id); });
  if (!ok) return toast('Cell occupied');
  mutate(() => ns.forEach(({ n }) => { n.r += dr; n.c += dc; }));
}

// Copy keeps every diagram of the selection as its own part (with the relation between them).
// Nothing selected → the current diagram is copied whole.
function copySel() {
  let ns = [...sel].filter((i) => i[0] === 'n').map(findNode).filter(Boolean);
  if (!ns.length && doc.diagrams[activeDi] && doc.diagrams[activeDi].nodes.length) ns = doc.diagrams[activeDi].nodes.map((n) => ({ n, d: doc.diagrams[activeDi] }));
  if (!ns.length) return;
  const byD = new Map();
  ns.forEach(({ n, d }) => { if (!byD.has(d)) byD.set(d, []); byD.get(d).push(n); });
  const order = [...byD.keys()].sort((a, b) => doc.diagrams.indexOf(a) - doc.diagrams.indexOf(b));
  const parts = order.map((d) => {
    const list = byD.get(d), ids = new Set(list.map((n) => n.id));
    const r0 = Math.min(...list.map((n) => n.r)), c0 = Math.min(...list.map((n) => n.c));
    return {
      i: doc.diagrams.indexOf(d), opts: d.opts,
      nodes: list.map((n) => Object.assign({}, n, { r: n.r - r0, c: n.c - c0 })),
      edges: d.edges.filter((e) => ids.has(e.a) && ids.has(e.b)).map((e) => Object.assign({}, e)),
    };
  });
  // the relation between two copied diagrams that sat next to each other
  const seps = parts.slice(1).map((p, k) => (p.i === parts[k].i + 1 ? sepOf(parts[k].i) : '='));
  clip = { parts, seps };
  const nN = ns.length;
  toast(parts.length > 1 ? `Copied ${parts.length} diagrams (${nN} nodes)` : `Copied ${nN} node${nN > 1 ? 's' : ''}`);
}
// Paste: into the diagram you have something selected in; otherwise as new diagram(s) at the end.
function paste() {
  if (!clip) return;
  if (lockedStop()) return;
  if (!clip.parts) clip = { parts: [{ nodes: clip.nodes, edges: clip.edges, opts: '' }], seps: [] };   // older clipboard shape
  const selD = [...sel].map((id) => (id[0] === 'n' ? findNode(id) : findEdge(id))).filter(Boolean).map((x) => x.d);
  const one = selD.length && selD.every((d) => d === selD[0]);   // a selection across several diagrams is not a target
  const target = one ? selD[0] : doc.single && doc.diagrams[0] ? doc.diagrams[0] : null;
  const add = (d, part, base) => {
    const map = new Map();
    part.nodes.forEach((n) => { const m = Object.assign({}, n, { id: ZX.newId('n'), r: base.r + n.r, c: base.c + n.c }); map.set(n.id, m.id); d.nodes.push(m); sel.add(m.id); });
    part.edges.forEach((e) => d.edges.push({ id: ZX.newId('e'), a: map.get(e.a), b: map.get(e.b), o: e.o }));
  };
  const fits = (d, part, base) => !part.nodes.some((n) => at(d, base.r + n.r, base.c + n.c));
  animate(() => {
    snapshot();
    sel = new Set();
    if (target) {
      // into the selected diagram: at the pointer if it is over that diagram, else to the right of it; parts side by side
      const R = vp.getBoundingClientRect(), p = lastWorld || toWorld(R.left + R.width / 2, R.top + R.height / 2), f = frameRect(target);
      const b = target.nodes.length ? ZX.bounds(target) : { r0: 0, c0: 0, c1: -2 };
      let base = p.x >= f.x0 && p.x <= f.x1 && p.y >= f.y0 && p.y <= f.y1 ? cellOf(target, p) : { r: b.r0, c: b.c1 + 2 };
      clip.parts.forEach((part) => {
        let off = 0;
        while (off < 80 && !fits(target, part, { r: base.r, c: base.c + off })) off++;
        add(target, part, { r: base.r, c: base.c + off });
        base = { r: base.r, c: base.c + off + Math.max(...part.nodes.map((n) => n.c)) + 2 };
      });
      activeDi = doc.diagrams.indexOf(target);
    } else {
      // nothing selected: each copied diagram becomes a new diagram at the end of the page
      const first = doc.diagrams.length;
      clip.parts.forEach((part, k) => {
        const d = ZX.newDiagram(part.opts || '');
        add(d, part, { r: 0, c: 0 });
        if (doc.diagrams.length) doc.seps.push(k === 0 ? '=' : clip.seps[k - 1] || '=');
        doc.diagrams.push(d);
      });
      activeDi = first;
      tidy();
    }
  }, 320);
  if (!target) { fit(); toast(clip.parts.length > 1 ? `Pasted ${clip.parts.length} new diagrams` : 'Pasted as a new diagram'); }
  else toast(`Pasted into ${nameOf(activeDi)}`);
}

const CURVE_TOK = (t) => /^(bend\s+(left|right).*|s|S|ss|s'|s\.|S'|S\.|o'|o\.|o-|o\||C|C'|C\.|C-|[<>'.]{2}|out\s*=.*|in\s*=.*|loop.*|looseness.*)$/.test(t);
function setCurve(e, tok) { const rest = ZX.splitOpts(e.o).filter((t) => !CURVE_TOK(t)); if (tok) rest.unshift(tok); e.o = rest.join(', '); }
function curveOf(e) { const t = ZX.splitOpts(e.o).find(CURVE_TOK) || ''; return t.replace(/\s*=.*$/, ''); }
// S steps through every curve style in order (Shift+S goes back). Loops are left alone.
function toggleCurve(back) {
  const edges = selected().edges.filter(({ e }) => e.a !== e.b);
  if (!edges.length) return toast('Select a wire first');
  const keys = CURVES.map((c) => c[0]);
  const i = Math.max(0, keys.indexOf(curveOf(edges[0].e)));
  const j = (i + (back ? keys.length - 1 : 1)) % keys.length;
  mutate(() => edges.forEach(({ e }) => setCurve(e, keys[j])));
  toast(CURVES[j][1] + (keys[j].startsWith('bend') ? ' · drag the dot to adjust' : ''));
}
// Bend handle: the dot on a selected straight / bend wire. Dragging it sets the bend angle.
const BEND_MAX = 90;
function bendHandle(d, e, A, B, g) {
  const c = curveOf(e);
  if (e.a === e.b || !(c === '' || c.startsWith('bend'))) return null;
  return g.m;
}
function bendFromPoint(D, p) {
  const { p0, p1, fan } = D;
  const dx = p1.x - p0.x, dy = p1.y - p0.y, L = Math.hypot(dx, dy) || 1;
  const h = ((p.x - p0.x) * -dy + (p.y - p0.y) * dx) / L - fan;      // signed distance from the chord
  const r = Math.max(-1, Math.min(1, h / (0.75 * L * 0.3915)));
  let deg = Math.round(Math.asin(r) * 180 / Math.PI);
  if (Math.abs(deg) < 4) return { tok: '', deg: 0 };
  deg = Math.max(-BEND_MAX, Math.min(BEND_MAX, deg));
  const side = deg < 0 ? 'bend left' : 'bend right', a = Math.abs(deg);
  return { tok: a === 30 ? side : `${side}=${a}`, deg: a };
}
function toggleTok(e, tok) { const ts = ZX.splitOpts(e.o); e.o = (ts.includes(tok) ? ts.filter((t) => t !== tok) : ts.concat(tok)).join(', '); }

// ---------- diagrams ----------
function cloneDiagram(d) {
  const map = new Map();
  const c = ZX.newDiagram(d.opts);
  c.nodes = d.nodes.map((n) => { const m = Object.assign({}, n, { id: ZX.newId('n') }); map.set(n.id, m.id); return m; });
  c.edges = d.edges.map((e) => ({ id: ZX.newId('e'), a: map.get(e.a), b: map.get(e.b), o: e.o }));
  return c;
}
function addDiagram() {
  if (lockedStop()) return;
  if (doc.single) return singleBlocked();
  mutate(() => {
    const last = doc.diagrams[doc.diagrams.length - 1];
    doc.diagrams.push(ZX.newDiagram(last ? last.opts : ''));
    if (doc.diagrams.length > 1) doc.seps.push('=');
    tidy();
    activeDi = doc.diagrams.length - 1;
  });
}
// New empty diagram between diagram i and i+1 (the old relation stays in front of it).
function insertDiagram(i) {
  closePop();
  snapshot();
  animate(() => {
    const d = ZX.newDiagram(doc.diagrams[i] ? doc.diagrams[i].opts : '');
    doc.diagrams.splice(i + 1, 0, d);
    doc.seps.splice(i + 1, 0, '=');
    tidy();
    activeDi = i + 1; sel.clear();
  }, 360);
  toast('Empty diagram inserted — place spiders inside its frame');
}
// Rotate a diagram 180° in place: every cell is mirrored through the centre, so inputs become
// outputs (bottom wire first). Wire options are turned too, so curves keep their shape.
const ROT_SWAP = { "o'": 'o.', 'o.': "o'", 'o-': 'o|', 'o|': 'o-', C: "C'", "C'": 'C', 'C.': 'C-', 'C-': 'C.' };
const ROT_CH = { '<': '>', '>': '<', "'": '.', '.': "'", '^': 'v', v: '^' };
function rotTok(t) {
  if (ROT_SWAP[t]) return ROT_SWAP[t];
  let m;
  if ((m = /^loop(\s+(above|below|left|right))?(.*)$/.exec(t))) return 'loop ' + ({ above: 'below', below: 'above', left: 'right', right: 'left' }[m[2] || 'above']) + m[3];
  if ((m = /^(out|in)\s*=\s*(-?[\d.]+)$/.exec(t))) return `${m[1]}=${((+m[2] + 180) % 360 + 360) % 360}`;
  if (/^-?[sSN]{1,2}['.]-?$|^-?[sS]['.]?I?[sS]?['.]?$/.test(t)) return t.replace(/['.]/g, (c) => ROT_CH[c]);
  if (/^[<>'.^v]{2}$/.test(t)) return t.replace(/./g, (c) => ROT_CH[c] || c);
  return t;   // bend left/right, H, s, … look the same after a half turn
}
function rotateDiagram(i) {
  const d = doc.diagrams[i];
  if (!d || !d.nodes.length) return toast('This diagram is empty');
  closePop();
  snapshot();
  animate(() => {
    const b = ZX.bounds(d);
    d.nodes.forEach((n) => { n.r = b.r0 + b.r1 - n.r; n.c = b.c0 + b.c1 - n.c; if (n.t === 'M') n.v = n.v === '<' ? '' : '<'; });
    d.edges.forEach((e) => { e.o = ZX.splitOpts(e.o || '').map(rotTok).join(', '); });
  }, 420);
  activeDi = i;
  toast('Rotated 180° — ⌘Z to undo');
}
function dupDiagram(i) {
  if (lockedStop()) return;
  if (doc.single) return singleBlocked();
  mutate(() => {
    doc.diagrams.splice(i + 1, 0, cloneDiagram(doc.diagrams[i]));
    doc.seps.splice(i, 0, '=');
    tidy();
    activeDi = i + 1; sel.clear();
  });
  toast('Duplicated — edit the copy for the next rewrite step');
}
function delDiagram(i) {
  closePop();
  mutate(() => {
    const [gone] = doc.diagrams.splice(i, 1);
    if (gone && gone.br && doc.diagrams[i]) doc.diagrams[i].br = true;
    if (doc.seps.length) doc.seps.splice(i < doc.seps.length ? i : i - 1, 1);
    pruneSel();
    tidy();
  });
}

// ---------- inspector (opens on double-click, right-click, Enter or long-press) ----------
let inspSig = '', inspOpen = false, inspHideT = 0;
function selected() {
  const nodes = [], edges = [];
  sel.forEach((id) => { if (id[0] === 'n') { const f = findNode(id); if (f) nodes.push(f); } else { const f = findEdge(id); if (f) edges.push(f); } });
  return { nodes, edges };
}
function openInsp(focusPhase) {
  if (isLocked()) return;
  inspOpen = true; inspSig = '';
  render();
  if (focusPhase && !isPhone()) {
    const i = insp.querySelector('input[data-i="label"]');
    if (i && !i.closest('.shut')) { i.focus(); i.select(); }
  }
}
function hideInsp() {
  if (insp.hidden || insp.classList.contains('closing')) return;
  insp.classList.add('closing');
  clearTimeout(inspHideT);
  inspHideT = setTimeout(() => { insp.hidden = true; insp.classList.remove('closing'); }, 130);
}
function updateInspector() {
  const { nodes, edges } = selected();
  if (!nodes.length && !edges.length) inspOpen = false;
  if (!inspOpen || preview || (drag && ((drag.type === 'move' && drag.snap) || (drag.type === 'ghost' && drag.moved)))) {
    inspSig = ''; pillMem.type = pillMem.curve = pillMem.loop = null;
    return hideInsp();
  }
  const ae = document.activeElement, typing = insp.contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
  const multi = nodes.length + edges.length > 1;
  // Rebuild only when *what* is selected changes; edits are patched in place so the pills slide.
  const sig = JSON.stringify([multi && selBlock() ? 1 : 0, nodes.map((x) => x.n.id + x.n.t), edges.map((x) => [x.e.id, x.e.a === x.e.b]), multi ? nodes.map((x) => x.n.t) : 0]);
  clearTimeout(inspHideT); insp.classList.remove('closing');
  if (sig !== inspSig && !typing) { inspSig = sig; insp.innerHTML = buildInsp(nodes, edges); }
  insp.hidden = false;
  insp.classList.toggle('mpanel', nodes.length === 1 && !edges.length && nodes[0].n.t === 'M');
  refreshInsp(nodes, edges);
  syncWireLook(edges);
  syncAllPills(insp);
  positionInsp();
  if (mFocus) { mFocus = false; const ta = insp.querySelector('textarea[data-i="mtext"]'); if (ta && !isPhone()) setTimeout(() => ta.focus(), 60); }
}
function buildInsp(nodes, edges) {
  if (nodes.length + edges.length > 1) {
    const zx = nodes.some((x) => x.n.t === 'Z' || x.n.t === 'X');
    return `<div class="row"><span class="count">${nodes.length ? nodes.length + ' node' + (nodes.length > 1 ? 's' : '') : ''}${nodes.length && edges.length ? ' · ' : ''}${edges.length ? edges.length + ' wire' + (edges.length > 1 ? 's' : '') : ''}</span>
      ${zx ? `<button class="ib" data-i="swap" title="Swap Z ↔ X colour (C)">${I.swap}</button>` : ''}
      ${selBlock() ? `<button class="ib m-conv" data-i="tomat" title="Convert to matrix arrow (⇧A)">${I.marrow}</button>` : ''}
      ${nodes.length ? `<button class="ib" data-i="copy" title="Copy (⌘C)">${I.copy}</button>` : ''}
      <button class="ib danger" data-i="del" title="Delete (⌫)">${I.trash}</button></div>${edges.length ? wireLookRow() : ''}`;
  }
  if (nodes.length && nodes[0].n.t === 'M') return buildMatInsp(nodes[0].n);
  if (nodes.length) {
    const types = [['Z', '', 'Z spider'], ['X', '', 'X spider'], ['H', '', 'H box'], ['N', 'wire', 'Wire point / boundary'], ['P', '', 'Dot: routing point (bends, swaps, crossings)'], ['T', '', 'Text cell (\\vdots, \\cdots …)']].map(([t, l, ti]) =>
      `<button data-i="type" data-v="${t}" title="${ti}">${t === 'T' ? `<span class="ti-t">${I.text}</span>` : `<span class="sw ${t}"></span>`}${l}</button>`).join('');
    return `<div class="row"><div class="seg" data-seg="type">${types}</div><span class="vsep"></span>
        <button class="ib" data-i="loop" title="Add a self-loop">${I.loop}</button>
        <button class="ib danger" data-i="del" title="Delete (⌫)">${I.trash}</button></div>
      <div class="collapse" data-c="phase"><div>
        <div class="row"><label class="field"><span>Phase</span><input data-i="label" placeholder="LaTeX, e.g. \\pi" spellcheck="false" autocomplete="off"></label></div>
        <div class="chips">${PHASES.map(([l, v]) => `<button class="chip" data-i="phase" data-v="${esc(v)}">${l}</button>`).join('')}</div>
      </div></div>`;
  }
  const self = edges[0].e.a === edges[0].e.b;
  const curves = self ? ['loop above', 'loop below', 'loop left', 'loop right'].map((t) => `<button data-i="curve" data-v="${t}">${t.split(' ')[1]}</button>`).join('')
    : CURVES.map(([t, l, ic]) => `<button data-i="curve" data-v="${t}" title="${l}">${ic}</button>`).join('');
  return `<div class="row"><div class="seg" data-seg="${self ? 'loop' : 'curve'}">${curves}</div><span class="vsep"></span>
      <button class="ib" data-i="hbox" title="Hadamard box on this wire (H style)"><span class="sw H"></span></button>
      ${self ? '' : `<button class="ib" data-i="rev" title="Reverse direction (changes which cell the \\ar lives in)">${I.rev}</button>`}
      <button class="ib danger" data-i="del" title="Delete (⌫)">${I.trash}</button></div>
    ${wireLookRow()}
    <div class="row"><label class="field"><span>TikZ</span><input data-i="opts" placeholder="e.g. bend left=40, H" spellcheck="false" autocomplete="off"></label></div>`;
}
function refreshInsp(nodes, edges) {
  if (nodes.length + edges.length !== 1) return;
  const ae = document.activeElement;
  if (nodes.length && nodes[0].n.t === 'M') return refreshMatInsp(nodes[0].n, nodes[0].d);
  if (nodes.length) {
    const n = nodes[0].n, sp = n.t === 'Z' || n.t === 'X' || n.t === 'T';
    const fl = insp.querySelector('[data-c="phase"] .field > span');
    if (fl) fl.textContent = n.t === 'T' ? 'Text' : 'Phase';
    insp.querySelectorAll('[data-i="type"]').forEach((b) => b.classList.toggle('on', b.dataset.v === n.t));
    const c = insp.querySelector('[data-c="phase"]');
    if (c) c.classList.toggle('shut', !sp);
    const inp = insp.querySelector('input[data-i="label"]');
    if (inp) { if (ae !== inp) inp.value = n.label; inp.tabIndex = sp ? 0 : -1; }
    insp.querySelectorAll('[data-i="phase"]').forEach((b) => b.classList.toggle('on', b.dataset.v === n.label));
  } else {
    const e = edges[0].e, toks = ZX.splitOpts(e.o), cur = curveOf(e), self = e.a === e.b;
    insp.querySelectorAll('[data-i="curve"]').forEach((b) => b.classList.toggle('on',
      self ? toks.includes(b.dataset.v) || (!toks.some((t) => t.startsWith('loop')) && b.dataset.v === 'loop above') : cur === b.dataset.v));
    const hb = insp.querySelector('[data-i="hbox"]');
    if (hb) hb.classList.toggle('on', toks.includes('H'));
    const inp = insp.querySelector('input[data-i="opts"]');
    if (inp && ae !== inp) inp.value = e.o;
  }
  syncAllPills(insp);
}
// ---------- matrix arrows: panel, expand ⇄ fold, spotting Z–X blocks ----------
let mFocus = false, mErr = '';
const matWarn = (d, n) => { const i = ZX.matInfo(d, n); return i.ok ? '' : i.msg; };
const matRows = (m) => (m ? m.map((r) => r.join(' ')).join('\n') : '');
function buildMatInsp() {
  return `<div class="row m-head"><span class="m-ttl">${I.marrow}<input data-i="mname" class="m-name" placeholder="A" spellcheck="false" autocomplete="off" title="Name — click to rename"></span><span class="m-sp"></span>
      <button class="ib" data-i="mexp" title="Expand into Z / X spiders (⇧A)">${I.unfold}</button>
      <button class="ib danger" data-i="del" title="Delete (⌫)">${I.trash}</button></div>
    <div class="m-body">
      <div class="m-gw"><div class="m-grid" data-mgrid></div></div>
      <textarea data-i="mtext" class="m-text" rows="3" placeholder="1 0 1&#10;1 1 0" spellcheck="false" autocomplete="off"></textarea>
    </div>
    <div class="m-stat" data-mstat></div>`;
}
function refreshMatInsp(n, d) {
  const ae = document.activeElement;
  const nm = insp.querySelector('[data-i="mname"]');
  if (nm && nm !== ae) nm.value = n.label || '';
  if (nm) nm.style.width = Math.max(2, (nm.value || nm.placeholder).length + 1) + 'ch';
  const ta = insp.querySelector('[data-i="mtext"]');
  if (ta && ta !== ae) { ta.value = matRows(n.mat); mErr = ''; }
  if (ta) ta.classList.toggle('bad', !!mErr);
  const g = insp.querySelector('[data-mgrid]'), m = n.mat, R = m ? m.length : 0, C = m && m[0] ? m[0].length : 0;
  if (g) {
    g.parentNode.classList.toggle('none', !m);
    g.style.gridTemplateColumns = `repeat(${C}, var(--mbw, 24px)) 14px`;
    let h = '';
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) h += `<button class="mb${m[i][j] ? ' on' : ''}" data-i="mbit" data-r="${i}" data-c="${j}" style="grid-row:${i + 1};grid-column:${j + 1}" title="Output ${i + 1} · input ${j + 1}">${m[i][j]}</button>`;
    if (m) h += `<button class="madd mc" data-i="maddc" style="grid-row:1/span ${R};grid-column:${C + 1}" title="Add a column (an input)">+</button><button class="madd mr" data-i="maddr" style="grid-row:${R + 1};grid-column:1/span ${C}" title="Add a row (an output)">+</button>`;
    g.innerHTML = h;
  }
  // only something wrong is worth a line: a typo in the entries, or wires that do not fit A
  const info = ZX.matInfo(d, n), st = insp.querySelector('[data-mstat]');
  const msg = mErr || (n.mat && !info.ok ? info.msg : '');
  if (st) { st.className = 'm-stat' + (mErr ? ' err' : msg ? ' warn' : ''); st.textContent = msg; st.hidden = !msg; }
  const ex = insp.querySelector('[data-i="mexp"]'); if (ex) ex.disabled = !info.ok;
}
function matInput(n, el) {
  const k = el.dataset.i, v = el.value;
  if (k === 'mname') { n.label = v; el.style.width = Math.max(2, (v || el.placeholder).length + 1) + 'ch'; }
  else if (k === 'mtext') {
    if (!v.trim()) { n.mat = null; mErr = ''; return; }
    const r = ZX.parseMatrix(v);
    if (r.err) mErr = r.err; else { n.mat = r.rows; mErr = ''; }
  }
}
function matClick(n, d, b) {
  const a = b.dataset.i, m = n.mat ? n.mat.map((r) => r.slice()) : null;   // copies: duplicated diagrams share nothing
  if (a === 'mexp') return toggleMat();
  mutate(() => {
    if (a === 'mflip') n.v = n.v === '<' ? '' : '<';
    if (a === 'mbit') { m[+b.dataset.r][+b.dataset.c] ^= 1; n.mat = m; }
    if (a === 'maddc') n.mat = m ? m.map((r) => r.concat(0)) : [[0]];
    if (a === 'maddr') n.mat = m ? m.concat([m[0].map(() => 0)]) : [[0]];
  });
}
// Name for a new matrix arrow: the first letter of the alphabet no arrow on this page uses
// (a deleted arrow's letter comes free again). After Z: A_2, B_2 …
function nextMatName(except) {
  const used = new Set();
  doc.diagrams.forEach((d) => d.nodes.forEach((n) => { if (n.t === 'M' && n !== except) used.add((n.label || '').trim()); }));
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  for (let k = 1; ; k++) for (const c of L) { const nm = k === 1 ? c : `${c}_${k}`; if (!used.has(nm)) return nm; }
}
// The selection, if its Z / X spiders form exactly one block in parity normal form:
// each Z has one outside wire (its input), each X one (its output), only Z–X wires inside, never two between a pair.
function selBlock() {
  const sn = selected().nodes.filter((x) => x.n.t === 'Z' || x.n.t === 'X');
  if (sn.length < 2 || !sn.every((x) => x.d === sn[0].d)) return null;
  const d = sn[0].d, only = new Set(sn.map((x) => x.n.id)), bs = ZX.findMatBlocks(d, only);
  return bs.length === 1 && bs[0].ids.length === only.size ? { d, b: bs[0] } : null;
}
// Shift+A: expand the selected arrows, otherwise fold the selected block (or every block in this diagram)
function toggleMat() {
  if (lockedStop()) return;
  const sn = selected().nodes, ms = sn.filter((x) => x.n.t === 'M');
  if (ms.length) return expandMatSel(ms);
  let d = doc.diagrams[activeDi], only = null;
  const sp = sn.filter((x) => x.n.t === 'Z' || x.n.t === 'X');   // a box selection also holds wire ends: only spiders count
  if (sp.length >= 2 && sp.every((x) => x.d === sp[0].d)) { d = sp[0].d; only = new Set(sp.map((x) => x.n.id)); }
  if (!d) return toast('Nothing to fold here');
  const blocks = ZX.findMatBlocks(d, only);
  if (!blocks.length) return toast(only ? 'Not a matrix block: phase-free Z and X spiders, Z only wired to X, one outside wire each'
    : 'No phase-free Z–X block here. Select a matrix arrow to expand it');
  foldBlocks(d, blocks);
}
function foldBlocks(d, blocks) {
  snapshot();
  const made = [];
  animate(() => {
    blocks.forEach((b) => {
      const ps = b.ids.map((id) => lastDisp.get(id)).filter(Boolean);
      const cen = ps.length ? { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length } : null;
      const M = ZX.foldMat(d, b);
      if (M) { M.label = nextMatName(M); made.push([M, cen]); }
    });
    sel = new Set(made.map(([M]) => M.id)); inspOpen = false;
    activeDi = Math.max(0, doc.diagrams.indexOf(d));
  }, 420);
  if (!made.length) { tween = null; hist.pop(); render(); return toast('No free cell for the arrow between its input and output wires'); }
  made.forEach(([M, c]) => { if (c && tween) tween.from.set(M.id, c); });
  const A = made[0][0].mat;
  setTimeout(showSuggest, 500);
  toast(made.length > 1 ? `Folded ${made.length} blocks into matrix arrows — ⇧A expands` : `Folded into a ${A.length}×${A[0].length} matrix arrow — ⇧A expands it again`);
}
function expandMatSel(ms) {
  const bad = ms.find(({ n, d }) => !ZX.matInfo(d, n).ok);
  if (bad) { sel = new Set([bad.n.id]); inspOpen = true; render(); return toast(ZX.matInfo(bad.d, bad.n).msg); }
  snapshot();
  const news = [];
  animate(() => {
    ms.forEach(({ n, d }) => { const f = lastDisp.get(n.id); ZX.expandMat(d, n.id, true).forEach((m) => news.push([m, f])); });
    sel = new Set(news.filter(([m]) => m.t !== 'N').map(([m]) => m.id)); inspOpen = false;
  }, 460);
  news.forEach(([m, f]) => { if (f && tween) tween.from.set(m.id, f); });   // the spiders burst out of the arrow
  matSeen.add(blockKey(news.filter(([m]) => m.t !== 'N').map(([m]) => m.id)));
  showSuggest();
}
// After an edit: a block that is exactly a matrix arrow gets a one-time offer in the top chip.
const matSeen = new Set();
const blockKey = (ids) => ids.slice().sort().join(',');
let matSpotT = 0;
function queueMatSpot() {
  clearTimeout(matSpotT);
  matSpotT = setTimeout(() => {
    const d = doc.diagrams[activeDi], s = $('#suggest');
    if (!d || drag || isLocked() || preview || (!s.hidden && !s.classList.contains('closing'))) return;
    const blocks = ZX.findMatBlocks(d).filter((b) => b.ids.length >= 4 && !matSeen.has(blockKey(b.ids)));
    if (!blocks.length) return;
    blocks.forEach((b) => matSeen.add(blockKey(b.ids)));
    const A = blocks[0].A;
    showChip(blocks.length > 1 ? `${blocks.length} Z–X blocks here are matrix arrows` : `This Z–X block is a ${A.length}×${A[0].length} matrix arrow`, 'Fold  ⇧A', () => {
      const bs = doc.diagrams.includes(d) ? ZX.findMatBlocks(d).filter((b) => b.ids.length >= 4) : [];
      if (bs.length) foldBlocks(d, bs);
    });
  }, 700);
}

function positionInsp() {
  if (insp.hidden || isPhone()) return;
  const { nodes, edges } = selected();
  const pts = [];
  nodes.forEach(({ n, d }) => pts.push(toScreen(dpos(d, n))));
  edges.forEach(({ e, d }) => {
    const A = d.nodes.find((n) => n.id === e.a), B = d.nodes.find((n) => n.id === e.b);
    if (A && B) pts.push(toScreen(edgeGeom(d, e, A, B, dpos).m));
  });
  if (!pts.length) return;
  const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
  const w = insp.offsetWidth, h = insp.offsetHeight, gap = 22 * Math.max(cam.k, 0.6);
  insp.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + 'px';
  // anchor by the bottom edge when above, so the panel grows upwards while the phase row unfolds
  if (y0 - gap - h < 60) { insp.style.bottom = 'auto'; insp.style.top = Math.min(innerHeight - h - 80, y1 + gap) + 'px'; }
  else { insp.style.top = 'auto'; insp.style.bottom = (innerHeight - (y0 - gap)) + 'px'; }
}

let typingSnap = false;
insp.addEventListener('focusin', () => { typingSnap = false; });
insp.addEventListener('input', (ev) => {
  const el = ev.target, { nodes, edges } = selected();
  if (!typingSnap) { snapshot(); typingSnap = true; }
  if (el.dataset.i === 'label' && nodes[0]) nodes[0].n.label = el.value;
  if (nodes[0] && nodes[0].n.t === 'M') matInput(nodes[0].n, el);
  if (el.dataset.i === 'opts' && edges[0]) edges[0].e.o = el.value;
  save(); render();
});
insp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.target.tagName !== 'TEXTAREA' || ev.metaKey || ev.ctrlKey)) ev.target.blur(); ev.stopPropagation(); if (ev.key === 'Escape') ev.target.blur(); });
// After typing, rebuild the panel (it skips rebuilds while a field has focus). Only for fields, and only once
// focus has left them: rebuilding when focus just moves between buttons replaced the button mid-click.
insp.addEventListener('focusout', (ev) => {
  if (!/INPUT|TEXTAREA/.test(ev.target.tagName)) return;
  const to = ev.relatedTarget;
  if (to && insp.contains(to) && /INPUT|TEXTAREA/.test(to.tagName)) return;
  setTimeout(() => { if (inspPress) inspLater = true; else { inspSig = ''; updateInspector(); } }, 0);
});
let inspPress = false, inspLater = false;   // a press in the panel: rebuild only after its click has landed
insp.addEventListener('pointerdown', () => { inspPress = true; }, true);
window.addEventListener('pointerup', () => setTimeout(() => {
  inspPress = false;
  if (inspLater) { inspLater = false; inspSig = ''; updateInspector(); }
}, 0));
insp.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-i]');
  if (!b || b.tagName === 'INPUT') return;
  const { nodes, edges } = selected(), a = b.dataset.i, v = b.dataset.v;
  if (a === 'del') return deleteSel();
  if (a === 'swap') return swapColour();
  if (a === 'copy') return copySel();
  if (a === 'tomat') { const bk = selBlock(); return bk && foldBlocks(bk.d, [bk.b]); }
  if (a[0] === 'm' && nodes[0] && nodes[0].n.t === 'M') return matClick(nodes[0].n, nodes[0].d, b);
  if (a === 'type') return mutate(() => nodes.forEach(({ n }) => setType(n, v)));
  if (a === 'phase') return mutate(() => { nodes[0].n.label = v; });
  if (a === 'loop') return mutate(() => { const { n, d } = nodes[0]; d.edges.push({ id: ZX.newId('e'), a: n.id, b: n.id, o: 'loop above' }); });
  if (a === 'curve') return mutate(() => setCurve(edges[0].e, v));
  if (a === 'hbox') return mutate(() => toggleTok(edges[0].e, 'H'));
  if (a === 'wcol' || a === 'wls') { const f = a === 'wcol' ? 'col' : 'ls'; return mutate(() => edges.forEach(({ e }) => { if (v) e[f] = v; else delete e[f]; })); }
  if (a === 'rev') return mutate(() => {
    const e = edges[0].e; [e.a, e.b] = [e.b, e.a];
    e.o = ZX.splitOpts(e.o).map((t) => t.replace(/^bend\s+(left|right)/, (_, s) => 'bend ' + (s === 'left' ? 'right' : 'left'))).join(', ');
  });
});

// ---------- secondary popover (separator / frame options) ----------
let popAnchor = null;
function openPop(html, anchor) { pop.innerHTML = html; pop.hidden = false; syncAllPills(pop); popAnchor = anchor; positionPop(); const i = pop.querySelector('input'); if (i && !isPhone()) i.focus(); }
function closePop() { pop.hidden = true; popAnchor = null; }
function positionPop() {
  if (pop.hidden || !popAnchor || isPhone()) return;
  if (pop.dataset.kind && pop.dataset.kind !== 'wrap' && pop.dataset.kind !== 'check' && !doc.diagrams[+pop.dataset.i]) return closePop();
  const s = toScreen(popAnchor());
  const w = pop.offsetWidth;
  pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, s.x - w / 2)) + 'px';
  pop.style.top = Math.max(60, Math.min(innerHeight - pop.offsetHeight - 80, s.y + 26)) + 'px';
}
// Re-space diagrams after the relation between them changed size.
function respace() { animate(tidy, 320); }
function sepParts(s) {
  const m = /^\\stackrel\{\\mathbf\{(.*)\}\}\{(.*)\}$/.exec(s.trim());
  if (m) return { rule: m[1], rel: m[2] };
  return { rule: '', rel: s.trim() };
}
const sepBuild = (rule, rel) => (rule ? `\\stackrel{\\mathbf{${rule}}}{${rel || '='}}` : rel);
function openSep(i) {
  if (lockedStop()) return;
  const draw = () => {
    const { rule, rel } = sepParts(sepOf(i));
    return `<div class="row"><div class="seg" data-seg="rel">${RELS.map(([l, v]) => `<button data-s="rel" data-v="${esc(v)}" class="${rel === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <label class="field"><span>Rule</span><input data-s="rule" value="${esc(rule)}" placeholder="(sp)" spellcheck="false"></label></div>
      <div class="chips">${RULES.map((r) => `<button class="chip${rule.includes(r) ? ' on' : ''}" data-s="chip" data-v="${esc(r)}">${r.replace('\\pi', 'π')}</button>`).join('')}</div>
      <div class="row"><label class="field"><span>LaTeX</span><input data-s="raw" value="${esc(sepOf(i))}" spellcheck="false"></label></div>
      ${brRow(i)}`;
  };
  openPop(draw(), () => (doc.diagrams[i + 1] ? sepPoint(i, doc.diagrams.map(frameRect), lineStarts()) : { x: 0, y: 0 }));
  pop.dataset.kind = 'sep'; pop.dataset.i = i;
  pop._redraw = () => { const f = document.activeElement && document.activeElement.dataset.s; pop.innerHTML = draw(); syncAllPills(pop); if (f) { const el = pop.querySelector(`input[data-s="${f}"]`); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } } };
}
function brRow(i) {
  const d = doc.diagrams[i + 1];
  if (!d) return '';
  const auto = !d.br && lineStarts()[i + 1];
  return `<div class="row brrow"><button class="chip${d.br ? ' on' : ''}" data-s="br">${I.wrap}<span>New line here</span></button><button class="chip" data-s="ins">${I.plus}<span>Insert diagram</span></button>
    <span class="muted">${auto ? `Wraps here anyway (every ${doc.wrap})` : d.br ? 'The next diagram starts a new line' : 'Start the next diagram on a new line'}</span></div>`;
}
// Top-bar popover: how many diagrams fit on one line before wrapping (per tab).
const WRAP_OPTS = [0, 2, 3, 4, 5, 6, 8];
function openWrap() {
  if (lockedStop()) return;
  const draw = () => {
    const manual = doc.diagrams.some((d, i) => i > 0 && d.br);
    return `<div class="wraphead">Diagrams per line</div>
      <div class="seg" data-seg="wrap">${WRAP_OPTS.map((n) => `<button data-s="wrap" data-v="${n}" class="${(doc.wrap || 0) === n ? 'on' : ''}">${n || 'No wrap'}</button>`).join('')}</div>
      <div class="phint">Click a relation on the canvas and pick <b>New line here</b> to break a line by hand.${manual ? ` <button class="linkbtn" data-s="clearbr">Clear hand-made breaks</button>` : ''}</div>`;
  };
  const btn = $('#btnWrap');
  openPop(draw(), () => { const r = btn.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.bottom - 18); });
  pop.dataset.kind = 'wrap'; pop.dataset.i = 0;
  pop._redraw = () => { pop.innerHTML = draw(); syncAllPills(pop); };
}
function openFrameOpts(i) {
  const d = doc.diagrams[i];
  openPop(`<div class="row"><label class="field"><span>\\zx[ ]</span><input data-s="fopts" value="${esc(d.opts)}" placeholder="row sep=3mm, column sep=4mm" spellcheck="false"></label></div>
    <div class="chips">${['row sep=3mm, column sep=4mm', 'row sep=small, column sep=small', ''].map((o) => `<button class="chip${d.opts === o ? ' on' : ''}" data-s="fchip" data-v="${o}">${o || 'none'}</button>`).join('')}</div>`,
    () => { const f = frameRect(d); return { x: f.x0 + 60, y: f.y0 - 30 }; });
  pop.dataset.kind = 'frame'; pop.dataset.i = i;
}
let popSnap = false;
pop.addEventListener('focusin', () => { popSnap = false; });
pop.addEventListener('change', (ev) => {
  if (ev.target.dataset.s === 'live') { setLiveCheck(ev.target.checked); return; } if (ev.target.dataset.s === 'raw' || ev.target.dataset.s === 'rule') respace(); });
pop.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter' || ev.key === 'Escape') closePop(); });
pop.addEventListener('input', (ev) => {
  if (pop.dataset.kind === 'check') {   // settings only: no undo step
    const el = ev.target;
    if (el.dataset.s === 'lv') { const v = parseFloat(el.value); if (isFinite(v)) { matState.vals[el.dataset.k] = v; render(); } }
    return;
  }
  const el = ev.target, i = +pop.dataset.i;
  if (!popSnap) { snapshot(); popSnap = true; }
  if (el.dataset.s === 'raw') doc.seps[i] = el.value;
  if (el.dataset.s === 'rule') doc.seps[i] = sepBuild(el.value.trim(), sepParts(sepOf(i)).rel);
  if (el.dataset.s === 'fopts') doc.diagrams[i].opts = el.value.trim();
  save(); render();
  if (pop.dataset.kind === 'sep') { const raw = pop.querySelector('[data-s="raw"]'); if (raw && el !== raw) raw.value = doc.seps[i]; }
});
pop.addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-s]');
  if (!b) return;
  const i = +pop.dataset.i, v = b.dataset.v;
  if (b.dataset.s === 'rel') { mutate(() => { doc.seps[i] = v ? sepBuild(sepParts(sepOf(i)).rule, v) : ''; }); respace(); }
  if (b.dataset.s === 'chip') mutate(() => {
    const p = sepParts(sepOf(i));
    const rule = p.rule.includes(v) ? p.rule.replace(v, '') : p.rule + v;
    doc.seps[i] = sepBuild(rule, p.rel);
  });
  if (b.dataset.s === 'chip') respace();
  if (b.dataset.s === 'fchip') { mutate(() => { doc.diagrams[i].opts = v; }); return closePop(); }
  if (b.dataset.s === 'ins') return insertDiagram(i);
  if (b.dataset.s === 'lc') { matState.check = v; try { localStorage.setItem('zx-draw-check', v); } catch (_) {} if (!liveCheck) setLiveCheck(true); else render(); pop._redraw(); return; }
  if (b.dataset.s === 'lb') { matState.vals[b.dataset.k] = +v; render(); pop._redraw(); return; }
  if (b.dataset.s === 'simp-ins') return applySimplify(i, 'after');
  if (b.dataset.s === 'simp-pnf') return openSimplify(i, null, null, { pnf: true });
  if (b.dataset.s === 'simp-new') return applySimplify(i, 'page');
  if (b.dataset.s === 'simp-all') return simplifyAll();
  if (b.dataset.s === 'simp-mat') return openMatrix(i, true);
  if (b.dataset.s === 'br') { mutate(() => { const d = doc.diagrams[i + 1]; if (d) d.br = !d.br; }); respace(); }
  if (b.dataset.s === 'wrap' || b.dataset.s === 'clearbr') {
    snapshot();
    animate(() => {
      if (b.dataset.s === 'wrap') { doc.wrap = +v; try { localStorage.setItem('zx-draw-wrap', v); } catch (_) {} }
      else doc.diagrams.forEach((d) => { delete d.br; });
      tidy();
    }, 420);
    fit();
  }
  if (pop._redraw && (pop.dataset.kind === 'sep' || pop.dataset.kind === 'wrap')) pop._redraw();
});

// ---------- pointer input ----------
let lastTap = null, lpTimer = 0;
// Two presses on the same item within 380 ms = double-click (works across re-renders and on touch).
function isDouble(id, e) {
  const now = performance.now();
  const dbl = lastTap && lastTap.id === id && now - lastTap.t < 380 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 12;
  lastTap = dbl ? null : { id, t: now, x: e.clientX, y: e.clientY };
  return dbl;
}
vp.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (isLocked()) return;
  if (drag && drag.type === 'ghost') return;
  if (tool === 'edge') return;   // right button in the wire tool = box select; a plain right-click opens the panel on release
  const ne = e.target.closest('[data-node]'), ee = e.target.closest('[data-edge]');
  const id = ne ? ne.dataset.node : ee ? ee.dataset.edge : null;
  if (!id) return;
  if (!sel.has(id)) sel = new Set([id]);
  openInsp(false);
});
vp.addEventListener('pointerdown', (e) => {
  if (e.target.closest('[data-act],[data-add],[data-ins],.fl[data-stat]')) return;
  const sepEl = e.target.closest('[data-sep]');
  if (sepEl && tool !== 'hand' && !isLocked()) { e.preventDefault(); return openSep(+sepEl.dataset.sep); }
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  closePop();
  if (e.button === 2) {
    // wire tool: hold the right button and drag to box-select, as with Select
    if (tool !== 'edge' || isLocked() || pointers.size) return;
    const t = e.target.closest('[data-node],[data-edge]');
    wirePend = null; fanTp = null;
    try { vp.setPointerCapture(e.pointerId); } catch (_) {}
    drag = { type: 'marq', right: true, ctx: t ? (t.dataset.node || t.dataset.edge) : null, p0: toWorld(e.clientX, e.clientY), sx: e.clientX, sy: e.clientY, base: e.shiftKey ? new Set(sel) : new Set(), moved: false };
    return;
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { vp.setPointerCapture(e.pointerId); } catch (_) {}
  if (pointers.size === 2) { startPinch(); return; }
  if (pointers.size > 2) return;
  const p = toWorld(e.clientX, e.clientY);
  const bendEl = e.target.closest('[data-bend]');
  if (bendEl && tool === 'select' && !isLocked()) {
    const f = findEdge(bendEl.dataset.bend);
    if (f) {
      const A = f.d.nodes.find((n) => n.id === f.e.a), B = f.d.nodes.find((n) => n.id === f.e.b);
      const p0 = pos(f.d, A), p1 = pos(f.d, B), L = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
      const gm = edgeGeom(f.d, f.e, A, B).m, rm = rawGeom(f.d, f.e, A, B).m;
      const fan = ((gm.x - rm.x) * -(p1.y - p0.y) + (gm.y - rm.y) * (p1.x - p0.x)) / L;   // sideways shift from parallel-wire fanning
      drag = { type: 'bend', d: f.d, e: f.e, p0, p1, fan, snap: false, deg: bendFromPoint({ p0, p1, fan }, gm).deg };
      e.preventDefault();
      render();
      return;
    }
  }
  const nodeEl = e.target.closest('[data-node]'), edgeEl = e.target.closest('[data-edge]'), gripEl = e.target.closest('[data-grip]');
  const touchBg = e.pointerType === 'touch' && !nodeEl && !edgeEl && !gripEl && tool === 'select';
  if (e.button === 1 || spaceDown || tool === 'hand' || touchBg || isLocked()) {
    cancelAnimationFrame(camAnim);
    drag = { type: 'pan', sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, moved: false, touch: touchBg };
    vp.classList.add('panning');
    return;
  }
  if (gripEl) {
    const i = +gripEl.dataset.grip, d = doc.diagrams[i];
    activeDi = i;
    drag = { type: 'frame', d, p0: p, ox: d.ox, oy: d.oy, snap: false };
    return;
  }
  if (nodeEl) {
    const f = findNode(nodeEl.dataset.node);
    if (!f) return;
    const { n, d } = f;
    activeDi = doc.diagrams.indexOf(d);
    if (tool === 'edge') {
      const sp = n.t === 'M' ? pickPort(d, n, p) : null;
      drag = { type: 'edge', d, from: n, p0: sp || pos(d, n), startPort: sp, tp: null, tgt: {}, chain: [n], lp: p, mod: e.metaKey || e.ctrlKey, shift: e.shiftKey, viaS: holdS };
      return;
    }
    if (tool === 'select' && (e.ctrlKey || e.metaKey || e.altKey)) {
      // Ctrl: move the node itself; ⌘ / Alt: copy it. Neither carries the old wires.
      sel = new Set([n.id]); inspOpen = false;
      drag = { type: 'ghost', d, n, mode: e.ctrlKey ? 'cut' : 'copy', p0: p, td: d, cell: null, tp: null, dropId: null, moved: false };
      vp.classList.toggle('copying', drag.mode === 'copy');
      render();
      return;
    }
    // Node tools act like Select on an existing node: select it, never retype it.
    const again = (tool === 'select' || ['Z', 'X', 'H', 'N', 'T', 'P', 'M'].includes(tool)) && sel.size === 1 && sel.has(n.id) && !inspOpen && !e.shiftKey;
    if (e.shiftKey) { sel.has(n.id) ? sel.delete(n.id) : sel.add(n.id); inspOpen = false; render(); return; }
    if (!sel.has(n.id)) { sel = new Set([n.id]); inspOpen = false; }
    const ids = [...sel].filter((id) => id[0] === 'n' && d.nodes.some((m) => m.id === id));
    drag = { type: 'move', d, ids, start: new Map(ids.map((id) => { const m = d.nodes.find((x) => x.id === id); return [id, { r: m.r, c: m.c }]; })), p0: p, dr: 0, dc: 0, snap: false, again, focus: n.t === 'Z' || n.t === 'X' || n.t === 'T' };
    if (e.pointerType === 'touch') lpTimer = setTimeout(() => { if (drag && drag.type === 'move' && !drag.snap) { drag = null; openInsp(false); } }, 480);
    render();
    return;
  }
  if (edgeEl) {
    const f = findEdge(edgeEl.dataset.edge);
    if (!f) return;
    activeDi = doc.diagrams.indexOf(f.d);
    if (['Z', 'X', 'H', 'N', 'P'].includes(tool)) return splitEdge(f.d, f.e, p, tool);
    if (!e.shiftKey && !e.metaKey && !e.ctrlKey && sel.size === 1 && sel.has(f.e.id) && !inspOpen) return openInsp(false);
    if (e.shiftKey || e.metaKey || e.ctrlKey) { sel.has(f.e.id) ? sel.delete(f.e.id) : sel.add(f.e.id); inspOpen = false; }
    else if (!sel.has(f.e.id) || sel.size > 1) { sel = new Set([f.e.id]); inspOpen = false; }
    if (e.pointerType === 'touch') lpTimer = setTimeout(() => openInsp(false), 480);
    render();
    return;
  }
  // empty canvas
  lastTap = null;
  if (['Z', 'X', 'H', 'N', 'T', 'P', 'M'].includes(tool)) return placeNode(p, tool);
  if (tool === 'edge') {
    const had = doc.diagrams.length;
    const d = pickDiagram(p), c = cellOf(d, p);
    drag = { type: 'edge', d, from: at(d, c.r, c.c) || null, fromCell: c, p0: { x: d.ox + c.c * CW, y: d.oy + c.r * CH }, tp: null, tgt: {}, newDiagram: !had, chain: [], lp: p, mod: e.metaKey || e.ctrlKey, shift: e.shiftKey, viaS: holdS };
    return;
  }
  drag = { type: 'marq', p0: p, sx: e.clientX, sy: e.clientY, base: e.shiftKey ? new Set(sel) : new Set(), moved: false };
  if (!e.shiftKey && sel.size) { sel.clear(); render(); }
});

// The frame bar (number, duplicate, options …) shows only for the diagram under the pointer.
let hovDi = -1, barRects = [];
function setHovDi(i) {
  if (i === hovDi) return;
  hovDi = i;
  world.querySelectorAll('.fbar').forEach((b) => b.classList.toggle('hov', +b.dataset.fb === i));
}
function hoverDiagram(e) {
  if (e.pointerType === 'touch' || (drag && drag.type !== 'pan')) return;
  if (drag) return setHovDi(-1);
  const fb = e.target.closest && e.target.closest('.fbar');
  if (fb) return setHovDi(+fb.dataset.fb);   // on the bar itself (it can be wider than its diagram)
  const p = toWorld(e.clientX, e.clientY);
  let best = -1, bd = Infinity;
  barRects.forEach((r, i) => {   // the frame plus the strip above it where the bar sits
    if (p.x < r.x0 - 6 || p.x > r.x1 + 6 || p.y < r.y0 - 40 || p.y > r.y1 + 6) return;
    const dd = Math.hypot(p.x - (r.x0 + r.x1) / 2, p.y - (r.y0 + r.y1) / 2);
    if (dd < bd) { bd = dd; best = i; }
  });
  setHovDi(best);
}
vp.addEventListener('pointerleave', () => setHovDi(-1));
vp.addEventListener('pointermove', (e) => {
  hoverDiagram(e);
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch) return updatePinch();
  const p = toWorld(e.clientX, e.clientY);
  lastWorld = p;
  if (!drag) {
    if (tool === 'edge' && mWatch(null, p)) render();
    if (wirePend && tool === 'edge') { const c = cellOf(wirePend.d, p); wirePend.tp = mHot && mHot.id !== wirePend.n.id ? { x: mHot.x, y: mHot.y } : { x: wirePend.d.ox + c.c * CW, y: wirePend.d.oy + c.r * CH }; render(); }
    else if (tool === 'edge' && sel.size >= fanMin()) {
      const fd = doc.diagrams.find((d) => d.nodes.some((n) => sel.has(n.id)));
      if (fd && fanSources(fd).length >= fanMin()) { const c = cellOf(fd, p), q = { x: fd.ox + c.c * CW, y: fd.oy + c.r * CH }; if (!fanTp || fanTp.x !== q.x || fanTp.y !== q.y) { fanTp = q; render(); } }
    } else if (fanTp) { fanTp = null; render(); }
    return;
  }
  if (drag.type === 'bend') {
    const r = bendFromPoint(drag, p);
    drag.deg = r.deg;
    if (r.tok !== (ZX.splitOpts(drag.e.o).find(CURVE_TOK) || '')) {
      if (!drag.snap) { snapshot(); drag.snap = true; }
      setCurve(drag.e, r.tok);
    }
    render();
    return;
  }
  if (drag.type === 'pan') {
    cam.x = drag.cx + e.clientX - drag.sx; cam.y = drag.cy + e.clientY - drag.sy;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true;
    return applyCam();
  }
  if (drag.type === 'frame') {
    const dc = Math.round((p.x - drag.p0.x) / CW), dr = Math.round((p.y - drag.p0.y) / CH);
    const ox = drag.ox + dc * CW, oy = drag.oy + dr * CH, D = drag.d;
    if (ox !== D.ox || oy !== D.oy) {
      if (!drag.snap) { snapshot(); drag.snap = true; }
      animate(() => { D.ox = ox; D.oy = oy; }, 140);
    }
    return;
  }
  if (drag.type === 'ghost') {
    if (!drag.moved && Math.hypot(p.x - drag.p0.x, p.y - drag.p0.y) < 8) return;
    drag.moved = true;
    const td = pickDiagram(p), cell = cellOf(td, p), w = wireUnder(td, p, drag.mode === 'cut' ? drag.n.id : null);
    drag.td = td; drag.cell = cell; drag.dropId = w ? w.id : null;
    drag.tp = { x: td.ox + cell.c * CW, y: td.oy + cell.r * CH };
    return render();
  }
  if (drag.type === 'move') {
    const dt = dropTarget(drag, p), did = dt ? dt.id : null;
    if (did !== drag.dropId && Math.hypot(p.x - drag.p0.x, p.y - drag.p0.y) > 10) { drag.dropId = did; render(); }
    const dc = Math.round((p.x - drag.p0.x) / CW), dr = Math.round((p.y - drag.p0.y) / CH);
    if (dc === drag.dc && dr === drag.dr) return;
    const moving = new Set(drag.ids);
    const occ = new Set(drag.d.nodes.filter((n) => !moving.has(n.id)).map((n) => n.r + ',' + n.c));
    if (!drag.ids.every((id) => { const s = drag.start.get(id); return !occ.has((s.r + dr) + ',' + (s.c + dc)); })) return;
    if (!drag.snap) { snapshot(); drag.snap = true; clearTimeout(lpTimer); }
    const D = drag;
    animate(() => D.ids.forEach((id) => { const n = D.d.nodes.find((x) => x.id === id), s = D.start.get(id); n.r = s.r + dr; n.c = s.c + dc; }), 130);
    drag.dr = dr; drag.dc = dc;
    return;
  }
  if (drag.type === 'edge') {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const ne = el && el.closest && el.closest('[data-node]');
    let node = null;
    if (ne) { const f = findNode(ne.dataset.node); if (f && f.d === drag.d) node = f.n; }
    // nodes the stroke passes through (checked along the segment, so fast drags don't skip any)
    const a = drag.lp, vx = p.x - a.x, vy = p.y - a.y, L2 = vx * vx + vy * vy || 1;
    drag.d.nodes.map((m) => { const q = pos(drag.d, m), t = Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.y - a.y) * vy) / L2)); return { m, t, dist: Math.hypot(a.x + vx * t - q.x, a.y + vy * t - q.y) }; })
      .filter((h) => h.dist < 13 && !drag.chain.includes(h.m)).sort((x, y) => x.t - y.t).forEach((h) => drag.chain.push(h.m));
    drag.lp = p;
    const cell = node ? { r: node.r, c: node.c } : cellOf(drag.d, p);
    drag.tgt = node ? { node } : { cell };
    drag.tp = { x: drag.d.ox + cell.c * CW, y: drag.d.oy + cell.r * CH };
    drag.port = node && node.t === 'M' && node !== drag.from ? pickPort(drag.d, node, p) : null;
    if (drag.port) drag.tp = { x: drag.port.x, y: drag.port.y };
    mWatch(drag.d, p, drag.port);
    return render();
  }
  if (drag.type === 'marq') {
    const R = vp.getBoundingClientRect();
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 3) drag.moved = true;
    if (!drag.moved) return;
    const x0 = Math.min(drag.sx, e.clientX), y0 = Math.min(drag.sy, e.clientY);
    Object.assign(marq.style, { display: 'block', left: (x0 - R.left) + 'px', top: (y0 - R.top) + 'px', width: Math.abs(e.clientX - drag.sx) + 'px', height: Math.abs(e.clientY - drag.sy) + 'px' });
    const a = drag.p0, wx0 = Math.min(a.x, p.x), wx1 = Math.max(a.x, p.x), wy0 = Math.min(a.y, p.y), wy1 = Math.max(a.y, p.y);
    const s = new Set(drag.base), inside = new Set();
    doc.diagrams.forEach((d) => {
      d.nodes.forEach((n) => { const q = pos(d, n); if (q.x >= wx0 && q.x <= wx1 && q.y >= wy0 && q.y <= wy1) { inside.add(n.id); if (selPick[pickKind(n.t)] !== false) s.add(n.id); } });
      if (selPick.wire !== false) d.edges.forEach((ed) => { if (inside.has(ed.a) && inside.has(ed.b)) s.add(ed.id); });
    });
    // a wire is picked as soon as any part of it lies in the box (points sampled once per drag from the drawn paths)
    if (selPick.wire !== false) {
      if (!drag.wpts) {
        drag.wpts = [];
        world.querySelectorAll('.edges .edge[data-edge] > .wire-p').forEach((el) => {
          const L = el.getTotalLength(), k = Math.max(2, Math.ceil(L / 5)), pts = [];
          for (let i = 0; i <= k; i++) { const q = el.getPointAtLength(L * i / k); pts.push(q.x, q.y); }
          drag.wpts.push([el.parentNode.dataset.edge, pts]);
        });
      }
      drag.wpts.forEach(([id, pts]) => {
        if (s.has(id)) return;
        for (let i = 0; i < pts.length; i += 2) if (pts[i] >= wx0 && pts[i] <= wx1 && pts[i + 1] >= wy0 && pts[i + 1] <= wy1) { s.add(id); break; }
      });
    }
    sel = s;
    inspOpen = false;
    render();
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  clearTimeout(lpTimer);
  if (pinch) { if (pointers.size < 2) pinch = null; return; }
  if (!drag) return;
  const D = drag;
  drag = null;
  if (!spaceDown) vp.classList.remove('panning');
  marq.style.display = 'none';
  if (D.type === 'pan') { if (D.touch && !D.moved && sel.size) { sel.clear(); render(); } return; }
  if (D.type === 'edge') { finishEdge(D); if (!holdS && tool === 'edge' && D.viaS) setTool('select'); return; }
  if (D.type === 'marq' && D.right && !D.moved) {
    if (D.ctx && findNode(D.ctx) || D.ctx && findEdge(D.ctx)) { if (!sel.has(D.ctx)) sel = new Set([D.ctx]); return openInsp(false); }
    return render();
  }
  if (D.type === 'ghost') { vp.classList.remove('copying'); return D.moved && D.cell ? finishGhost(D, toWorld(e.clientX, e.clientY)) : render(); }
  if (D.type === 'move' && D.dropId) {
    const d = D.d, n = d.nodes.find((x) => x.id === D.ids[0]), ed = d.edges.find((x) => x.id === D.dropId);
    if (n && ed) {
      const p = toWorld(e.clientX, e.clientY);
      if (!D.snap) snapshot();
      animate(() => { detachNode(d, n); insertIntoEdge(d, ed, p, n); }, 320);
      showSuggest();
      return;
    }
  }
  if (D.type === 'move' && !D.snap && D.again) return openInsp(D.focus);
  if (D.snap) save();
  render();
}
vp.addEventListener('pointerup', endPointer);
vp.addEventListener('pointercancel', endPointer);

function finishGhost(D, p) {
  const { n, d, td, cell, mode } = D;
  const wire = D.dropId ? td.edges.find((x) => x.id === D.dropId) : null;
  if (!wire) {
    const occ = at(td, cell.r, cell.c);
    if (mode === 'cut' && occ === n) return render();
    if (occ) { toast('That cell is taken'); return render(); }
  }
  snapshot();
  animate(() => {
    let m;
    if (mode === 'cut') { detachNode(d, n); m = n; } else m = Object.assign({}, n, { id: ZX.newId('n') });
    if (wire) insertIntoEdge(td, wire, p, m); else { m.r = cell.r; m.c = cell.c; td.nodes.push(m); }
    sel = new Set([m.id]);
  }, 300);
  activeDi = doc.diagrams.indexOf(td);
  if (mode === 'cut' || wire) showSuggest();
}

// Arrow to arrow: the outputs of the left one (in its direction) go to the inputs of the other, port j to port j.
function bundleArrows(d, A, B) {
  const aOut = (B.c > A.c) !== (A.v === '<') || B.c === A.c;
  const src = aOut ? A : B, dst = aOut ? B : A;
  const so = ZX.matSides(d, src).outSlots, si = ZX.matSides(d, dst).inSlots;
  const k = Math.max(1, Math.min(src.mat ? src.mat.length : 1, dst.mat && dst.mat[0] ? dst.mat[0].length : 1));
  // the ports this replaces are freed first
  d.edges = d.edges.filter((e) => !so.concat(si).some((x) => x && x.e === e && ((e.a === src.id && e.b === dst.id) || (e.a === dst.id && e.b === src.id))));
  for (let j = 0; j < k; j++) {
    const id = ZX.newId('e');
    d.edges.push({ id, a: src.id, b: dst.id, o: '' });
    ZX.setPort(src, 'out', j, id); ZX.setPort(dst, 'in', j, id);
  }
  const ka = src.mat ? src.mat.length : k, kb = dst.mat && dst.mat[0] ? dst.mat[0].length : k;
  if (ka !== kb) toast(`${src.label || 'A'} has ${ka} outputs but ${dst.label || 'B'} has ${kb} inputs`);
}
// Wire tool near a matrix arrow: remember which arrow (ports grow) and which port is aimed at.
// Returns true when that changed.
function mWatch(d0, q, port) {
  let best = null, bd = 64;
  (d0 ? [d0] : doc.diagrams).forEach((d) => d.nodes.forEach((n) => {
    if (n.t !== 'M') return;
    const p = pos(d, n), dist = Math.hypot(Math.max(0, Math.abs(q.x - p.x) - M_PORT), Math.max(0, Math.abs(q.y - p.y) - 20));
    if (dist < bd) { bd = dist; best = { d, n }; }
  }));
  const id = best ? best.n.id : null;
  let hot = port || null;
  if (!hot && best && Math.abs(q.x - pos(best.d, best.n).x) > M_BAR - 6) hot = pickPort(best.d, best.n, q);
  const was = JSON.stringify([mNear && mNear.id, mHot && [mHot.id, mHot.side, mHot.j]]);
  if (id !== (mNear && mNear.id)) mNear = id ? { id, t0: performance.now() } : null;
  mHot = hot && id === hot.id ? hot : null;
  return was !== JSON.stringify([mNear && mNear.id, mHot && [mHot.id, mHot.side, mHot.j]]);
}
function finishEdge(D) {
  const d = D.d, t = D.tgt;
  const from = D.from ? { r: D.from.r, c: D.from.c } : D.fromCell;
  const to = t && (t.node ? { r: t.node.r, c: t.node.c } : t.cell);
  if (!to || (from.r === to.r && from.c === to.c)) {
    // a click: first click picks a node, second click (node or empty cell) wires it up
    const P = wirePend && wirePend.d === d && doc.diagrams.includes(d) ? wirePend : null;
    const srcs = fanSources(d);
    if (D.from && D.mod) {   // ⌘/Ctrl-click: add or remove a source
      sel.has(D.from.id) ? sel.delete(D.from.id) : sel.add(D.from.id);
      if (P && !sel.has(P.n.id)) sel.add(P.n.id);
      wirePend = null;
      const k = fanSources(d).length;
      if (k > 1) toast(`${k} sources — click a target to wire them all`);
      return render();
    }
    if (srcs.length >= fanMin() && (!D.from || !sel.has(D.from.id))) {   // several sources: wire them all to the clicked node or cell
      wirePend = null;
      return fanTo(d, srcs, D.from || D.fromCell, D.shift || holdS);
    }
    if (D.from) {
      if (P && P.n !== D.from) { wirePend = null; return linkChain(d, [P.n, D.from], { start: P.port, end: D.startPort }); }
      wirePend = P && P.n === D.from ? null : { d, n: D.from, tp: null, port: D.startPort };
      if (wirePend) toast('Click another node or cell to connect');
      return render();
    }
    wirePend = null;
    if (P) return linkChain(d, [P.n, D.fromCell], { start: P.port });
    if (D.newDiagram && !d.nodes.length) doc.diagrams = doc.diagrams.filter((x) => x !== d);
    return render();
  }
  wirePend = null;
  const seq = [D.from || from];
  D.chain.forEach((n) => { if (n !== seq[0]) seq.push(n); });
  const B = t.node || at(d, to.r, to.c) || to;
  if (seq[seq.length - 1] !== B) seq.push(B);
  linkChain(d, seq, { start: D.startPort, end: t.node && t.node.t === 'M' ? D.port : null });
}
// wire consecutive items of seq (nodes, or {r,c} cells that become wire points).
// A plain two-point wire is always added; a pass-through chain skips pairs that are already wired.
// ---------- many sources → one target (wire tool) ----------
const fanSources = (d) => [...sel].filter((id) => id[0] === 'n').map(findNode).filter((x) => x && x.d === d).map((x) => x.n);
function fanTo(d, srcs, target, keep) {
  let made = 0;
  mutate(() => {
    let t = target.id ? target : at(d, target.r, target.c);
    if (!t) { t = makeNode('N', target.r, target.c); d.nodes.push(t); }
    srcs.forEach((s) => {
      if (s === t || d.edges.some((e) => (e.a === s.id && e.b === t.id) || (e.a === t.id && e.b === s.id))) return;
      d.edges.push({ id: ZX.newId('e'), a: s.id, b: t.id, o: '' }); made++;
    });
    if (!keep) sel.clear();
  });
  fanTp = null;
  toast(made ? `Connected ${made} wire${made === 1 ? '' : 's'}${keep ? (holdS ? ' — click another target, or let go of S' : ' — Shift-click another target, or Esc') : ''}` : 'Already connected');
}
let fanTp = null;   // pointer cell while several sources wait for a target (ghost lines)
// Holding S in the Select tool with nodes selected: the wire tool until S is let go, and one source is enough.
const fanMin = () => (holdS ? 1 : 2);
function releaseS() {
  if (!holdS) return;
  holdS = false; fanTp = null;
  if (drag && drag.type === 'edge') return;   // finish the wire first (endPointer calls this again)
  if (tool === 'edge') setTool('select');
  render();
}
function linkChain(d, seq, ports) {
  ports = ports || {};
  mutate(() => {
    const ns = seq.map((x) => {
      if (x.id) return x;
      let m = at(d, x.r, x.c);
      if (!m) { m = makeNode('N', x.r, x.c); d.nodes.push(m); }
      return m;
    });
    for (let i = 0; i + 1 < ns.length; i++) {
      const A = ns[i], B = ns[i + 1];
      if (A === B) continue;
      if (ns.length > 2 && d.edges.some((e) => (e.a === A.id && e.b === B.id) || (e.a === B.id && e.b === A.id))) continue;
      if (A.t === 'M' && B.t === 'M') { bundleArrows(d, A, B); continue; }
      const eid = ZX.newId('e');
      d.edges.push({ id: eid, a: A.id, b: B.id, o: '' });
      // a wire dropped on (or started from) a port of a matrix arrow keeps that port
      if (i === 0 && A.t === 'M' && ports.start && ports.start.id === A.id) ZX.setPort(A, ports.start.side, ports.start.j, eid);
      if (i === ns.length - 2 && B.t === 'M' && ports.end && ports.end.id === B.id) ZX.setPort(B, ports.end.side, ports.end.j, eid);
    }
    sel.clear();
  });
  mNear = mHot = null;
}

function pinchState() { const [a, b] = [...pointers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function startPinch() {
  cancelAnimationFrame(camAnim);
  if (drag && drag.snap) save();
  drag = null; marq.style.display = 'none';
  const s = pinchState(), R = vp.getBoundingClientRect();
  pinch = Object.assign(s, { k: cam.k, wx: (s.x - R.left - cam.x) / cam.k, wy: (s.y - R.top - cam.y) / cam.k });
}
function updatePinch() {
  const s = pinchState(), R = vp.getBoundingClientRect();
  cam.k = Math.max(0.15, Math.min(5, pinch.k * s.d / pinch.d));
  cam.x = s.x - R.left - pinch.wx * cam.k; cam.y = s.y - R.top - pinch.wy * cam.k;
  applyCam();
}

vp.addEventListener('wheel', (e) => {
  e.preventDefault();
  cancelAnimationFrame(camAnim);
  if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
  else { cam.x -= e.deltaX; cam.y -= e.deltaY; applyCam(); }
}, { passive: false });

// clicks on in-world buttons (frame bar, add)
world.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act],[data-add],[data-ins]');
  if (!b) return;
  if (b.hasAttribute('data-add')) return addDiagram();
  if (b.hasAttribute('data-ins')) return doc.single ? singleBlocked() : insertDiagram(+b.dataset.ins);
  const i = +b.dataset.fi;
  activeDi = i;
  if (['opts', 'rot', 'del'].includes(b.dataset.act) && lockedStop()) return;
  if (b.dataset.act === 'dup') dupDiagram(i);
  if (b.dataset.act === 'simp') openSimplify(i);
  if (b.dataset.act === 'rot') rotateDiagram(i);
  if (b.dataset.act === 'mat') openMatrix(i);
  if (b.dataset.act === 'del') delDiagram(i);
  if (b.dataset.act === 'opts') openFrameOpts(i);
});

// ---------- keyboard ----------
window.addEventListener('keydown', (e) => {
  const ae = document.activeElement, typing = ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName);
  if (e.key === 'Escape') {
    if (!$('#modal').hidden) return closeModal();
    if (typing) return ae.blur();
    // step back one level at a time: wire in progress → open popover → selection → back to Select
    if (wirePend || (drag && drag.type === 'edge')) { wirePend = null; if (drag && drag.type === 'edge') drag = null; return render(); }
    if (!pop.hidden || inspOpen || (statEl && statEl.classList.contains('show')) || ctxEl) { closePop(); hideStat(); closeCtx(); if (inspOpen) { inspOpen = false; } return render(); }
    if (sel.size) { sel.clear(); hideSuggest(); return render(); }
    hideSuggest(); if (tool !== 'select') setTool('select'); return render();
  }
  if (typing || !$('#modal').hidden) return;
  const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
  if (mod) {
    if (k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
    if (k === 'y') { e.preventDefault(); return redo(); }
    if (k === 'a') { e.preventDefault(); sel = new Set(); doc.diagrams.forEach((d) => { d.nodes.forEach((n) => sel.add(n.id)); d.edges.forEach((x) => sel.add(x.id)); }); return render(); }
    if (k === 'c') { copySel(); return; }
    if (k === 'v') { e.preventDefault(); return paste(); }
    if (k === 'x') { if (lockedStop()) return; copySel(); return deleteSel(); }
    if (k === 's') { e.preventDefault(); return toast('Saved automatically in this browser'); }
    if (k === 'e') { e.preventDefault(); return openExport(); }
    if (k === 'i' || k === 'o') { e.preventDefault(); return openImport(); }
    return;
  }
  if (e.key === ' ') { spaceDown = true; vp.classList.add('panning'); e.preventDefault(); return; }
  const arrows = { arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1] };
  if (arrows[k]) { e.preventDefault(); return nudge(...arrows[k]); }
  if (k === 'delete') { e.preventDefault(); return deleteSel(); }
  if (k === 'w') {
    if (isLocked()) return lockedNote();
    const ns = [...sel].filter((id) => id[0] === 'n');
    if (ns.length === 2 && !e.shiftKey) return swapNodes(ns[0], ns[1]);
    return setTool('edge');
  }
  if (e.altKey && /^Digit[1-9]$/.test(e.code)) { e.preventDefault(); return switchTab(Math.min(+e.code.slice(5), ws.tabs.length) - 1); }
  if (e.altKey && e.code === 'KeyN') { e.preventDefault(); return addTab(); }
  if (e.shiftKey && k.length === 1 && runKey('shift+' + k)) { e.preventDefault(); return; }
  if (e.shiftKey && k === 'p') { e.preventDefault(); return startShow(); }
  if (k === 's' && !e.shiftKey && !e.altKey && (holdS || (tool === 'select' && !isLocked() && [...sel].some((id) => id[0] === 'n')))) {
    // S held with nodes selected: wire them to whatever you click, until S is let go
    e.preventDefault();
    if (!holdS) { holdS = true; wirePend = null; setTool('edge'); render(); }
    return;
  }
  if (e.shiftKey && k === keys.curve) { e.preventDefault(); return toggleCurve(true); }
  if (runKey(k)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { if (e.key === ' ') { spaceDown = false; if (!drag) vp.classList.remove('panning'); } if (e.key.toLowerCase() === 's') releaseS(); });
window.addEventListener('pagehide', save);
window.addEventListener('blur', () => { spaceDown = false; vp.classList.remove('panning'); releaseS(); });
window.addEventListener('resize', () => { applyCam(); syncPill($('#dock')); });

function togglePreview() {
  preview = !preview;
  vp.classList.toggle('preview', preview);
  $('#btnPreview').classList.toggle('on', preview);
  render();
}

// ---------- modals ----------
function openModal(title, html) { recording = null; document.querySelectorAll('#modal header .hdr-tabs').forEach((x) => x.remove()); $('#modal .sheet').classList.remove('wide'); $('#mTitle').textContent = title; $('#mBody').innerHTML = html; $('#modal').hidden = false; syncAllPills($('#mBody')); closePop(); }
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') closeModal(); });
$('#modal').addEventListener('click', (e) => { if (e.target.closest('[data-m="close"]')) closeModal(); });

function importPyzx(text, mode) {
  const r = window.ZXP && ZXP.fromPyzx(text);
  if (!r) { toast('Not a PyZX graph'); return false; }
  snapshot();
  if (mode === 'append' && doc.diagrams.length) { doc.seps.push('='); doc.diagrams.push(r.diagram); }
  else { doc = { diagrams: [r.diagram], seps: [], wrap: doc.wrap || 0 }; const b = ZX.bounds(r.diagram); r.diagram.ox = -b.c0 * CW; r.diagram.oy = -Math.round((b.r0 + b.r1) / 2) * CH; }
  tidy(); sel.clear(); activeDi = doc.diagrams.indexOf(r.diagram);
  commit(); fit();
  toast(`Imported a PyZX graph · ${r.stats.vertices} vertices, ${r.stats.edges} wires${r.warnings.length ? ' — ' + r.warnings[0] : ''}`);
  return true;
}
function importText(text, mode, which) {
  if (window.ZXP && ZXP.looksLikePyzx(text)) return importPyzx(text, mode);
  const eqs = ZX.findEquations(text);
  if (!eqs.length) { toast('No \\zx{…} diagram found'); return false; }
  const parsed = ZX.parseEquation(eqs[which || 0].text);
  if (!parsed.diagrams.length) { toast('Could not read that diagram'); return false; }
  snapshot();
  if (mode === 'append' && doc.diagrams.length) {
    doc.seps.push('=');
    doc.diagrams.push(...parsed.diagrams);
    doc.seps.push(...parsed.seps);
  } else {
    doc = { diagrams: parsed.diagrams, seps: parsed.seps, wrap: doc.wrap || 0 };
    const d0 = doc.diagrams[0], b = ZX.bounds(d0);
    d0.ox = -b.c0 * CW; d0.oy = -Math.round((b.r0 + b.r1) / 2) * CH;
  }
  tidy();
  sel.clear(); activeDi = 0;
  commit(); fit();
  toast(`Imported ${parsed.diagrams.length} diagram${parsed.diagrams.length > 1 ? 's' : ''}`);
  return true;
}

function openImport(prefill) {
  if (lockedStop()) return;
  openModal('Import', `
    <div class="muted">Paste a <code>\\zx{…}</code> block, a whole equation <code>\\[ … \\]</code> with <code>\\stackrel</code> steps, a full .tex file — or a PyZX / ZXLive graph (JSON).</div>
    <textarea class="code" id="impText" spellcheck="false" placeholder="\\zx[row sep=3mm, column sep=4mm]{\n  \\zxN{} \\rar & \\zxZ{\\alpha} \\rar & \\zxN{}\n}"></textarea>
    <div class="eqlist" id="impList"></div>
    <div class="mfoot">
      <label class="btn ghost" title="Open a .tex file or a PyZX graph (.json, .zxg)">${I.up}<span>Open file…</span><input type="file" id="impFile" accept=".tex,.txt,.json,.zxg,.qgraph,text/plain,application/json" hidden></label>
      <div class="seg" id="impMode"><button data-v="replace" class="on">Replace</button><button data-v="append">Append</button></div>
      <span class="grow"></span><span class="muted" id="impInfo"></span>
      <button class="btn primary" id="impGo">Import</button>
    </div>`);
  const ta = $('#impText'), list = $('#impList'), info = $('#impInfo');
  let which = 0, mode = 'replace';
  const refresh = () => {
    if (window.ZXP && ZXP.looksLikePyzx(ta.value)) {
      const r = ZXP.fromPyzx(ta.value);
      info.textContent = r ? `PyZX graph · ${r.stats.vertices} vertices, ${r.stats.edges} wires` : 'This JSON is not a PyZX graph';
      list.innerHTML = r && r.warnings.length ? `<div class="phint">${r.warnings.map(esc).join(' · ')}</div>` : '';
      return;
    }
    const eqs = ZX.findEquations(ta.value);
    if (which >= eqs.length) which = 0;
    info.textContent = eqs.length ? (eqs.length > 1 ? `${eqs.length} equations found` : `${eqs[0].count} diagram${eqs[0].count > 1 ? 's' : ''} found`) : (ta.value.trim() ? 'No diagram found' : '');
    list.innerHTML = eqs.length > 1 ? eqs.map((q, i) => `<button class="eq${i === which ? ' on' : ''}" data-q="${i}">Equation ${i + 1} · line ${q.line} · ${q.count} diagram${q.count > 1 ? 's' : ''}<code>${esc(q.text.replace(/\s+/g, ' ').trim().slice(0, 140))}</code></button>`).join('') : '';
  };
  ta.addEventListener('input', refresh);
  list.addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) { which = +b.dataset.q; refresh(); } });
  list.addEventListener('dblclick', (e) => { if (e.target.closest('[data-q]') && importText(ta.value, mode, which)) closeModal(); });
  $('#impMode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.v; $('#impMode').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); syncPill($('#impMode')); });
  $('#impFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) f.text().then((t) => { ta.value = t; refresh(); }); });
  $('#impGo').addEventListener('click', () => { if (importText(ta.value, mode, which)) closeModal(); });
  if (prefill) { ta.value = prefill; refresh(); }
  setTimeout(() => ta.focus(), 30);
}

let perLine = 'c';   // 'c' = same lines as the canvas, 0 = everything in one block, n = n per block
try { const v = localStorage.getItem('zx-draw-perline'); if (v != null) perLine = v === 'c' ? 'c' : +v || 0; } catch (_) {}
let expTab = 'tex', imgState = { scope: 'one', fmt: 'png', scale: 3, white: true };
try { Object.assign(imgState, JSON.parse(localStorage.getItem('zx-draw-img') || '{}')); } catch (_) {}
function openExport(tab) {
  expTab = ['img', 'tikz', 'pyzx'].includes(tab) ? tab : 'tex';   // opens on LaTeX unless asked for another tab
  openModal('Export', `<div class="exphead"><div id="expOpts"></div></div><div id="expBody" class="hbody"></div>`);
  $('#modal .sheet').classList.add('wide');
  // the format tabs sit in the title row, right of "Export"
  const head = $('#modal header');
  head.insertAdjacentHTML('beforeend', `<div class="seg htabs hdr-tabs" data-seg="exptab"><button data-et="tex">LaTeX</button><button data-et="img">Image</button><button data-et="tikz">TikZ</button><button data-et="pyzx">PyZX</button></div>`);
  const tabs = head.querySelector('.hdr-tabs');
  head.insertBefore(tabs, head.querySelector('[data-m="close"]'));
  const show = () => {
    tabs.querySelectorAll('[data-et]').forEach((b) => b.classList.toggle('on', b.dataset.et === expTab));
    syncPill(tabs);
    const body = $('#expBody');
    body.classList.remove('in'); void body.offsetWidth; body.classList.add('in');
    if (expTab === 'tex') exportTex(body); else if (expTab === 'img') exportImage(body); else if (expTab === 'tikz') exportTikz(body); else exportPyzx(body);
  };
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-et]'); if (b && b.dataset.et !== expTab) { expTab = b.dataset.et; show(); } });
  show();
  requestAnimationFrame(() => syncPill(tabs));   // the sheet may still be opening when first measured
}
// Re-rendered panels keep their motion: [data-cond] items and switches start from how they
// looked last time and then move to the new state (instead of popping).
const motionMem = new Map();
function keepMotion(root) {
  const flips = [];
  root.querySelectorAll('[data-cond]').forEach((el) => {
    const k = 'c:' + el.dataset.cond, want = !el.classList.contains('off'), prev = motionMem.get(k);
    motionMem.set(k, want);
    if (prev !== undefined && prev !== want) { el.classList.add('nt'); el.classList.toggle('off', !prev); flips.push(() => { el.classList.remove('nt'); el.classList.toggle('off', !want); }); }
  });
  root.querySelectorAll('input[type="checkbox"][id]').forEach((el) => {
    const k = 'k:' + el.id, want = el.checked, prev = motionMem.get(k);
    motionMem.set(k, want);
    if (prev !== undefined && prev !== want) { el.classList.add('nt'); el.checked = prev; flips.push(() => { el.classList.remove('nt'); el.checked = want; }); }
  });
  if (!flips.length) return;
  void root.offsetWidth;
  flips.forEach((f) => f());
}
// Move a panel's option row up next to the LaTeX / Image tabs; switching tabs cross-fades the rows.
function liftOpts(root) {
  const host = $('#expOpts');
  const f = root && root.querySelector(':scope > .mfoot');
  if (!host || !f) return;
  const swap = host.dataset.tab !== expTab;
  host.dataset.tab = expTab;
  f.classList.add('expopts');
  host.querySelectorAll('.expopts').forEach((old) => {
    if (!swap) return old.remove();
    old.classList.add('out');
    setTimeout(() => old.remove(), 260);
  });
  host.appendChild(f);
  if (swap) f.classList.add('in');
  keepMotion(host);
}
function exportTex(root) {
  if (perLine !== 'c' && !(Number.isInteger(perLine) && perLine >= 0 && perLine <= 9)) perLine = 'c';
  const hasActive = doc.diagrams.length > 1;
  root.innerHTML = `
    <div class="mfoot">
      ${hasActive ? `<div class="seg" id="expScope"><button data-v="all" class="on">All diagrams</button><button data-v="one">${esc(nameOf(activeDi))} only</button></div>` : ''}
      <label class="chk"><input type="checkbox" id="expWrap" checked> Wrap in <code>\\[ … \\]</code></label>
      ${doc.diagrams.length > 1 ? `<span class="grow"></span><span class="muted">Per line</span><div class="seg" id="expPer">${['c', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-v="${n}" class="${n === perLine ? 'on' : ''}"${n === 'c' ? ' title="Break lines where the canvas wraps"' : ''}>${n === 'c' ? 'Canvas' : n || 'All'}</button>`).join('')}</div>` : ''}
    </div>
    <textarea class="code" id="expText" readonly spellcheck="false"></textarea>
    <div class="mfoot"><span class="muted">Needs <code>\\usepackage{zxdiagram}</code> — <button class="linkbtn" id="expGuide">how to set it up</button></span><span class="grow"></span>
      <button class="btn ghost" id="expDl">${I.down}<span>.tex</span></button>
      <button class="btn primary" id="expCopy">Copy</button></div>`;
  let scope = 'all';
  const ta = $('#expText');
  const gen = () => {
    const wrap = wrapEl.checked;
    ta.value = doc.diagrams.length ? ZX.docTex(doc, { wrap, only: scope === 'one' ? activeDi : null, perLine: perLine === 'c' ? null : perLine || null, starts: perLine === 'c' ? lineStarts() : null }) : '% empty';
    if (perEl) perEl.classList.toggle('dim', !wrap || scope === 'one');
  };
  const wrapEl = root.querySelector('#expWrap'), perEl = root.querySelector('#expPer'), scopeEl = root.querySelector('#expScope'), per = perEl;
  if (per) per.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    perLine = b.dataset.v === 'c' ? 'c' : +b.dataset.v; try { localStorage.setItem('zx-draw-perline', perLine); } catch (_) {}
    per.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); syncPill(per); gen();
  });
  gen();
  wrapEl.addEventListener('change', gen);
  if (hasActive) scopeEl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; scope = b.dataset.v; scopeEl.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); syncPill(scopeEl); gen(); });
  $('#expCopy').addEventListener('click', async () => {
    const btn = $('#expCopy');
    try { await navigator.clipboard.writeText(ta.value); } catch (_) { ta.select(); document.execCommand('copy'); }
    btn.textContent = 'Copied ✓';
    setTimeout(() => { if (btn.isConnected) btn.textContent = 'Copy'; }, 1400);
  });
  $('#expGuide').addEventListener('click', () => { closeModal(); openHelp('guide'); });
  $('#expDl').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ta.value], { type: 'text/plain' }));
    a.download = 'zx-diagram.tex'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  liftOpts(root);
  setTimeout(() => { ta.focus(); ta.select(); }, 30);
}
// a diagram picker shared by the TikZ / PyZX tabs (names, or a menu when there are many)
let expPick = null;
function diagramPicker(id) {
  const live = doc.diagrams.map((d, i) => i).filter((i) => doc.diagrams[i].nodes.length);
  if (expPick == null || !live.includes(expPick)) expPick = live.includes(activeDi) ? activeDi : live[0];
  if (live.length < 2) return '';
  if (live.length <= 5) return `<div class="seg" id="${id}" data-seg="${id}">${live.map((i) => `<button data-v="${i}" class="${i === expPick ? 'on' : ''}">${esc(nameOf(i))}</button>`).join('')}</div>`;
  return `<select class="sel" id="${id}">${live.map((i) => `<option value="${i}"${i === expPick ? ' selected' : ''}>${esc(nameOf(i))}</option>`).join('')}</select>`;
}
function bindPicker(root, id, redraw) {
  const el = root.querySelector('#' + id);
  if (!el) return;
  if (el.tagName === 'SELECT') el.addEventListener('change', () => { expPick = +el.value; redraw(); });
  else el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; expPick = +b.dataset.v; redraw(); });
}
const download = (text, name, type = 'text/plain') => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
const fileBase = (i) => (nameOf(i).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'diagram').toLowerCase();
let tkState = { scope: 'one', fmt: 'snip' };
try { Object.assign(tkState, JSON.parse(localStorage.getItem('zx-draw-tikz') || '{}')); } catch (_) {}
function exportTikz(root) {
  const live = doc.diagrams.map((d, i) => i).filter((i) => doc.diagrams[i].nodes.length);
  if (live.length < 2) tkState.scope = 'one';
  const pick = tkState.scope === 'one' ? diagramPicker('tkPick') : '';
  root.innerHTML = `<div class="mfoot">
      ${live.length > 1 ? `<div class="seg" data-seg="tk-scope" id="tkScope"><button data-v="one" class="${tkState.scope === 'one' ? 'on' : ''}">One diagram</button><button data-v="page" class="${tkState.scope === 'page' ? 'on' : ''}">Whole page</button></div>` : ''}
      ${pick}
      <div class="seg" data-seg="tk-fmt" id="tkFmt"><button data-v="snip" class="${tkState.fmt === 'snip' ? 'on' : ''}" title="A picture to \\input into your document">Picture</button><button data-v="doc" class="${tkState.fmt === 'doc' ? 'on' : ''}" title="A complete standalone .tex file">Standalone</button></div>
    </div>
    <div class="tkwrap"><textarea class="code" id="tkText" readonly spellcheck="false"></textarea><div class="tkprev" id="tkPrev"><div class="mbusy"><span class="spin"></span>Measuring with the TeX fonts…</div></div></div>
    <div class="mfoot"><span class="muted">Plain TikZ — no <code>zx-calculus</code> or <code>zxdiagram.sty</code> needed. Same geometry as Export → Image (right).</span><span class="grow"></span>
      <button class="btn ghost" id="tkDl">${I.down}<span>${tkState.fmt === 'doc' ? '.tex' : '.tikz'}</span></button>
      <button class="btn primary" id="tkCopy">Copy</button></div>`;
  const ta = $('#tkText'), save = () => { try { localStorage.setItem('zx-draw-tikz', JSON.stringify(tkState)); } catch (_) {} };
  const sc = root.querySelector('#tkScope'); if (sc) sc.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; tkState.scope = b.dataset.v; save(); exportTikz(root); });
  root.querySelector('#tkFmt').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; tkState.fmt = b.dataset.v; save(); exportTikz(root); });
  bindPicker(root, 'tkPick', () => exportTikz(root));
  let name = 'zx-diagram';
  loadMathJax().then(() => {
    if (!root.isConnected) return;
    if (!live.length) { ta.value = '% nothing to export yet'; $('#tkPrev').innerHTML = ''; return; }
    let g;
    try {
      if (tkState.scope === 'page') { g = drawChain(live, lineStarts()); name = 'zx-page'; }
      else { g = drawDiagram(doc.diagrams[expPick]); name = fileBase(expPick); }
    } catch (e) { ta.value = ''; $('#tkPrev').innerHTML = `<div class="simerr">${esc(e.message)}</div>`; return; }
    ta.value = tikzFile(g, tkState.fmt === 'doc');
    $('#tkPrev').innerHTML = svgFile(g, true).text;
  }, (e) => { $('#tkPrev').innerHTML = `<div class="simerr">${esc(e.message)}</div>`; });
  $('#tkCopy').addEventListener('click', async () => { const b = $('#tkCopy'); try { await navigator.clipboard.writeText(ta.value); } catch (_) { ta.select(); document.execCommand('copy'); } b.textContent = 'Copied ✓'; setTimeout(() => { if (b.isConnected) b.textContent = 'Copy'; }, 1400); });
  $('#tkDl').addEventListener('click', () => download(ta.value, name + (tkState.fmt === 'doc' ? '.tex' : '.tikz'), 'application/x-tex'));
  liftOpts(root);
}
let pyState = { hEdges: true, fmt: 'json' };
try { Object.assign(pyState, JSON.parse(localStorage.getItem('zx-draw-pyzx') || '{}')); } catch (_) {}
function exportPyzx(root) {
  const pick = diagramPicker('pyPick');
  const i = expPick, d = doc.diagrams[i];
  root.innerHTML = `<div class="mfoot">
      ${pick}
      <div class="seg" data-seg="py-fmt" id="pyFmt"><button data-v="json" class="${pyState.fmt === 'json' ? 'on' : ''}">JSON</button><button data-v="py" class="${pyState.fmt === 'py' ? 'on' : ''}">Python</button></div>
      <label class="chk" title="PyZX simplifies graphs whose Hadamards sit on edges; off keeps them as H boxes"><input type="checkbox" id="pyH"${pyState.hEdges ? ' checked' : ''}> H boxes as Hadamard edges</label>
    </div>
    <textarea class="code" id="pyText" readonly spellcheck="false"></textarea>
    <div class="mfoot"><span class="muted" id="pyInfo"></span><span class="grow"></span>
      <button class="btn ghost" id="pyDl">${I.down}<span>${pyState.fmt === 'py' ? '.py' : '.zxg'}</span></button>
      <button class="btn primary" id="pyCopy">Copy</button></div>`;
  const ta = $('#pyText'), info = $('#pyInfo');
  let out = null;
  if (!d) { ta.value = '# nothing to export yet'; }
  else {
    try {
      out = ZXP.toPyzx(d, { hEdges: pyState.hEdges });
      ta.value = pyState.fmt === 'py' ? ZXP.pythonSnippet(out.json) : out.json;
      info.innerHTML = `${out.stats.vertices} vertices · ${out.stats.edges} edges${out.stats.hadamard ? ` (${out.stats.hadamard} Hadamard)` : ''} · opens in <code>pyzx.Graph.from_json</code> and ZXLive${out.warnings.length ? `<br><span class="warnline">${out.warnings.map(esc).join(' · ')}</span>` : ''}`;
    } catch (e) { markErr(e.nodes); ta.value = ''; info.innerHTML = errHTML(e.message, e.nodes); }
  }
  const save = () => { try { localStorage.setItem('zx-draw-pyzx', JSON.stringify(pyState)); } catch (_) {} };
  bindPicker(root, 'pyPick', () => exportPyzx(root));
  root.querySelector('#pyFmt').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; pyState.fmt = b.dataset.v; save(); exportPyzx(root); });
  root.querySelector('#pyH').addEventListener('change', (e) => { pyState.hEdges = e.target.checked; save(); exportPyzx(root); });
  $('#pyCopy').addEventListener('click', async () => { const b = $('#pyCopy'); try { await navigator.clipboard.writeText(ta.value); b.textContent = 'Copied ✓'; } catch (_) { ta.select(); document.execCommand('copy'); b.textContent = 'Copied ✓'; } setTimeout(() => { if (b.isConnected) b.textContent = 'Copy'; }, 1400); });
  $('#pyDl').addEventListener('click', () => { if (out) download(ta.value, fileBase(i) + (pyState.fmt === 'py' ? '.py' : '.zxg'), pyState.fmt === 'py' ? 'text/x-python' : 'application/json'); });
  liftOpts(root);
  keepMotion(root);
}
function exportImage(root) {
  const many = doc.diagrams.filter((d) => d.nodes.length).length > 1;
  if (!many && imgState.scope !== 'one') imgState.scope = 'one';
  const seg = (key, opts) => `<div class="seg" data-seg="img-${key}">${opts.map(([v, l]) => `<button data-k="${key}" data-v="${v}" class="${String(imgState[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  root.innerHTML = `<div class="mfoot">
      ${many ? seg('scope', [['one', `Diagram ${activeDi + 1}`], ['page', 'Whole page'], ['each', 'Each diagram']]) : ''}
      ${seg('fmt', [['png', 'PNG'], ['svg', 'SVG']])}
      <div class="cond${imgState.fmt === 'png' ? '' : ' off'}" data-cond="img-scale">${seg('scale', [[2, '2×'], [3, '3×'], [4, '4×']])}</div>
      <label class="chk"><input type="checkbox" id="imgWhite"${imgState.white ? ' checked' : ''}> White background</label>
    </div>
    <div class="imgprev" id="imgPrev"><div class="mbusy"><span class="spin"></span>Typesetting with the TeX fonts…</div></div>
    <div class="mfoot"><span class="muted">Same sizes as <code>zxdiagram.sty</code>, formulas set in TeX fonts (MathJax).${imgState.scope === 'page' ? ' Lines break where the canvas wraps.' : ''}</span><span class="grow"></span>
      <div class="cond${imgState.fmt === 'png' && imgState.scope !== 'each' ? '' : ' off'}" data-cond="img-copy"><button class="btn ghost" id="imgCopy">${I.copy}<span>Copy</span></button></div>
      <button class="btn primary" id="imgDl">${I.down}<span>${imgState.scope === 'each' ? 'Download all' : 'Download'}</span></button></div>`;
  syncAllPills(root);
  const save = () => { try { localStorage.setItem('zx-draw-img', JSON.stringify(imgState)); } catch (_) {} };
  root.querySelectorAll('.seg button[data-k]').forEach((b) => b.addEventListener('click', () => {
    const v = b.dataset.v; imgState[b.dataset.k] = b.dataset.k === 'scale' ? +v : v; save(); exportImage(root);
  }));
  root.querySelector('#imgWhite').addEventListener('change', (e) => { imgState.white = e.target.checked; save(); exportImage(root); });
  liftOpts(root);
  keepMotion(root);
  const live = doc.diagrams.map((d, i) => i).filter((i) => doc.diagrams[i].nodes.length);
  const jobs = () => {
    if (imgState.scope === 'page') return [{ name: 'zx-page', g: drawChain(live, lineStarts()) }];
    if (imgState.scope === 'each') return live.map((i) => ({ name: `zx-diagram-${i + 1}`, g: drawDiagram(doc.diagrams[i]) }));
    const i = doc.diagrams[activeDi] && doc.diagrams[activeDi].nodes.length ? activeDi : live[0];
    return [{ name: `zx-diagram-${i + 1}`, g: drawDiagram(doc.diagrams[i]) }];
  };
  let files = null;
  loadMathJax().then(() => {
    if (!root.isConnected) return;
    if (!live.length) { $('#imgPrev').innerHTML = '<div class="phint">Nothing to export yet.</div>'; return; }
    try { files = jobs().map((j) => Object.assign(svgFile(j.g, imgState.white), { name: j.name })); }
    catch (e) { $('#imgPrev').innerHTML = `<div class="simerr">${esc(e.message)}</div>`; return; }
    $('#imgPrev').innerHTML = files.map((f) => `<figure class="imgcard${imgState.white ? '' : ' checker'}">${f.text.replace('<svg ', `<svg style="width:${Math.round(f.w * 2)}px" `)}<figcaption>${f.name}.${imgState.fmt}</figcaption></figure>`).join('');
  }, (e) => { $('#imgPrev').innerHTML = `<div class="simerr">${esc(e.message)}</div>`; });
  const out = async (f) => (imgState.fmt === 'svg' ? new Blob([f.text], { type: 'image/svg+xml' }) : svgToPng(f, imgState.scale));
  $('#imgDl').addEventListener('click', async () => {
    if (!files) return;
    for (const f of files) { saveBlob(await out(f), `${f.name}.${imgState.fmt}`); await new Promise((r) => setTimeout(r, 250)); }
    toast(files.length > 1 ? `Saved ${files.length} images` : 'Image saved');
  });
  const cp = $('#imgCopy');
  if (cp) cp.addEventListener('click', async () => {
    if (!files) return;
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': svgToPng(files[0], imgState.scale) })]); toast('Image copied — paste it anywhere'); }
    catch (_) { toast('This browser cannot copy images — use Download'); }
  });
}

// ---------- image export: the diagram as LaTeX draws it ----------
// Sizes follow zx-calculus + zxdiagram.sty (gaps, spider size, 0.5pt lines, colours); formulas are typeset
// by MathJax with the TeX fonts as plain SVG paths, so the file needs no fonts and turns into PNG cleanly.
const PX = 96 / 25.4;                 // px per mm (1×)
const PTPX = 96 / 72;                 // px per pt
const EM = 10 * PTPX;                 // 10pt document font
let mjReady = null;
function loadMathJax() {
  if (mjReady) return mjReady;
  mjReady = new Promise((res, rej) => {
    window.MathJax = { svg: { fontCache: 'none' }, startup: { typeset: false }, options: { enableMenu: false } };
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
    sc.onload = () => window.MathJax.startup.promise.then(res, rej);
    sc.onerror = () => { mjReady = null; rej(new Error('Could not load MathJax (needs internet once)')); };
    document.head.appendChild(sc);
  });
  return mjReady;
}
const mjCache = new Map();
// LaTeX → { body (SVG markup), w, h, base } in px for the given font size (pt); base = baseline from the top
function mjBox(texSrc, pt) {
  const key = texSrc + '|' + pt;
  if (mjCache.has(key)) return mjCache.get(key);
  const node = window.MathJax.tex2svg(texSrc, { display: false });
  const sv = node.querySelector('svg');
  const vb = sv.getAttribute('viewBox').split(/\s+/).map(Number);   // units of 1/1000 em
  const k = (pt * PTPX) / 1000;
  const r = { body: sv.innerHTML, vb, w: vb[2] * k, h: vb[3] * k, base: -vb[1] * k, src: texSrc };
  mjCache.set(key, r);
  return r;
}
const mjPlace = (b, x, y) => `<svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${b.w.toFixed(2)}" height="${b.h.toFixed(2)}" viewBox="${b.vb.join(' ')}" overflow="visible" color="#000" fill="#000">${b.body}</svg>`;
const lenMM = (v) => {
  const m = /^\s*(-?[\d.]+)\s*(mm|cm|pt|em|ex)?\s*$/.exec(v || '');
  if (m) return +m[1] * ({ mm: 1, cm: 10, pt: 25.4 / 72.27, em: 3.5, ex: 1.6 }[m[2] || 'pt']);
  return { tiny: 0.45, small: 1.35, scriptsize: 0.9, normal: 1.8, large: 2.7, huge: 3.6 }[(v || '').trim()] * 3.5 || null;
};
// TikZ twin of the image: same coordinates, written in pt with y pointing up
const tkN = (v) => (Math.abs(v) < 0.005 ? 0 : +v.toFixed(2));
const tkP = (x, y) => `(${tkN(x * 0.75)}pt,${tkN(-y * 0.75)}pt)`;
function tkPath(dStr) {   // the wire paths only use M, L and C
  const t = dStr.match(/[MLC]|-?[\d.]+(?:e-?\d+)?/g) || [];
  let out = '', cmd = '', i = 0;
  const num = () => +t[i++];
  while (i < t.length) {
    if (/[MLC]/.test(t[i])) cmd = t[i++];
    if (cmd === 'M') { const x = num(), y = num(); out += (out ? ' ' : '') + tkP(x, y); cmd = 'L'; }
    else if (cmd === 'L') { const x = num(), y = num(); out += ' -- ' + tkP(x, y); }
    else if (cmd === 'C') { const a = [num(), num()], b = [num(), num()], c = [num(), num()]; out += ` .. controls ${tkP(...a)} and ${tkP(...b)} .. ${tkP(...c)}`; }
    else i++;
  }
  return out;
}
// One diagram → { svg (inner markup), tk (TikZ), w, h } in px, origin at its top-left
// Matrix arrow for image / TikZ export: the shape of \zxMat in zxdiagram.sty (9mm bar, chevron, labels)
function drawMArrow(n, p, w) {
  const fl = n.v === '<' ? -1 : 1, k = PX, bw = 1.3 * PTPX, ML = ZX.matLabels(n);
  const pts = [[-1.15, 1.2], [0.25, 1.2], [1.35, 0], [0.25, -1.2], [-1.15, -1.2], [-0.05, 0]].map(([x, y]) => [p.x + fl * x * k, p.y - y * k]);
  const svg = [`<path d="M${(p.x - w / 2).toFixed(2)} ${p.y.toFixed(2)}H${(p.x + w / 2).toFixed(2)}" stroke="#000" stroke-width="${bw.toFixed(2)}"/>`,
    `<path d="M${pts.map((q) => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('L')}Z" fill="#a6a6a6" stroke="#000" stroke-width="${(0.6 * PTPX).toFixed(2)}" stroke-linejoin="miter"/>`];
  const tk = [`\\draw[line width=1.3pt] ${tkP(p.x - w / 2, p.y)} -- ${tkP(p.x + w / 2, p.y)};`,
    `\\filldraw[fill=black!35, line width=.6pt] ${pts.map((q) => tkP(q[0], q[1])).join(' -- ')} -- cycle;`];
  const lab = (t, x, y) => {
    if (!t) return;
    const b = mjBox(t, 7);
    svg.push(mjPlace(b, x - b.w / 2, y - b.h));
    tk.push(`\\node[above, inner sep=.4pt, font=\\scriptsize] at ${tkP(x, y)} {$${t}$};`);
  };
  lab(n.label, p.x, p.y - 1.3 * k);
  lab(fl > 0 ? ML.lin : ML.lout, p.x - 0.38 * w, p.y - 0.45 * k);
  lab(fl > 0 ? ML.lout : ML.lin, p.x + 0.38 * w, p.y - 0.45 * k);
  return { svg: svg.join(''), tk: tk.join(' ') };
}
function drawDiagram(d) {
  const o = ZX.splitOpts(d.opts || '');
  const get = (k) => { const t = o.find((x) => x.startsWith(k)); return t ? lenMM(t.split('=')[1]) : null; };
  let colSep = get('column sep'), rowSep = get('row sep');
  const explicit = colSep != null || rowSep != null || o.includes('circuit');
  if (o.includes('circuit')) { colSep = colSep ?? 4; rowSep = rowSep ?? 4; }
  const wireOnly = !d.nodes.some((n) => n.t === 'Z' || n.t === 'X' || n.t === 'H' || n.t === 'M');
  colSep = colSep ?? (wireOnly ? 12 : 3.2); rowSep = rowSep ?? 2.8;
  const spider = explicit ? 2 : 2.6, pad = explicit ? 0 : 2.6;
  const LW = 0.5 * PTPX;
  // node boxes (mm)
  const box = new Map();
  d.nodes.forEach((n) => {
    if (n.t === 'N' || n.t === 'P') return box.set(n.id, { w: 0, h: pad });
    if (n.t === 'H') return box.set(n.id, { w: 1.7, h: 1.7 });
    if (n.t === 'M') return box.set(n.id, { w: 9, h: 2.6, mat: true });
    if (n.t === 'T') { const b = mjBox(DOTS.test((n.label || '').trim()) ? n.label : n.label || '\\cdot', 10); return box.set(n.id, { w: b.w / PX, h: b.h / PX, lab: b }); }
    if (n.cmd === 'Ctrl' && !n.label) return box.set(n.id, { w: 1.13, h: 1.13, ctrl: true });
    if (n.cmd === 'Not' && !n.label) return box.set(n.id, { w: 2.6, h: 2.6, not: true });
    const L = (n.label || '').trim();
    if (!L) return box.set(n.id, { w: spider, h: spider });
    const b = mjBox(L, 8 * 0.8);
    box.set(n.id, { w: Math.max(4, b.w / PX + 1.9), h: Math.max(4, b.h / PX + 0.7), lab: b });
  });
  const B = ZX.bounds(d);
  const colW = [], rowH = [];
  for (let c = B.c0; c <= B.c1; c++) colW[c - B.c0] = Math.max(0, ...d.nodes.filter((n) => n.c === c).map((n) => box.get(n.id).w));
  for (let r = B.r0; r <= B.r1; r++) rowH[r - B.r0] = Math.max(0, ...d.nodes.filter((n) => n.r === r).map((n) => box.get(n.id).h));
  const X = [colW[0] / 2], Y = [rowH[0] / 2];
  for (let c = 1; c < colW.length; c++) X[c] = X[c - 1] + colW[c - 1] / 2 + colSep + colW[c] / 2;
  for (let r = 1; r < rowH.length; r++) Y[r] = Y[r - 1] + rowH[r - 1] / 2 + rowSep + rowH[r] / 2;
  const pos = (dd, n) => ({ x: X[n.c - B.c0] * PX, y: Y[n.r - B.r0] * PX });
  // wires first (same curve maths as the editor, which follows TikZ), then nodes on top
  const W = [], N = [], TW = [], TN = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x0, y0, x1, y1) => { minX = Math.min(minX, x0); minY = Math.min(minY, y0); maxX = Math.max(maxX, x1); maxY = Math.max(maxY, y1); };
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  const bun = ZX.matBundles(d);
  const spread = ZX.spreadOpts({ edges: d.edges.filter((e) => !bun.has(e.id)) });   // same bends as the LaTeX export
  d.edges.forEach((e0) => {
    const e = spread.has(e0.id) ? Object.assign({}, e0, { o: spread.get(e0.id) }) : e0;
    const A = byId.get(e.a), Bn = byId.get(e.b), bu = bun.get(e.id);
    if (!A || !Bn || (bu && !bu.lead)) return;
    mTipHalf = 4.5 * PX;
    const g = rawGeom(d, e, A, Bn, pos);
    mTipHalf = 0;
    const lw = bu ? 1.3 * PTPX : LW;   // arrow → arrow: one bold wire
    W.push(`<path d="${g.d}" fill="none" stroke="#000" stroke-width="${lw.toFixed(2)}" stroke-linecap="${bu ? 'butt' : 'round'}"/>`);
    TW.push(bu ? `\\draw[line width=1.3pt] ${tkPath(g.d)};` : `\\draw ${tkPath(g.d)};`);
    (g.pts || []).forEach((p) => grow(p.x, p.y, p.x, p.y));
    if (g.h) { const s = 1.7 * PX; N.push(`<rect x="${(g.m.x - s / 2).toFixed(2)}" y="${(g.m.y - s / 2).toFixed(2)}" width="${s.toFixed(2)}" height="${s.toFixed(2)}" fill="#ffffbe" stroke="#000" stroke-width="${LW.toFixed(2)}"/>`); TN.push(`\\draw[fill=zxH] ${tkP(g.m.x - s / 2, g.m.y - s / 2)} rectangle ${tkP(g.m.x + s / 2, g.m.y + s / 2)};`); }
  });
  d.nodes.forEach((n) => {
    const p = pos(d, n), b = box.get(n.id), w = b.w * PX, h = b.h * PX;
    grow(p.x - w / 2, p.y - h / 2, p.x + w / 2, p.y + h / 2);
    if (n.t === 'N' || n.t === 'P') return;
    const stroke = `stroke="#000" stroke-width="${LW.toFixed(2)}"`;
    if (b.mat) { const r = drawMArrow(n, p, w); N.push(r.svg); TN.push(r.tk); return; }
    if (n.t === 'H') { N.push(`<rect x="${(p.x - w / 2).toFixed(2)}" y="${(p.y - h / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="#ffffbe" ${stroke}/>`); TN.push(`\\draw[fill=zxH] ${tkP(p.x - w / 2, p.y - h / 2)} rectangle ${tkP(p.x + w / 2, p.y + h / 2)};`); return; }
    if (n.t === 'T') { N.push(mjPlace(b.lab, p.x - b.lab.w / 2, p.y - b.lab.h / 2)); TN.push(`\\node[inner sep=0pt] at ${tkP(p.x, p.y)} {$${DOTS.test((n.label || '').trim()) ? n.label.trim() : n.label || '\\cdot'}$};`); return; }
    if (b.ctrl) { N.push(`<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${(w / 2).toFixed(2)}" fill="#000"/>`); TN.push(`\\fill ${tkP(p.x, p.y)} circle[radius=${tkN(w / 2 * 0.75)}pt];`); return; }
    if (b.not) { const r = w / 2; N.push(`<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${r.toFixed(2)}" fill="#fff" ${stroke}/><path d="M${p.x - r} ${p.y}h${2 * r}M${p.x} ${p.y - r}v${2 * r}" ${stroke}/>`); TN.push(`\\draw[fill=white] ${tkP(p.x, p.y)} circle[radius=${tkN(r * 0.75)}pt]; \\draw ${tkP(p.x - r, p.y)} -- ${tkP(p.x + r, p.y)} ${tkP(p.x, p.y - r)} -- ${tkP(p.x, p.y + r)};`); return; }
    const fill = n.t === 'Z' ? '#d8f8d8' : '#e8a5a5';
    N.push(`<rect x="${(p.x - w / 2).toFixed(2)}" y="${(p.y - h / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${(Math.min(w, h) / 2).toFixed(2)}" fill="${fill}" ${stroke}/>`);
    const col = n.t === 'Z' ? 'zxZ' : 'zxX';
    if (Math.abs(w - h) < 0.01) TN.push(`\\draw[fill=${col}] ${tkP(p.x, p.y)} circle[radius=${tkN(w / 2 * 0.75)}pt];`);
    else TN.push(`\\draw[fill=${col}, rounded corners=${tkN(Math.min(w, h) / 2 * 0.75)}pt] ${tkP(p.x - w / 2, p.y - h / 2)} rectangle ${tkP(p.x + w / 2, p.y + h / 2)};`);
    if (b.lab) { N.push(mjPlace(b.lab, p.x - b.lab.w / 2, p.y - b.lab.h / 2)); TN.push(`\\node[inner sep=0pt] at ${tkP(p.x, p.y)} {\\scalebox{0.64}{$${(n.label || '').trim()}$}};`); }
  });
  if (!isFinite(minX)) { minX = minY = 0; maxX = maxY = 1; }
  const m = LW;
  return { svg: `<g transform="translate(${(-minX + m).toFixed(2)} ${(-minY + m).toFixed(2)})">${W.join('')}${N.join('')}</g>`,
    tk: `\\begin{scope}[shift={${tkP(-minX + m, -minY + m)}}]\n${TW.concat(TN).map((l) => '  ' + l).join('\n')}\n\\end{scope}`, w: maxX - minX + 2 * m, h: maxY - minY + 2 * m };
}
// Lines of diagrams with their relations, set like a display equation: diagrams centred on the math axis.
function drawChain(idx, lines) {
  const rel = (i) => sepOf(i);
  const gap = (5 / 18) * EM;          // \thickmuskip around a relation
  const AXIS = 0.25 * EM;             // math axis above the baseline
  const rows = [];
  let cur = [];
  idx.forEach((i, k) => {
    if (k && lines && lines[i]) { rows.push(cur); cur = []; }
    if (k && rel(i - 1)) cur.push({ rel: mjBox(rel(i - 1), 10) });
    else if (k) cur.push({ space: gap * 2 });
    cur.push({ d: drawDiagram(doc.diagrams[i]) });
  });
  rows.push(cur);
  const out = [], tk = [];
  let y = 0, W = 0;
  const laid = rows.map((items) => {
    let x = 0, up = 0, down = 0;
    const parts = items.map((it) => {
      if (it.space) { x += it.space; return null; }
      if (it.rel) { x += gap; const p = { kind: 'rel', b: it.rel, x }; x += it.rel.w + gap; up = Math.max(up, it.rel.base + AXIS); down = Math.max(down, it.rel.h - it.rel.base - AXIS); return p; }
      const p = { kind: 'd', g: it.d, x }; x += it.d.w; up = Math.max(up, it.d.h / 2); down = Math.max(down, it.d.h / 2); return p;
    }).filter(Boolean);
    W = Math.max(W, x);
    return { parts, w: x, up, down };
  });
  const lineGap = 3.2 * PX;
  laid.forEach((L, k) => {
    if (k) y += lineGap;
    const axisY = y + L.up, x0 = (W - L.w) / 2;   // lines are centred, like \[ … \]
    L.parts.forEach((p) => {
      if (p.kind === 'd') { out.push(`<g transform="translate(${(x0 + p.x).toFixed(2)} ${(axisY - p.g.h / 2).toFixed(2)})">${p.g.svg}</g>`); tk.push(`\\begin{scope}[shift={${tkP(x0 + p.x, axisY - p.g.h / 2)}}]\n${p.g.tk}\n\\end{scope}`); }
      else { out.push(mjPlace(p.b, x0 + p.x, axisY + AXIS - p.b.base)); tk.push(`\\node[anchor=base west, inner sep=0pt] at ${tkP(x0 + p.x, axisY + AXIS)} {$${p.b.src}$};`); }
    });
    y += L.up + L.down;
  });
  return { svg: out.join(''), tk: tk.join('\n'), w: W, h: y };
}
// a full TikZ picture (plain TikZ + graphicx; no zx-calculus) drawn exactly like the image export
function tikzFile(g, standalone) {
  const pic = `% ZX Draw — plain TikZ, drawn like the image export. Needs \\usepackage{tikz} and \\usepackage{graphicx}.
\\begingroup
\\definecolor{zxZ}{HTML}{D8F8D8}\\definecolor{zxX}{HTML}{E8A5A5}\\definecolor{zxH}{HTML}{FFFFBE}
\\begin{tikzpicture}[line width=0.5pt, line cap=round, line join=round, baseline=(current bounding box.center), every node/.style={font=\\fontsize{10pt}{12pt}\\selectfont}]
${g.tk}
\\end{tikzpicture}
\\endgroup`;
  return standalone ? `\\documentclass[border=2mm]{standalone}\n\\usepackage{tikz}\n\\usepackage{graphicx}\n\\begin{document}\n${pic}\n\\end{document}\n` : pic + '\n';
}
function svgFile(g, bg) {
  const pad = 2 * PX;
  const w = g.w + 2 * pad, h = g.h + 2 * pad;
  return { text: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${(w * 0.75).toFixed(1)}pt" height="${(h * 0.75).toFixed(1)}pt" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}">${bg ? `<rect width="100%" height="100%" fill="#fff"/>` : ''}<g transform="translate(${pad} ${pad})">${g.svg}</g></svg>`, w, h };
}
function svgToPng(file, scale) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.ceil(file.w * scale); c.height = Math.ceil(file.h * scale);
      const ctx = c.getContext('2d'); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, file.w, file.h);
      c.toBlob((b) => (b ? res(b) : rej(new Error('PNG failed'))), 'image/png');
    };
    img.onerror = () => rej(new Error('Could not draw the image'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(file.text);
  });
}
const saveBlob = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); };

// ---------- guide: setup in LaTeX, import/export, keys with animated demos ----------
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const CMD = IS_MAC ? '⌘' : 'Ctrl';
const cap = (k) => `<kbd class="cap">${k}</kbd>`;
const codeBlock = (code, id) => `<div class="gcode"><pre id="${id}">${esc(code)}</pre><button class="chip gcopy" data-copy="${id}">${I.copy}<span>Copy</span></button></div>`;
// --- tiny looping animations (SVG + SMIL), 220×110 ---
const DUR = '3.4s';
const anim = (attr, values, keyTimes, extra = '') => `<animate attributeName="${attr}" values="${values}" keyTimes="${keyTimes}" dur="${DUR}" repeatCount="indefinite"${extra}/>`;
const move = (values, keyTimes) => `<animateTransform attributeName="transform" type="translate" values="${values}" keyTimes="${keyTimes}" dur="${DUR}" repeatCount="indefinite"/>`;
const CUR = '<path d="M0 0v15l4-3.6 3 6.6 2.6-1.1-2.9-6.4h5.4z" fill="#1d1d1f" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/>';
const sp = (x, y, t, extra = '') => `<circle cx="${x}" cy="${y}" r="9" fill="${t === 'Z' ? '#d8f8d8' : '#e8a5a5'}" stroke="#1d1d1f" stroke-width="1.3">${extra}</circle>`;
const wire = (d, extra = '') => `<path d="${d}" fill="none" stroke="#1d1d1f" stroke-width="1.5" stroke-linecap="round">${extra}</path>`;
const ring = (x, y, vals, kt, extra = '') => `<circle cx="${x}" cy="${y}" r="13.5" fill="none" stroke="#5b5bd6" stroke-width="2" opacity="0">${anim('opacity', vals, kt)}${extra}</circle>`;
const pt = (x, y) => `<circle cx="${x}" cy="${y}" r="4" fill="#fff" stroke="#aeaea8" stroke-dasharray="2 1.6"/>`;
const demoSvg = (inner) => `<svg class="demo" viewBox="0 0 220 110" aria-hidden="true">${inner}</svg>`;
const DEMOS = {
  select: () => demoSvg(wire('M20 55H200') + pt(20, 55) + pt(200, 55) + sp(80, 55, 'Z') + sp(140, 55, 'X') + ring(80, 55, '0;0;1;1;0', '0;.34;.4;.86;1')
    + `<g>${move('190 100;190 100;84 59;84 59;190 100', '0;.08;.32;.86;1')}${CUR}</g>`),
  hand: () => demoSvg(`<g>${move('0 0;0 0;-34 0;-34 0;0 0', '0;.15;.55;.75;1')}${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [0, 1, 2].map((j) => `<circle cx="${10 + i * 34}" cy="${22 + j * 33}" r="1.6" fill="#c3c3bc"/>`).join('')).join('')}${wire('M44 55H210')}${sp(100, 55, 'Z')}${sp(160, 55, 'X')}</g>`
    + `<g>${move('120 70;120 70;86 70;86 70;120 70', '0;.15;.55;.75;1')}<g transform="translate(-9 -9)" color="#1d1d1f">${I.hand.replace('<svg ', '<svg x="0" y="0" ')}</g></g>`),
  place: () => demoSvg(wire('M20 55H200', anim('opacity', '0;0;1;1', '0;.66;.72;1')) + pt(20, 55) + pt(200, 55)
    + `<g transform="translate(80 55)"><g>${anim('opacity', '0;0;1;1;0', '0;.24;.28;.94;1')}<circle r="9" fill="#d8f8d8" stroke="#1d1d1f" stroke-width="1.3"><animate attributeName="r" values="0;0;11;9;9" keyTimes="0;.24;.3;.36;1" dur="${DUR}" repeatCount="indefinite"/></circle></g></g>`
    + `<g transform="translate(140 55)"><g>${anim('opacity', '0;0;1;1;0', '0;.5;.54;.94;1')}<circle r="9" fill="#e8a5a5" stroke="#1d1d1f" stroke-width="1.3"><animate attributeName="r" values="0;0;11;9;9" keyTimes="0;.5;.56;.62;1" dur="${DUR}" repeatCount="indefinite"/></circle></g></g>`
    + `<text x="80" y="88" class="dlabel">Z</text><text x="140" y="88" class="dlabel">X</text>`
    + `<g>${move('190 100;84 59;84 59;144 59;144 59;190 100', '0;.2;.3;.46;.6;1')}${CUR}</g>`),
  fan: () => {
    // three sources light up, the cursor clicks the target, three wires grow into it
    const S3 = [[40, 22, 'Z'], [40, 55, 'X'], [40, 88, 'Z']];
    const grow = (x, y, i) => { const L = Math.hypot(165 - x, 55 - y); return `<path d="M${x} ${y}L165 55" fill="none" stroke="#1d1d1f" stroke-width="1.5" stroke-dasharray="${L}" stroke-dashoffset="${L}">${anim('stroke-dashoffset', `${L};${L};0;0;${L}`, `0;${(.52 + i * .04).toFixed(2)};${(.7 + i * .04).toFixed(2)};.92;1`)}</path>`; };
    const ghost = (x, y) => `<path d="M${x} ${y}L165 55" fill="none" stroke="#5b5bd6" stroke-width="1.2" stroke-dasharray="3 3" opacity="0">${anim('opacity', '0;0;.7;.7;0;0', '0;.3;.36;.5;.54;1')}</path>`;
    return demoSvg(S3.map(([x, y], i) => ghost(x, y) + grow(x, y, i)).join('') + S3.map(([x, y, t], i) => sp(x, y, t) + ring(x, y, '0;0;1;1;0;0', `0;${(.08 + i * .07).toFixed(2)};${(.12 + i * .07).toFixed(2)};.52;.56;1`)).join('')
      + sp(165, 55, 'X') + `<circle cx="165" cy="55" r="13.5" fill="none" stroke="#5b5bd6" stroke-width="2" opacity="0">${anim('opacity', '0;0;1;0;0', '0;.46;.5;.6;1')}</circle>`
      + `<g>${move('120 100;46 26;46 26;46 59;46 59;46 92;46 92;170 60;170 60;120 100', '0;.08;.12;.15;.19;.22;.26;.44;.6;1')}${CUR}</g>`
      + `<g transform="translate(196 8)"><rect width="18" height="18" rx="4" fill="#fff" stroke="#d8d8d2">${anim('fill', '#fff;#fff;#e6e6fb;#e6e6fb;#fff;#fff', '0;.3;.33;.6;.63;1')}</rect><text x="9" y="13" class="dkey">S</text></g>`);
  },
  wire: () => demoSvg(`<path d="M60 55H160" fill="none" stroke="#1d1d1f" stroke-width="1.5" stroke-dasharray="100" stroke-dashoffset="100">${anim('stroke-dashoffset', '100;100;0;0;100', '0;.2;.58;.9;1')}</path>` + sp(60, 55, 'Z') + sp(160, 55, 'X')
    + `<g>${move('64 59;64 59;164 59;164 59;64 59', '0;.2;.58;.9;1')}${CUR}</g>`),
  curve: () => {
    const P = ['M50 38C90 48 130 60 170 72', 'M50 38C70 0 150 22 170 72', 'M50 38C100 70 150 100 170 72', 'M50 38C110 38 110 72 170 72'];
    const lab = ['straight', 'bend left', 'bend right', 's', 'straight'];
    return demoSvg(wire(P[0], anim('d', P.concat(P[0]).join(';'), '0;.25;.5;.75;1', ' calcMode="spline" keySplines="' + Array(4).fill('.5 0 .2 1').join(';') + '"')) + sp(50, 38, 'Z') + sp(170, 72, 'X')
      + lab.slice(0, 4).map((l, i) => `<text x="110" y="104" class="dlabel" opacity="0">${l}${anim('opacity', [0, .25, .5, .75].map((t, j) => (j === i ? 1 : 0)).concat(i === 0 ? 1 : 0).join(';'), '0;.25;.5;.75;1', ' calcMode="discrete"')}</text>`).join('')
      + `<g transform="translate(14 14)"><rect width="18" height="18" rx="4" fill="#fff" stroke="#d8d8d2"/><text x="9" y="13" class="dkey">S</text>${anim('opacity', '1;.4;1;.4;1;.4;1;.4;1', '0;.05;.25;.3;.5;.55;.75;.8;1')}</g>`);
  },
  swap: () => demoSvg(wire('M20 40H200') + wire('M70 40V96') + wire('M150 40V12') + pt(20, 40) + pt(200, 40) + pt(70, 96) + pt(150, 12)
    + `<circle cy="40" r="9" fill="#d8f8d8" stroke="#1d1d1f" stroke-width="1.3">${anim('cx', '70;70;150;150;70', '0;.35;.55;.85;1', ' calcMode="spline" keySplines=".5 0 .2 1;.5 0 .2 1;.5 0 .2 1;.5 0 .2 1"')}</circle>`
    + `<circle cy="40" r="9" fill="#e8a5a5" stroke="#1d1d1f" stroke-width="1.3">${anim('cx', '150;150;70;70;150', '0;.35;.55;.85;1', ' calcMode="spline" keySplines=".5 0 .2 1;.5 0 .2 1;.5 0 .2 1;.5 0 .2 1"')}</circle>`
    + ring(70, 40, '1;1;1;1;1', '0;.3;.5;.8;1', anim('cx', '70;70;150;150;70', '0;.35;.55;.85;1')) + ring(150, 40, '1;1;1;1;1', '0;.3;.5;.8;1', anim('cx', '150;150;70;70;150', '0;.35;.55;.85;1'))),
  colour: () => demoSvg(wire('M20 55H200') + pt(20, 55) + pt(200, 55)
    + `<circle cx="80" cy="55" r="9" stroke="#1d1d1f" stroke-width="1.3" fill="#d8f8d8">${anim('fill', '#d8f8d8;#d8f8d8;#e8a5a5;#e8a5a5;#d8f8d8', '0;.35;.42;.85;1')}</circle>`
    + `<circle cx="140" cy="55" r="9" stroke="#1d1d1f" stroke-width="1.3" fill="#e8a5a5">${anim('fill', '#e8a5a5;#e8a5a5;#d8f8d8;#d8f8d8;#e8a5a5', '0;.35;.42;.85;1')}</circle>`
    + ring(80, 55, '1;1;1;1;1', '0;.3;.5;.8;1') + ring(140, 55, '1;1;1;1;1', '0;.3;.5;.8;1')),
  ctrl: () => demoSvg(wire('M20 40H200') + pt(20, 40) + pt(200, 40)
    + `<g>${move('0 0;0 0;0 48;0 48;0 0', '0;.25;.55;.85;1')}${sp(110, 40, 'X')}</g>` + `<g>${move('114 44;114 44;114 92;114 92;114 44', '0;.25;.55;.85;1')}${CUR}</g>`),
  copy: () => demoSvg(wire('M20 40H200') + pt(20, 40) + pt(200, 40) + sp(110, 40, 'Z')
    + `<g opacity=".95">${move('0 0;0 0;0 50;0 50;0 0', '0;.25;.55;.85;1')}${anim('opacity', '0;0;.95;.95;0', '0;.24;.3;.85;1')}${sp(110, 40, 'Z')}<circle cx="122" cy="30" r="6" fill="#5b5bd6"/><path d="M119.5 30h5M122 27.5v5" stroke="#fff" stroke-width="1.4"/></g>`
    + `<g>${move('114 44;114 44;114 94;114 94;114 44', '0;.25;.55;.85;1')}${CUR}</g>`),
  shift: () => demoSvg(wire('M20 55H200') + pt(20, 55) + pt(200, 55) + sp(80, 55, 'Z') + sp(140, 55, 'X')
    + ring(80, 55, '0;0;1;1;0', '0;.22;.26;.88;1') + ring(140, 55, '0;0;1;1;0', '0;.55;.59;.88;1')
    + `<g>${move('84 59;84 59;144 59;144 59;84 59', '0;.24;.52;.9;1')}${CUR}</g>`),
  drop: () => demoSvg(`<path d="M20 70H200" fill="none" stroke="#1d1d1f" stroke-width="1.5">${anim('stroke', '#1d1d1f;#1d1d1f;#5b5bd6;#1d1d1f;#1d1d1f', '0;.35;.45;.55;1')}${anim('stroke-width', '1.5;1.5;4;1.5;1.5', '0;.35;.45;.55;1')}</path>` + pt(20, 70) + pt(200, 70)
    + `<g>${move('0 0;0 0;0 50;0 50;0 0', '0;.1;.5;.9;1')}${sp(110, 20, 'Z')}</g>` + `<g>${move('114 24;114 24;114 74;114 74;114 24', '0;.1;.5;.9;1')}${CUR}</g>`),
  zoom: () => demoSvg(`<g transform="translate(110 55)"><g>${'<animateTransform attributeName="transform" type="scale" values="1;1;1.45;1.45;1" keyTimes="0;.2;.5;.8;1" dur="' + DUR + '" repeatCount="indefinite"/>'}${wire('M-80 0H80')}${sp(-30, 0, 'Z')}${sp(30, 0, 'X')}</g></g>`),
};
const GUIDE_KEYS = () => [   // read when the guide opens (key bindings load later)
  ['select', [keys.select], 'Select and move', 'Click a node or wire to select it, drag to move. Drag on empty canvas to box-select. Click the selected item again to edit it.'],
  ['hand', [keys.hand, 'Space'], 'Hand / pan', 'Drag anywhere to move around the canvas. Holding Space does the same from any tool.'],
  ['place', [keys.Z, keys.X, keys.H, keys.N], 'Place Z, X, H, wire point', 'Pick a node type and click a cell. Click a wire to insert into it; click an existing node to select it. N places a wire point (boundary or corner).'],
  ['fan', ['S', 'click'], 'Connect many at once', `In Select, box-select the nodes, then hold S and click a node or an empty cell: every selected node is wired to it (keep holding S for more targets). In the wire tool, hold the right button and drag to box-select; ${IS_MAC ? '⌘' : 'Ctrl'}-click adds or removes a source, Shift-click a target keeps the sources.`],
  ['wire', [keys.edge], 'Draw wires', 'Drag from one node to another (or to an empty cell). A stroke through several nodes connects them in order. Or click one node, then the other.'],
  ['curve', [keys.curve], 'Curve style', 'With a wire selected, each press cycles straight → bend left → bend right → s → cap → cup → C. Shift+S goes back. Drag the dot on a bend to change how far it bends.'],
  ['swap', ['W'], 'Swap two nodes', 'Select exactly two nodes and press W: they trade places and each takes over the other’s wires. With anything else selected, W picks the wire tool.'],
  ['colour', [keys.swap], 'Swap colour', 'Turns the selected Z spiders into X spiders and back.'],
];
const GUIDE_MODS = [
  ['ctrl', ['Ctrl', 'drag'], 'Move a node without its wires', 'Lifts the node out; the wire it sat on joins up again. Drop it on another wire to insert it there.'],
  ['copy', [IS_MAC ? '⌘' : 'Alt', 'drag'], 'Copy a node', `Drags out a copy (no wires) and leaves the original. ${IS_MAC ? 'Alt + drag works too.' : ''} Drop on a wire to insert the copy.`],
  ['shift', ['Shift', 'click'], 'Add to the selection', 'Shift-click adds or removes a node or wire. Select exactly two nodes, then W swaps them.'],
  ['drop', ['drag'], 'Drop a node onto a wire', 'Drag a node onto any wire: it is inserted there and its old wire rejoins.'],
  ['zoom', [CMD, 'scroll'], 'Zoom', `${CMD} + scroll or pinch zooms around the cursor; F fits everything on screen; − / = zoom out and in.`],
];
function guideHTML() {
  const card = ([demo, ks, title, desc]) => `<article class="gcard"><div class="gdemo">${DEMOS[demo]()}</div>
    <div class="gtitle"><span>${title}</span><span class="gkeys">${ks.map((k) => (k === 'drag' || k === 'click' || k === 'scroll' ? `<span class="gplus">${k}</span>` : cap(keyLabel(k) || k))).join('<span class="gplus">+</span>').replace(/<span class="gplus">\+<\/span>(<kbd class="cap">)/g, '<span class="gsep">/</span>$1')}</span></div>
    <p>${desc}</p></article>`;
  const modCard = ([demo, ks, title, desc]) => `<article class="gcard"><div class="gdemo">${DEMOS[demo]()}</div>
    <div class="gtitle"><span>${title}</span><span class="gkeys">${ks.map((k) => (['drag', 'click', 'scroll'].includes(k) ? `<span class="gplus">${k}</span>` : cap(k))).join('<span class="gplus">+</span>')}</span></div><p>${desc}</p></article>`;
  const minimal = String.raw`\documentclass{article}
\usepackage{zxdiagram}   % zxdiagram.sty next to this .tex file

\begin{document}
\[
  \zx{\zxN{} \rar & \zxZ{\alpha} \rar & \zxX{\beta} \rar & \zxN{}}
\]
\end{document}`;
  return `<div class="guide">
    <nav class="gnav">${[['g-latex', 'Use in LaTeX'], ['g-io', 'Import & export'], ['g-keys', 'Keys'], ['g-mods', 'Mouse & modifiers']].map(([id, l], i) => `<button data-go="${id}" class="${i ? '' : 'on'}">${l}</button>`).join('')}<button class="gtour" data-tour>${I.play}<span>Replay the tour</span></button></nav>
    <div class="gmain" id="gmain">
      <section id="g-latex"><h3>Use in LaTeX</h3><p class="glead">Three steps, once per project. The diagrams then compile to exactly what you see in Export → Image.</p>
        <ol class="gsteps">
          <li><div class="gnum">1</div><div class="gstep"><h4>Download the style file</h4><p><code>zxdiagram.sty</code> sets the colours, sizes and fonts. Put it in the same folder as your <code>.tex</code> file (or a shared folder — then load it with a relative path such as <code>\\usepackage{../../zxdiagram}</code>).</p>
            <div class="grow2"><button class="btn primary sm" data-sty="dl">${I.down}<span>Download zxdiagram.sty</span></button><button class="btn sm" data-sty="copy">${I.copy}<span>Copy its contents</span></button></div></div></li>
          <li><div class="gnum">2</div><div class="gstep"><h4>Load it in the preamble</h4><p>Before <code>\\begin{document}</code>. It needs the <code>zx-calculus</code> package (in TeX Live, MiKTeX and Overleaf). Don’t also load <code>quantikz</code>.</p>${codeBlock('\\usepackage{zxdiagram}', 'gc-use')}</div></li>
          <li><div class="gnum">3</div><div class="gstep"><h4>Paste your diagrams</h4><p>Click <b>Export</b> (${cap(CMD)}${cap('E')}), then <b>Copy</b>, and paste where the equation goes. “Per line → Canvas” keeps the same line breaks as on the canvas. A complete example:</p>${codeBlock(minimal, 'gc-min')}</div></li>
        </ol></section>
      <section id="g-io"><h3>Import & export</h3>
        <div class="gio">
          <div class="giocard"><div class="gioi">${I.up}</div><h4>Import LaTeX</h4><p><b>Import</b> (${cap(CMD)}${cap('I')}): paste a <code>\\zx{…}</code>, a whole <code>\\[ … \\]</code> chain with its <code>\\stackrel</code> steps, or open a .tex file and pick the equation. You can also drop a .tex file on the page.</p></div>
          <div class="giocard"><div class="gioi">${I.down}</div><h4>Export LaTeX</h4><p><b>Export</b> → LaTeX: all diagrams or the current one, wrapped in <code>\\[ … \\]</code> or not, and how many per line. Copy or save as .tex.</p></div>
          <div class="giocard"><div class="gioi">${I.file}</div><h4>Export an image</h4><p><b>Export</b> → Image: the current diagram, the whole page (with its line breaks) or each diagram as its own file — PNG (2–4×, copy or download) or SVG, white or transparent. Same look as the compiled PDF.</p><button class="linkbtn" data-goexp="img">Open image export</button></div>
          <div class="giocard"><div class="gioi">${I.file}</div><h4>Plain TikZ</h4><p><b>Export</b> → TikZ: the same picture as the image export, as plain TikZ — compiles without <code>zx-calculus</code> or <code>zxdiagram.sty</code>. A picture to <code>\\input</code>, or a standalone .tex file.</p></div>
          <div class="giocard"><div class="gioi">${I.up}</div><h4>PyZX &amp; ZXLive</h4><p><b>Export</b> → PyZX writes the graph JSON that <code>pyzx.Graph.from_json</code> and ZXLive (.zxg) open, or a ready Python snippet. <b>Import</b> reads PyZX / ZXLive graphs back.</p></div>
          <div class="giocard"><div class="gioi">${I.folder}</div><h4>Canvas files</h4><p>The folder menu saves the whole canvas — every page — in this browser, or as a <code>.zxd</code> file to keep or share. “Add pages from file” merges another canvas in. Drop a .zxd on the page to open it.</p></div>
        </div></section>
      <section id="g-keys"><h3>Keys</h3><p class="glead">Single keys, no modifier. Every one can be changed in the Shortcuts tab.</p><div class="ggrid">${GUIDE_KEYS().map(card).join('')}</div>
        <div class="gmore">${[['simplify', 'Simplify step by step'], ['matrix', 'Matrix & checks'], ['rotate', 'Rotate 180°'], ['tidy', 'Tidy layout'], ['fit', 'Fit to screen'], ['preview', 'Preview']].map(([k, l]) => `<span>${cap(keyLabel(keys[k]))}${l}</span>`).join('')}</div></section>
      <section id="g-mods"><h3>Mouse & modifiers</h3><div class="ggrid">${GUIDE_MODS.map(modCard).join('')}</div>
        <div class="gmore">${[[`${CMD} Z`, 'Undo'], [`⇧ ${CMD} Z`, 'Redo'], [`${CMD} C / X / V`, 'Copy, cut, paste'], [`${CMD} A`, 'Select all'], ['Enter', 'Edit panel'], ['Esc', 'Deselect, back to Select'], ['← ↑ → ↓', 'Nudge one cell']].map(([k, l]) => `<span>${k.split(' ').map((t) => (t === '/' ? '<span class="gsep">/</span>' : cap(t))).join('')}${l}</span>`).join('')}</div></section>
    </div></div>`;
}
function wireGuide(body) {
  const main = body.querySelector('#gmain'), nav = body.querySelector('.gnav');
  nav.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (!b) return; main.querySelector('#' + b.dataset.go).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  // highlight the section in view
  main.addEventListener('scroll', () => {
    const secs = [...main.querySelectorAll('section')];
    const top = main.getBoundingClientRect().top + 40;
    let cur = secs[0].id;
    secs.forEach((s) => { if (s.getBoundingClientRect().top <= top) cur = s.id; });
    nav.querySelectorAll('[data-go]').forEach((b) => b.classList.toggle('on', b.dataset.go === cur));
  }, { passive: true });
  body.addEventListener('click', async (e) => {
    const cp = e.target.closest('[data-copy]');
    if (cp) { const t = body.querySelector('#' + cp.dataset.copy).textContent; try { await navigator.clipboard.writeText(t); cp.querySelector('span').textContent = 'Copied ✓'; setTimeout(() => { if (cp.isConnected) cp.querySelector('span').textContent = 'Copy'; }, 1300); } catch (_) { toast('Could not copy'); } }
    const st = e.target.closest('[data-sty]');
    if (st) {
      let text = null;
      try { const r = await fetch('zxdiagram.sty', { cache: 'no-cache' }); if (r.ok) text = await r.text(); } catch (_) {}
      if (st.dataset.sty === 'dl') {
        if (text) saveBlob(new Blob([text], { type: 'text/x-tex' }), 'zxdiagram.sty');
        else { const a = document.createElement('a'); a.href = 'zxdiagram.sty'; a.download = 'zxdiagram.sty'; a.click(); }
      } else if (text) { try { await navigator.clipboard.writeText(text); toast('zxdiagram.sty copied'); } catch (_) { toast('Could not copy'); } }
      else toast('Open ZX Draw from its folder (or a local server) to copy the file');
    }
    const ge = e.target.closest('[data-goexp]');
    if (ge) { closeModal(); openExport(ge.dataset.goexp); }
  });
}

// ---------- shortcuts (rebindable) ----------
const KEYS_KEY = 'zx-draw-keys-v1';
// [id, group, what it does, default key, action]
const ACTIONS = [
  ['select', 'Tools', 'Select / move — drag nodes, drag the background to box-select', 'v', () => setTool('select')],
  ['hand', 'Tools', 'Hand — drag anywhere to move around the canvas', 'g', () => setTool('hand')],
  ['Z', 'Tools', 'Z spider — click a cell to place, click a node to recolour', 'z', () => setTool('Z')],
  ['X', 'Tools', 'X spider', 'x', () => setTool('X')],
  ['H', 'Tools', 'Hadamard box', 'h', () => setTool('H')],
  ['N', 'Tools', 'Wire point / boundary', 'n', () => setTool('N')],
  ['P', 'Tools', 'Dot — a routing point for wires (bends, swaps, crossings); exported as an empty \\zxN', 'd', () => setTool('P')],
  ['T', 'Tools', 'Text cell (⋮, labels) — ignored when computing', 't', () => setTool('T')],
  ['M', 'Tools', 'Matrix arrow — a phase-free Z/X block given by a 0/1 matrix A (type its entries in the panel)', 'a', () => setTool('M')],
  ['edge', 'Tools', 'Wire — drag between nodes or empty cells', 'e', () => setTool('edge')],
  ['swap', 'Edit', 'Swap Z ↔ X colour of the selection', 'c', () => swapColour()],
  ['matx', 'Edit', 'Matrix arrow ⇄ Z/X spiders: expand the selected arrow, or fold the selected (or any found) phase-free Z–X block into one', 'shift+a', () => toggleMat()],
  ['curve', 'Edit', 'Cycle the selected wire(s) through every curve style (Shift+S: back)', 's', () => toggleCurve()],
  ['panel', 'Edit', 'Open the edit panel for the selection', 'enter', () => { if (sel.size) openInsp(true); }],
  ['delete', 'Edit', 'Delete the selection (a node with one wire in and one out leaves the wire)', 'backspace', () => deleteSel()],
  ['tidy', 'View', 'Tidy layout', 'l', () => tidyAll()],
  ['fit', 'View', 'Fit to screen', 'f', () => fit()],
  ['preview', 'View', 'Preview without editing guides', 'p', () => togglePreview()],
  ['zin', 'View', 'Zoom in', '=', () => zoomBy(1.25)],
  ['zout', 'View', 'Zoom out', '-', () => zoomBy(1 / 1.25)],
  ['z100', 'View', 'Zoom to 100%', '0', () => zoomTo(1)],
  ['rotate', 'Edit', 'Rotate the current diagram 180° (inputs and outputs swap)', 'o', () => rotateDiagram(activeDi)],
  ['simplify', 'Compute', 'Simplify the current diagram step by step', 'r', () => openSimplify(activeDi, $('#btnSimp'))],
  ['matrix', 'Compute', 'Matrix of the current diagram (and checks of the whole chain)', 'm', () => openMatrix(activeDi)],
  ['play', 'View', 'Present this page: one diagram per slide, full screen', 'shift+p', () => startShow()],
  ['lock', 'View', 'Lock / unlock this page (look and zoom only)', 'k', () => toggleLock()],
  ['help', 'View', 'Help & ZX rules', '?', () => openHelp()],
];
// gestures and system shortcuts: shown in the table, not rebindable
const FIXED = [
  ['Tools', 'Insert a node into a wire (makes room if needed)', 'Z / X / H tool + click wire'],
  ['Tools', 'Wire a chain: every node the stroke passes through is connected in order', 'Wire tool + drag across nodes'],
  ['Tools', 'Connect two points without dragging', 'Wire tool + click one, then the other'],
  ['Edit', 'Swap two nodes: they trade places and each takes the other’s wires', 'Select exactly 2 nodes + W'],
  ['Edit', 'Select a node or wire (then ⌫ / Delete removes it)', 'Click'],
  ['Edit', 'Open the edit panel', 'Click the selected item again · Right-click'],
  ['Edit', 'Move a node onto another wire (its old wire is rejoined)', 'Drag it onto the wire'],
  ['Edit', 'Move a node to a new place without its wires (old wire rejoins)', 'Ctrl + drag'],
  ['Edit', 'Copy a node to a new place, without wires (drop on a wire to insert)', '⌘ / Alt + drag'],
  ['Edit', 'Add to / remove from selection', 'Shift + click'],
  ['Edit', 'Move the selection one cell', '← ↑ → ↓'],
  ['Edit', 'Copy · cut · paste at the cursor', '⌘C · ⌘X · ⌘V'],
  ['Edit', 'Undo · redo', '⌘Z · ⇧⌘Z'],
  ['Edit', 'Select everything', '⌘A'],
  ['View', 'Pan', 'Space + drag · two-finger scroll'],
  ['View', 'Zoom', '⌘ + scroll · pinch'],
  ['Steps', 'Duplicate a diagram for the next rewrite step', '⧉ above the diagram'],
  ['Steps', 'Set the rule between steps, e.g. (sp), = / ∝', 'Click the = sign'],
  ['Steps', 'Import · export LaTeX', '⌘I · ⌘E'],
];
const RESERVED = new Set([' ', 'escape', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab', 'shift', 'meta', 'control', 'alt', 'capslock', 'delete']);
let keys = {};
function loadKeys() {
  keys = Object.fromEntries(ACTIONS.map((a) => [a[0], a[3]]));
  try { Object.assign(keys, JSON.parse(localStorage.getItem(KEYS_KEY) || '{}')); } catch (_) {}
  if (keys.tidy === 't' && keys.T === 't') keys.tidy = 'l';   // T used to be Tidy; it is now the text tool
}
function saveKeys() { try { localStorage.setItem(KEYS_KEY, JSON.stringify(keys)); } catch (_) {} }
const keyLabel = (k) => ({ backspace: '⌫', enter: '↵', ' ': 'Space', '=': '=', '-': '−' }[k] || (k && k.length === 1 ? k.toUpperCase() : k || '—'));
const LOCK_OK = new Set(['select', 'hand', 'fit', 'preview', 'zin', 'zout', 'z100', 'help', 'matrix', 'simplify', 'lock', 'play']);
function runKey(k) {
  if (k === '+') k = keys.zin === '=' ? '=' : k;
  const a = ACTIONS.find((x) => keys[x[0]] === k);
  if (a && isLocked() && !LOCK_OK.has(a[0])) { lockedNote(); return true; }
  if (a) { a[4](); return true; }
  return false;
}
function updateKbd() {
  document.querySelectorAll('.tool[data-tool]').forEach((b) => {
    const kb = b.querySelector('kbd'), k = keys[b.dataset.tool];
    if (kb) kb.textContent = keyLabel(k);
    b.title = b.title.replace(/\s*\([^)]*\)$/, '') + ` (${keyLabel(k)})`;
  });
}

// ---------- ZX-calculus rule library (drawn from zx LaTeX by the same renderer) ----------
const RULE_LIB = [
  ['(sp)', 'Spider fusion', 'Connected spiders of the same colour merge; phases add.', String.raw`\zx{\zxN{} \rar & \zxZ{\alpha} \rar \ar[dd, bend left] \ar[dd, bend right] & \zxN{} \\ \vdots & \vdots & \vdots \\ \zxN{} \rar & \zxZ{\beta} \rar & \zxN{}} \stackrel{\mathbf{(sp)}}{=} \zx{\zxN{} \ar[dr, s] & & \zxN{} \\ \vdots & \zxZ{\alpha+\beta} \ar[ur, s] \ar[dr, s] & \vdots \\ \zxN{} \ar[ur, s] & & \zxN{}}`],
  ['(sp)', 'Spider fusion (X)', 'The same rule for X spiders.', String.raw`\zx{\zxN{} \rar & \zxX{\alpha} \rar \ar[dd, bend left] \ar[dd, bend right] & \zxN{} \\ \vdots & \vdots & \vdots \\ \zxN{} \rar & \zxX{\beta} \rar & \zxN{}} \stackrel{\mathbf{(sp)}}{=} \zx{\zxN{} \ar[dr, s] & & \zxN{} \\ \vdots & \zxX{\alpha+\beta} \ar[ur, s] \ar[dr, s] & \vdots \\ \zxN{} \ar[ur, s] & & \zxN{}}`],
  ['(id)', 'Identity', 'A phase-free spider with one input and one output is a plain wire.', String.raw`\zx{\zxN{} \rar & \zxZ{} \rar & \zxN{}} \stackrel{\mathbf{(id)}}{=} \zx{\zxN{} \ar[rr] & & \zxN{}} = \zx{\zxN{} \rar & \zxX{} \rar & \zxN{}}`],
  ['(hh)', 'Hadamard cancels', 'Two Hadamard boxes in a row cancel.', String.raw`\zx{\zxN{} \rar & \zxH{} \rar & \zxH{} \rar & \zxN{}} \stackrel{\mathbf{(hh)}}{=} \zx{\zxN{} \ar[rr] & & \zxN{}}`],
  ['(cc)', 'Colour change', 'Hadamards on every leg swap the colour of a spider.', String.raw`\zx{\zxN{} \rar & \zxH{} \ar[dr, s] & & \zxH{} \rar & \zxN{} \\ & \vdots & \zxZ{\alpha} \ar[ur, s] \ar[dr, s] & \vdots & \\ \zxN{} \rar & \zxH{} \ar[ur, s] & & \zxH{} \rar & \zxN{}} \stackrel{\mathbf{(cc)}}{=} \zx{\zxN{} \ar[dr, s] & & \zxN{} \\ \vdots & \zxX{\alpha} \ar[ur, s] \ar[dr, s] & \vdots \\ \zxN{} \ar[ur, s] & & \zxN{}}`],
  ['(π)', 'π-commutation', 'π phases of the other colour pass through a spider and flip its phase.', String.raw`\zx{\zxN{} \rar & \zxX{\pi} \ar[dr, s] & & \zxN{} \\ & \vdots & \zxZ{\alpha} \ar[ur, s] \ar[dr, s] & \vdots \\ \zxN{} \rar & \zxX{\pi} \ar[ur, s] & & \zxN{}} \stackrel{\mathbf{(\pi)}}{\propto} \zx{\zxN{} \ar[dr, s] & & \zxX{\pi} \rar & \zxN{} \\ \vdots & \zxZ{-\alpha} \ar[ur, s] \ar[dr, s] & \vdots & \\ \zxN{} \ar[ur, s] & & \zxX{\pi} \rar & \zxN{}}`],
  ['(sc)', 'Strong complementarity', 'A Z–X pair turns into a fully connected bipartite block.', String.raw`\zx{\zxN{} \ar[dr, s] & & & \zxN{} \\ \vdots & \zxX{} \rar & \zxZ{} \ar[ur, s] \ar[dr, s] & \vdots \\ \zxN{} \ar[ur, s] & & & \zxN{}} \stackrel{\mathbf{(sc)}}{\propto} \zx{\zxN{} \rar & \zxZ{} \rar \ar[ddr] & \zxX{} \rar & \zxN{} \\ \vdots & & & \vdots \\ \zxN{} \rar & \zxZ{} \rar \ar[uur] & \zxX{} \rar & \zxN{}}`],
  ['(sc)', 'Copy rule', 'A phase-free state is copied through a spider of the other colour.', String.raw`\zx{& & \zxN{} \\ \zxX{} \rar & \zxZ{} \ar[ur, s] \ar[dr, s] & \\ & & \zxN{}} \stackrel{\mathbf{(sc)}}{\propto} \zx{\zxX{} \rar & \zxN{} \\ & \\ \zxX{} \rar & \zxN{}}`],
  ['', 'Matrix arrow', 'A 0/1 matrix A (m×n) drawn as one arrow: input j (a Z spider) is wired to output i (an X spider) exactly when A_ij = 1. Tool A places one; ⇧A expands or folds it.', String.raw`\zx{\zxN{} \ar[dr] & & \zxN{} \\ \zxN{} \rar & \zxMat[1 0 1; 1 1 0]{3}{A}{2} \ar[ur] \ar[dr] & \\ \zxN{} \ar[ur] & & \zxN{}} = \zx{\zxN{} \rar & \zxZ{} \rar \ar[dr] & \zxX{} \rar & \zxN{} \\ \zxN{} \rar & \zxZ{} \rar & \zxX{} \rar & \zxN{} \\ \zxN{} \rar & \zxZ{} \ar[uur] & & }`],
  ['(eu)', 'Euler decomposition', 'A Hadamard is three π/2 rotations.', String.raw`\zx{\zxN{} \rar & \zxH{} \rar & \zxN{}} \stackrel{\mathbf{(eu)}}{\propto} \zx{\zxN{} \rar & \zxFracZ{\pi}{2} \rar & \zxFracX{\pi}{2} \rar & \zxFracZ{\pi}{2} \rar & \zxN{}}`],
  ['(sp)', '0-legged spiders', 'A phase-free spider with no legs is a scalar (2); both colours agree, and it equals the empty diagram up to a scalar.', String.raw`\zx{\zxZ{}} = \zx{\zxX{}} \propto \zx{}`],
  ['(ho)', 'Hopf law', 'Two wires between a Z and an X spider disconnect (up to a scalar ½).', String.raw`\zx{\zxN{} \rar & \zxZ{} \ar[r, bend left] \ar[r, bend right] & \zxX{} \rar & \zxN{}} \stackrel{\mathbf{(ho)}}{\propto} \zx{\zxN{} \rar & \zxZ{} & \zxX{} \rar & \zxN{}}`],
  ['(sp)', 'Phases add', 'Two π states fuse; phases add modulo 2π.', String.raw`\zx{\zxZ{\pi} \rar & \zxZ{\pi} \rar & \zxN{}} \stackrel{\mathbf{(sp)}}{=} \zx{\zxZ{} \rar & \zxN{}}`],
  ['', 'Phase through CNOT control', 'A Z phase commutes through the control of a CNOT.', String.raw`\zx{\zxN{} \rar & \zxZ{\alpha} \rar & \zxZ{} \rar \dar & \zxN{} \\ \zxN{} \ar[rr] & & \zxX{} \rar & \zxN{}} = \zx{\zxN{} \rar & \zxZ{} \rar \dar & \zxZ{\alpha} \rar & \zxN{} \\ \zxN{} \rar & \zxX{} \ar[rr] & & \zxN{}}`],
  ['', 'π through CNOT target', 'An X π phase commutes through the target of a CNOT.', String.raw`\zx{\zxN{} \ar[rr] & & \zxZ{} \rar \dar & \zxN{} \\ \zxN{} \rar & \zxX{\pi} \rar & \zxX{} \rar & \zxN{}} = \zx{\zxN{} \rar & \zxZ{} \ar[rr] \dar & & \zxN{} \\ \zxN{} \rar & \zxX{} \rar & \zxX{\pi} \rar & \zxN{}}`],
  ['', 'Three CNOTs = SWAP', 'Alternating CNOTs swap the two qubits.', String.raw`\zx{\zxN{} \rar & \zxZ{} \rar \dar & \zxX{} \rar & \zxZ{} \rar \dar & \zxN{} \\ \zxN{} \rar & \zxX{} \rar & \zxZ{} \rar \uar & \zxX{} \rar & \zxN{}} \propto \zx{\zxN{} \ar[drr, s] & & \zxN{} \\ \zxN{} \ar[urr, s] & & \zxN{}}`],
];

// Draw an equation (zx LaTeX) as static HTML using the canvas renderer.
function renderMini(src, maxW, maxH) {
  const { diagrams, seps } = ZX.parseEquation(src);
  const G = CW * 1.15, rects = [];
  let x = 0;
  diagrams.forEach((d) => {
    const b = ZX.bounds(d);
    d.ox = x - b.c0 * CW + CW / 2; d.oy = -((b.r0 + b.r1) / 2) * CH;
    const f = frameRect(d);
    rects.push(f); x = f.x1 + G;
  });
  const S = [], N = [], T = [];
  diagrams.forEach((d) => {
    const by = new Map(d.nodes.map((n) => [n.id, n]));
    d.edges.forEach((e) => {
      const A = by.get(e.a), B = by.get(e.b);
      if (!A || !B) return;
      const g = edgeGeom(d, e, A, B);
      S.push(`<path class="wire-p" d="${g.d}"/>${g.h ? `<rect class="hbox" x="${g.m.x - 7}" y="${g.m.y - 7}" width="14" height="14"/>` : ''}`);
    });
    d.nodes.forEach((n) => N.push(nodeHTML(n, pos(d, n), false, null, d)));
  });
  // Empty diagram: dashed placeholder box, as on the canvas.
  diagrams.forEach((d, i) => { if (!d.nodes.length) { const r = rects[i]; N.push(`<div class="mini-empty" style="left:${r.x0 + 6}px;top:${r.y0 + 6}px;width:${r.x1 - r.x0 - 12}px;height:${r.y1 - r.y0 - 12}px"></div>`); } });
  for (let i = 0; i + 1 < rects.length; i++) T.push(`<div class="sep" style="left:${(rects[i].x1 + rects[i + 1].x0) / 2}px;top:0">${tex(seps[i] == null ? '=' : seps[i])}</div>`);
  const y0 = Math.min(...rects.map((r) => r.y0)) - 8, y1 = Math.max(...rects.map((r) => r.y1)) + 8;
  const W = x - G, H = y1 - y0, k = Math.min(1, maxW / W, maxH / H);
  return `<div class="mini" style="width:${W * k}px;height:${H * k}px"><div class="mini-in" style="width:${W}px;height:${H}px;transform:scale(${k})"><div style="position:absolute;left:0;top:${-y0}px"><svg class="edges" width="1" height="1">${S.join('')}</svg>${N.join('')}${T.join('')}</div></div></div>`;
}

// ---------- help (Shortcuts / ZX rules) ----------
let helpTab = 'guide', recording = null, rulesHTML = '';
function openHelp(tab) {
  if (tab === 'keys' || tab === 'rules' || tab === 'guide') helpTab = tab;
  openModal('Help', `<div class="seg htabs" data-seg="help"><button data-h="guide">Guide</button><button data-h="keys">Shortcuts</button><button data-h="rules">ZX-calculus rules</button></div><div id="helpBody" class="hbody"></div>`);
  $('#modal .sheet').classList.add('wide');
  const tabs = $('#modal .htabs');
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-h]'); if (b && b.dataset.h !== helpTab) { helpTab = b.dataset.h; drawHelp(); } });
  $('#helpBody').addEventListener('click', onHelpClick);
  drawHelp();
}
function drawHelp() {
  const tabs = $('#modal .htabs'), body = $('#helpBody');
  if (!tabs || !body) return;
  tabs.querySelectorAll('[data-h]').forEach((b) => b.classList.toggle('on', b.dataset.h === helpTab));
  syncPill(tabs);
  body.classList.remove('in'); void body.offsetWidth; body.classList.add('in');
  if (helpTab === 'keys') body.innerHTML = keysTable();
  else if (helpTab === 'guide') { body.innerHTML = guideHTML(); wireGuide(body); }
  else {
    if (!rulesHTML) rulesHTML = RULE_LIB.map(([tag, name, desc, src], i) => `<figure class="rule">
      <div class="rule-fig">${renderMini(src, 250, 130)}</div>
      <figcaption><div class="rule-name">${tag ? `<span class="rule-tag">${tag}</span>` : ''}${name}</div><div class="rule-desc">${desc}</div></figcaption>
      <div class="rule-acts"><button class="chip" data-ins="${i}">Insert</button><button class="chip" data-cp="${i}">Copy LaTeX</button></div></figure>`).join('');
    body.innerHTML = `<div class="rules">${rulesHTML}</div>`;
  }
}
function keysTable() {
  const groups = ['Tools', 'Edit', 'Compute', 'View', 'Steps'];
  const rows = (g) => [
    ...ACTIONS.filter((a) => a[1] === g).map((a) => `<tr><td>${a[2]}</td><td class="kc"><button class="kbtn${keys[a[0]] !== a[3] ? ' custom' : ''}" data-rebind="${a[0]}" title="Click, then press a new key">${keyLabel(keys[a[0]])}</button></td></tr>`),
    ...FIXED.filter((f) => f[0] === g).map((f) => `<tr class="fixed"><td>${f[1]}</td><td class="kc"><span class="kfix">${f[2]}</span></td></tr>`),
  ].join('');
  const custom = ACTIONS.some((a) => keys[a[0]] !== a[3]);
  return `<div class="ktop"><span class="muted">Click a key to change it — press the new key, or Esc to cancel.</span><span class="grow"></span>${custom ? '<button class="chip" data-reset>Reset to defaults</button>' : ''}</div>
    <table class="ktable">${groups.map((g) => `<tbody><tr class="kgroup"><th colspan="2">${g}</th></tr>${rows(g)}</tbody>`).join('')}</table>`;
}
function onHelpClick(e) {
  if (e.target.closest('[data-tour]')) { closeModal(); return startTour(); }
  const rb = e.target.closest('[data-rebind]');
  if (rb) { startRecording(rb); return; }
  if (e.target.closest('[data-reset]')) { loadKeysDefaults(); return; }
  const ins = e.target.closest('[data-ins]'), cp = e.target.closest('[data-cp]');
  if (ins) { const src = RULE_LIB[+ins.dataset.ins][3]; closeModal(); importText(src, 'append', 0); }
  if (cp) {
    const t = ZX.docTex(ZX.parseEquation(RULE_LIB[+cp.dataset.cp][3]));
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('LaTeX copied'), () => toast('Copy failed'));
  }
}
function loadKeysDefaults() { keys = Object.fromEntries(ACTIONS.map((a) => [a[0], a[3]])); saveKeys(); updateKbd(); drawHelp(); toast('Shortcuts reset'); }
function startRecording(btn) {
  if (recording) recording.btn.classList.remove('rec');
  recording = { btn, id: btn.dataset.rebind };
  btn.classList.add('rec');
  btn.textContent = 'Press a key…';
}
// Captures the next key while a shortcut is being recorded (runs before every other key handler).
window.addEventListener('keydown', (e) => {
  if (!recording) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const { id, btn } = recording, k = e.key.toLowerCase();
  if (k === 'escape') { recording = null; btn.classList.remove('rec'); btn.textContent = keyLabel(keys[id]); return; }
  if (e.metaKey || e.ctrlKey || RESERVED.has(k)) { toast('That key is reserved — try another'); return; }
  recording = null;
  const other = ACTIONS.find((a) => a[0] !== id && keys[a[0]] === k);
  if (other) { keys[other[0]] = keys[id]; toast(`Swapped with “${other[2].split(' —')[0]}”`); }
  keys[id] = k;
  saveKeys(); updateKbd(); drawHelp();
}, true);

// ---------- background computing ----------
// Heavy work (matrices, checks, simplification) runs in zx-worker.js so the page never freezes.
// Two lanes: 'fg' for what you asked for (can be cancelled), 'bg' for live relation checks.
// Opened from file:// (workers blocked) it falls back to the main thread, one job per tick.
// Results are memoised by their inputs, so toggling options or reopening a panel is instant.
const SIM = { fg: null, bg: null, seq: 0, pend: new Map(), off: false, memo: new Map() };
const simArgs = (args) => JSON.stringify(args, (k, v) => (k === '_ph' ? undefined : v));
function simLane(lane) {
  if (SIM.off) return null;
  if (SIM[lane]) return SIM[lane];
  let w;
  try { w = new Worker('zx-worker.js?v=5'); } catch (_) { SIM.off = true; return null; }
  w.onmessage = (e) => {
    const m = e.data, p = m && SIM.pend.get(m.id);
    if (!p) return;
    SIM.pend.delete(m.id);
    if (m.ok) { memoPut(p.key, m.r); p.res(m.r); } else { const er = new Error(m.msg); er.nodes = m.nodes; p.rej(er); }
  };
  w.onerror = (e) => {   // the worker could not start (e.g. file://): finish its jobs here instead
    if (e.preventDefault) e.preventDefault();
    SIM.off = true; SIM[lane] = null; try { w.terminate(); } catch (_) {}
    [...SIM.pend.values()].filter((p) => p.lane === lane).forEach((p) => { SIM.pend.delete(p.id); runHere(p); });
  };
  SIM[lane] = w;
  return w;
}
function memoPut(key, r) { if (!key) return; SIM.memo.delete(key); SIM.memo.set(key, r); if (SIM.memo.size > 240) SIM.memo.delete(SIM.memo.keys().next().value); }
function runHere(p) {
  setTimeout(() => {
    if (p.dead) return;
    try { const r = ZXS[p.fn](...JSON.parse(simArgs(p.args))); memoPut(p.key, r); p.res(r); }
    catch (er) { p.rej(er); }
  }, 0);
}
// run ZXS[fn](...args) off the page; resolves with the result, rejects with the error (e.nodes kept)
function simJob(fn, args, lane = 'fg') {
  const a = simArgs(args), key = fn + '|' + a;
  if (SIM.memo.has(key)) { const r = SIM.memo.get(key); memoPut(key, r); return Promise.resolve(r); }
  return new Promise((res, rej) => {
    const p = { id: ++SIM.seq, fn, args, lane, key, res, rej };
    const w = simLane(lane);
    if (!w) return runHere(p);
    SIM.pend.set(p.id, p);
    w.postMessage({ id: p.id, fn, args: JSON.parse(a) });
  });
}
// stop everything on a lane (the worker restarts on the next job)
function simCancel(lane = 'fg') {
  const cancelled = new Error('cancelled'); cancelled.cancelled = true;
  [...SIM.pend.values()].filter((p) => p.lane === lane).forEach((p) => { SIM.pend.delete(p.id); p.dead = true; p.rej(cancelled); });
  if (SIM[lane]) { SIM[lane].terminate(); SIM[lane] = null; }
}
const busyHTML = (msg, cancel = 'sim-cancel') => `<div class="mbusy"><span class="spin"></span><span class="mbusy-t">${msg}</span><button class="linkbtn" data-${cancel}>Cancel</button></div>`;

// ---------- compute: step-by-step simplification and matrices (engine: zx-sim.js) ----------
const SIM_RULES = 'spider fusion (sp), identity (id), Hadamard cancel (hh), colour change (cc), Hopf (ho), copy and strong complementarity (sc), π-commutation (π)';
let simCache = null;   // { i, sig, res } for the open Simplify popover
function runSimplify(d, opt) {
  return simJob('simplify', opt ? [d, opt] : [d]).catch((e) => { if (e.cancelled) throw e; markErr(e.nodes); return { steps: [], error: e.message, nodes: e.nodes }; });
}
const relChip = (rel) => (rel === '=' ? '=' : '∝');
function openSimplify(i, fromEl, ready, opt) {
  if (doc.diagrams[i] && !doc.diagrams[i].nodes.length) i = doc.diagrams.findIndex((x) => x.nodes.length);
  const d = doc.diagrams[i];
  if (!d || !d.nodes.length) return toast('Draw or import a diagram first');
  activeDi = i;
  const anchor = fromEl ? () => { const r = fromEl.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.bottom - 18); }
    : () => { const f = frameRect(doc.diagrams[i] || d); return { x: f.x0 + 120, y: f.y0 - 30 }; };
  if (!ready) {   // show the popover at once; the work runs in the background and can be cancelled
    openPop(`<div class="wraphead">Simplify ${esc(nameOf(i))}</div>${busyHTML('Simplifying — every step is being checked…')}`, anchor);
    pop.dataset.kind = 'simp'; pop.dataset.i = i;
    const sig = JSON.stringify(shape(d));
    runSimplify(d, opt).then((res) => {
      if (res) res._opt = opt;
      if (pop.hidden || pop.dataset.kind !== 'simp' || +pop.dataset.i !== i || !doc.diagrams[i] || JSON.stringify(shape(doc.diagrams[i])) !== sig) return;
      openSimplify(i, fromEl, res);
    }, () => {});
    return;
  }
  const res = ready;
  simCache = { i, d, res };
  const n0 = d.nodes.length, last = res.steps.length ? res.steps[res.steps.length - 1].diagram : d;
  const body = res.error ? errHTML(res.error, res.nodes)
    : !res.steps.length ? `<div class="phint">Already as simple as these rules get it: ${SIM_RULES}.${res.note ? ' ' + esc(res.note) : ''}</div>`
    : `<div class="simsteps">${res.steps.map((s, k) => `<span class="simstep" style="--k:${k}">${tex(s.sep)}</span>`).join('<span class="simarrow">›</span>')}</div>
       <div class="phint">${res.steps.length} step${res.steps.length === 1 ? '' : 's'} · ${n0} → ${last.nodes.length} nodes. Each step was checked by computing both sides, and each relation (= or ∝) is the one the computation found.${res.note ? ' ' + esc(res.note) : ''}</div>`;
  openPop(`<div class="wraphead">Simplify ${esc(nameOf(i))}</div>${body}
    <div class="row simacts">
      ${res.steps.length ? `<button class="btn primary sm" data-s="simp-ins">Insert steps after it</button><button class="btn sm" data-s="simp-new">Open in a new page</button>` : ''}
      ${doc.diagrams.length > 1 ? `<button class="linkbtn" data-s="simp-all">Simplify all ${doc.diagrams.length} diagrams</button>` : ''}
      ${res.parity && !res._opt ? `<button class="linkbtn" data-s="simp-pnf" title="It is a parity map: rewrite it to parity normal form">Parity normal form</button>` : ''}
      <span class="grow"></span><button class="linkbtn" data-s="simp-mat">Matrix</button>
    </div>`, anchor);
  render();
  pop.dataset.kind = 'simp'; pop.dataset.i = i;
}
// Turn engine steps into editor diagrams laid out on the grid.
function stepDiagrams(res) {
  // fresh copies (new ids) so inserting the same result twice never shares objects
  return res.steps.map((s) => { autoLayout(s.diagram); return cloneDiagram(s.diagram); });
}
function applySimplify(i, where) {
  if (!simCache || simCache.i !== i) return;
  if (where === 'after' && lockedStop()) return;
  const { res, d } = simCache;
  closePop();
  const ds = stepDiagrams(res), seps = res.steps.map((s) => s.sep);
  if (where === 'after') {
    snapshot();
    animate(() => {
      doc.diagrams.splice(i + 1, 0, ...ds);
      doc.seps.splice(i, 0, ...seps);
      tidy();
      activeDi = i + ds.length; sel.clear();
    }, 420);
    fit();
    toast(`Added ${ds.length} step${ds.length === 1 ? '' : 's'}`);
    return;
  }
  const name = `Simplified ${i + 1}`;
  openPage(name, { diagrams: [cloneDiagram(d)].concat(ds), seps, wrap: doc.wrap || defaultWrap() });
}
// one new page; each diagram's simplification on its own line
// one diagram after another in the background, with progress and Cancel; the page opens when all are done
async function simplifyAll() {
  const anchor = popAnchor;
  const src = doc.diagrams.filter((d) => d.nodes.length).map((d) => JSON.parse(JSON.stringify(d)));
  if (!src.length) return toast('Nothing to simplify here');
  const out = { diagrams: [], seps: [], wrap: 0 };
  let any = 0, skipped = 0;
  const show = (k) => { const t = !pop.hidden && pop.dataset.kind === 'simpall' && pop.querySelector('.mbusy-t'); if (t) t.textContent = `Simplifying ${k + 1} of ${src.length}…`; };
  const f0 = frameRect(doc.diagrams[0]);
  openPop(`<div class="wraphead">Simplify all</div>${busyHTML(`Simplifying 1 of ${src.length}…`)}<div class="sbar"><span style="width:0%"></span></div>`, anchor || (() => ({ x: f0.x0 + 120, y: f0.y0 - 30 })));
  pop.dataset.kind = 'simpall';
  try {
    for (let k = 0; k < src.length; k++) {
      show(k);
      const res = await runSimplify(src[k]);
      const bar = pop.querySelector('.sbar span'); if (bar) bar.style.width = ((k + 1) / src.length * 100) + '%';
      if (res.error || !res.steps.length) { skipped++; continue; }
      any++;
      const first = cloneDiagram(src[k]);
      if (out.diagrams.length) { first.br = true; out.seps.push(''); }
      out.diagrams.push(first, ...stepDiagrams(res));
      out.seps.push(...res.steps.map((st) => st.sep));
    }
  } catch (e) { if (e.cancelled) return; throw e; }
  closePop();
  if (!any) return toast('Nothing to simplify here');
  openPage('Simplified', out);
  if (skipped) setTimeout(() => toast(`${any} simplified, ${skipped} already simple or not computable`), 900);
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-sim-cancel]')) { simCancel('fg'); closePop(); toast('Cancelled'); } });
function openPage(name, d) {
  stashTab();
  const from = curTab();
  ws.tabs.splice(ws.active + 1, 0, Object.assign(makeTab(name, d), { madeFrom: from && from.id }));
  ws.active++;
  doc = curTab().doc;
  const d0 = doc.diagrams[0];
  if (d0) { const b = ZX.bounds(d0); d0.ox = -b.c0 * CW; d0.oy = -Math.round((b.r0 + b.r1) / 2) * CH; }
  tidy();
  loadTab();
  fit(true);
  const el = tabsEl.querySelector('.tab.on'); if (el) { el.classList.add('new'); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}

// Matrix panel: exact (multiples of π/4) or numeric values, one diagram or the whole chain with checks.
let matState = { scope: 'one', mode: 'exact', norm: false, vals: {}, check: 'all' };
try { if (localStorage.getItem('zx-draw-check') === 'current') matState.check = 'current'; } catch (_) {}
const ketLabels = (n) => Array.from({ length: 1 << n }, (_, x) => n ? x.toString(2).padStart(n, '0') : '');
const symbolsOf = (ds) => ZXS.symbolsOf(ds);   // quick (numeric), used by the Check popover
// M = ZXS.matrixView(...) result, computed in the background (or { error, nodes })
function matrixBlock(d, k, V) {
  if (V && V.error) { markErr(V.nodes); return `<div class="mblock"><div class="mhead"><b>${esc(nameOf(k))}</b></div>${errHTML(V.error, V.nodes)}</div>`; }
  const exact = V.exact, rows = V.rows, pref = V.pref;
  const M = { ins: V.ins, outs: V.outs, exact: V.Mexact, bigFallback: V.bigFallback };   // M.exact: the engine had exact values
  const big = rows.length * (rows[0] || []).length > 1024;
  const rl = ketLabels(M.outs), cl = ketLabels(M.ins);
  const cell = (v) => (exact ? tex(v) : esc(v));
  const latex = `${pref && pref !== '1' && pref !== '\\propto' ? pref : ''}\\begin{pmatrix} ${rows.map((r) => r.join(' & ')).join(' \\\\ ')} \\end{pmatrix}`;
  const note = !M.exact && matState.mode === 'exact' ? `<span class="mtag">${M.bigFallback ? 'numeric — too large for exact values' : 'numeric — a phase has no exact value (an angle symbol or a decimal)'}</span>` : '';
  return `<div class="mblock"><div class="mhead"><b>${esc(nameOf(k))}</b><span class="muted">${M.ins} in → ${M.outs} out · ${rows.length}×${(rows[0] || []).length}</span>${note}<span class="grow"></span>
      <button class="ib mcopy" data-latex="${esc(latex)}" title="Copy as LaTeX">${I.copy}</button></div>
    ${big ? '<div class="phint">Too large to show (more than 1024 entries).</div>' : `<div class="mwrap">${pref ? `<div class="mpref">${tex(pref)}</div>` : ''}
      <table class="mtab${exact ? '' : ' num'}"><thead><tr><th></th>${cl.map((c) => `<th>${c ? '⟨' + c + '|' : ''}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r, ri) => `<tr><th>${rl[ri] ? '|' + rl[ri] + '⟩' : ''}</th>${r.map((v) => `<td class="${v === '0' ? 'z' : ''}">${cell(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
  </div>`;
}
function checkBlock(i, C) {
  const s = sepOf(i), claim = /\\propto|∝/.test(s) ? 'prop' : /\\approx|≈|Rightarrow|⇒/.test(s) ? 'other' : s.trim() ? 'eq' : 'none';
  let r, syms = [];
  try {
    if (!C || C.error) { const er = new Error(C ? C.error : 'not computed'); er.nodes = C && C.nodes; throw er; }
    syms = C.syms; r = C.r;
  } catch (e) { markErr(e.nodes); return `<div class="mcheck info"><span class="mci">${MARK.err}</span><span>${tex(s || '\\;')}</span><span>Can’t check: ${esc(e.message)}${e.nodes && e.nodes.length ? ` <button class="linkbtn errgo" data-errgo="${e.nodes.join(',')}">Show on canvas</button>` : ''}</span></div>`; }
  // which values the check covered
  const valTex = syms.map((k) => { const v = matState.vals[k]; const b = Number.isInteger(v) && (v === 0 || v === 1) && !/^\\/.test(k) ? String(v) : `${+(+v).toFixed(4)}\\pi`; return `${k}=${b}`; }).join(',\\ ');
  const scope = !syms.length ? '' : matState.check === 'current' ? ` for ${tex(valTex)}` : ' for every value';
  const how = r.exact ? 'exact' : syms.length && matState.check === 'all' ? 'all 0/1 cases, random angles' : 'numeric';
  const word = r.rel === 'eq' ? 'equal' : r.rel === 'prop' ? 'equal up to a non-zero scalar' : 'not equal, not even up to a scalar';
  let cls = 'ok', icon = '✓', msg;
  if (claim === 'eq' && r.rel === 'prop') { cls = 'warn'; icon = '≈'; msg = `Written “=”, but${scope} they are only ${word}`; }
  else if ((claim === 'eq' || claim === 'prop') && r.rel === 'ne') {
    cls = 'bad'; icon = '✗';
    msg = `Does not hold${scope}: ${word}${r.why ? ` — ${esc(r.why)}` : ''}`;
    if (syms.length && matState.check === 'all' && r.at) msg += ` — fails e.g. at ${tex(syms.map((k) => `${k}=${+(+r.at[k]).toFixed(3)}`).join(',\\ '))}`;
  }
  else if (claim === 'none' || claim === 'other') { cls = 'info'; icon = '·'; msg = `Diagrams ${i + 1} and ${i + 2} are ${word}${scope}`; }
  else msg = `Holds${scope}: ${word}`;
  return `<div class="mcheck ${cls}"><span class="mci">${MARK[cls] || icon}</span><span>${tex(s || '\\;')}</span><span>${msg}</span><span class="muted">(${how})</span></div>`;
}
function openMatrix(i, keepScope) {
  closePop();
  if (!keepScope) matState.scope = doc.diagrams.length > 1 && i == null ? 'all' : 'one';
  if (i != null) activeDi = i;
  // everything the panel shows is computed first, in the background (cancel any time), then drawn at once
  const compute = async () => {
    const ds = matState.scope === 'all' ? doc.diagrams : [doc.diagrams[activeDi]];
    const syms = await simJob('symbolsOf', [ds]);
    syms.reals.forEach((k) => { if (!(k in matState.vals)) matState.vals[k] = 0.25; });
    syms.bools.forEach((k) => { if (!(k in matState.vals)) matState.vals[k] = 0; });
    const opts = { mode: matState.mode, values: matState.vals, norm: matState.norm };
    const step = (t) => { const el = root.querySelector('.mbusy-t'); if (el) el.textContent = t; };
    const mats = [], chks = [];
    const todo = ds.length + (matState.scope === 'all' ? ds.length - 1 : 0);
    let done = 0;
    const soft = (e) => { if (e.cancelled) throw e; return { error: e.message, nodes: e.nodes }; };
    for (let k = 0; k < ds.length; k++) {
      step(`Computing ${++done} of ${todo}…`);
      mats[k] = await simJob('matrixView', [ds[k], opts]).catch(soft);
      if (matState.scope === 'all' && k + 1 < ds.length) {
        step(`Computing ${++done} of ${todo}…`);
        chks[k] = await simJob('relationCheck', [ds[k], ds[k + 1], { check: matState.check, values: matState.vals }]).catch(soft);
      }
    }
    return { ds, syms, mats, chks };
  };
  const draw = ({ ds, syms, mats, chks }) => {
    const symUI = syms.reals.concat(syms.bools).length ? `<div class="msyms">${syms.reals.map((k) => `<label class="msym">${tex(k)}<span>=</span><input type="number" step="0.05" data-sym="${esc(k)}" value="${matState.vals[k]}"><span class="muted">π</span></label>`).join('')}
      ${syms.bools.map((k) => `<span class="msym">${tex(k)}<span>=</span><div class="seg sm" data-seg="b-${esc(k)}">${[0, 1].map((v) => `<button data-bool="${esc(k)}" data-v="${v}" class="${matState.vals[k] === v ? 'on' : ''}">${v}</button>`).join('')}</div></span>`).join('')}</div>` : '';
    const blocks = ds.map((d, k) => {
      const idx = matState.scope === 'all' ? k : activeDi;
      return matrixBlock(d, idx, mats[k]) + (matState.scope === 'all' && k + 1 < ds.length ? checkBlock(k, chks[k]) : '');
    }).join('');
    return `<div class="mfoot">
        ${doc.diagrams.length > 1 ? `<div class="seg" data-seg="mscope"><button data-scope="one" class="${matState.scope === 'one' ? 'on' : ''}">${esc(nameOf(activeDi))}</button><button data-scope="all" class="${matState.scope === 'all' ? 'on' : ''}">All ${doc.diagrams.length} + checks</button></div>` : ''}
        <div class="seg" data-seg="mmode"><button data-mode="exact" class="${matState.mode === 'exact' ? 'on' : ''}">Exact</button><button data-mode="num" class="${matState.mode === 'num' ? 'on' : ''}">Numeric</button></div>
        <label class="chk cond${matState.mode === 'num' ? '' : ' off'}" data-cond="m-norm"><input type="checkbox" id="mNorm"${matState.norm ? ' checked' : ''}> Up to scalar</label>
        ${matState.scope === 'all' && syms.reals.concat(syms.bools).length ? `<span class="grow"></span><span class="muted">Check relations</span><div class="seg" data-seg="mcheck"><button data-check="all" class="${matState.check === 'all' ? 'on' : ''}" title="The relation must hold for every value of the symbols">For all values</button><button data-check="current" class="${matState.check === 'current' ? 'on' : ''}" title="Check only at the values set below">At these values</button></div>` : ''}
      </div>
      ${symUI}
      <div class="mxlist">${blocks}</div>
      <div class="phint">Columns are inputs (left boundary wires), rows are outputs (right), top wire first. Phases without π are read in units of π (½ means π/2). Exact values work for any fraction of π. Spiders are unnormalised as in the zx-calculus package; a Hadamard is (1/√2)[[1,1],[1,−1]].</div>`;
  };
  openModal('Matrix', '<div id="matRoot"></div>');
  $('#modal .sheet').classList.add('wide');
  const root = $('#matRoot');
  let gen = 0;
  const redraw = () => {
    const my = ++gen;
    simCancel('fg');   // a newer request replaces the one still running
    // fast results swap in directly; slow ones dim the old content (or show progress) first
    const slow = setTimeout(() => { if (my !== gen || !root.isConnected) return; if (root.querySelector('.mxlist')) root.classList.add('mstale'); else root.innerHTML = busyHTML('Computing…', 'mat-cancel'); }, 120);
    compute().then((data) => {
      clearTimeout(slow);
      if (my !== gen || !root.isConnected) return;
      root.classList.remove('mstale');
      root.innerHTML = draw(data); syncAllPills(root); keepMotion(root); render();
    }, (e) => { clearTimeout(slow); if (e.cancelled || my !== gen) return; root.classList.remove('mstale'); root.innerHTML = errHTML(e.message, e.nodes); });
  };
  root.innerHTML = busyHTML('Computing…', 'mat-cancel');
  root.addEventListener('click', (e) => { if (e.target.closest('[data-mat-cancel]')) { gen++; simCancel('fg'); closeModal(); toast('Cancelled'); } });
  redraw();
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.scope) { matState.scope = b.dataset.scope; redraw(); }
    if (b.dataset.mode) { matState.mode = b.dataset.mode; redraw(); }
    if (b.dataset.check) { matState.check = b.dataset.check; try { localStorage.setItem('zx-draw-check', matState.check); } catch (_) {} redraw(); }
    if (b.dataset.bool) { matState.vals[b.dataset.bool] = +b.dataset.v; redraw(); }
    if (b.classList.contains('mcopy')) {
      const t = b.dataset.latex;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Matrix copied as LaTeX'), () => toast('Could not copy'));
    }
  });
  root.addEventListener('change', (e) => {
    if (e.target.id === 'mNorm') { matState.norm = e.target.checked; redraw(); }
    if (e.target.dataset.sym) { const v = parseFloat(e.target.value); if (isFinite(v)) { matState.vals[e.target.dataset.sym] = v; redraw(); } }
  });
}

// ---------- live step check: ✓ / ≈ / ✗ on every relation ----------
// status marks drawn as SVG so they sit exactly in the middle of their circles (font glyphs don't)
const markSvg = (d) => `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const MARK = {
  ok: markSvg('<path d="M3 6.3l2 2 4-4.6"/>'),
  warn: markSvg('<path d="M3 4.9c1-1 2-1 3 0s2 1 3 0M3 7.6c1-1 2-1 3 0s2 1 3 0"/>'),
  bad: markSvg('<path d="M3.8 3.8l4.4 4.4M8.2 3.8l-4.4 4.4"/>'),
  err: markSvg('<path d="M4.6 4.6a1.5 1.5 0 1 1 2.1 1.4c-.5.2-.7.6-.7 1.1M6 9.1h.01"/>'),
  info: markSvg('<path d="M6 6h.01" stroke-width="3"/>'),
};
let liveCheck = false;
try { liveCheck = localStorage.getItem('zx-draw-live-check') === '1'; } catch (_) {}
const checkCache = new Map();
let checkTimer = 0;
const claimOf = (s) => (/\\propto|∝/.test(s) ? 'prop' : /\\approx|≈|Rightarrow|⇒/.test(s) ? 'other' : s.trim() ? 'eq' : 'none');
const shape = (d) => [d.nodes.map((n) => [n.id, n.r, n.c, n.t, n.label, n.cmd, n.v]), d.edges.map((e) => [e.a, e.b, e.o])];
function checkKey(i) {
  const d1 = doc.diagrams[i], d2 = doc.diagrams[i + 1];
  return JSON.stringify([sepOf(i), matState.check, matState.check === 'current' ? matState.vals : 0, shape(d1), shape(d2)]);
}
function checkFrom(i, C) {
  const s = sepOf(i), claim = claimOf(s);
  const syms = C.syms, r = C.r;
  const where = !syms.length ? '' : matState.check === 'current' ? ' at the chosen values' : ' for every value';
  if (r.rel === 'ne') return { cls: 'bad', icon: '✗', title: `Does not hold${where}${r.why ? ': ' + r.why : ''}` };
  if (claim === 'eq' && r.rel === 'prop') return { cls: 'warn', icon: '≈', title: `Only equal up to a scalar${where} — write ∝, or fix the scalar` };
  return { cls: 'ok', icon: '✓', title: `Holds${where}${r.rel === 'eq' ? ': equal' : ': equal up to a scalar'}` };
}
function sepBadge(i) {
  if (!liveCheck || !doc.diagrams[i + 1]) return '';
  const claim = claimOf(sepOf(i));
  if (claim === 'none' || claim === 'other') return '';
  if (!doc.diagrams[i].nodes.length || !doc.diagrams[i + 1].nodes.length) return '';
  const r = checkCache.get(checkKey(i));
  if (!r) { queueChecks(); return '<span class="sepok wait"></span>'; }
  return `<span class="sepok ${r.cls}" title="${esc(r.title)}">${MARK[r.cls] || ''}</span>`;
}
// work through unchecked relations one at a time, so the page stays responsive
function queueChecks() { if (!checkTimer) checkTimer = setTimeout(runChecks, 150); }
let checkBusy = null;   // key of the relation being checked in the background lane
function runChecks() {
  checkTimer = 0;
  if (!liveCheck || checkBusy) return;
  if (checkCache.size > 400) checkCache.clear();
  for (let i = 0; i + 1 < doc.diagrams.length; i++) {
    const claim = claimOf(sepOf(i));
    if (claim === 'none' || claim === 'other' || !doc.diagrams[i].nodes.length || !doc.diagrams[i + 1].nodes.length) continue;
    const k = checkKey(i);
    if (checkCache.has(k)) continue;
    checkBusy = k;
    simJob('relationCheck', [doc.diagrams[i], doc.diagrams[i + 1], { check: matState.check, values: matState.vals }], 'bg')
      .then((C) => checkFrom(i, C), (e) => ({ cls: 'err', icon: '?', title: e.message, nodes: e.nodes }))
      .then((res) => { checkBusy = null; checkCache.set(k, res); render(); });   // render() queues the next one
    return;
  }
  updateCheckBtn();
}
function updateCheckBtn() {
  const b = $('#btnCheck');
  if (!b) return;
  b.classList.toggle('on', liveCheck);
  let bad = 0;
  if (liveCheck) for (let i = 0; i + 1 < doc.diagrams.length; i++) { const r = checkCache.get(checkKey(i)); if (r && r.cls === 'bad') bad++; }
  const old = b.querySelector('.cbad');
  if (bad) { if (old) old.textContent = bad; else b.insertAdjacentHTML('beforeend', `<span class="cbad">${bad}</span>`); } else if (old) old.remove();
}
function setLiveCheck(on) {
  liveCheck = on;
  try { localStorage.setItem('zx-draw-live-check', on ? '1' : '0'); } catch (_) {}
  render(); updateCheckBtn();
}
function openCheck() {
  const draw = () => {
    let syms = { reals: [], bools: [] };
    try { syms = symbolsOf(doc.diagrams); } catch (_) {}
    syms.reals.forEach((k) => { if (!(k in matState.vals)) matState.vals[k] = 0.25; });
    syms.bools.forEach((k) => { if (!(k in matState.vals)) matState.vals[k] = 0; });
    const anySym = syms.reals.length + syms.bools.length > 0;
    return `<div class="wraphead">Check each step</div>
      <label class="switch"><input type="checkbox" data-s="live"${liveCheck ? ' checked' : ''}><span class="track"></span><span>Show ✓ / ≈ / ✗ on every relation</span></label>
      ${anySym ? `<div class="seg" data-seg="lcheck"><button data-s="lc" data-v="all" class="${matState.check === 'all' ? 'on' : ''}">For all values</button><button data-s="lc" data-v="current" class="${matState.check === 'current' ? 'on' : ''}">At these values</button></div>` : ''}
      ${anySym && matState.check === 'current' ? `<div class="msyms">${syms.reals.map((k) => `<label class="msym">${tex(k)}<span>=</span><input type="number" step="0.05" data-s="lv" data-k="${esc(k)}" value="${matState.vals[k]}"><span class="muted">π</span></label>`).join('')}
        ${syms.bools.map((k) => `<span class="msym">${tex(k)}<span>=</span><div class="seg sm" data-seg="lb-${esc(k)}">${[0, 1].map((v) => `<button data-s="lb" data-k="${esc(k)}" data-v="${v}" class="${matState.vals[k] === v ? 'on' : ''}">${v}</button>`).join('')}</div></span>`).join('')}</div>` : ''}
      <div class="legend"><span><i class="ok">${MARK.ok}</i>holds as written</span><span><i class="warn">${MARK.warn}</i>written “=”, only equal up to a scalar</span><span><i class="bad">${MARK.bad}</i>does not hold</span></div>`;
  };
  const btn = $('#btnCheck');
  openPop(draw(), () => { const r = btn.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.bottom - 18); });
  pop.dataset.kind = 'check'; pop.dataset.i = 0;
  pop._redraw = () => { pop.innerHTML = draw(); syncAllPills(pop); };
}

// ---------- tabs (pages of one canvas) ----------
const tabsEl = $('#tabs');
function defaultWrap() { try { return +localStorage.getItem('zx-draw-wrap') || 0; } catch (_) { return 0; } }
const emptyDoc = () => ({ diagrams: [], seps: [], wrap: defaultWrap() });
function cleanDoc(d) {
  if (!d || !Array.isArray(d.diagrams)) return emptyDoc();
  if (!Array.isArray(d.seps)) d.seps = [];
  return d;
}
const makeTab = (name, d) => ({ id: ZX.newId('t'), name: name || 'Page 1', doc: cleanDoc(d), cam: null });
function nextTabName() {
  const used = ws.tabs.map((t) => +((/^Page (\d+)$/.exec(t.name) || [])[1] || 0));
  return 'Page ' + (Math.max(0, ...used) + 1);
}
// Park the open tab (diagrams, camera, undo history) before switching away.
function stashTab() {
  const t = curTab();
  wsPrev = null;
  if (!t) return;
  t.doc = doc; t.cam = { x: cam.x, y: cam.y, k: cam.k };
  tabHist.set(t.id, { hist, redo: redoStack });
}
function loadTab(fade = true) {
  const t = curTab();
  cancelAnimationFrame(camAnim);   // a camera glide from the previous page must not carry over
  t.seen = Date.now();
  doc = t.doc;
  const h = tabHist.get(t.id) || { hist: [], redo: [] };
  hist = h.hist; redoStack = h.redo;
  sel.clear(); inspOpen = false; wirePend = null; activeDi = 0; drag = null;
  closePop(); hideSuggest();
  lastDisp.clear(); tween = null;
  if (fade) { world.classList.remove('tabin'); void world.offsetWidth; world.classList.add('tabin'); }
  render();
  if (t.cam) { cancelAnimationFrame(camAnim); cam = { ...t.cam }; applyCam(); } else fit(true);
  save();
  drawTabs();
}
function switchTab(i) {
  if (i === ws.active || !ws.tabs[i]) return;
  stashTab(); ws.active = i; loadTab();
}
function addTab() {
  stashTab();
  ws.tabs.splice(ws.active + 1, 0, makeTab(nextTabName(), emptyDoc()));
  ws.active++;
  loadTab();
  const el = tabsEl.querySelector('.tab.on');
  if (el) { el.classList.add('new'); el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); }
}
function closeTab(i) {
  if (ws.tabs.length < 2 || !ws.tabs[i]) return;
  if (ws.tabs[i].locked) { toast(`“${ws.tabs[i].name}” is locked — unlock it to delete`); return; }
  const wasOpen = i === ws.active;
  stashTab();
  const [t] = ws.tabs.splice(i, 1);
  tabHist.delete(t.id);
  if (wasOpen) {
    // go back to the page used most recently (like a browser), else the left neighbour
    let best = Math.max(0, i - 1);
    ws.tabs.forEach((x, k) => { if ((x.seen || 0) > (ws.tabs[best].seen || 0)) best = k; });
    ws.active = best;
    loadTab();          // doc must be swapped before anything saves
  } else {
    if (i < ws.active) ws.active--;
    save(); drawTabs(); // the open page is unchanged
  }
  toast(`Deleted “${t.name}”`);
}
const tabHasWork = (t) => (t === curTab() ? doc : t.doc).diagrams.some((d) => d.nodes.length);
function drawTabs() {
  const many = ws.tabs.length > 1, old = tabsEl.querySelector('.tab-track'), sl = old ? old.scrollLeft : 0;
  tabsEl.innerHTML = `<button class="tarr l" data-tarr="-1" title="Scroll pages left">${I.chevL}</button><div class="tab-track">${ws.tabs.map((t, i) => `
    <div class="tab${i === ws.active ? ' on' : ''}${many ? '' : ' solo'}" data-tab="${i}" title="${esc(t.name)}${i === ws.active ? ' · click to rename' : ''}${many ? ' · drag to reorder' : ''}">
      ${t.locked ? `<span class="tlock" title="Locked">${I.lockS}</span>` : ''}<span class="tname">${esc(t.name)}</span>${many ? `<button class="tx" data-tx="${i}" title="Delete page">${I.close}</button>` : ''}</div>`).join('')}
    </div><button class="tarr r" data-tarr="1" title="Scroll pages right">${I.chevR}</button><button class="tadd" id="tabAdd" title="New page (Alt+N)">${I.plus}</button>`;
  const tr = tabsEl.querySelector('.tab-track');
  tr.scrollLeft = sl;
  tr.addEventListener('scroll', tabArrows, { passive: true });
  // keep the open page in view (only nudges when it is cut off)
  const on = tr.querySelector('.tab.on');
  if (on && !tabDrag) { const a = on.offsetLeft - 28, b = on.offsetLeft + on.offsetWidth + 28 - tr.clientWidth; if (tr.scrollLeft > a) tr.scrollLeft = a; else if (tr.scrollLeft < b) tr.scrollLeft = b; }
  tabArrows();
}
// show ‹ › only when the pages overflow, and only on the side that has more
function tabArrows() {
  const tr = tabsEl.querySelector('.tab-track');
  if (!tr) return;
  const max = tr.scrollWidth - tr.clientWidth, x = tr.scrollLeft;
  tabsEl.classList.toggle('over', max > 2);
  tabsEl.classList.toggle('can-l', x > 2);
  tabsEl.classList.toggle('can-r', x < max - 2);
}
tabsEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tarr]');
  if (!b) return;
  const tr = tabsEl.querySelector('.tab-track');
  tr.scrollBy({ left: +b.dataset.tarr * Math.max(120, tr.clientWidth * 0.7), behavior: 'smooth' });
});
// a vertical mouse wheel scrolls the pages sideways
tabsEl.addEventListener('wheel', (e) => {
  const tr = e.target.closest('.tab-track');
  if (!tr || Math.abs(e.deltaX) > Math.abs(e.deltaY) || tr.scrollWidth <= tr.clientWidth) return;
  e.preventDefault(); tr.scrollLeft += e.deltaY;
}, { passive: false });
window.addEventListener('resize', tabArrows);
function renameTab(i) {
  const el = tabsEl.querySelector(`.tab[data-tab="${i}"] .tname`);
  if (!el) return;
  const t = ws.tabs[i], inp = document.createElement('input');
  inp.className = 'tren'; inp.value = t.name; inp.spellcheck = false;
  // the field opens a little wider to the right, follows the text while typing, and closes back
  const host = el.parentNode, textW = (v) => { const m = document.createElement('span'); m.className = 'tname tmeasure'; m.textContent = v || ' '; host.appendChild(m); const w = m.offsetWidth; m.remove(); return w; };
  const w0 = el.offsetWidth;
  const grow = () => { inp.style.width = Math.min(180, textW(inp.value) + 18) + 'px'; };
  inp.style.width = w0 + 'px';
  el.replaceWith(inp);
  inp.closest('.tab').classList.add('renaming');
  requestAnimationFrame(() => requestAnimationFrame(grow));
  inp.addEventListener('input', grow);
  inp.focus(); inp.select();
  let done = false;
  const end = (ok) => {
    if (done) return; done = true;
    const v = inp.value.trim(); if (ok && v) { t.name = v.slice(0, 40); save(); }
    inp.style.width = Math.min(150, textW(t.name)) + 'px';   // shrink back to the name
    inp.closest('.tab').classList.remove('renaming');
    setTimeout(drawTabs, 200);
  };
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') end(true); if (e.key === 'Escape') end(false); });
  inp.addEventListener('blur', () => end(true));
  inp.addEventListener('pointerdown', (e) => e.stopPropagation());
}
let tabDrag = null;
tabsEl.addEventListener('pointerdown', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab || e.target.closest('.tx,.tren,.tconf') || e.button !== 0) return;
  tabDrag = { i: +tab.dataset.tab, x0: e.clientX, moved: false };
  try { tabsEl.setPointerCapture(e.pointerId); } catch (_) {}
});
tabsEl.addEventListener('pointermove', (e) => {
  if (!tabDrag) return;
  if (!tabDrag.moved && Math.abs(e.clientX - tabDrag.x0) < 6) return;
  tabDrag.moved = true;
  // live reorder: swap with a neighbour once the pointer passes its middle
  const els = [...tabsEl.querySelectorAll('.tab')], i = tabDrag.i;
  let j = i;
  els.forEach((el, k) => { const r = el.getBoundingClientRect(), m = r.left + r.width / 2; if (k < i && e.clientX < m) j = Math.min(j, k); if (k > i && e.clientX > m) j = Math.max(j, k); });
  if (j !== i) {
    const act = ws.tabs[ws.active];
    const [t] = ws.tabs.splice(i, 1); ws.tabs.splice(j, 0, t);
    ws.active = ws.tabs.indexOf(act); tabDrag.i = j;
    drawTabs(); save();
  }
  const el = tabsEl.querySelector(`.tab[data-tab="${tabDrag.i}"]`);
  if (el) el.classList.add('drag');
});
const tabUp = () => {
  if (!tabDrag) return;
  const D = tabDrag; tabDrag = null;
  if (D.moved) return drawTabs();
  if (D.i !== ws.active) switchTab(D.i);
  else renameTab(D.i);   // clicking the open tab again edits its name
};
tabsEl.addEventListener('pointerup', tabUp);
tabsEl.addEventListener('pointercancel', tabUp);
tabsEl.addEventListener('dblclick', (e) => { const tab = e.target.closest('.tab'); if (tab && !e.target.closest('.tx')) renameTab(+tab.dataset.tab); });
let tabConfT = 0;
tabsEl.addEventListener('click', (e) => {
  if (e.target.closest('#tabAdd')) return addTab();
  const yes = e.target.closest('.tc-yes'), no = e.target.closest('.tc-no');
  if (yes) return closeTab(+yes.dataset.i);
  if (no) { const c = no.closest('.tconf'); c.classList.add('out'); setTimeout(drawTabs, 160); return; }
  const x = e.target.closest('.tx');
  if (!x) return;
  const i = +x.dataset.tx;
  if (!tabHasWork(ws.tabs[i])) return closeTab(i);
  // a page with diagrams asks first: Delete? ✓ ✕ in place of the ×
  const c = document.createElement('span');
  c.className = 'tconf';
  c.innerHTML = `<span class="tc-q">Delete?</span><button class="tc-yes" data-i="${i}" title="Delete this page">${I.tick}</button><button class="tc-no" title="Keep it">${I.close}</button>`;
  x.replaceWith(c);
  c.querySelector('.tc-no').focus({ preventScroll: true });
  clearTimeout(tabConfT);
  tabConfT = setTimeout(() => { if (c.isConnected) { c.classList.add('out'); setTimeout(() => { if (c.isConnected) drawTabs(); }, 160); } }, 4000);
});

// ---------- canvas files & saved canvases ----------
const SAVES_KEY = 'zx-draw-saves-v1';
const menu = $('#menu');
function loadSaves() { try { return JSON.parse(localStorage.getItem(SAVES_KEY) || '[]'); } catch (_) { return []; } }
function storeSaves(a) { try { localStorage.setItem(SAVES_KEY, JSON.stringify(a)); return true; } catch (_) { toast('Browser storage is full'); return false; } }
// Plain data for a whole canvas: { active, tabs: [{ name, doc }] }.
function wsData() { stashTab(); return { active: ws.active, tabs: ws.tabs.map((t) => ({ name: t.name, doc: t.doc, locked: !!t.locked })) }; }
// Swap in another canvas (open, import, new). ⌘Z right after brings the previous one back.
function setWorkspace(data, msg) {
  if (!data || !Array.isArray(data.tabs) || !data.tabs.length) { toast('Not a ZX Draw canvas'); return; }
  wsPrev = JSON.stringify(wsData());
  ws = { tabs: data.tabs.map((t) => Object.assign(makeTab(t.name, JSON.parse(JSON.stringify(t.doc))), { locked: !!t.locked })), active: Math.min(Math.max(0, data.active | 0), data.tabs.length - 1) };
  tabHist.clear();
  loadTab();
  fit();
  if (msg) toast(msg + ' — ⌘Z to undo');
}
function restoreWorkspace() {
  const p = JSON.parse(wsPrev); wsPrev = null;
  ws = { tabs: p.tabs.map((t) => Object.assign(makeTab(t.name, t.doc), { locked: !!t.locked })), active: p.active };
  tabHist.clear(); loadTab(); fit();
  toast('Previous canvas restored');
}
function appendTabs(data, msg) {
  if (!data || !Array.isArray(data.tabs) || !data.tabs.length) { toast('Not a ZX Draw canvas'); return; }
  stashTab();
  const first = ws.tabs.length;
  data.tabs.forEach((t) => ws.tabs.push(Object.assign(makeTab(t.name, JSON.parse(JSON.stringify(t.doc))), { locked: !!t.locked })));
  ws.active = first; loadTab();
  toast(msg);
}
// Canvas file format (.zxd): JSON with a header, one entry per page, and each page's LaTeX for reading.
//   { "format": "zx-draw", "version": 2, "saved": ISO date, "active": 0,
//     "pages": [ { "name": "Page 1", "tex": "\[ \zx{…} \]", "doc": { diagrams, seps, wrap } } ] }
// Older files ({ app: 'zx-draw', version: 1, doc } or a bare doc) open as a single page.
function parseCanvas(text) {
  const j = JSON.parse(text);
  if (j && j.format === 'zx-draw' && Array.isArray(j.pages)) return { active: j.active || 0, tabs: j.pages.map((p, i) => ({ name: p.name || 'Page ' + (i + 1), doc: cleanDoc(p.doc), locked: !!p.locked })) };
  const d = j && (j.doc || j);
  if (d && Array.isArray(d.diagrams)) return { active: 0, tabs: [{ name: 'Page 1', doc: cleanDoc(d) }] };
  return null;
}
function canvasFile() {
  const w = wsData();
  return JSON.stringify({
    format: 'zx-draw', version: 2, saved: new Date().toISOString(), active: w.active,
    pages: w.tabs.map((t) => ({ name: t.name, tex: t.doc.diagrams.length ? ZX.docTex(t.doc, { starts: lineStarts(t.doc) }) : '', doc: t.doc, locked: t.locked || undefined })),
  }, null, 1);
}
let fileMode = 'replace';
function loadCanvasText(t, name) {
  let data = null;
  try { data = parseCanvas(t); } catch (_) {}
  if (!data) return toast('Could not read that file');
  if (fileMode === 'append') appendTabs(data, `Added ${data.tabs.length} page${data.tabs.length === 1 ? '' : 's'} from ${name || 'file'}`);
  else setWorkspace(data, `Opened ${name || 'canvas'}`);
  fileMode = 'replace';
}
// saved entries: { name, t, ws } (older ones stored a single doc)
const entryWs = (x) => x.ws || { active: 0, tabs: [{ name: 'Page 1', doc: x.doc }] };
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : new Date(t).toLocaleDateString(); };
function drawCanvasMenu() {
  const saves = loadSaves();
  const n = ws.tabs.length > 1 || doc.diagrams.length;
  menu.innerHTML = `
    <div class="msave"><label class="field"><span>Name</span><input id="saveName" value="${esc(menu.dataset.name || 'Canvas ' + (saves.length + 1))}" spellcheck="false"></label>
      <button class="btn primary sm" id="saveGo">Save</button></div>
    ${saves.length ? `<div class="mlabel">Saved in this browser</div><div class="mlist">${saves.map((x, i) => `
      <div class="mitem" data-open="${i}"><div class="mtext"><div class="mname">${esc(x.name)}</div><div class="mmeta">${(() => { const w = entryWs(x), p = w.tabs.length, dn = w.tabs.reduce((a, t) => a + t.doc.diagrams.length, 0); return `${p} page${p === 1 ? '' : 's'} · ${dn} diagram${dn === 1 ? '' : 's'} · ${ago(x.t)}`; })()}</div></div>
      <button class="ib danger" data-delsave="${i}" title="Delete this saved canvas">${I.trash}</button></div>`).join('')}</div>` : '<div class="mempty">Saved canvases appear here.</div>'}
    <div class="mdiv"></div>
    <button class="mrow" id="cvExport">${I.down}<span>Export canvas file</span><kbd>.zxd · ${ws.tabs.length} page${ws.tabs.length === 1 ? '' : 's'}</kbd></button>
    <button class="mrow" id="cvImport">${I.up}<span>Open canvas file…</span></button>
    <button class="mrow" id="cvAppend">${I.plus}<span>Add pages from file…</span></button>
    <button class="mrow" id="cvNew"${n ? '' : ' disabled'}>${I.file}<span>New empty canvas</span></button>
    ${(() => {
      const bk = loadBackups();
      if (!bk.length) return '';
      const label = { auto: 'Automatic', unreadable: 'Rescued · unreadable', 'partly unreadable': 'Rescued · partly unreadable', 'before replace': 'Before replacing' };
      return `<div class="mdiv"></div><button class="mrow bk-toggle" id="bkToggle">${I.clock || I.file}<span>Backups</span><kbd>${bk.length}</kbd></button>
        <div class="bk-list${menu.dataset.bk ? ' open' : ''}">${bk.map((b, i) => { const info = backupInfo(b); const p = info ? info.tabs.length : 0;
          return `<div class="bk-item"><div class="mtext"><div class="mname">${label[b.reason] || b.reason}</div><div class="mmeta">${ago(b.t)}${info ? ` · ${p} page${p === 1 ? '' : 's'}` : ' · raw data'}</div></div>
            ${info ? `<button class="btn sm ghost" data-bkopen="${i}">Restore</button>` : ''}<button class="ib" data-bkdl="${i}" title="Download this backup">${I.down}</button></div>`; }).join('')}</div>`;
    })()}
    <input type="file" id="cvFile" accept=".zxd,.json,application/json" hidden>`;
}
function toggleCanvasMenu(force) {
  const open = force != null ? force : menu.hidden;
  if (!open) { menu.hidden = true; return; }
  drawCanvasMenu();
  menu.hidden = false;
  const r = $('#btnNew').getBoundingClientRect();
  menu.style.top = (r.bottom + 8) + 'px';
  menu.style.right = Math.max(8, innerWidth - r.right - 60) + 'px';
}
menu.addEventListener('click', (e) => {
  e.stopPropagation();
  const del = e.target.closest('[data-delsave]');
  if (del) { const a = loadSaves(); const [x] = a.splice(+del.dataset.delsave, 1); storeSaves(a); drawCanvasMenu(); toast(`Deleted “${x.name}”`); return; }
  const op = e.target.closest('[data-open]');
  if (op) { const x = loadSaves()[+op.dataset.open]; menu.dataset.name = x.name; menu.hidden = true; setWorkspace(entryWs(x), `Opened “${x.name}”`); return; }
  const bo = e.target.closest('[data-bkopen]'), bd = e.target.closest('[data-bkdl]');
  if (bo) { const b = loadBackups()[+bo.dataset.bkopen], info = b && backupInfo(b); if (!info) return toast('This backup cannot be opened'); menu.hidden = true; pushBackup(JSON.stringify(ws), 'before replace'); setWorkspace(info, `Restored the backup from ${ago(b.t)}`); return; }
  if (bd) { const b = loadBackups()[+bd.dataset.bkdl]; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([b.raw], { type: 'application/json' })); a.download = `zx-draw-backup-${new Date(b.t).toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); return; }
  const id = e.target.closest('button') && e.target.closest('button').id;
  if (id === 'bkToggle') { menu.dataset.bk = menu.dataset.bk ? '' : '1'; menu.querySelector('.bk-list').classList.toggle('open', !!menu.dataset.bk); return; }
  if (id === 'saveGo') {
    const name = ($('#saveName').value || '').trim() || 'Untitled';
    const a = loadSaves(), i = a.findIndex((x) => x.name === name), entry = { name, t: Date.now(), ws: JSON.parse(JSON.stringify(wsData())) };
    if (i >= 0) a.splice(i, 1);
    a.unshift(entry);
    if (storeSaves(a)) { menu.dataset.name = name; drawCanvasMenu(); toast(i >= 0 ? `Updated “${name}”` : `Saved “${name}”`); }
  }
  if (id === 'cvExport') {
    const name = (($('#saveName') && $('#saveName').value) || 'canvas').trim().replace(/[^\w\- ]+/g, '') || 'canvas';
    const blob = new Blob([canvasFile()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '.zxd'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    menu.hidden = true;
  }
  if (id === 'cvImport' || id === 'cvAppend') { fileMode = id === 'cvAppend' ? 'append' : 'replace'; $('#cvFile').click(); }
  if (id === 'cvNew') { menu.hidden = true; menu.dataset.name = ''; setWorkspace({ active: 0, tabs: [{ name: 'Page 1', doc: emptyDoc() }] }, 'New canvas'); }
});
menu.addEventListener('change', (e) => {
  if (e.target.id !== 'cvFile') return;
  const f = e.target.files[0];
  if (f) f.text().then((t) => { menu.hidden = true; loadCanvasText(t, f.name); });
});
menu.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && e.target.id === 'saveName') $('#saveGo').click(); if (e.key === 'Escape') menu.hidden = true; });
document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('#btnNew')) menu.hidden = true; });

// ---------- misc UI ----------
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }

function initChrome() {
  $('#btnTidy').innerHTML = I.tidy; $('#btnPreview').innerHTML = I.eye; $('#btnHelp').innerHTML = I.help; $('#btnNew').innerHTML = I.folder;
  $('#btnImport .bi').innerHTML = I.up; $('#btnExport .bi').innerHTML = I.down;
  $('.tool[data-tool="select"] .ti').innerHTML = I.pointer; $('.tool[data-tool="T"] .ti').innerHTML = I.text; $('.tool[data-tool="P"] .ti').innerHTML = I.dot; $('.tool[data-tool="M"] .ti').innerHTML = I.marrow; $('.tool[data-tool="edge"] .ti').innerHTML = I.wire;
  $('#dUndo').innerHTML = I.undo; $('#dRedo').innerHTML = I.redo; $('#dDel').innerHTML = I.trash;
  $('#btnTidy').onclick = tidyAll;
  $('#btnSimp .bi').innerHTML = I.wand; $('#btnMat .bi').innerHTML = I.matrix; $('#btnCheck .bi').innerHTML = I.okc;
  $('#btnCheck').onclick = (e) => { e.stopPropagation(); if (!pop.hidden && pop.dataset.kind === 'check') closePop(); else openCheck(); };
  $('#btnSimp').onclick = (e) => { e.stopPropagation(); if (!pop.hidden && pop.dataset.kind === 'simp') closePop(); else openSimplify(activeDi, $('#btnSimp')); };
  $('#btnMat').onclick = () => { if (!doc.diagrams.some((d) => d.nodes.length)) return toast('Draw or import a diagram first'); openMatrix(activeDi); };
  $('#btnWrap').innerHTML = I.wrap;
  $('#btnWrap').onclick = (e) => { e.stopPropagation(); if (!pop.hidden && pop.dataset.kind === 'wrap') closePop(); else openWrap(); };
  $('#sgGo').onclick = tidyAll; $('#sgX').onclick = hideSuggest;
  $('#zIn').innerHTML = I.plus; $('#zOut').innerHTML = I.minus; $('#zFit').innerHTML = I.fit;
  $('#zIn').onclick = () => zoomBy(1.25); $('#zOut').onclick = () => zoomBy(1 / 1.25); $('#zPct').onclick = cycleZoom; $('#zFit').onclick = () => fit();
  $('.tool[data-tool="hand"] .ti').innerHTML = I.hand;
  $('#btnPreview').onclick = togglePreview;
  $('#btnHelp').onclick = () => openHelp();
  $('#btnNew').onclick = (e) => { e.stopPropagation(); toggleCanvasMenu(); };
  $('#btnImport').onclick = () => openImport();
  $('#btnExport').onclick = () => openExport();
  $('#dUndo').onclick = undo; $('#dRedo').onclick = redo; $('#dDel').onclick = deleteSel;
  document.querySelectorAll('.tool[data-tool]').forEach((b) => { b.onclick = () => { const was = tool; setTool(b.dataset.tool); b.blur(); if (b.dataset.tool === 'select' && was === 'select') togglePickPop(b); }; });
{ const vb = document.querySelector('.tool[data-tool="select"]'); vb.addEventListener('contextmenu', (e) => { e.preventDefault(); if (tool !== 'select') setTool('select'); openPickPop(vb); }); }
  // drop a .tex file anywhere
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) f.text().then((t) => (/\.json$|\.zxd$/i.test(f.name) ? (fileMode = 'replace', loadCanvasText(t, f.name)) : openImport(t)));
  });
}

// ---------- first-run tour: spotlight + card, remembered in localStorage ----------
const TOUR_KEY = 'zx-draw-tour-v1';
let tour = null;
const tourSeen = () => { try { return localStorage.getItem(TOUR_KEY) === '1'; } catch (_) { return true; } };
const TOUR = () => [
  { title: 'Welcome to ZX Draw', demo: 'place', text: 'Draw ZX-calculus diagrams, check and simplify them, and copy LaTeX straight into your notes. Here is a quick look around — about a minute.' },
  { at: ['.tool[data-tool="Z"]', '.tool[data-tool="X"]', '.tool[data-tool="H"]', '.tool[data-tool="N"]'], demo: 'place', title: 'Place spiders', keys: [keys.Z, keys.X, keys.H, keys.N],
    text: 'Pick Z, X, H or a wire point N, then click the canvas. Click a wire to drop the node onto it. Double-click a spider to give it a phase.' },
  { at: ['.tool[data-tool="edge"]'], demo: 'wire', title: 'Draw wires', keys: [keys.edge],
    text: 'Drag from one node to another. One stroke through several nodes wires them all. Select a wire and press S to bend it.' },
  { at: ['.tool[data-tool="select"]', '.tool[data-tool="hand"]'], demo: 'select', title: 'Select, move, pan', keys: [keys.select, keys.hand],
    text: 'Click to select, drag to move, click again to edit. Drag empty canvas to box-select. Hold Space (or use the hand) to pan; pinch or ⌘-scroll to zoom.' },
  { at: ['#tabs'], title: 'Pages', text: 'A canvas holds several pages. + adds one, click the open page to rename it, drag to reorder. Everything saves automatically in this browser.' },
  { at: ['#btnSimp', '#btnCheck', '#btnMat'], title: 'Simplify, check, compute', keys: ['R', 'M'],
    text: '<b>Simplify</b> rewrites a diagram step by step with ZX rules — every step is verified. <b>Check</b> marks each = with ✓ ≈ ✗. <b>Matrix</b> gives the exact or numeric matrix.' },
  { at: ['#btnImport', '#btnExport'], title: 'LaTeX in, LaTeX out',
    text: 'Paste <code>\\zx{…}</code> code to import it. <b>Export</b> copies LaTeX for your document, or saves a PNG / SVG that looks exactly like the compiled PDF.' },
  { at: ['#btnHelp'], title: 'Help is one key away', keys: ['?'],
    text: 'The guide covers LaTeX setup (with the .sty file), every shortcut with animations, and the ZX rules. You can replay this tour from there.' },
];
function tourRect(sel) {
  let r = null;
  for (const q of sel) {
    const el = $(q); if (!el) continue;
    const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
    r = r ? { l: Math.min(r.l, b.left), t: Math.min(r.t, b.top), r: Math.max(r.r, b.right), b: Math.max(r.b, b.bottom) } : { l: b.left, t: b.top, r: b.right, b: b.bottom };
  }
  return r;
}
function startTour() {
  if (tour) return;
  closePop(); insp.hidden = true; menu.hidden = true; if (!$('#modal').hidden) closeModal();
  const steps = TOUR().filter((s) => !s.at || tourRect(s.at));   // skip what this screen hides
  const el = document.createElement('div');
  el.id = 'tour';
  el.innerHTML = `<div class="t-spot"></div><div class="t-card" role="dialog" aria-live="polite">
    <div class="t-body"></div>
    <footer><div class="t-dots">${steps.map(() => '<i></i>').join('')}</div><button class="t-skip">Skip</button><button class="btn sm t-back">Back</button><button class="btn primary sm t-next"></button></footer></div>`;
  document.body.appendChild(el);
  tour = { el, steps, i: 0, spot: el.querySelector('.t-spot'), card: el.querySelector('.t-card') };
  el.querySelector('.t-skip').onclick = () => endTour();
  el.querySelector('.t-back').onclick = () => tourGo(tour.i - 1);
  el.querySelector('.t-next').onclick = () => (tour.i === steps.length - 1 ? endTour() : tourGo(tour.i + 1));
  el.addEventListener('pointerdown', (e) => { if (!tour.card.contains(e.target)) { e.preventDefault(); tour.card.classList.remove('nudge'); void tour.card.offsetWidth; tour.card.classList.add('nudge'); } });
  tourGo(0, true);
  requestAnimationFrame(() => el.classList.add('on'));
}
function tourGo(i, first) {
  if (!tour || i < 0 || i >= tour.steps.length) return;
  const back = i < tour.i;
  tour.i = i;
  const s = tour.steps[i], body = tour.card.querySelector('.t-body');
  const fill = () => {
    body.innerHTML = (s.demo ? `<div class="t-demo">${DEMOS[s.demo]()}</div>` : '')
      + `<div class="t-step">${i ? `${i} of ${tour.steps.length - 1}` : 'Quick tour'}</div><h3>${s.title}</h3><p>${s.text}</p>`
      + (s.keys ? `<div class="t-keys">${s.keys.map((k) => cap(keyLabel(k))).join('')}</div>` : '');
    tour.card.querySelector('.t-back').hidden = !i;
    tour.card.querySelector('.t-next').textContent = i === tour.steps.length - 1 ? 'Start drawing' : i ? 'Next' : 'Show me around';
    tour.card.querySelector('.t-skip').hidden = i === tour.steps.length - 1;
    tour.card.querySelectorAll('.t-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    tour.card.classList.toggle('center', !s.at);
    tourPlace();
    body.classList.remove('out', 'back');
  };
  if (first) return fill();
  body.classList.toggle('back', back); body.classList.add('out');
  setTimeout(fill, 150);
}
function tourPlace() {
  if (!tour) return;
  const s = tour.steps[tour.i], W = innerWidth, H = innerHeight, pad = 6, m = 16;
  const r = s.at && tourRect(s.at), sp = tour.spot.style, card = tour.card;
  if (r) Object.assign(sp, { left: r.l - pad + 'px', top: r.t - pad + 'px', width: r.r - r.l + 2 * pad + 'px', height: r.b - r.t + 2 * pad + 'px' });
  else Object.assign(sp, { left: W / 2 + 'px', top: H / 2 + 'px', width: '0px', height: '0px' });
  tour.spot.classList.toggle('none', !r);
  const cw = Math.min(360, W - 2 * m);
  card.style.width = cw + 'px';
  const ch = card.offsetHeight || 260;
  let x, y;
  if (!r) { x = (W - cw) / 2; y = (H - ch) / 2; }
  else {
    x = Math.max(m, Math.min(W - m - cw, (r.l + r.r) / 2 - cw / 2));
    const below = r.b + pad + 14, above = r.t - pad - 14 - ch;
    y = below + ch <= H - m ? below : above >= m ? above : Math.max(m, H - m - ch);
  }
  card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}
function endTour() {
  if (!tour) return;
  try { localStorage.setItem(TOUR_KEY, '1'); } catch (_) {}
  const { el } = tour; tour = null;
  el.classList.remove('on');
  setTimeout(() => el.remove(), 260);
}
document.addEventListener('keydown', (e) => {
  if (!tour) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.key === 'Escape') endTour();
  else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') tour.card.querySelector('.t-next').click();
  else if (e.key === 'ArrowLeft') tourGo(tour.i - 1);
}, true);
window.addEventListener('resize', () => tour && tourPlace());

// ---------- open wire ends: inputs (left side) and outputs (right side) ----------
// Same rule as the matrix: the end whose wire leaves to the right is an input.
const ioCache = new WeakMap();
function ioMap(d) {
  const m = new Map();
  if (!window.ZXS || !d.nodes.length) return m;
  const sig = JSON.stringify([d.nodes.map((n) => [n.id, n.r, n.c, n.t]), d.edges.map((e) => [e.a, e.b, e.o])]);
  const c = ioCache.get(d);
  if (c && c.sig === sig) return c.m;
  let r = ZXS.io(d);
  if (!r) {   // the diagram has no meaning yet: judge single-wire ends by direction only
    r = { ins: [], outs: [] };
    d.nodes.forEach((n) => {
      if (n.t !== 'N' && n.t !== 'P') return;
      const es = d.edges.filter((e) => e.a === n.id || e.b === n.id);
      if (es.length !== 1 || es[0].a === es[0].b) return;
      const o = d.nodes.find((x) => x.id === (es[0].a === n.id ? es[0].b : es[0].a));
      if (o && o.c > n.c) r.ins.push(n.id); else if (o && o.c < n.c) r.outs.push(n.id);
    });
  }
  r.ins.forEach((id, k) => m.set(id, `in ${k + 1}`));
  r.outs.forEach((id, k) => m.set(id, `out ${k + 1}`));
  ioCache.set(d, { sig, m });
  return m;
}

// ---------- diagram facts on hover (the step number) ----------
function diagStats(d) {
  const io = ioMap(d), count = { Z: 0, X: 0, H: 0 };
  let ins = 0, outs = 0, t = 0, nonCl = 0, sym = 0, bad = 0;
  io.forEach((v) => (v[0] === 'i' ? ins++ : outs++));
  let src = d; try { src = ZX.expandMats(d); } catch (_) {}   // matrix arrows count as their spiders
  src.nodes.forEach((n) => {
    if (n.t === 'H') count.H++;
    if (n.t !== 'Z' && n.t !== 'X') return;
    count[n.t]++;
    let p;
    try { p = ZXS.parsePhase(n.label || ''); } catch (_) { bad++; return; }
    if (Object.keys(p.sym).length || p.rad) { sym++; return; }
    const [a, b] = p.pi, g = (x, y) => (y ? g(y, x % y) : Math.abs(x)), q = b / g(a, b);   // reduced denominator of a/b · π
    if (q <= 2) return;           // multiple of π/2: Clifford
    nonCl++;
    if (q === 4) t++;
  });
  count.H += d.edges.filter((e) => ZX.splitOpts(e.o || '').includes('H')).length;
  const kind = bad ? null : sym ? 'Symbolic' : !nonCl ? 'Clifford' : nonCl === t ? 'Clifford + T' : 'General';
  return { ins, outs, count, wires: d.edges.length, t, nonCl, sym, kind };
}
let statEl = null, statT = 0, statFor = null;
function showStat(el, pin) {
  const i = +el.dataset.stat, d = doc.diagrams[i];
  if (!d) return;
  const st = diagStats(d);
  if (!statEl) { statEl = document.createElement('div'); statEl.id = 'statCard'; document.body.appendChild(statEl); }
  const dim = st.ins + st.outs <= 10 ? `${1 << st.outs}×${1 << st.ins} matrix` : 'large matrix';
  const chip = (t, n) => `<span class="sc-sp"><span class="sw ${t}"></span>${n}</span>`;
  statEl.innerHTML = `
    <div class="sc-h"><span class="sc-name" data-ren="${i}" title="Click to rename">${esc(d.name || (doc.single ? 'This diagram' : 'Diagram ' + (i + 1)))}</span>${st.kind ? `<span class="sc-kind k-${st.kind.replace(/\W+/g, '')}">${st.kind}</span>` : ''}</div>
    <div class="sc-io"><span class="sc-n in">${st.ins}</span><span class="sc-arr">→</span><span class="sc-n out">${st.outs}</span><span class="sc-dim">${st.ins === 1 ? 'input' : 'inputs'} → ${st.outs === 1 ? 'output' : 'outputs'} · ${dim}</span></div>
    <div class="sc-row">${chip('Z', st.count.Z)}${chip('X', st.count.X)}${chip('H', st.count.H)}<span class="sc-w">${st.wires} wire${st.wires === 1 ? '' : 's'}</span></div>
    <div class="sc-foot"><span>T-count <b>${st.t}</b></span>${st.nonCl > st.t ? `<span>other non-Clifford <b>${st.nonCl - st.t}</b></span>` : ''}${st.sym ? `<span>symbolic <b>${st.sym}</b></span>` : ''}</div>`;
  const r = el.getBoundingClientRect(), w = statEl.offsetWidth, h = statEl.offsetHeight;
  const below = r.top - h - 10 < 60;
  statEl.style.left = Math.max(8, Math.min(r.left - 10, innerWidth - w - 8)) + 'px';
  statEl.style.top = (below ? r.bottom + 10 : r.top - h - 10) + 'px';
  statEl.style.transformOrigin = `${Math.min(w - 10, Math.max(10, r.left + r.width / 2 - parseFloat(statEl.style.left)))}px ${below ? 'top' : 'bottom'}`;
  statEl.classList.toggle('below', below);
  statEl.classList.toggle('pinned', !!pin);
  statEl.dataset.i = i;
  requestAnimationFrame(() => statEl.classList.add('show'));
}
const nameOf = (i, dc = doc) => (dc.diagrams[i] && dc.diagrams[i].name) || `Diagram ${i + 1}`;
// Click the title of a pinned card to rename the diagram; names are unique within a page.
function renameDiagram(span) {
  const i = +span.dataset.ren, d = doc.diagrams[i];
  if (!d || lockedStop()) return;
  const inp = document.createElement('input');
  inp.className = 'sc-inp'; inp.value = d.name || ''; inp.placeholder = `Diagram ${i + 1}`; inp.spellcheck = false; inp.maxLength = 40;
  const fit = () => { inp.style.width = Math.max(6, (inp.value || inp.placeholder).length + 1) + 'ch'; };
  fit(); inp.addEventListener('input', () => { fit(); inp.classList.remove('dup'); });
  span.replaceWith(inp); inp.focus(); inp.select();
  let done = false;
  const finish = (ok, blur) => {
    if (done) return;
    const v = inp.value.trim().replace(/\s+/g, ' ');
    if (ok && v && v !== (d.name || '')) {
      const clash = doc.diagrams.some((x, j) => j !== i && nameOf(j).toLowerCase() === v.toLowerCase());
      if (clash) {
        toast(`“${v}” is already used on this page`);
        if (blur) ok = false;   // clicked away: keep the old name
        else { inp.classList.remove('dup'); void inp.offsetWidth; inp.classList.add('dup'); inp.focus(); return; }
      }
    }
    done = true;
    if (ok && v !== (d.name || '') && !(v === '' && !d.name)) mutate(() => { if (v && v !== `Diagram ${i + 1}`) d.name = v; else delete d.name; });
    const el = world.querySelector(`.fl[data-stat="${i}"]`);
    if (el && statEl.classList.contains('show')) showStat(el, true);
  };
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') { inp.value = d.name || ''; finish(false); } });
  inp.addEventListener('blur', () => finish(true, true));
}
document.addEventListener('click', (e) => {
  const ren = statEl && statEl.classList.contains('pinned') && e.target.closest('#statCard .sc-name');
  if (ren) return renameDiagram(ren);
  const fl = e.target.closest('.fl[data-stat]');
  if (!fl) return;
  if (statEl && statEl.classList.contains('pinned') && statEl.classList.contains('show') && statEl.dataset.i === fl.dataset.stat) return hideStat();
  clearTimeout(statT); statFor = fl; showStat(fl, true);
});
function hideStat() { clearTimeout(statT); statFor = null; if (statEl) statEl.classList.remove('show', 'pinned'); }
world.addEventListener('pointerover', (e) => {
  const el = e.target.closest('[data-stat]');
  if (!el || el === statFor || drag || e.pointerType === 'touch' || (statEl && statEl.classList.contains('pinned'))) return;
  clearTimeout(statT); statFor = el;
  statT = setTimeout(() => { if (statFor === el && el.isConnected) showStat(el); }, statEl && statEl.classList.contains('show') ? 0 : 160);
});
world.addEventListener('pointerout', (e) => {
  const el = e.target.closest('[data-stat]');
  if (el && !el.contains(e.relatedTarget) && !(statEl && statEl.classList.contains('pinned'))) { clearTimeout(statT); statFor = null; statT = setTimeout(hideStat, 90); }
});
window.addEventListener('pointerdown', (e) => { if (statEl && (statEl.contains(e.target) || e.target.closest('.fl[data-stat]'))) return; hideStat(); }, true);
window.addEventListener('wheel', hideStat, { passive: true });

// ---------- calculation errors on the canvas ----------
let errMark = null;
function errHTML(msg, ids) {
  return `<div class="simerr">${esc(msg)}${ids && ids.length ? ` <button class="linkbtn errgo" data-errgo="${ids.join(',')}">Show on canvas</button>` : ''}</div>`;
}
// circle the nodes (no camera move); edits clear it
function markErr(ids) {
  if (!ids || !ids.length || !ids.some((id) => findNode(id))) return;
  const key = ids.join(',');
  if (errMark && errMark.key === key) return;
  errMark = { ids: new Set(ids), key, born: performance.now() };
  requestAnimationFrame(render);
}
// circle them and glide the camera there
function showErr(ids) {
  const fs = ids.map(findNode).filter(Boolean);
  if (!fs.length) return toast('That part is no longer on the page');
  closeModal(); closePop();
  errMark = { ids: new Set(ids), key: ids.join(','), born: performance.now() };
  const ps = fs.map(({ n, d }) => pos(d, n));
  const cx = (Math.min(...ps.map((p) => p.x)) + Math.max(...ps.map((p) => p.x))) / 2, cy = (Math.min(...ps.map((p) => p.y)) + Math.max(...ps.map((p) => p.y))) / 2;
  const k = Math.max(cam.k, 1);
  activeDi = doc.diagrams.indexOf(fs[0].d);
  flyTo({ k, x: innerWidth / 2 - cx * k, y: innerHeight / 2 - cy * k }, 520);
  render();
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-errgo]'); if (b) { e.stopPropagation(); showErr(b.dataset.errgo.split(',')); } });

// ---------- presentation: the page as slides, one diagram each, with morphing between steps ----------
// Nodes are matched across consecutive diagrams (wire ends by input/output number, others by type and
// nearest place); matched ones glide, a node that disappears slides into the nearest one of its kind
// (fusion), new ones grow out of the nearest one (or fade in). Wires follow their ends.
let show = null;
const SHOW_MS = 720;
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function slideList() { return doc.diagrams.map((d, i) => i).filter((i) => doc.diagrams[i].nodes.length); }
// positions relative to the diagram's centre, and the scale that fits it on screen
function slideGeo(d, wf = 0.82, hf = 0.66) {
  const ps = new Map(d.nodes.map((n) => [n.id, pos(d, n)]));
  const xs = [...ps.values()].map((p) => p.x), ys = [...ps.values()].map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  ps.forEach((p, k) => ps.set(k, { x: p.x - cx, y: p.y - cy }));
  const w = Math.max(...xs) - Math.min(...xs) + CW * 2, h = Math.max(...ys) - Math.min(...ys) + CH * 2;
  const k = Math.max(0.3, Math.min(2.4, (innerWidth * wf) / w, (innerHeight * hf) / h));
  return { ps, k };
}
function matchNodes(A, B, gA, gB) {
  const m = new Map(), used = new Set();
  const ioA = ioMap(A), ioB = ioMap(B), byIo = new Map();
  B.nodes.forEach((n) => { const t = ioB.get(n.id); if (t) byIo.set(t, n); });
  A.nodes.forEach((n) => { const t = ioA.get(n.id), b = t && byIo.get(t); if (b && !used.has(b.id)) { m.set(n.id, b.id); used.add(b.id); } });
  const pairs = [];
  A.nodes.forEach((a) => { if (m.has(a.id)) return; B.nodes.forEach((b) => { if (used.has(b.id) || a.t !== b.t) return; const p = gA.ps.get(a.id), q = gB.ps.get(b.id); pairs.push([Math.hypot(p.x - q.x, p.y - q.y) + (a.label === b.label ? 0 : CW * 0.3), a, b]); }); });
  pairs.sort((x, y) => x[0] - y[0]);
  pairs.forEach(([dd, a, b]) => { if (dd > CW * 3.2 || m.has(a.id) || used.has(b.id)) return; m.set(a.id, b.id); used.add(b.id); });
  return m;
}
function nearestOfType(n, p, list, ps) {
  let best = null, bd = CW * 3.2;
  list.forEach((x) => { if (x.t !== n.t) return; const q = ps.get(x.id), dd = Math.hypot(p.x - q.x, p.y - q.y); if (dd < bd) { bd = dd; best = x; } });
  return best;
}
// draw a slide, or the morph from slide `from` to slide `to` at progress t (0…1)
function drawShow(from, to, t) {
  if (show.pair) return drawPair(from, to, t);
  const stage = show.el.querySelector('.show-stage');
  const B = doc.diagrams[show.list[to]], gB = slideGeo(B);
  const W = innerWidth / 2, H = innerHeight / 2 + 18;
  const S = [], N = [];
  const wire = (dd, e, A0, B0, P, op) => { const g = rawGeom(dd, e, A0, B0, P); S.push(`<path d="${g.d}" class="show-wire" style="opacity:${op.toFixed(3)}"/>`); if (g.h) S.push(`<rect class="show-h" x="${g.m.x - 7}" y="${g.m.y - 7}" width="14" height="14" style="opacity:${op.toFixed(3)}"/>`); };
  let k = gB.k;
  if (from == null || from === to || t >= 1) {
    const P = (dd, n) => gB.ps.get(n.id);
    const byId = new Map(B.nodes.map((n) => [n.id, n]));
    B.edges.forEach((e) => { const a = byId.get(e.a), b = byId.get(e.b); if (a && b) wire(B, e, a, b, P, 1); });
    B.nodes.forEach((n) => N.push(nodeHTML(n, gB.ps.get(n.id), false)));
  } else {
    const A = doc.diagrams[show.list[from]], gA = slideGeo(A), e = easeIO(t);
    k = gA.k + (gB.k - gA.k) * e;
    const m = matchNodes(A, B, gA, gB), back = new Map([...m].map(([a, b]) => [b, a]));
    const lerp = (p, q) => ({ x: p.x + (q.x - p.x) * e, y: p.y + (q.y - p.y) * e });
    const posA = new Map(), posB = new Map();
    A.nodes.forEach((n) => {   // where every old node is at time t
      const p = gA.ps.get(n.id);
      if (m.has(n.id)) posA.set(n.id, lerp(p, gB.ps.get(m.get(n.id))));
      else { const tgt = nearestOfType(n, p, B.nodes, gB.ps); posA.set(n.id, tgt ? lerp(p, gB.ps.get(tgt.id)) : p); }
    });
    B.nodes.forEach((n) => {   // and every new one
      const q = gB.ps.get(n.id);
      if (back.has(n.id)) posB.set(n.id, posA.get(back.get(n.id)));
      else { const src = nearestOfType(n, q, A.nodes, gA.ps); posB.set(n.id, src ? lerp(gA.ps.get(src.id), q) : q); }
    });
    // wires: kept ones stay solid, old ones fade out, new ones fade in — all following their ends
    const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
    const oldPairs = new Set(A.edges.map((x) => key(x.a, x.b)));
    const byA = new Map(A.nodes.map((n) => [n.id, n])), byB = new Map(B.nodes.map((n) => [n.id, n]));
    const kept = new Set();
    B.edges.forEach((x) => { const a = back.get(x.a), b = back.get(x.b); if (a && b && oldPairs.has(key(a, b))) kept.add(key(a, b)); });
    A.edges.forEach((x) => { const a = byA.get(x.a), b = byA.get(x.b); if (a && b && !kept.has(key(x.a, x.b))) wire(A, x, a, b, (dd, n) => posA.get(n.id), 1 - e); });
    B.edges.forEach((x) => { const a = byB.get(x.a), b = byB.get(x.b); if (!a || !b) return; const ka = back.get(x.a), kb = back.get(x.b); const keep = ka && kb && kept.has(key(ka, kb)); wire(B, x, a, b, (dd, n) => posB.get(n.id), keep ? 1 : e); });
    A.nodes.forEach((n) => { if (m.has(n.id)) return; const s = Math.max(0.001, 1 - e); N.push(nodeHTML(n, Object.assign({ s }, posA.get(n.id)), false)); });
    B.nodes.forEach((n) => {
      const p = posB.get(n.id);
      if (back.has(n.id)) { const a = byA.get(back.get(n.id)); N.push(nodeHTML(e < 0.5 && a ? a : n, p, false)); }
      else N.push(nodeHTML(n, Object.assign({ s: Math.max(0.001, e) }, p), false));
    });
  }
  stage.innerHTML = `<div class="show-world" style="transform:translate(${W}px,${H}px) scale(${k.toFixed(4)})"><svg class="show-svg" overflow="visible" width="1" height="1">${S.join('')}</svg>${N.join('')}</div>`;
}
// ---- two-up mode: from the second slide on, the previous diagram (left), the relation, and the current one (right).
// Stepping forward slides the old one out to the left, the current one over, and the next one in from the right.
function pairLayout(i) {
  const W = innerWidth, items = [];
  const one = (j, x, wf) => { const d = doc.diagrams[show.list[j]], g = slideGeo(d, wf, 0.6); items.push({ key: 'd' + j, j, x, k: g.k, g }); };
  if (i === 0) one(0, W / 2, 0.82);
  else {
    one(i - 1, W * 0.27, 0.38); one(i, W * 0.73, 0.38);
    const a = show.list[i - 1], b = show.list[i];
    items.push({ key: 'r' + i, rel: b === a + 1 ? sepOf(a) || '=' : '\\cdots', x: W / 2 });
  }
  return items;
}
function pairItemHTML(it, y, op, dx = 0) {
  if (it.rel != null) return `<div class="show-prel" style="left:${(it.x + dx).toFixed(1)}px;top:${y}px;opacity:${op.toFixed(3)}">${tex(it.rel)}</div>`;
  const d = doc.diagrams[show.list[it.j]], P = (dd, n) => it.g.ps.get(n.id), S = [], N = [];
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  d.edges.forEach((e) => { const a = byId.get(e.a), b = byId.get(e.b); if (!a || !b) return; const g = rawGeom(d, e, a, b, P); S.push(`<path d="${g.d}" class="show-wire"/>`); if (g.h) S.push(`<rect class="show-h" x="${g.m.x - 7}" y="${g.m.y - 7}" width="14" height="14"/>`); });
  d.nodes.forEach((n) => N.push(nodeHTML(n, it.g.ps.get(n.id), false)));
  return `<div class="show-world" style="transform:translate(${(it.x + dx).toFixed(1)}px,${y}px) scale(${it.k.toFixed(4)});opacity:${op.toFixed(3)}"><svg class="show-svg" overflow="visible" width="1" height="1">${S.join('')}</svg>${N.join('')}</div>`;
}
function drawPair(from, to, t) {
  const stage = show.el.querySelector('.show-stage'), y = innerHeight / 2 + 18, W = innerWidth;
  const B = pairLayout(to);
  if (from == null || from === to || t >= 1) { stage.innerHTML = B.map((it) => pairItemHTML(it, y, 1)).join(''); return; }
  const A = pairLayout(from), e = easeIO(t), dir = to > from ? 1 : -1, out = [];
  const inA = new Map(A.map((it) => [it.key, it])), inB = new Map(B.map((it) => [it.key, it]));
  // kept: glide (and rescale) to the new place; leaving: slide out the way we came; arriving: slide in from the other side
  B.forEach((b) => {
    const a = inA.get(b.key);
    if (a) out.push(pairItemHTML(Object.assign({}, b, { x: a.x + (b.x - a.x) * e, k: a.k != null ? a.k + (b.k - a.k) * e : b.k }), y, 1));
    else out.push(pairItemHTML(b, y, Math.min(1, e * 1.4), dir * W * 0.32 * (1 - e)));
  });
  A.forEach((a) => { if (!inB.has(a.key)) out.push(pairItemHTML(a, y, Math.max(0, 1 - e * 1.5), -dir * W * 0.32 * e)); });
  stage.innerHTML = out.join('');
}
function setShowPair(on) {
  show.pair = on;
  try { localStorage.setItem('zx-draw-show-pair', on ? '1' : ''); } catch (_) {}
  show.el.classList.toggle('pair', on);
  const b = show.el.querySelector('[data-sh="pair"]');
  if (b) { b.classList.toggle('on', on); b.title = on ? 'Two diagrams per slide: on (T)' : 'Two diagrams per slide: off (T)'; }
  const st = show.el.querySelector('.show-stage');
  st.classList.remove('swap'); void st.offsetWidth; st.classList.add('swap');
  cancelAnimationFrame(show.raf); show.anim = null;
  drawShow(null, show.i, 1); showCaption(show.i);
}
function showCaption(i) {
  const cap = show.el.querySelector('.show-cap'), j = show.list[i], prev = i > 0 ? show.list[i - 1] : null;
  const rel = prev != null && prev === j - 1 ? sepOf(prev) : '';
  cap.classList.remove('in'); void cap.offsetWidth;
  cap.innerHTML = show.pair
    ? `<span class="show-name">${i > 0 ? `${esc(nameOf(show.list[i - 1]))}<span class="show-arrow">→</span>${esc(nameOf(j))}` : esc(nameOf(j))}</span>`
    : `${rel ? `<span class="show-rel">${tex(rel)}</span>` : ''}<span class="show-name">${esc(nameOf(j))}</span>`;
  cap.classList.add('in');
  show.el.querySelector('.show-count').textContent = `${i + 1} / ${show.list.length}`;
  show.el.querySelectorAll('.show-dot').forEach((b, k) => b.classList.toggle('on', k === i));
}
function goShow(i) {
  if (!show) return;
  i = Math.max(0, Math.min(show.list.length - 1, i));
  if (i === show.i && !show.anim) return;
  const from = show.anim ? show.anim.to : show.i;
  cancelAnimationFrame(show.raf);
  show.i = i;
  showCaption(i);
  // jumping several slides at once: morph straight from the current one
  const t0 = performance.now(), dur = Math.abs(i - from) > 1 ? SHOW_MS * 1.15 : SHOW_MS;
  show.anim = { from, to: i };
  const tick = () => {
    const t = Math.min(1, (performance.now() - t0) / dur);
    drawShow(from, i, t);
    if (t < 1) show.raf = requestAnimationFrame(tick); else show.anim = null;
  };
  tick();
}
function showIdle() {
  if (!show) return;
  show.el.classList.remove('idle');
  clearTimeout(show.idleT);
  show.idleT = setTimeout(() => show && show.el.classList.add('idle'), 2200);
}
function startShow() {
  const list = slideList();
  if (!list.length) return toast('Nothing to present on this page');
  if (show) return;
  closePop(); closeModal(); hideStat();
  const el = document.createElement('div');
  el.id = 'show';
  el.innerHTML = `<div class="show-stage"></div>
    <div class="show-cap"></div>
    <div class="show-bar">
      <button class="show-btn" data-sh="prev" title="Previous (←)">${I.chevL}</button>
      <div class="show-dots">${list.map((j, k) => `<button class="show-dot" data-sh="${k}" title="${esc(nameOf(j))}"></button>`).join('')}</div>
      <button class="show-btn" data-sh="next" title="Next (→ / Space)">${I.chevR}</button>
      <span class="show-count"></span>
      <span class="show-sep"></span>
      <button class="show-btn show-pairbtn" data-sh="pair" title="Two diagrams per slide (T)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="6.5" width="7.5" height="11" rx="1.6"/><rect x="13.5" y="6.5" width="7.5" height="11" rx="1.6"/></svg></button>
      <button class="show-btn" data-sh="exit" title="Exit (Esc)">${I.close}</button>
    </div>`;
  document.body.appendChild(el);
  const start = Math.max(0, list.indexOf(activeDi));
  let pair = false;
  try { pair = localStorage.getItem('zx-draw-show-pair') === '1'; } catch (_) {}
  show = { el, list, i: start, anim: null, raf: 0, idleT: 0, pair };
  el.classList.toggle('pair', pair);
  const pb = el.querySelector('[data-sh="pair"]'); if (pb) pb.classList.toggle('on', pair);
  drawShow(null, start, 1); showCaption(start);
  requestAnimationFrame(() => el.classList.add('open'));
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  showIdle();
  el.addEventListener('pointermove', showIdle);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sh]');
    if (!b) return goShow(show.i + (e.clientX < innerWidth * 0.3 ? -1 : 1));   // click the slide: next (left third: back)
    const v = b.dataset.sh;
    if (v === 'prev') goShow(show.i - 1); else if (v === 'next') goShow(show.i + 1); else if (v === 'exit') endShow(); else if (v === 'pair') setShowPair(!show.pair); else goShow(+v);
  });
}
function endShow() {
  if (!show) return;
  const s = show; show = null;
  cancelAnimationFrame(s.raf); clearTimeout(s.idleT);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  activeDi = s.list[s.i];
  s.el.classList.remove('open');
  setTimeout(() => s.el.remove(), 260);
  render();
}
document.addEventListener('fullscreenchange', () => { if (show && !document.fullscreenElement && show.wasFull) endShow(); if (show && document.fullscreenElement) show.wasFull = true; });
document.addEventListener('keydown', (e) => {
  if (!show) return;
  const k = e.key;
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) goShow(show.i + 1);
  else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) goShow(show.i - 1);
  else if (k === 'Home') goShow(0);
  else if (k === 'End') goShow(show.list.length - 1);
  else if (k === 'Escape') endShow();
  else if (k === 't' || k === 'T') setShowPair(!show.pair);
  else return;
  e.preventDefault(); e.stopImmediatePropagation(); showIdle();
}, true);
window.addEventListener('resize', () => { if (show && !show.anim) drawShow(null, show.i, 1); });
$('#btnPlay').innerHTML = I.play;
$('#btnPlay').onclick = (e) => { e.currentTarget.blur(); startShow(); };

// ---------- page lock: look, pan and zoom only ----------
const LOCKED = { locked: true };
window.addEventListener('error', (e) => { if (e.error === LOCKED) e.preventDefault(); });
window.addEventListener('unhandledrejection', (e) => { if (e.reason === LOCKED) e.preventDefault(); });
const isLocked = () => !!(curTab() && curTab().locked);
let lockToastAt = 0;
function lockedNote() {
  const b = $('#btnLock');
  if (b) { b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); }
  if (Date.now() - lockToastAt > 1500) { lockToastAt = Date.now(); toast('This page is locked — unlock it to edit (K)'); }
}
function lockedStop() { if (!isLocked()) return false; lockedNote(); return true; }
function syncLock() {
  const on = isLocked(), b = document.getElementById('btnLock');
  document.body.classList.toggle('pg-locked', on);
  if (b) { b.classList.toggle('on', on); b.title = on ? 'Page locked: look and zoom only — click to unlock (K)' : 'Lock this page (K)'; }
}
function toggleLock() {
  const t = curTab(); if (!t) return;
  t.locked = !t.locked;
  if (t.locked) { sel.clear(); inspOpen = false; wirePend = null; closePop(); hideSuggest(); }
  save(); drawTabs(); render();
  toast(t.locked ? `“${t.name}” locked — look and zoom only` : `“${t.name}” unlocked`);
}
$('#btnLock').innerHTML = I.lock;
$('#btnLock').onclick = (e) => { e.currentTarget.blur(); toggleLock(); };

// ---------- single-graph page: one diagram, no step numbers, no relations ----------
function syncSingle() {
  const singleBtn = document.getElementById('btnSingle');
  if (!singleBtn) return;
  const on = !!doc.single;
  singleBtn.classList.toggle('on', on);
  singleBtn.setAttribute('aria-checked', on ? 'true' : 'false');
  singleBtn.title = on ? 'Single graph: on — this page holds one diagram (click to allow steps)' : 'Single graph: off — this page is a chain of steps 1, 2, 3 … (click for one diagram)';
}
function singleBlocked() {
  const singleBtn = $('#btnSingle');
  toast('Single-graph page — turn the switch off to add steps');
  singleBtn.classList.remove('nudge'); void singleBtn.offsetWidth; singleBtn.classList.add('nudge');
}
// put every diagram side by side in the first one (rows aligned at the top)
function mergeDiagrams() {
  const [A, ...rest] = doc.diagrams;
  const minR = (d) => Math.min(...d.nodes.map((n) => n.r)), minC = (d) => Math.min(...d.nodes.map((n) => n.c));
  const top = A.nodes.length ? minR(A) : 0;
  let right = A.nodes.length ? Math.max(...A.nodes.map((n) => n.c)) : -2;
  rest.forEach((d) => {
    if (!d.nodes.length) return;
    const dc = right + 2 - minC(d), dr = top - minR(d);
    d.nodes.forEach((n) => { n.r += dr; n.c += dc; A.nodes.push(n); });
    A.edges.push(...d.edges);
    right = Math.max(...A.nodes.map((n) => n.c));
  });
  doc.diagrams = [A]; doc.seps = []; A.br = false;
}
function toggleSingle() {
  const on = !doc.single, many = doc.diagrams.length > 1;
  world.classList.toggle('single', on);   // fade the step chrome first
  animate(() => {
    snapshot();
    if (on && many) mergeDiagrams();
    doc.single = on;
    activeDi = 0;
    tidy();
  }, on && many ? 420 : 240);
  if (on && many) toast('Merged into one diagram — ⌘Z to undo');
  else toast(on ? 'Single graph' : 'Steps on: add diagrams with +');
}
// turning it on with several diagrams asks first (they get merged)
function confirmSingle() {
  if (lockedStop()) return;
  const btn = $('#btnSingle'), n = doc.diagrams.length;
  if (doc.single || n < 2) return toggleSingle();
  closeCtx();
  const el = document.createElement('div');
  el.className = 'ctx cfm';
  el.innerHTML = `<div class="cfm-t">Merge ${n} diagrams into one?</div>
    <div class="cfm-d">This page has ${n} diagrams. They will be placed side by side in one graph, and the relations between them (=, ∝ …) are removed. ⌘Z undoes it.</div>
    <div class="cfm-b"><button class="btn sm ghost" data-c="0">Cancel</button><button class="btn sm primary" data-c="1">Merge</button></div>`;
  document.body.appendChild(el);
  const r = btn.getBoundingClientRect(), w = el.offsetWidth;
  el.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
  el.style.top = r.bottom + 8 + 'px';
  el.style.transformOrigin = 'right top';
  requestAnimationFrame(() => el.classList.add('show'));
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; closeCtx(); if (b.dataset.c === '1') toggleSingle(); });
  ctxEl = el;
  el.querySelector('[data-c="1"]').focus();
}
$('#btnSingle').onclick = (e) => { e.currentTarget.blur(); confirmSingle(); };

// ---------- movable dock: drag the grip to the bottom, left or right edge ----------
const DOCK_KEY = 'zx-draw-dock-v1';
const dockEl = $('#dock');
let dockSide = 'bottom', dockDrag = null;
try { const v = localStorage.getItem(DOCK_KEY); if (v === 'left' || v === 'right') dockSide = v; } catch (_) {}
const dockPhone = () => matchMedia('(max-width: 640px)').matches;
const dockEase = 'cubic-bezier(.22,1,.36,1)';
function dockClass(side) { dockEl.classList.toggle('side', !!side && side !== 'bottom'); if (side) dockEl.dataset.side = side; else delete dockEl.dataset.side; }
// where the dock sits on `side` (its size depends on the orientation)
function dockRect(side) {
  const was = dockEl.dataset.side;
  dockClass(side);
  const w = dockEl.offsetWidth, h = dockEl.offsetHeight, W = innerWidth, H = innerHeight, m = 16;
  dockClass(was);
  if (side === 'left') return { x: m, y: Math.max(64, (H - h) / 2), w, h };
  if (side === 'right') return { x: W - m - w, y: Math.max(64, (H - h) / 2), w, h };
  return { x: (W - w) / 2, y: H - m - h, w, h };
}
function placeDock() {
  if (dockPhone()) { dockClass(null); dockEl.style.left = dockEl.style.top = ''; return; }
  const r = dockRect(dockSide);
  dockClass(dockSide);
  dockEl.style.left = r.x + 'px'; dockEl.style.top = r.y + 'px';
}
// FLIP: the frame glides and reshapes, every button slides from its old spot to the new one
function setDockSide(side) {
  const parts = [...dockEl.children].filter((c) => !c.classList.contains('pill'));
  const b0 = dockEl.getBoundingClientRect(), o0 = parts.map((c) => [c.offsetLeft, c.offsetTop]);
  dockSide = side;
  try { localStorage.setItem(DOCK_KEY, side); } catch (_) {}
  placeDock();
  syncPill(dockEl);
  const b1 = dockEl.getBoundingClientRect(), o1 = parts.map((c) => [c.offsetLeft, c.offsetTop]), opt = { duration: 460, easing: dockEase };
  dockEl.animate([{ left: b0.left + 'px', top: b0.top + 'px', width: b0.width + 'px', height: b0.height + 'px' },
    { left: b1.left + 'px', top: b1.top + 'px', width: b1.width + 'px', height: b1.height + 'px' }], opt);
  parts.forEach((c, i) => {
    const dx = o0[i][0] - o1[i][0], dy = o0[i][1] - o1[i][1];
    if (dx || dy) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { ...opt, delay: i * 12 });
  });
}
let dockHint = null;
function dockTarget(x) { const W = innerWidth; return x < W * 0.25 ? 'left' : x > W * 0.75 ? 'right' : 'bottom'; }
function showHint(side) {
  if (!dockHint) { dockHint = document.createElement('div'); dockHint.id = 'dockHint'; document.body.appendChild(dockHint); }
  const r = dockDrag.rects[side];
  Object.assign(dockHint.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  dockHint.classList.add('show');
}
dockEl.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.dock-grip') || e.button !== 0 || dockPhone()) return;
  e.preventDefault(); e.stopPropagation();
  const r = dockEl.getBoundingClientRect();
  dockDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moved: false, side: dockSide,
    rects: { bottom: dockRect('bottom'), left: dockRect('left'), right: dockRect('right') } };
  try { dockEl.setPointerCapture(e.pointerId); } catch (_) {}
});
dockEl.addEventListener('pointermove', (e) => {
  const D = dockDrag;
  if (!D) return;
  if (!D.moved && Math.hypot(e.clientX - D.x0, e.clientY - D.y0) < 4) return;
  if (!D.moved) { D.moved = true; dockEl.classList.add('dragging'); }
  dockEl.style.left = e.clientX - D.dx + 'px'; dockEl.style.top = e.clientY - D.dy + 'px';
  D.side = dockTarget(e.clientX);
  showHint(D.side);
});
const dockUp = () => {
  const D = dockDrag;
  if (!D) return;
  dockDrag = null;
  dockEl.classList.remove('dragging');
  if (dockHint) dockHint.classList.remove('show');
  if (D.moved) setDockSide(D.side);
};
dockEl.addEventListener('pointerup', dockUp);
dockEl.addEventListener('pointercancel', dockUp);
dockEl.addEventListener('dblclick', (e) => { if (e.target.closest('.dock-grip') && !dockPhone()) setDockSide(dockSide === 'bottom' ? 'left' : dockSide === 'left' ? 'right' : 'bottom'); });
window.addEventListener('resize', () => { if (!dockDrag) { placeDock(); syncPill(dockEl); } });

// ---------- what box-select picks (click V again, or right-click it) ----------
const PICK_KEY = 'zx-draw-pick-v1';
const PICKS = [['Z', 'Z spiders', '<span class="sw Z"></span>'], ['X', 'X spiders', '<span class="sw X"></span>'], ['H', 'H boxes', '<span class="sw H"></span>'],
  ['pt', 'Wire points & dots', '<span class="sw N"></span>'], ['T', 'Text cells', '<span class="pk-t">⋮</span>'], ['M', 'Matrix arrows', '<span class="pk-m"></span>'], ['wire', 'Wires', '<span class="pk-w"></span>']];
const pickKind = (t) => (t === 'N' || t === 'P' ? 'pt' : t);
let selPick = {};
try { selPick = JSON.parse(localStorage.getItem(PICK_KEY) || '{}') || {}; } catch (_) {}
let pickEl = null;
const pickAll = () => PICKS.every(([k]) => selPick[k] !== false);
function syncPickDot() { const vb = document.querySelector('.tool[data-tool="select"]'); if (vb) vb.classList.toggle('filt', !pickAll()); }
function closePickPop() { if (!pickEl) return; const el = pickEl; pickEl = null; el.classList.remove('show'); setTimeout(() => el.remove(), 180); }
function togglePickPop(b) { pickEl ? closePickPop() : openPickPop(b); }
function openPickPop(b) {
  closePickPop(); closeCtx();
  const el = document.createElement('div');
  el.className = 'pickpop';
  const draw = () => {
    el.innerHTML = `<div class="pk-head"><span>Box select picks</span><button class="pk-all"${pickAll() ? ' disabled' : ''}>All</button></div>`
      + PICKS.map(([k, l, ic]) => `<label class="pk-row"><span class="pk-ic">${ic}</span><span class="pk-l">${l}</span><button class="pk-only" data-only="${k}" title="Only ${l.toLowerCase()}">Only</button><input type="checkbox" data-k="${k}"${selPick[k] !== false ? ' checked' : ''}></label>`).join('');
  };
  draw();
  el.addEventListener('change', (e) => {
    const k = e.target.dataset.k; if (!k) return;
    if (e.target.checked) delete selPick[k]; else selPick[k] = false;
    if (PICKS.every(([q]) => selPick[q] === false)) { delete selPick[k]; e.target.checked = true; toast('Keep at least one'); }
    try { localStorage.setItem(PICK_KEY, JSON.stringify(selPick)); } catch (_) {}
    el.querySelector('.pk-all').disabled = pickAll(); syncPickDot();
  });
  // set the switches one after another so the change runs down the list
  const flip = (want) => {
    try { Object.keys(selPick).length ? localStorage.setItem(PICK_KEY, JSON.stringify(selPick)) : localStorage.removeItem(PICK_KEY); } catch (_) {}
    let t = 0;
    el.querySelectorAll('input[data-k]').forEach((i) => { const on = want(i.dataset.k); if (i.checked !== on) { setTimeout(() => { i.checked = on; }, t); t += 35; } });
    el.querySelector('.pk-all').disabled = pickAll(); syncPickDot();
  };
  el.addEventListener('click', (e) => {
    const only = e.target.closest('.pk-only');
    if (only) {
      e.preventDefault(); e.stopPropagation();
      const k = only.dataset.only;
      selPick = {}; PICKS.forEach(([q]) => { if (q !== k) selPick[q] = false; });
      only.classList.remove('pop'); void only.offsetWidth; only.classList.add('pop');
      return flip((q) => q === k);
    }
    if (!e.target.closest('.pk-all')) return;
    selPick = {};
    flip(() => true);
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  document.body.appendChild(el);
  // pops out of the button: up from a bottom dock, sideways from a side dock
  const r = b.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, side = dockPhone() ? 'bottom' : dockSide, gap = 10;
  let x, y;
  if (side === 'left') { x = r.right + gap; y = r.top + r.height / 2 - h / 2; }
  else if (side === 'right') { x = r.left - gap - w; y = r.top + r.height / 2 - h / 2; }
  else { x = r.left + r.width / 2 - w / 2; y = r.top - gap - h; }
  x = Math.max(8, Math.min(innerWidth - w - 8, x)); y = Math.max(8, Math.min(innerHeight - h - 8, y));
  Object.assign(el.style, { left: x + 'px', top: y + 'px', transformOrigin: `${r.left + r.width / 2 - x}px ${r.top + r.height / 2 - y}px` });
  el.dataset.side = side;
  requestAnimationFrame(() => el.classList.add('show'));
  pickEl = el;
}
document.addEventListener('pointerdown', (e) => { if (pickEl && !pickEl.contains(e.target) && !e.target.closest('.tool[data-tool="select"]')) closePickPop(); }, true);
document.addEventListener('keydown', (e) => { if (pickEl && e.key === 'Escape') { e.stopImmediatePropagation(); closePickPop(); } }, true);
window.addEventListener('resize', closePickPop);
syncPickDot();

// ---------- page tab menu (right-click / long-press) ----------
let ctxEl = null;
function closeCtx() { if (!ctxEl) return; const el = ctxEl; ctxEl = null; el.classList.remove('show'); setTimeout(() => el.remove(), 160); }
function openCtx(x, y, items) {
  closeCtx();
  const el = document.createElement('div');
  el.className = 'ctx';
  el.innerHTML = items.map((it, k) => it === '-' ? '<div class="ctx-sep"></div>'
    : `<button class="ctx-i${it.danger ? ' danger' : ''}" data-k="${k}"${it.disabled ? ' disabled' : ''}><span>${esc(it.label)}</span>${it.key ? `<kbd>${esc(it.key)}</kbd>` : ''}</button>`).join('');
  document.body.appendChild(el);
  const W = innerWidth, H = innerHeight, w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = Math.min(x, W - w - 8) + 'px'; el.style.top = (y + h > H - 8 ? Math.max(8, y - h) : y) + 'px';
  el.style.transformOrigin = `${x < W - w - 8 ? 'left' : 'right'} ${y + h > H - 8 ? 'bottom' : 'top'}`;
  requestAnimationFrame(() => el.classList.add('show'));
  el.addEventListener('click', (e) => {
    const b = e.target.closest('.ctx-i'); if (!b || b.disabled) return;
    const it = items[+b.dataset.k];
    // risky items ask for a second click (the label turns into the question)
    if (it.confirm && !b.classList.contains('arm')) { b.classList.add('arm'); b.querySelector('span').textContent = it.confirm; return; }
    closeCtx(); it.run();
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  ctxEl = el;
}
document.addEventListener('pointerdown', (e) => { if (ctxEl && !ctxEl.contains(e.target)) closeCtx(); }, true);
document.addEventListener('keydown', (e) => { if (ctxEl && e.key === 'Escape') { e.stopImmediatePropagation(); closeCtx(); } }, true);
window.addEventListener('blur', closeCtx);
const tabDocOf = (i) => (i === ws.active ? doc : ws.tabs[i].doc);
function dupTab(i) {
  stashTab();
  const t = ws.tabs[i], base = t.name.replace(/ copy( \d+)?$/, '');
  let name = base + ' copy', n = 2;
  while (ws.tabs.some((x) => x.name === name)) name = `${base} copy ${n++}`;
  const c = makeTab(name, JSON.parse(JSON.stringify(t.doc)));
  c.cam = t.cam ? { ...t.cam } : null;
  ws.tabs.splice(i + 1, 0, c); ws.active = i + 1;
  loadTab();
  toast(`Duplicated “${t.name}”`);
}
function moveTab(i, j) {
  if (j < 0 || j >= ws.tabs.length) return;
  const act = ws.tabs[ws.active];
  const [t] = ws.tabs.splice(i, 1); ws.tabs.splice(j, 0, t);
  ws.active = ws.tabs.indexOf(act); save(); drawTabs();
}
function closeOthers(i) {
  const keep = ws.tabs[i];
  stashTab();
  const gone = ws.tabs.filter((t) => t !== keep && !t.locked);   // locked pages stay
  gone.forEach((t) => tabHist.delete(t.id));
  const n = gone.length;
  ws.tabs = ws.tabs.filter((t) => !gone.includes(t)); ws.active = ws.tabs.indexOf(keep); loadTab();
  toast(`Deleted ${n} other page${n === 1 ? '' : 's'}`);
}
async function copyTabTex(i) {
  const d = tabDocOf(i);
  if (!d.diagrams.length) return toast('This page is empty');
  const t = ZX.docTex(d, { starts: lineStarts(d) });
  try { await navigator.clipboard.writeText(t); toast('LaTeX copied'); } catch (_) { toast('Could not copy'); }
}
function clearTab(i) {
  if (i !== ws.active) switchTab(i);
  if (lockedStop()) return;
  if (!doc.diagrams.length) return;
  animate(() => { snapshot(); doc.diagrams = []; doc.seps = []; sel.clear(); }, 220);
  toast('Page cleared — ⌘Z to undo');
}
function tabMenu(i, x, y) {
  const many = ws.tabs.length > 1, empty = !tabDocOf(i).diagrams.some((d) => d.nodes.length);
  openCtx(x, y, [
    { label: 'Rename', run: () => { if (i !== ws.active) switchTab(i); requestAnimationFrame(() => renameTab(ws.active)); } },
    { label: 'Duplicate', run: () => dupTab(i) },
    { label: 'Copy as LaTeX', disabled: empty, run: () => copyTabTex(i) },
    { label: tabDocOf(i).single ? 'Allow steps (1, 2, 3 …)' : 'Make single graph', run: () => { if (i !== ws.active) switchTab(i); requestAnimationFrame(confirmSingle); } },
    { label: ws.tabs[i].locked ? 'Unlock page' : 'Lock page', key: 'K', run: () => { if (i !== ws.active) switchTab(i); toggleLock(); } },
    { label: 'New page', key: 'Alt+N', run: () => { if (i !== ws.active) switchTab(i); addTab(); } },
    '-',
    { label: 'Move left', disabled: i === 0, run: () => moveTab(i, i - 1) },
    { label: 'Move right', disabled: i === ws.tabs.length - 1, run: () => moveTab(i, i + 1) },
    '-',
    { label: 'Clear page', disabled: empty, run: () => clearTab(i) },
    { label: 'Delete other pages', disabled: !many, confirm: ws.tabs.some((t, k) => k !== i && tabHasWork(t)) ? 'Click again to delete others' : null, run: () => closeOthers(i) },
    { label: 'Delete page', danger: true, disabled: !many, confirm: empty ? null : 'Click again to delete', run: () => closeTab(i) },
  ]);
}
tabsEl.addEventListener('contextmenu', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab || e.target.closest('.tren')) return;
  e.preventDefault();
  tabMenu(+tab.dataset.tab, e.clientX, e.clientY);
});
// long-press on touch opens the same menu
let tabLp = null;
tabsEl.addEventListener('pointerdown', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab || e.pointerType !== 'touch') return;
  const x = e.clientX, y = e.clientY, i = +tab.dataset.tab;
  tabLp = setTimeout(() => { tabLp = null; tabDrag = null; tabMenu(i, x, y); }, 500);
});
['pointerup', 'pointercancel', 'pointermove'].forEach((ev) => tabsEl.addEventListener(ev, (e) => { if (tabLp && (ev !== 'pointermove' || (tabDrag && tabDrag.moved))) { clearTimeout(tabLp); tabLp = null; } }));

// ---------- boot ----------
loadKeys();
initChrome();
updateKbd();
placeDock();
setTool('select');
setMinimap(mmCollapsed);
let loaded = false, rescued = false;
{
  let raw = null;
  try { raw = localStorage.getItem(WS_KEY); } catch (_) {}
  try {
    const w = JSON.parse(raw || 'null');
    if (w && Array.isArray(w.tabs) && w.tabs.length) {
      const bad = w.tabs.some((t) => !t || !t.doc || !Array.isArray(t.doc.diagrams));
      if (bad) { pushBackup(raw, 'partly unreadable'); rescued = true; }   // keep the original before cleaning it up
      ws = { tabs: w.tabs.filter(Boolean).map((t) => Object.assign(makeTab(t.name, t.doc), { cam: t.cam || null, locked: !!t.locked })), active: Math.min(w.active | 0, w.tabs.length - 1) };
      loaded = ws.tabs.length > 0;
    } else if (raw && raw !== 'null') { pushBackup(raw, 'unreadable'); rescued = true; }
  } catch (_) { if (raw) { pushBackup(raw, 'unreadable'); rescued = true; } }
}
if (rescued) setTimeout(() => toast('The last autosave could not be fully read — a copy is kept under Canvas → Backups'), 900);
if (!loaded) {   // first run, or moving over from the single-canvas autosave
  let old = null;
  try { old = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
  ws = { tabs: [makeTab('Page 1', old)], active: 0 };
}
doc = curTab().doc;
tidy();   // re-space diagrams with the current gaps
render();
drawTabs();
if (curTab().cam) { cam = { ...curTab().cam }; applyCam(); } else fit(true);
if (!window.katex) toast('KaTeX could not load — labels shown as plain text');
if (!tourSeen()) setTimeout(startTour, 500);
})();

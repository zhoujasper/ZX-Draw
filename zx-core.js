/* ZX core: parse zx-calculus / tikz-cd LaTeX into a grid model and export it back.
   Works in the browser (window.ZX) and in Node (require('./zx-core.js').ZX). */
(function (root) {
  'use strict';

  let uid = 0;
  const newId = (p) => p + Date.now().toString(36).slice(-4) + (uid++).toString(36) + Math.random().toString(36).slice(2, 5);

  const stripComments = (s) => s.replace(/(^|[^\\])%.*$/gm, '$1');

  // s[i] === open. Returns [inner, indexAfterClose].
  function readGroup(s, i, open, close) {
    let d = 0;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      if (ch === '\\') { j++; continue; }
      if (ch === open) d++;
      else if (ch === close) { d--; if (d === 0) return [s.slice(i + 1, j), j + 1]; }
    }
    return [s.slice(i + 1), s.length];
  }

  // Split at top level (outside {} and []) on '\\' (rows) or '&' (cells).
  function splitTop(s, kind) {
    const out = []; let d = 0, last = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '\\') {
        if (kind === 'row' && d === 0 && s[i + 1] === '\\') { out.push(s.slice(last, i)); i++; last = i + 1; continue; }
        i++; continue;
      }
      if (ch === '{' || ch === '[') d++;
      else if (ch === '}' || ch === ']') d = Math.max(0, d - 1);
      else if (ch === '&' && kind === 'cell' && d === 0) { out.push(s.slice(last, i)); last = i + 1; }
    }
    out.push(s.slice(last));
    return out;
  }

  // Split tikz options on top-level commas.
  function splitOpts(s) {
    const out = []; let d = 0, q = false, last = 0;
    s = s || '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '\\') { i++; continue; }
      if (ch === '"') q = !q;
      else if (!q && ch === '{') d++;
      else if (!q && ch === '}') d--;
      else if (!q && d === 0 && ch === ',') { out.push(s.slice(last, i)); last = i + 1; }
    }
    out.push(s.slice(last));
    return out.map((t) => t.trim()).filter(Boolean);
  }

  const blankNode = () => ({ id: newId('n'), r: 0, c: 0, t: 'N', label: '', cmd: '', v: '', st: '' });

  function nodeFromCmd(base, v, args, st) {
    const n = blankNode();
    n.st = st || '';
    let m;
    if ((m = /^Frac([ZX])$/.exec(base))) {
      n.t = m[1];
      n.label = `\\frac{${args[0] || ''}}{${args[1] || ''}}`;
      if (v.includes('-')) { n.label = '-' + n.label; v = v.replace('-', ''); }
      n.v = v;
    } else if (base === 'Z' || base === 'X') {
      n.t = base; n.label = args[0] || '';
      if (v === '-') { n.label = '-' + n.label; v = ''; }
      n.v = v;
    } else if (base === 'H') {
      n.t = 'H'; n.v = v;
    } else if (base === 'Ctrl') {
      n.t = 'Z'; n.cmd = 'Ctrl'; n.v = v; n.label = args[0] || '';
    } else if (base === 'Not') {
      n.t = 'X'; n.cmd = 'Not'; n.v = v; n.label = args[0] || '';
    } else {
      n.t = 'N'; n.cmd = base; n.v = v;
    }
    return n;
  }

  function parseCell(s) {
    let i = 0, node = null;
    const arrows = [];
    const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
    while (i < s.length) {
      ws();
      if (i >= s.length) break;
      if (s[i] !== '\\') { i++; continue; }
      const m = /^\\([A-Za-z]+)/.exec(s.slice(i));
      if (!m) { i += 2; continue; }
      const name = m[1];
      i += m[0].length;
      if (name.length > 2 && name.startsWith('zx')) {
        const base = name.slice(2);
        const v = /^[^{[\s\\&]*/.exec(s.slice(i))[0];
        i += v.length;
        let st = '';
        ws();
        if (s[i] === '[') { const g = readGroup(s, i, '[', ']'); st = g[0]; i = g[1]; }
        const args = [];
        const nargs = base.startsWith('Frac') ? 2 : 1;
        for (let a = 0; a < nargs; a++) {
          ws();
          if (s[i] === '{') { const g = readGroup(s, i, '{', '}'); args.push(g[0].trim()); i = g[1]; }
        }
        if (!node) node = nodeFromCmd(base, v, args, st);
      } else if (name === 'ar' || name === 'arrow' || /^[udlr]+ar$/.test(name)) {
        let dir = /^[udlr]+ar$/.test(name) ? name.slice(0, -2) : '';
        let opts = [];
        ws();
        if (s[i] === '[') { const g = readGroup(s, i, '[', ']'); i = g[1]; opts = splitOpts(g[0]); }
        else if (s[i] === '{' && !dir) { const g = readGroup(s, i, '{', '}'); i = g[1]; opts = splitOpts(g[0]); }
        const rest = [];
        for (const o of opts) { if (!dir && /^[udlr]+$/.test(o)) dir = o; else rest.push(o); }
        arrows.push({ dir, opts: rest.join(', ') });
      }
    }
    return { node, arrows };
  }

  const newDiagram = (opts) => ({ id: newId('d'), ox: 0, oy: 0, opts: opts || '', nodes: [], edges: [] });

  function parseBody(body, opts) {
    const d = newDiagram(opts);
    const grid = new Map();
    const pending = [];
    splitTop(stripComments(body), 'row').forEach((row, r) => {
      splitTop(row, 'cell').forEach((cell, c) => {
        const parsed = parseCell(cell), arrows = parsed.arrows;
        let node = parsed.node;
        if (!node) {
          // plain cell content such as \vdots or \cdots becomes a text node
          const txt = cell.replace(/\\(?:ar|arrow|[udlr]+ar)(?![A-Za-z])(?:\s*\[[^\]]*\])?(?:\s*\{[^}]*\})?/g, '').trim();
          if (txt) node = Object.assign(blankNode(), { t: 'T', label: txt });
        }
        if (!node && !arrows.length) return;
        const n = node || Object.assign(blankNode(), { cmd: 'N' });
        n.r = r; n.c = c;
        d.nodes.push(n); grid.set(r + ',' + c, n);
        arrows.forEach((a) => pending.push(Object.assign({ from: n }, a)));
      });
    });
    pending.forEach((a) => {
      let dr = 0, dc = 0;
      for (const ch of a.dir) { if (ch === 'u') dr--; if (ch === 'd') dr++; if (ch === 'l') dc--; if (ch === 'r') dc++; }
      const r = a.from.r + dr, c = a.from.c + dc, key = r + ',' + c;
      let t = grid.get(key);
      if (!t) { t = Object.assign(blankNode(), { r, c, cmd: 'N' }); d.nodes.push(t); grid.set(key, t); }
      d.edges.push({ id: newId('e'), a: a.from.id, b: t.id, o: a.opts });
    });
    return d;
  }

  function cleanSep(s) {
    const t = s.replace(/\\nonumber|\\notag/g, '').replace(/&/g, '').replace(/\\\\/g, '').replace(/\s+/g, ' ').trim();
    return t;   // may be empty: diagrams side by side with no relation
  }

  // One equation (or a bare \zx{...}) → { diagrams, seps }
  function parseEquation(src) {
    src = stripComments(src);
    const blocks = [];
    const re = /\\zx(?![A-Za-z])|\\begin\{ZX\}/g;
    let m;
    while ((m = re.exec(src))) {
      const start = m.index;
      let j = m.index + m[0].length, opts = '', body = '';
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === '[') { const g = readGroup(src, j, '[', ']'); opts = g[0]; j = g[1]; }
      if (m[0] === '\\zx') {
        while (j < src.length && /\s/.test(src[j])) j++;
        if (src[j] !== '{') continue;
        const g = readGroup(src, j, '{', '}'); body = g[0]; j = g[1];
      } else {
        const e = src.indexOf('\\end{ZX}', j);
        if (e < 0) continue;
        body = src.slice(j, e); j = e + 8;
      }
      blocks.push({ start, end: j, opts: opts.trim(), body });
      re.lastIndex = j;
    }
    const diagrams = blocks.map((b) => parseBody(b.body, b.opts));
    const seps = [];
    for (let k = 0; k + 1 < blocks.length; k++) seps.push(cleanSep(src.slice(blocks[k].end, blocks[k + 1].start)));
    return { diagrams, seps };
  }

  // Find display-math blocks that contain zx diagrams.
  function findEquations(src) {
    const s = stripComments(src || '');
    const re = /\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\\begin\{(equation\*?|align\*?|gather\*?|multline\*?|displaymath)\}([\s\S]*?)\\end\{\3\}/g;
    const out = [];
    let m;
    while ((m = re.exec(s))) {
      const text = m[1] || m[2] || m[4] || '';
      if (!/\\zx(?![A-Za-z])|\\begin\{ZX\}/.test(text)) continue;
      const count = (text.match(/\\zx(?![A-Za-z])|\\begin\{ZX\}/g) || []).length;
      const line = s.slice(0, m.index).split('\n').length;
      out.push({ text, line, count });
    }
    if (!out.length && /\\zx(?![A-Za-z])|\\begin\{ZX\}/.test(s)) {
      out.push({ text: s, line: 1, count: (s.match(/\\zx(?![A-Za-z])|\\begin\{ZX\}/g) || []).length });
    }
    return out;
  }

  function bounds(d) {
    if (!d.nodes.length) return { r0: 0, r1: 0, c0: 0, c1: 0 };
    let r0 = Infinity, r1 = -Infinity, c0 = Infinity, c1 = -Infinity;
    for (const n of d.nodes) { r0 = Math.min(r0, n.r); r1 = Math.max(r1, n.r); c0 = Math.min(c0, n.c); c1 = Math.max(c1, n.c); }
    return { r0, r1, c0, c1 };
  }

  // ---------- export ----------
  function fracParts(L) {
    let neg = false, s = L.trim();
    if (s.startsWith('-')) { neg = true; s = s.slice(1).trim(); }
    if (!s.startsWith('\\frac')) return null;
    let i = 5;
    while (s[i] === ' ') i++;
    if (s[i] !== '{') return null;
    const g1 = readGroup(s, i, '{', '}');
    let j = g1[1];
    while (s[j] === ' ') j++;
    if (s[j] !== '{') return null;
    const g2 = readGroup(s, j, '{', '}');
    if (s.slice(g2[1]).trim()) return null;
    return { neg, a: g1[0], b: g2[0] };
  }

  function nodeTex(n) {
    const st = n.st ? `[${n.st}]` : '';
    const v = n.v || '';
    if (n.t === 'T') return n.label || '';
    if (n.t === 'P') return '\\zxN{}';   // Dot: a routing point, invisible in LaTeX
    if (n.t === 'N') return `\\zx${n.cmd || 'N'}${v}${st}{}`;
    if (n.t === 'H') return `\\zxH${v}${st}{}`;
    if (n.cmd === 'Ctrl' || n.cmd === 'Not') return `\\zx${n.cmd}${v}${st}{${n.label || ''}}`;
    const L = (n.label || '').trim();
    const f = fracParts(L);
    if (f) return `\\zxFrac${n.t}${f.neg ? '-' : ''}${v}${st}{${f.a}}{${f.b}}`;
    return `\\zx${n.t}${v}${st}{${L}}`;
  }

  function arrowTex(A, B, o) {
    const dr = B.r - A.r, dc = B.c - A.c;
    const dir = (dr < 0 ? 'u'.repeat(-dr) : 'd'.repeat(dr)) + (dc < 0 ? 'l'.repeat(-dc) : 'r'.repeat(dc));
    o = (o || '').trim();
    if (!dir) return `\\ar[${o || 'loop above'}]`;
    if (!o && dir.length === 1) return `\\${dir}ar`;
    return `\\ar[${[dir, o].filter(Boolean).join(', ')}]`;
  }

  // Wires between the same two nodes with the same shape would sit on top of each other in TikZ.
  // Give each one its own bend (the editor fans them out the same way). Returns Map edgeId → options.
  const BEND_RE = /^bend\s+(left|right)(?:\s*=\s*(-?[\d.]+))?$/;
  const OTHER_CURVE = /^(s|S|ss|s'|s\.|S'|S\.|o'|o\.|o-|o\||C|C'|C\.|C-|[<>'.]{2}|out\s*=.*|in\s*=.*|loop.*|looseness.*)$/;
  function spreadOpts(d) {
    const out = new Map(), groups = new Map();
    d.edges.forEach((e) => {
      if (e.a === e.b) return;
      const toks = splitOpts(e.o || '');
      if (toks.some((t) => OTHER_CURVE.test(t))) return;   // s, caps, loops…: leave as written
      const fwd = String(e.a) < String(e.b);
      const bt = toks.map((t) => BEND_RE.exec(t)).find(Boolean);
      let ang = 0;                                           // signed bend, measured from the lower id to the higher
      if (bt) { const th = bt[2] != null ? +bt[2] : 30; ang = (bt[1] === 'left' ? th : -th) * (fwd ? 1 : -1); }
      const rest = toks.filter((t) => !BEND_RE.test(t));
      const key = [fwd ? e.a : e.b, fwd ? e.b : e.a, ang, rest.slice().sort().join(',')].join('|');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ e, fwd, ang, rest });
    });
    groups.forEach((list) => {
      if (list.length < 2) return;
      const k = list.length, step = k === 2 ? 40 : 30;   // degrees between neighbouring wires
      list.forEach((x, j) => {
        let a = Math.round(x.ang + (j - (k - 1) / 2) * step);
        a = Math.max(-80, Math.min(80, a));
        const own = x.fwd ? a : -a;
        const bend = own === 0 ? [] : [own > 0 ? `bend left=${own}` : `bend right=${-own}`];
        out.set(x.e.id, bend.concat(x.rest).join(', '));
      });
    });
    return out;
  }

  function diagramTex(d, ind) {
    ind = ind == null ? '    ' : ind;
    const b = bounds(d);
    const R = b.r1 - b.r0 + 1, C = b.c1 - b.c0 + 1;
    const cells = Array.from({ length: R }, () => Array(C).fill(''));
    const byId = new Map(d.nodes.map((n) => [n.id, n]));
    d.nodes.forEach((n) => { cells[n.r - b.r0][n.c - b.c0] = nodeTex(n); });
    const spread = spreadOpts(d);
    d.edges.forEach((e) => {
      const A = byId.get(e.a), B = byId.get(e.b);
      if (!A || !B) return;
      cells[A.r - b.r0][A.c - b.c0] += ' ' + arrowTex(A, B, spread.has(e.id) ? spread.get(e.id) : e.o);
    });
    const w = Array(C).fill(0);
    cells.forEach((row) => row.forEach((s, j) => { w[j] = Math.max(w[j], s.length); }));
    const lines = cells.map((row) => row.map((s, j) => (j < C - 1 ? s.padEnd(w[j]) : s)).join(' & ').replace(/\s+$/, ''));
    const head = `${ind}\\zx${d.opts ? `[${d.opts}]` : ''}{`;
    return head + '\n' + lines.map((l, i) => `${ind}  ${l}${i < R - 1 ? ' \\\\' : ''}`).join('\n') + `\n${ind}}`;
  }

  // Unicode Greek etc. typed in labels or rules -> LaTeX macros (π -> \pi).
  const UNI = { 'π': '\\pi', 'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'θ': '\\theta', 'φ': '\\phi', 'ϕ': '\\phi',
    'ψ': '\\psi', 'λ': '\\lambda', 'μ': '\\mu', 'σ': '\\sigma', 'ω': '\\omega', 'Π': '\\Pi', '⊕': '\\oplus', '−': '-', '·': '\\cdot', '∝': '\\propto' };
  const UNI_RE = new RegExp('[' + Object.keys(UNI).join('') + ']', 'g');
  const unicodeToTex = (t) => t.replace(UNI_RE, (c, at, str) => UNI[c] + (/[A-Za-z]/.test(str[at + 1] || '') && UNI[c][0] === '\\' ? ' ' : ''));

  // o.wrap: wrap in \[ \]; o.only: index of a single diagram; o.perLine: diagrams per \[ \] block; o.starts: canvas line starts
  // (each later block starts with the relation that links it to the previous one).
  function docTex(doc, o) {
    o = o || {};
    const idx = o.only != null ? [o.only].filter((i) => doc.diagrams[i]) : doc.diagrams.map((_, i) => i);
    const sepAt = (i) => (doc.seps[i] == null ? '=' : doc.seps[i]);
    const per = o.wrap === false || !o.perLine ? Math.max(1, idx.length) : o.perLine;
    // o.starts[i] = true: diagram i begins a new \[ \] block (the canvas line breaks)
    const groups = [];
    if (o.starts && o.only == null && o.wrap !== false) idx.forEach((di) => { if (!groups.length || o.starts[di]) groups.push([]); groups[groups.length - 1].push(di); });
    else for (let s = 0; s < idx.length; s += per) groups.push(idx.slice(s, s + per));
    const chunks = groups.map((g) => {
      const parts = [];
      g.forEach((di) => {
        if (o.only == null && di > 0) { const sp = sepAt(di - 1); if (sp) parts.push('    ' + sp); }
        parts.push(diagramTex(doc.diagrams[di]));
      });
      return parts.join('\n');
    });
    const out = o.wrap === false ? chunks.join('\n').replace(/^ {4}/gm, '') : chunks.map((c) => `\\[\n${c}\n\\]`).join('\n');
    return unicodeToTex(out);
  }

  root.ZX = {
    newId, stripComments, readGroup, splitTop, splitOpts, parseCell, parseBody, parseEquation,
    findEquations, bounds, nodeTex, arrowTex, diagramTex, docTex, spreadOpts, newDiagram, fracParts, unicodeToTex,
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : typeof window !== 'undefined' ? window : self);   // self: inside a Web Worker

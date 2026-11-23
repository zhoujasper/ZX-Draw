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
    } else if (base === 'Mat') {
      // matrix arrow: \zxMat[1 0 1; 1 1 0]{n}{A}{m}; \zxMat< points left
      n.t = 'M'; n.v = v.includes('<') ? '<' : '';
      n.lin = args[0] || ''; n.label = args[1] || ''; n.lout = args[2] || '';
      const pm = st ? parseMatrix(st) : null;
      n.mat = pm && !pm.err ? pm.rows : null; n.st = '';
      if (n.mat && n.lin === String(n.mat[0].length)) n.lin = '';      // the size: shown automatically
      if (n.mat && n.lout === String(n.mat.length)) n.lout = '';
    } else if (base === 'Block' || base === 'Box' || base === 'Gate') {
      // box: \zxBlock[opts]{W}{H}{label} (W, H = drawn size in cells), or zx-calculus \zxBox{..} / \zxGate{..}
      n.t = 'B'; n.bw = 1; n.bh = 1; n.lay = ''; n.fill = ''; n.v = '';
      // box labels are text, math inside $…$ (n.lt marks that); \zxBox / \zxGate (zx-calculus) are math mode,
      // and an old \zxBlock label written as bare math (has \ ^ _ but no $) gets its $…$ back
      const raw = ((base === 'Block' ? args[2] : args[0]) || '').trim();
      n.label = raw && !raw.includes('$') && (base !== 'Block' || /[\\^_]/.test(raw)) ? `$${raw}$` : raw; n.lt = 1;
      if (base === 'Block') { n._W = parseFloat(args[0]) || 0; n._H = parseFloat(args[1]) || 0; } else n.cmd = base;
      const keep = [];
      splitOpts(st).forEach((t) => {
        const m = FILL_RE.exec(t);
        if (m) n.fill = '#' + m.slice(1, 4).map((x) => (+x).toString(16).padStart(2, '0')).join('');
        else if (AT_RE.test(t)) { const q = AT_RE.exec(t); n._at = { x: +q[1], y: -q[2] }; }
        else if (t === 'zxEnds') n.lay = 'ends';
        else if (t === 'zxVert') n.vt = 1;
        else if (t === 'zxMid') n.lay = 'mid';
        else keep.push(t);
      });
      n.st = keep.join(', ');
    } else if (base === 'Not') {
      n.t = 'X'; n.cmd = 'Not'; n.v = v; n.label = args[0] || '';
    } else {
      n.t = 'N'; n.cmd = base; n.v = v;
      // export looks: zxDot = a visible Dot, zxIn / zxOut = marked open ends (recomputed, so dropped)
      const toks = splitOpts(n.st);
      if (base === 'N' && toks.includes('zxDot')) { n.t = 'P'; n.cmd = ''; }
      if (toks.includes('zxFill')) n._fill = true;   // keeps a cell under a box wide (dropped again if unwired)
      n.st = toks.filter((t) => t !== 'zxDot' && t !== 'zxIn' && t !== 'zxOut' && t !== 'zxFill').join(', ');
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
        ws();
        if (base === 'Block' && s[i] === '<') i = readGroup(s, i, '<', '>')[1];   // the legs: redrawn from the box
        const args = [];
        const nargs = base.startsWith('Frac') ? 2 : base === 'Mat' || base === 'Block' ? 3 : 1;
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
          if (txt) node = Object.assign(blankNode(), { t: 'T', label: txt.replace(/^\|\[\s*(?:zxT[LRUD]|anchor\s*=\s*(?:east|west))\s*\]\|\s*/, '') });   // the lean is worked out again on export
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
      d.edges.push(edgeFromTex({ id: newId('e'), a: a.from.id, b: t.id }, a.opts));
    });
    d.nodes = d.nodes.filter((n) => { const f = n._fill; delete n._fill; return !f || d.edges.some((e) => e.a === n.id || e.b === n.id); });
    return unbundle(fromHalf(d));
  }

  // \zxScalar{…} (written by docTex around the scalars next to a relation) → its content
  function unScalar(s) {
    let i;
    while ((i = s.indexOf('\\zxScalar')) >= 0) {
      let j = i + 9; while (s[j] === ' ') j++;
      if (s[j] !== '{') break;
      let depth = 0, k = j;
      for (; k < s.length; k++) { if (s[k] === '{') depth++; else if (s[k] === '}' && --depth === 0) break; }
      s = s.slice(0, i) + s.slice(j + 1, k) + s.slice(k + 1);
    }
    return s;
  }
  // the relation with its scalars (pre / post) passed through wrap: smaller than the relation itself
  function sepScalarTex(sep, wrap) {
    const p = sepSplit(sep);
    if (!p.pre && !p.post) return sep;
    return [p.pre && wrap(p.pre), sepJoin({ pre: '', rule: p.rule, rel: p.rel, post: '' }), p.post && wrap(p.post)].filter(Boolean).join(' ');
  }
  function cleanSep(s) {
    s = unScalar(s);
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

  // in / out labels: what the user typed, else the size of A
  const matLabels = (n) => ({ lin: n.lin || (n.mat && n.mat[0] ? String(n.mat[0].length) : ''), lout: n.lout || (n.mat ? String(n.mat.length) : '') });
  // Wire options in LaTeX ↔ the editor: the Hadamard edge is the token H inside, zxHE in LaTeX (blue dashed,
  // zxdiagram.sty; a plain H from other sources reads the same). A wire colour is written as draw={rgb,255:…}.
  const HEX2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const FILL_RE = /^fill\s*=\s*\{?\s*rgb\s*,\s*255\s*:\s*red\s*,\s*(\d+)\s*;\s*green\s*,\s*(\d+)\s*;\s*blue\s*,\s*(\d+)\s*\}?$/;
  const AT_RE = /^zxAt\s*=\s*\{\s*(-?[\d.]+)\s*\}\s*\{\s*(-?[\d.]+)\s*\}$/;
  const PORT_RE = /^zx(From|To)\s*=\s*\{\s*(-?[\d.]+)\s*\}\s*\{\s*(-?[\d.]+)\s*\}$/;
  const COL_RE = /^draw\s*=\s*\{?\s*rgb\s*,\s*255\s*:\s*red\s*,\s*(\d+)\s*;\s*green\s*,\s*(\d+)\s*;\s*blue\s*,\s*(\d+)\s*\}?$/;
  function edgeFromTex(e, opts) {
    const out = [];
    splitOpts(opts || '').forEach((t) => {
      const m = COL_RE.exec(t);
      const pm = PORT_RE.exec(t);
      if (m) e.col = '#' + m.slice(1, 4).map((x) => (+x).toString(16).padStart(2, '0')).join('');
      else if (pm) e[pm[1] === 'From' ? '_pa' : '_pb'] = { x: +pm[2], y: -pm[3] };   // where the wire meets a box (made a pin in fromHalf)
      else out.push(t === 'zxHE' ? 'H' : t);
    });
    e.o = out.join(', ');
    return e;
  }
  function edgeTexOpts(e, o, look) {
    const toks = splitOpts(o || '').map((t) => (t === 'H' ? 'zxHE' : t));
    if (look && look.col && e.col && /^#[0-9a-f]{6}$/i.test(e.col) && !toks.includes('zxHE')) { const [r, g, b] = HEX2(e.col); toks.push(`draw={rgb,255:red,${r};green,${g};blue,${b}}`); }
    return toks.join(', ');
  }
  function nodeTex(n, mat, hide, look) {
    let st = n.st ? `[${n.st}]` : '';
    if (look && n.t === 'N' && look.io && look.io.has(n.id)) st = `[${[look.io.get(n.id) === 'in' ? 'zxIn' : 'zxOut'].concat(n.st ? [n.st] : []).join(', ')}]`;
    const v = n.v || '';
    if (n.t === 'T') return n.label || '';
    if (n.t === 'P') return look && look.dots ? '\\zxN[zxDot]{}' : '\\zxN{}';   // Dot: a routing point (drawn only when asked)
    if (n.t === 'N') return `\\zx${n.cmd || 'N'}${v}${st}{}`;
    if (n.t === 'M') { const L = matLabels(n), m = mat || n.mat; if (hide && hide.in && !n.lin) L.lin = ''; if (hide && hide.out && !n.lout) L.lout = ''; return `\\zxMat${n.v === '<' ? '<' : ''}${m ? `[${matText(m)}]` : ''}{${L.lin}}{${n.label || ''}}{${L.lout}}`; }
    if (n.t === 'B') return boxTex(n, look && look.box && look.box.get(n.id));
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

  // A straight wire must never run under a node it is not wired to (it would read as wired through it).
  // Such a wire gets the smallest bend that clears every other node, on the freer side; the same bend is
  // used on the canvas, in LaTeX and in image / TikZ export. base: Map edge id → options to use instead of e.o.
  // Returns Map edge id → options with the bend added (only for the wires that need one).
  // Measured as drawn (canvas px: a cell is 64 x 52; tikz-cd rows / columns keep about the same proportions):
  // a wire counts as running under a node only when it really touches it, its drawn radius plus AV_GAP;
  // a bend must then keep AV_CLEAR px from its edge.
  const AV_W = 64, AV_H = 52, AV_GAP = 2, AV_CLEAR = 5;
  const avRad = (n) => {
    if (n.t === 'Z' || n.t === 'X') return (n.label || '').trim() ? 14.5 + Math.max(0, (n.label || '').trim().length - 4) * 2 : (n.cmd === 'Ctrl' || n.cmd === 'Not') ? 5.5 : 8.5;
    if (n.t === 'H') return 8;
    if (n.t === 'T') return 9;
    if (n.t === 'M') return 15;
    return 5;   // wire point / dot: a wire through it would look connected
  };
  // wires that may be fanned out by spreadOpts: not bundled, not touching a box (boxes give each wire its own port)
  function plainEdges(d, bun) {
    const bx = new Set(d.nodes.filter((n) => n.t === 'B').map((n) => n.id));
    return d.edges.filter((e) => !(bun && bun.has(e.id)) && !bx.has(e.a) && !bx.has(e.b));
  }
  function avoidOpts(d, base) {
    const out = new Map();
    if (d.nodes.length < 3) return out;
    const by = new Map(d.nodes.map((n) => [n.id, n]));
    d.edges.forEach((e) => {
      if (e.a === e.b) return;
      const o = base && base.has(e.id) ? base.get(e.id) : e.o || '';
      const toks = splitOpts(o);
      if (toks.some((t) => BEND_RE.test(t) || OTHER_CURVE.test(t) || t === 'zxBundle')) return;
      const A = by.get(e.a), B = by.get(e.b);
      if (!A || !B || A.t === 'M' || B.t === 'M' || A.t === 'B' || B.t === 'B') return;
      const x0 = A.c * AV_W, y0 = A.r * AV_H, x1 = B.c * AV_W, y1 = B.r * AV_H, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
      if (!L) return;
      const others = d.nodes.filter((n) => n !== A && n !== B && n.t !== 'B').map((n) => ({ x: n.c * AV_W, y: n.r * AV_H, rad: avRad(n) }));
      const segDist = (n) => { const t = Math.max(0, Math.min(1, ((n.x - x0) * dx + (n.y - y0) * dy) / (L * L))); return Math.hypot(x0 + t * dx - n.x, y0 + t * dy - n.y); };
      if (!others.some((n) => segDist(n) < n.rad + AV_GAP)) return;
      // TikZ bend (as in the editor, y down): control points at 0.3915·L, turned by ∓θ from the chord
      const ux = dx / L, uy = dy / L, k = 0.3915 * L;
      const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
      const clearOf = (deg, left) => {
        const th = (deg * Math.PI / 180) * (left ? -1 : 1);
        const [ax, ay] = rot(ux, uy, th), [bx, by2] = rot(-ux, -uy, -th);
        const c1x = x0 + k * ax, c1y = y0 + k * ay, c2x = x1 + k * bx, c2y = y1 + k * by2;
        let m = Infinity;
        for (let i = 1; i < 24; i++) {
          const t = i / 24, u = 1 - t;
          const px = u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x1;
          const py = u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y1;
          others.forEach((n) => { m = Math.min(m, Math.hypot(px - n.x, py - n.y) - n.rad); });   // gap to the node's edge
        }
        return m;
      };
      let pick = null;
      for (const deg of [20, 25, 30, 35, 40, 45, 50, 60, 70]) {
        const l = clearOf(deg, true), r = clearOf(deg, false);
        if (Math.max(l, r) >= AV_CLEAR) { pick = [deg, l > r + 1e-6 ? 'left' : 'right']; break; }
      }
      if (!pick) pick = [40, clearOf(40, true) > clearOf(40, false) ? 'left' : 'right'];
      out.set(e.id, [`bend ${pick[1]}=${pick[0]}`].concat(toks).join(', '));
    });
    return out;
  }

  // ---------- half cells ----------
  // A node may sit between two grid cells (r or c ending in .5). LaTeX has only whole cells, so such a
  // diagram is written on a grid twice as fine with the zxHalf option (zxdiagram.sty: half the spacing,
  // same spider size), and read back the same way.
  const isHalf = (d) => d.nodes.some((n) => n.r % 1 || n.c % 1);
  function texGrid(d) {
    if (!isHalf(d)) return d;
    const o = splitOpts(d.opts || '').filter((t) => t !== 'zxHalf');
    return Object.assign({}, d, { opts: ['zxHalf'].concat(o).join(', '), nodes: d.nodes.map((n) => Object.assign({}, n, { r: Math.round(n.r * 2), c: Math.round(n.c * 2) })) });
  }
  function fromHalf(d) {
    let o = splitOpts(d.opts || '');
    const k = o.includes('zxHalf') ? 2 : 1, by = new Map(d.nodes.map((n) => [n.id, n]));
    d.nodes.forEach((n) => {
      if (n.t !== 'B') return;
      const half = (v) => Math.max(0, Math.round(v * 2) / 2), at = n._at || { x: 0, y: 0 };
      const sx = n._W ? Math.max(0, n._W / k - BOX_PAD) : 0, sy = n._H ? Math.max(0, n._H / k - BOX_PAD) : 0;
      n.bl = half(sx / 2 - at.x / k); n.br = half(sx / 2 + at.x / k); n.bt = half(sy / 2 - at.y / k); n.bb = half(sy / 2 + at.y / k);
      delete n._W; delete n._H; delete n._at; delete n.bw; delete n.bh;
    });
    d.edges.forEach((e) => ['a', 'b'].forEach((end) => {
      const q = e['_p' + end]; delete e['_p' + end];
      const n = by.get(e[end]);
      if (!q || !isBox(n)) return;
      const X = boxExt(n), cx = (X.r - X.l) / 2, cy = (X.b - X.t) / 2, x = q.x / k, y = q.y / k;
      const hor = Math.abs(x - cx) * (X.t + X.b + BOX_PAD) >= Math.abs(y - cy) * (X.l + X.r + BOX_PAD);
      e['p' + end] = hor ? { s: x < cx ? 'L' : 'R', t: y } : { s: y < cy ? 'T' : 'B', t: x };
    }));
    if (o.includes('zxBW') || o.includes('zxGrid')) { o = o.filter((t) => t !== 'zxBW' && t !== 'zxGrid'); d.opts = o.join(', '); }   // export look / box grid: written again on export
    if (!o.includes('zxHalf')) return d;
    d.opts = o.filter((t) => t !== 'zxHalf').join(', ');
    d.nodes.forEach((n) => { n.r /= 2; n.c /= 2; });
    return d;
  }


  // ---------- boxes ----------
  // A box (t 'B') sits on its cell; bw × bh = the cells it spans (drawn size = span − 1 + BOX_PAD, grown when
  // a side has more wires than fit). Each wire meets it at a port on the side facing the other end, or on the
  // side a pin says (e.pa / e.pb = { s: 'L'|'R'|'T'|'B', t: offset along the side in cells }). Ports on a side
  // are ordered by where their wires come from and spread by n.lay: '' evenly, 'ends' packed to both ends
  // (room for ⋮ in the middle), 'mid' all into the middle of the side. Offsets in cells from the centre, y down.
  const BOX_PAD = 0.7, BOX_STEP = 0.5;
  // a box label is text with math inside $…$ (\$ = a dollar sign); as one math string for KaTeX / MathJax
  function labelMath(s) {
    const out = [];
    String(s || '').split(/(?<!\\)\$/).forEach((t, i) => { if (t) out.push(i % 2 ? `{${t}}` : `\\text{${t}}`); });
    return out.join('');
  }
  const isBox = (n) => n && n.t === 'B';
  // how far the box reaches past its own cell on each side (cells); old boxes kept a symmetric bw × bh
  function boxExt(n) {
    const sx = ((n.bw || 1) - 1) / 2, sy = ((n.bh || 1) - 1) / 2;
    return { l: n.bl != null ? n.bl : sx, r: n.br != null ? n.br : sx, t: n.bt != null ? n.bt : sy, b: n.bb != null ? n.bb : sy };
  }
  function boxGeom(d, n) {
    const byId = new Map(d.nodes.map((x) => [x.id, x]));
    const X = boxExt(n), cx = (X.r - X.l) / 2, cy = (X.b - X.t) / 2, ex = (X.l + X.r) / 2 + 0.5, ey = (X.t + X.b) / 2 + 0.5;
    const sides = { L: [], R: [], T: [], B: [] };
    d.edges.forEach((e, i) => {
      if (e.a === e.b) return;
      ['a', 'b'].forEach((end) => {
        if (e[end] !== n.id) return;
        const o = byId.get(end === 'a' ? e.b : e.a);
        if (!o) return;
        const pin = e[end === 'a' ? 'pa' : 'pb'];
        let s, key;
        if (pin && sides[pin.s]) { s = pin.s; key = +pin.t || 0; } else {
          const dx = (o.c - n.c - cx) / ex, dy = (o.r - n.r - cy) / ey;
          s = Math.abs(dx) >= Math.abs(dy) - 1e-9 ? (dx < 0 ? 'L' : 'R') : (dy < 0 ? 'T' : 'B');
          key = s === 'L' || s === 'R' ? o.r - n.r : o.c - n.c;
        }
        sides[s].push({ e: e.id, end, key, i });
      });
    });
    const offs = (k, span) => {
      if (k <= 1 || n.lay === 'mid') return Array(k).fill(0);
      if (n.lay === 'ends') {
        const sp = Math.max(span, (k - 1) * BOX_STEP), a = Math.ceil(k / 2);
        return Array.from({ length: k }, (_, i) => (i < a ? -sp / 2 + i * BOX_STEP : sp / 2 - (k - 1 - i) * BOX_STEP));
      }
      const g = Math.max(span / (k - 1), BOX_STEP);
      return Array.from({ length: k }, (_, i) => -(k - 1) * g / 2 + i * g);
    };
    const need = {};
    Object.keys(sides).forEach((s) => {
      const L = sides[s];
      L.sort((a, b) => a.key - b.key || a.i - b.i || (a.end < b.end ? -1 : 1));
      const o = offs(L.length, s === 'L' || s === 'R' ? X.t + X.b : X.l + X.r);
      L.forEach((x, j) => { x.t = o[j]; });
      need[s] = o.length ? Math.max(...o.map(Math.abs)) * 2 : 0;
    });
    const W = Math.max(X.l + X.r, need.T, need.B) + BOX_PAD, H = Math.max(X.t + X.b, need.L, need.R) + BOX_PAD;
    const ports = new Map(), mid = n.lay === 'mid';   // offsets from the box's own cell (its centre is at cx, cy); mid: wires meet at one point, no legs
    Object.keys(sides).forEach((s) => sides[s].forEach((x) => {
      ports.set(x.e + ':' + x.end, Object.assign(s === 'L' ? { s, x: cx - W / 2, y: cy + x.t } : s === 'R' ? { s, x: cx + W / 2, y: cy + x.t } : s === 'T' ? { s, x: cx + x.t, y: cy - H / 2 } : { s, x: cx + x.t, y: cy + H / 2 }, mid ? { mid } : {}));
    }));
    return { W, H, cx, cy, ports, sides };
  }
  // A wire leaves a box with a short straight leg square to the side (drawn by the box), then follows its own curve.
  const BOX_STUB = 0.22;
  const stubOf = (q) => (!q || q.mid ? { x: 0, y: 0 } : q.s === 'L' ? { x: -BOX_STUB, y: 0 } : q.s === 'R' ? { x: BOX_STUB, y: 0 } : q.s === 'T' ? { x: 0, y: -BOX_STUB } : { x: 0, y: BOX_STUB });
  // where wire e meets box n (offset in cells from its centre), or null
  const boxPort = (g, e, n) => (g ? g.ports.get(e.id + ':' + (e.a === n.id ? 'a' : 'b')) : null);
  const r2 = (x) => String(Math.round(x * 100) / 100);
  const HEXRGB = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return `{rgb,255:red,${r};green,${g};blue,${b}}`; };
  // \zxBlock[opts]{W}{H}{label}; k = 2 on a zxHalf grid (sizes in LaTeX cells)
  function boxTex(n, g, k) {
    k = k || 1;
    g = g || boxGeom({ nodes: [n], edges: [] }, n);
    const W = g.W, H = g.H;
    const o = (g.cx || g.cy ? [`zxAt={${r2(g.cx * k)}}{${r2(-g.cy * k)}}`] : []).concat(n.lay === 'ends' ? ['zxEnds'] : n.lay === 'mid' ? ['zxMid'] : [], n.vt ? ['zxVert'] : []).concat(n.fill && /^#[0-9a-f]{6}$/i.test(n.fill) ? [`fill=${HEXRGB(n.fill)}`] : [], n.st ? [n.st] : []);
    const mOnly = /^\$([^$]*)\$$/.exec((n.label || '').trim());   // \zxBox / \zxGate take math only
    if (n.cmd && (n.cmd === 'Gate' || n.cmd === 'Box') && mOnly && !o.length && Math.abs(W - BOX_PAD) < 1e-9 && Math.abs(H - BOX_PAD) < 1e-9 && ( Object.values(g.sides).every((L) => L.length <= 1))) return `\\zx${n.cmd}{${mOnly[1]}}`;
    const legs = [...g.ports.values()].filter((q) => !q.mid).map((q) => { const st = stubOf(q); return [q.x, -q.y, q.x + st.x, -(q.y + st.y)].map((v) => r2(v * k)).join('/'); });
    return `\\zxBlock${o.length ? `[${o.join(', ')}]` : ''}${legs.length ? `<${legs.join(', ')}>` : ''}{${r2(W * k)}}{${r2(H * k)}}{${n.lt || !n.label || n.label.includes('$') ? n.label || '' : `$${n.label}$`}}`;   // a box not yet moved to text labels (n.lt)
  }

  // A text cell (1/sqrt2, a label) half a cell from a spider would run into it on a fixed grid (zxGrid):
  // it leans away instead. 'L' = its right edge near its cell centre (spider on its right), 'R' the mirror,
  // 'U' = its bottom edge there (spider below), 'D' the mirror, '' = centred. LaTeX: |[zxTL]| … |[zxTD]|
  // (zxdiagram.sty). Only on a box diagram (zxGrid) with half cells; a row neighbour wins over a column one.
  function textLean(d, n) {
    if (n.t !== 'T' || DOTS_RE.test((n.label || '').trim()) || !d.nodes.some(isBox)) return '';
    const f = { l: 0, r: 0, u: 0, b: 0 };
    d.nodes.forEach((m) => {
      if (m === n || !['Z', 'X', 'H', 'M'].includes(m.t)) return;
      const dr = m.r - n.r, dc = m.c - n.c;
      if (dr === 0 && dc > 0 && dc <= 0.5) f.r = 1;
      if (dr === 0 && dc < 0 && dc >= -0.5) f.l = 1;
      if (dc === 0 && dr > 0 && dr <= 0.5) f.b = 1;
      if (dc === 0 && dr < 0 && dr >= -0.5) f.u = 1;
    });
    return f.r && !f.l ? 'L' : f.l && !f.r ? 'R' : f.b && !f.u ? 'U' : f.u && !f.b ? 'D' : '';
  }
  const DOTS_RE = /^\\[vcd]?dots$|^\\ddots$/;

  // look (optional): { col: wire colours, dots: draw Dots, bw: black-and-white spiders (zxBW), io: Map node id → 'in' | 'out' to mark open ends }
  function diagramTex(d, ind, look) {
    ind = ind == null ? '    ' : ind;
    const bun0 = matBundles(d), spread0 = spreadOpts({ edges: plainEdges(d, bun0) });
    const avoid = avoidOpts(d, spread0);
    const bg = new Map(d.nodes.filter(isBox).map((n) => [n.id, boxGeom(d, n)])), bk = isHalf(d) ? 2 : 1;
    const lean = new Map(d.nodes.map((n) => [n.id, textLean(d, n)]));
    d = texGrid(d);
    const b = bounds(d);
    const R = b.r1 - b.r0 + 1, C = b.c1 - b.c0 + 1;
    const cells = Array.from({ length: R }, () => Array(C).fill(''));
    const byId = new Map(d.nodes.map((n) => [n.id, n]));
    const bun = matBundles(d);
    // a bundled side (arrow → arrow) carries no size label, as in the book
    const hideOf = (n) => { const h = { in: false, out: false }; bun.forEach((x) => { if (x.a === n.id) h.out = true; if (x.b === n.id) h.in = true; }); return h; };
    d.nodes.forEach((n) => { cells[n.r - b.r0][n.c - b.c0] = n.t === 'M' ? nodeTex(n, matForTex(d, n), hideOf(n)) : n.t === 'B' ? boxTex(n, bg.get(n.id), bk) : (lean.get(n.id) ? `|[zxT${lean.get(n.id)}]| ` : '') + nodeTex(n, null, null, look); });
    // empty cells under a box get an invisible filler, so tikz-cd keeps their columns as wide as \zxCellW
    d.nodes.forEach((n) => {
      if (!isBox(n)) return;
      const X = boxExt(n);
      for (let r = Math.ceil(n.r - X.t * bk); r <= Math.floor(n.r + X.b * bk); r++) for (let c = Math.ceil(n.c - X.l * bk); c <= Math.floor(n.c + X.r * bk); c++) {
        const row = cells[r - b.r0];
        if (row && c - b.c0 >= 0 && c - b.c0 < C && row[c - b.c0] === '') row[c - b.c0] = '\\zxN[zxFill]{}';
      }
    });
    const spread = spreadOpts({ edges: plainEdges(d, bun) });
    // a wire starts where the box's short straight leg ends
    const portTok = (e, n, w) => { const q = boxPort(bg.get(n.id), e, n), st = stubOf(q); return q ? [`zx${w}={${r2((q.x + st.x) * bk)}}{${r2(-(q.y + st.y) * bk)}}`] : []; };
    d.edges.forEach((e) => {
      const A = byId.get(e.a), B = byId.get(e.b);
      if (!A || !B) return;
      const bu = bun.get(e.id);
      if (bu && !bu.lead) return;
      let o = bu ? 'zxBundle' : edgeTexOpts(e, avoid.has(e.id) ? avoid.get(e.id) : spread.has(e.id) ? spread.get(e.id) : e.o, look);
      if (!bu && A !== B && (isBox(A) || isBox(B))) {
        let toks = splitOpts(o);
        o = toks.concat(isBox(A) ? portTok(e, A, 'From') : [], isBox(B) ? portTok(e, B, 'To') : []).filter(Boolean).join(', ');
      }
      cells[A.r - b.r0][A.c - b.c0] += ' ' + arrowTex(A, B, o);
    });
    const w = Array(C).fill(0);
    cells.forEach((row) => row.forEach((s, j) => { w[j] = Math.max(w[j], s.length); }));
    const lines = cells.map((row) => row.map((s, j) => (j < C - 1 ? s.padEnd(w[j]) : s)).join(' & ').replace(/\s+$/, ''));
    // bw: black-and-white spiders; zxGrid (last, so it wins): with a box every cell is exactly one cell apart, as on the canvas
    const opts = (look && look.bw ? ['zxBW'] : []).concat(d.opts ? [d.opts] : [], d.nodes.some(isBox) ? ['zxGrid'] : []).join(', ');
    const head = `${ind}\\zx${opts ? `[${opts}]` : ''}{`;
    return head + '\n' + lines.map((l, i) => `${ind}  ${l}${i < R - 1 ? ' \\\\' : ''}`).join('\n') + `\n${ind}}`;
  }

  // Unicode Greek etc. typed in labels or rules -> LaTeX macros (π -> \pi).
  const UNI = { 'π': '\\pi', 'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'θ': '\\theta', 'φ': '\\phi', 'ϕ': '\\phi',
    'ψ': '\\psi', 'λ': '\\lambda', 'μ': '\\mu', 'σ': '\\sigma', 'ω': '\\omega', 'Π': '\\Pi', '⊕': '\\oplus', '−': '-', '·': '\\cdot', '∝': '\\propto' };
  const UNI_RE = new RegExp('[' + Object.keys(UNI).join('') + ']', 'g');
  const unicodeToTex = (t) => t.replace(UNI_RE, (c, at, str) => UNI[c] + (/[A-Za-z]/.test(str[at + 1] || '') && UNI[c][0] === '\\' ? ' ' : ''));

  // A relation between two diagrams, split into its parts:
  //   pre (scalar on the left diagram) · rule (e.g. "(sp)" from \stackrel{\mathbf{(sp)}}{=}) · rel (=, \propto …) · post (scalar on the right diagram)
  // e.g. "\stackrel{\mathbf{(eu)}}{=}\frac{1}{\sqrt{2}}" → { pre: '', rule: '(eu)', rel: '=', post: '\frac{1}{\sqrt{2}}' }
  const REL_TOKENS = ['\\Leftrightarrow', '\\Rightarrow', '\\propto', '\\approx', '\\simeq', ':=', '∝', '≈', '⇒', '='];
  function sepSplit(src) {
    const s = String(src == null ? '' : src).trim();
    const arg = (j) => {   // {…} starting at j (spaces skipped) → [text, end]
      while (s[j] === ' ') j++;
      if (s[j] !== '{') return null;
      let depth = 0;
      for (let k = j; k < s.length; k++) { if (s[k] === '{') depth++; else if (s[k] === '}' && --depth === 0) return [s.slice(j + 1, k), k + 1]; }
      return null;
    };
    const st = /\\(stackrel|overset)\s*\{/.exec(s);
    if (st) {
      const a = arg(st.index + st[0].length - 1), b = a && arg(a[1]);
      if (b) {
        const m = /^\s*\\(mathbf|textbf|text|mathrm)\s*\{([\s\S]*)\}\s*$/.exec(a[0]);
        return { pre: s.slice(0, st.index).trim(), rule: m ? m[2] : a[0].trim(), rel: b[0].trim(), post: s.slice(b[1]).trim() };
      }
    }
    let best = null;
    for (const t of REL_TOKENS) { const j = s.indexOf(t); if (j >= 0 && (!best || j < best[0])) best = [j, t]; }
    if (!best) return { pre: '', rule: '', rel: s, post: '' };
    return { pre: s.slice(0, best[0]).trim(), rule: '', rel: best[1], post: s.slice(best[0] + best[1].length).trim() };
  }
  const sepJoin = (p) => [p.pre, p.rule ? `\\stackrel{\\mathbf{${p.rule}}}{${p.rel || '='}}` : p.rel, p.post].filter(Boolean).join(' ');

  // o.look(d) → diagramTex looks; o.wrap: wrap in \[ \]; o.only: index of a single diagram; o.perLine: diagrams per \[ \] block; o.starts: canvas line starts
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
        if (o.only == null && di > 0) { const sp = sepScalarTex(sepAt(di - 1), (x) => `\\zxScalar{${x}}`); if (sp) parts.push('    ' + sp); }
        parts.push(diagramTex(doc.diagrams[di], null, o.look ? o.look(doc.diagrams[di]) : null));
      });
      return parts.join('\n');
    });
    const out = o.wrap === false ? chunks.join('\n').replace(/^ {4}/gm, '') : chunks.map((c) => `\\[\n${c}\n\\]`).join('\n');
    return unicodeToTex(out);
  }

  // ---------- matrix arrows (a phase-free Z–X block in normal form, drawn as one bold arrow) ----------
  // Reads a 0/1 matrix typed almost any way: "1 0 1; 1 1 0", one row per line, "101 110",
  // "1,0,1 \\ 1,1,0", "a & b \\ c & d", \begin{pmatrix}..\end{pmatrix}, [[1,0,1],[1,1,0]], "A = (...)".
  // → { rows: [[0|1]] } or { err }
  function parseMatrix(src) {
    let s = String(src || '');
    s = s.replace(/\\(begin|end)\s*\{[a-zA-Z*]*\}/g, ' ').replace(/\\(left|right|big|Big|bigg|Bigg)\b/g, ' ');
    if (s.includes('=')) s = s.slice(s.lastIndexOf('=') + 1);
    s = s.replace(/\]\s*,\s*\[/g, ';').replace(/\)\s*,\s*\(/g, ';').replace(/[[\](){}]/g, ' ').replace(/\\(?:cr|newline)\b/g, ';');
    let rows = s.split(/\\\\|;|\n|\r/).map((r) => r.trim()).filter(Boolean)
      .map((r) => r.split(/[&,\s]+/).filter(Boolean));
    if (!rows.length) return { err: 'Type the rows of A, e.g. 1 0 1; 1 1 0' };
    // a row written without separators: 101
    rows = rows.map((r) => (r.length === 1 && /^[01]{2,}$/.test(r[0]) ? r[0].split('') : r));
    // one line of bit strings: "101 110" means two rows
    if (rows.length === 1 && rows[0].length > 1 && rows[0].every((t) => /^[01]{2,}$/.test(t)) && rows[0].every((t) => t.length === rows[0][0].length)) rows = rows[0].map((t) => t.split(''));
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const r = [];
      for (const t of rows[i]) {
        if (!/^[+-]?\d+$/.test(t)) return { err: `“${t}” is not 0 or 1` };
        r.push(Math.abs(+t) % 2);
      }
      out.push(r);
    }
    const w = out[0].length;
    const bad = out.findIndex((r) => r.length !== w);
    if (bad > 0) return { err: `Row ${bad + 1} has ${out[bad].length} entries, row 1 has ${w}` };
    return { rows: out };
  }
  const matText = (m) => m.map((r) => r.join(' ')).join('; ');

  // The wires of a matrix arrow, by port. n.pin / n.pout hold edge ids per port (chosen by the user);
  // other wires take the free ports of their side in top-to-bottom order: a wire to the left goes in,
  // to the right comes out (mirrored for \zxMat<), a vertical one by its direction.
  // → { ins, outs: [{ e, o, j }] in port order, inSlots, outSlots: per port {e,o,j} or null (longer than A when overfull), loops }
  function matSides(d, n) {
    const byId = new Map(d.nodes.map((m) => [m.id, m]));
    const flip = n.v === '<', loops = [], att = new Map();
    d.edges.forEach((e) => {
      if (e.a !== n.id && e.b !== n.id) return;
      if (e.a === e.b) return loops.push(e);
      const o = byId.get(e.a === n.id ? e.b : e.a);
      if (o) att.set(e.id, { e, o });
    });
    const R = n.mat ? n.mat.length : 0, C = n.mat && n.mat[0] ? n.mat[0].length : 0;
    const used = new Set();
    const pinned = (list, k) => {
      const S = Array(k).fill(null);
      (list || []).forEach((id, j) => { const x = att.get(id); if (j < k && x && !used.has(id)) { S[j] = x; used.add(id); } });
      return S;
    };
    const kIn = Math.max(C, (n.pin || []).length), kOut = Math.max(R, (n.pout || []).length);
    const SI = pinned(n.pin, kIn), SO = pinned(n.pout, kOut);
    const free = [...att.values()].filter((x) => !used.has(x.e.id));
    const ord = (a, b) => a.o.r - b.o.r || a.o.c - b.o.c;
    const geoIn = free.filter((x) => (x.o.c < n.c || (x.o.c === n.c && x.e.b === n.id)) !== flip).sort(ord);
    const geoOut = free.filter((x) => !geoIn.includes(x)).sort(ord);
    const fill = (S, list, k) => {
      list.forEach((x) => { const j = S.findIndex((y, i) => !y && i < k); if (j >= 0) S[j] = x; else S.push(x); });
      while (S.length > Math.max(k, 0) && !S[S.length - 1]) S.pop();
      return S.map((x, j) => (x ? Object.assign({}, x, { j }) : null));
    };
    const inSlots = fill(SI, geoIn, C), outSlots = fill(SO, geoOut, R);
    return { ins: inSlots.filter(Boolean), outs: outSlots.filter(Boolean), inSlots, outSlots, loops };
  }
  // Size of A against the wires drawn: ok, or a message for the user.
  function matInfo(d, n) {
    const s = matSides(d, n), m = n.mat;
    const rows = m ? m.length : 0, cols = m && m[0] ? m[0].length : 0;
    const info = { rows, cols, nin: s.ins.length, nout: s.outs.length, ok: true, msg: '' };
    const side = (k, slots, w) => {
      const have = slots.filter(Boolean).length;
      if (!have) return '';
      if (slots.length > k) return `${have} ${w} wires, but A has ${k} ${w === 'input' ? 'column' : 'row'}${k === 1 ? '' : 's'}`;
      if (have < k) return `${have} of ${k} ${w} wire${k === 1 ? '' : 's'} connected`;
      return '';
    };
    if (!m) { info.ok = false; info.msg = 'Enter the entries of the matrix'; }
    else if (s.loops.length) { info.ok = false; info.msg = 'A self-loop on a matrix arrow has no meaning'; }
    else { const w = side(cols, s.inSlots, 'input') || side(rows, s.outSlots, 'output'); if (w) { info.ok = false; info.msg = w; } }
    info.openIn = !s.ins.length; info.openOut = !s.outs.length;
    return info;
  }
  // The entries as LaTeX will read them back: re-imported wires take their ports top to bottom,
  // so a custom port order is written as permuted rows / columns (same meaning).
  function matForTex(d, n) {
    if (!n.mat) return null;
    const info = matInfo(d, n);
    if (!info.ok) return n.mat;
    const s = matSides(d, n), ord = (a, b) => a.o.r - b.o.r || a.o.c - b.o.c, bun = matBundles(d);
    const bIn = s.ins.some((x) => bun.has(x.e.id)), bOut = s.outs.some((x) => bun.has(x.e.id));   // re-imported bundles keep port order
    const gi = info.openIn || bIn ? null : s.ins.slice().sort(ord).map((x) => x.j);     // geometric rank → port
    const go = info.openOut || bOut ? null : s.outs.slice().sort(ord).map((x) => x.j);
    return (go || n.mat.map((_, i) => i)).map((i) => (gi || n.mat[0].map((_, j) => j)).map((j) => n.mat[i][j]));
  }
  // Arrow-to-arrow wiring where output j of one meets input j of the other, every port used:
  // drawn as one bold wire and written as one \ar[.., zxBundle]. → Map edgeId → { lead, a, b, k }
  function matBundles(d) {
    const out = new Map(), M = d.nodes.filter((n) => n.t === 'M');
    if (M.length < 2) return out;
    const sides = new Map(M.map((n) => [n.id, matSides(d, n)]));
    const groups = new Map();
    d.edges.forEach((e) => {
      const A = sides.get(e.a), B = sides.get(e.b);
      if (!A || !B || e.a === e.b || (e.o || '').trim()) return;
      const key = [e.a, e.b].sort().join('|');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    });
    groups.forEach((es, key) => {
      const [x, y] = key.split('|');
      // which of the two gives outputs on these wires
      for (const [a, b] of [[x, y], [y, x]]) {
        const so = sides.get(a).outSlots, si = sides.get(b).inSlots;
        if (es.length < 2 || so.length !== es.length || si.length !== es.length) continue;
        if (!es.every((e) => { const i = so.findIndex((s) => s && s.e === e), j = si.findIndex((s) => s && s.e === e); return i >= 0 && i === j; })) continue;
        const ordered = so.map((s) => s.e);
        ordered.forEach((e, j) => out.set(e.id, { lead: j === 0, a, b, k: es.length, j }));
        break;
      }
    });
    return out;
  }
  // \ar[.., zxBundle] between two arrows (from LaTeX) → one wire per port, output j to input j
  function unbundle(d) {
    const byId = new Map(d.nodes.map((n) => [n.id, n]));
    d.edges.slice().forEach((e) => {
      const toks = splitOpts(e.o || '');
      if (!toks.includes('zxBundle')) return;
      const A = byId.get(e.a), B = byId.get(e.b);
      if (!A || !B || A.t !== 'M' || B.t !== 'M') { e.o = toks.filter((t) => t !== 'zxBundle').join(', '); return; }
      // the source cell is the one whose outputs leave towards the other (left one, unless mirrored)
      const aOut = (B.c > A.c) !== (A.v === '<');
      const src = aOut ? A : B, dst = aOut ? B : A;
      const k = Math.max(1, Math.min(src.mat ? src.mat.length : 1, dst.mat && dst.mat[0] ? dst.mat[0].length : 1));
      d.edges = d.edges.filter((x) => x !== e);
      for (let j = 0; j < k; j++) {
        const id = j ? newId('e') : e.id;
        d.edges.push({ id, a: e.a, b: e.b, o: '' });
        setPort(src, 'out', j, id); setPort(dst, 'in', j, id);
      }
    });
    return d;
  }
  // Put wire eid on port j of a side ('in' / 'out'); a wire already there gives the port up.
  function setPort(n, side, j, eid) {
    n.pin = (n.pin || []).map((x) => (x === eid ? null : x));
    n.pout = (n.pout || []).map((x) => (x === eid ? null : x));
    const L = side === 'in' ? n.pin : n.pout;
    while (L.length <= j) L.push(null);
    L[j] = eid;
  }

  // Replace matrix arrow `id` by its Z/X normal form, in place. grid = true: whole cells, opening new columns
  // (the editor); otherwise fractional positions, nothing else moves (computation). Returns the new nodes.
  function expandMat(d, id, grid) {
    const n = d.nodes.find((m) => m.id === id);
    if (!n || n.t !== 'M') return [];
    const info = matInfo(d, n);
    if (!info.ok) { const e = new Error(`Matrix arrow ${n.label || ''}: ${info.msg.toLowerCase()}`); e.nodes = [n.id]; throw e; }
    const { ins, outs } = matSides(d, n), A = n.mat, R = info.rows, C = info.cols, flip = n.v === '<';
    const r0 = n.r, c0 = n.c;
    // column order left → right
    const cols = flip ? ['oN', 'X', 'Z', 'iN'] : ['iN', 'Z', 'X', 'oN'];
    const used = cols.filter((k) => (k === 'iN' ? info.openIn : k === 'oN' ? info.openOut : true));
    const colOf = {};
    if (grid) {
      d.nodes.forEach((m) => { if (m.c > c0) m.c += used.length - 1; });
      used.forEach((k, i) => { colOf[k] = c0 + i; });
    } else {
      used.forEach((k, i) => { colOf[k] = c0 + (i - (used.length - 1) / 2) * 0.2; });
    }
    d.nodes = d.nodes.filter((m) => m !== n);
    const taken = new Set(d.nodes.map((m) => m.r + ',' + m.c));
    // rows: follow the wires when there are any, otherwise stack around the arrow
    const rowsFor = (k, list, col) => {
      const out = []; let prev = -Infinity;
      // follow the wires' rows when they fan out; stack around the arrow when they share a row (arrow → arrow)
      const follow = list.length && list.every((x, j) => !j || x.o.r > list[j - 1].o.r);
      for (let j = 0; j < k; j++) {
        let r = follow ? list[j].o.r : r0 - Math.floor((k - 1) / 2) + j;
        if (grid) { r = Math.max(Math.round(r), prev + 1); while (taken.has(r + ',' + col)) r++; taken.add(r + ',' + col); }
        else r = Math.max(r, prev + 0.01);
        out.push(r); prev = r;
      }
      return out;
    };
    const mk = (t, r, c, cmd) => ({ id: newId('n'), r, c, t, label: '', cmd: cmd || '', v: '', st: '' });
    const zr = rowsFor(C, ins, colOf.Z), xr = rowsFor(R, outs, colOf.X);
    const Z = zr.map((r) => mk('Z', r, colOf.Z)), X = xr.map((r) => mk('X', r, colOf.X));
    const made = Z.concat(X);
    const relink = (list, sp) => list.forEach(({ e }, j) => { if (e.a === id) e.a = sp[j].id; else e.b = sp[j].id; });
    relink(ins, Z); relink(outs, X);
    if (info.openIn) Z.forEach((z) => { const b = mk('N', z.r, colOf.iN, 'N'); made.push(b); d.edges.push(flip ? { id: newId('e'), a: z.id, b: b.id, o: '' } : { id: newId('e'), a: b.id, b: z.id, o: '' }); });
    if (info.openOut) X.forEach((x) => { const b = mk('N', x.r, colOf.oN, 'N'); made.push(b); d.edges.push(flip ? { id: newId('e'), a: b.id, b: x.id, o: '' } : { id: newId('e'), a: x.id, b: b.id, o: '' }); });
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) if (A[i][j]) d.edges.push(flip ? { id: newId('e'), a: X[i].id, b: Z[j].id, o: '' } : { id: newId('e'), a: Z[j].id, b: X[i].id, o: '' });
    d.nodes.push(...made);
    return made;
  }
  // A copy of d with every matrix arrow expanded (for computing).
  function expandMats(d) {
    if (!d.nodes.some((n) => n.t === 'M')) return d;
    const c = Object.assign({}, d, { nodes: d.nodes.map((n) => Object.assign({}, n)), edges: d.edges.map((e) => Object.assign({}, e)) });
    c.nodes.filter((n) => n.t === 'M').forEach((n) => expandMat(c, n.id, false));
    return c;
  }

  // Phase-free Z–X blocks that are exactly a matrix arrow: each spider has one wire leaving the block,
  // every wire inside joins a Z to an X (no H, no doubles). only: restrict to these node ids.
  function findMatBlocks(d, only) {
    const free = (n) => (n.t === 'Z' || n.t === 'X') && !n.cmd && !n.v && (!n.label || /^\s*0?\s*$/.test(n.label)) && (!only || only.has(n.id));
    const byId = new Map(d.nodes.map((n) => [n.id, n]));
    const hasH = (e) => splitOpts(e.o || '').includes('H');
    const taken = new Set(), blocks = [];
    // a chain of layers (Z X Z X …) splits into one block per Z→X step: first wires with Z left of X,
    // then the mirrored direction, then any (vertical drawings)
    const passes = [(z, x) => z.c < x.c, (z, x) => z.c > x.c, () => true];
    for (const dirOk of passes) {
      const K = new Map(d.nodes.filter((n) => free(n) && !taken.has(n.id)).map((n) => [n.id, n]));
      const inner = (e) => {
        if (e.a === e.b || !K.has(e.a) || !K.has(e.b) || hasH(e)) return false;
        const A = K.get(e.a), B = K.get(e.b);
        if (A.t === B.t) return false;
        return A.t === 'Z' ? dirOk(A, B) : dirOk(B, A);
      };
      const adj = new Map([...K.keys()].map((k) => [k, []]));
      d.edges.forEach((e) => { if (inner(e)) { adj.get(e.a).push(e.b); adj.get(e.b).push(e.a); } });
      const seen = new Set(), comps = [];
      for (const k of K.keys()) {
        if (seen.has(k) || !adj.get(k).length) continue;
        const comp = [k]; seen.add(k);
        for (let i = 0; i < comp.length; i++) adj.get(comp[i]).forEach((x) => { if (!seen.has(x)) { seen.add(x); comp.push(x); } });
        comps.push(comp);
      }
      // pieces in the same two columns (one Z column, one X column) belong to one arrow, e.g. an identity row of A;
      // so do lone spiders there (a zero column or row)
      const colKey = (comp) => { const zc = new Set(), xc = new Set(); comp.forEach((x) => (K.get(x).t === 'Z' ? zc : xc).add(K.get(x).c)); return zc.size === 1 && xc.size === 1 ? [...zc][0] + '|' + [...xc][0] : null; };
      const byCols = new Map(), merged = [];
      comps.forEach((c) => { const key = colKey(c); if (!key) return merged.push(c); if (!byCols.has(key)) { byCols.set(key, c.slice()); merged.push(byCols.get(key)); } else byCols.get(key).push(...c); });
      byCols.forEach((c, key) => {
        const [zc, xc] = key.split('|').map(Number);
        K.forEach((n, id) => { if (!seen.has(id) && !adj.get(id).length && n.c === (n.t === 'Z' ? zc : xc) && d.edges.filter((e) => e.a === id || e.b === id).length === 1) { seen.add(id); c.push(id); } });
      });
      for (const comp of merged) {
        const set = new Set(comp), zs = comp.filter((x) => K.get(x).t === 'Z'), xs = comp.filter((x) => K.get(x).t === 'X');
        if (!zs.length || !xs.length || (!only && comp.length < 3)) continue;
        const ext = new Map(), pairs = new Set();
        let ok = true;
        d.edges.forEach((e) => {
          if (!ok || (!set.has(e.a) && !set.has(e.b))) return;
          if (set.has(e.a) && set.has(e.b)) {
            if (!inner(e)) { ok = false; return; }
            const key = [e.a, e.b].sort().join('|');
            if (pairs.has(key)) ok = false; pairs.add(key);
            return;
          }
          const me = set.has(e.a) ? e.a : e.b;
          if (ext.has(me)) ok = false; else ext.set(me, e);
        });
        if (!ok || comp.some((x) => !ext.has(x))) continue;
        // live lookup: folding a neighbouring block first re-points these wires to its arrow
        const other = (x) => { const e = ext.get(x), id = e.a === x ? e.b : e.a; return byId.get(id) || d.nodes.find((n) => n.id === id); };
        // order top to bottom by the far end; on a matrix arrow, by its port
        const portOf = (x) => { const o = other(x); if (o.t !== 'M') return 0; const sd = matSides(d, o), e = ext.get(x); const f = sd.inSlots.concat(sd.outSlots).find((y) => y && y.e === e); return f ? f.j : 0; };
        const ord = (a, b) => other(a).r - other(b).r || portOf(a) - portOf(b) || other(a).c - other(b).c || byId.get(a).r - byId.get(b).r;
        zs.sort(ord); xs.sort(ord);
        const A = xs.map((x) => zs.map((z) => (pairs.has([x, z].sort().join('|')) ? 1 : 0)));
        comp.forEach((x) => taken.add(x));
        blocks.push({ ids: comp, zs, xs, ext, other, A });
      }
    }
    return blocks;
  }
  // Fold a block from findMatBlocks into one matrix arrow, in place. Returns the arrow, or null when
  // no cell keeps every input wire on the input side and every output on the output side.
  function foldMat(d, blk) {
    const byId = new Map(d.nodes.map((n) => [n.id, n]));
    const zc = blk.zs.reduce((s, x) => s + byId.get(x).c, 0) / blk.zs.length, xc = blk.xs.reduce((s, x) => s + byId.get(x).c, 0) / blk.xs.length;
    const flip = zc > xc;
    const inC = blk.zs.map((x) => blk.other(x).c), outC = blk.xs.map((x) => blk.other(x).c);
    // unflipped: every input neighbour strictly left of the arrow, every output strictly right
    const lo = flip ? Math.max(...outC) : Math.max(...inC), hi = flip ? Math.min(...inC) : Math.min(...outC);
    const set = new Set(blk.ids);
    const cells = blk.ids.map((x) => byId.get(x));
    const rMid = Math.round(cells.reduce((s, n) => s + n.r, 0) / cells.length);
    const free = (r, c) => !d.nodes.some((n) => !set.has(n.id) && n.r === r && n.c === c);
    let best = null;
    const cMid = Math.round((zc + xc) / 2);
    for (let c = lo + 1; c < hi; c++) for (let dr = 0; dr < 12 && !best; dr++) {
      for (const r of dr ? [rMid - dr, rMid + dr] : [rMid]) if (free(r, c)) { const sc = Math.abs(c - cMid) * 10 + dr; if (!best || sc < best.sc) best = { r, c, sc }; }
    }
    if (!best) return null;
    const usedNames = new Set(d.nodes.filter((n) => n.t === 'M').map((n) => n.label));
    const name = 'ABCDEFGHJKLMNPQRSTUVW'.split('').find((x) => !usedNames.has(x)) || 'A';
    const M = { id: newId('n'), r: best.r, c: best.c, t: 'M', label: name, cmd: '', v: flip ? '<' : '', st: '', lin: '', lout: '', mat: blk.A };
    blk.ids.forEach((x) => { const e = blk.ext.get(x); if (e.a === x) e.a = M.id; else e.b = M.id; });
    M.pin = blk.zs.map((x) => blk.ext.get(x).id); M.pout = blk.xs.map((x) => blk.ext.get(x).id);
    d.edges = d.edges.filter((e) => !(set.has(e.a) && set.has(e.b)));
    d.nodes = d.nodes.filter((n) => !set.has(n.id));
    d.nodes.push(M);
    return M;
  }

  root.ZX = {
    avoidOpts, boxGeom, boxExt, labelMath, stubOf, BOX_STUB, boxPort, boxTex, plainEdges, BOX_PAD,
    parseMatrix, matText, matSides, matInfo, matForTex, matLabels, setPort, matBundles, unbundle, expandMat, expandMats, findMatBlocks, foldMat,
    newId, stripComments, readGroup, splitTop, splitOpts, parseCell, parseBody, parseEquation,
    findEquations, bounds, isHalf, texGrid, textLean, fromHalf, nodeTex, arrowTex, diagramTex, docTex, spreadOpts, newDiagram, fracParts, unicodeToTex, sepSplit, sepJoin, sepScalarTex, unScalar,
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : typeof window !== 'undefined' ? window : self);   // self: inside a Web Worker

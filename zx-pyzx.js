// zx-pyzx.js — PyZX graph JSON ⇄ ZX Draw diagrams (no DOM).
// Browser: window.ZXP (needs window.ZX and window.ZXS). Node: require('./zx-pyzx.js').ZXP (zx-core / zx-sim next to it).
//
// Export writes PyZX's current format (graph_to_dict, "version": 2), which pyzx.Graph.from_json and ZXLive (.zxg) read:
//   { version: 2, backend: 'simple', variable_types: {}, inputs: [ids], outputs: [ids],
//     vertices: [{ id, t, pos: [row, qubit], phase? }], edges: [[s, t, type]] }
//   t: 0 boundary, 1 Z, 2 X, 3 H box, 4/5 W, 6 Z box · edge type: 1 plain, 2 Hadamard, 3 W wire · phases in units of π ("1/2").
// Import also reads the older PyZX / quanto format ({ wire_vertices, node_vertices, undir_edges }).
(function (root) {
  const ZX = root.ZX || (typeof require !== 'undefined' ? require('./zx-core.js').ZX : null);
  const ZXS = root.ZXS || (typeof require !== 'undefined' ? require('./zx-sim.js').ZXS : null);
  const hasH = (e) => ZX.splitOpts(e.o || '').includes('H');
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

  // a phase (linear form from ZXS.parsePhase) as PyZX writes it: a fraction of π, reduced mod 2
  function fracString(pi) {
    let [n, d] = pi;
    if (d < 0) { n = -n; d = -d; }
    n = ((n % (2 * d)) + 2 * d) % (2 * d);
    if (!n) return '';
    const g = gcd(n, d); n /= g; d /= g;
    return d === 1 ? String(n) : `${n}/${d}`;
  }
  function phaseOut(label, warn) {
    if (!label || !label.trim()) return '';
    let p;
    try { p = ZXS.parsePhase(label); } catch (_) { warn.push(`Phase “${label}” could not be read and was left out`); return ''; }
    const syms = Object.keys(p.sym);
    if (!syms.length && !p.rad) return fracString(p.pi);
    // symbolic: written as PyZX expects variables (a·π is just "a"); angles in units of π stay as they are
    const parts = syms.map((k) => { const [n, d] = p.sym[k], name = k.replace(/\\pi$/, '').replace(/^\\/, ''); /* a\pi (0/1 symbol) → a; \alpha → alpha */ const c =n === d ? '' : n === -d ? '-' : `${n}/${d}*`; return c + name; });
    const num = fracString(p.pi);
    if (num) parts.push(num);
    if (p.rad) { warn.push(`Phase “${label}” mixes in a decimal; written as a fraction of π`); parts.push(String(+(p.rad / Math.PI).toFixed(6))); }
    warn.push('Symbolic phases are written as PyZX variables — check them after loading');
    return parts.join(' + ').replace(/\+ -/g, '- ');
  }

  // ---------- export ----------
  // Wire points (pass-throughs and crossings) and, optionally, H boxes are not PyZX vertices:
  // each wire is followed through them to the next real vertex; an odd number of H on the way makes it a Hadamard edge.
  function toPyzx(d0, opt = {}) {
    const hEdges = opt.hEdges !== false;
    const warn = [];
    d0 = ZX.expandMats(d0);   // matrix arrows go out as their Z/X spiders
    const textIds = new Set(d0.nodes.filter((n) => n.t === 'T').map((n) => n.id));
    if (textIds.size) warn.push(`${textIds.size} text cell${textIds.size > 1 ? 's were' : ' was'} left out`);
    const d = Object.assign({}, d0, { nodes: d0.nodes.filter((n) => !textIds.has(n.id)), edges: d0.edges.filter((e) => !textIds.has(e.a) && !textIds.has(e.b)) });
    const an = ZXS.analyse(d);   // throws (with e.nodes) if the diagram has no meaning
    const kind = (id) => an.kind.get(id);
    const isReal = (id) => { const k = kind(id); return k === 'Z' || k === 'X' || k === 'B' || (k === 'H' && !hEdges); };
    const inc = new Map(d.nodes.map((n) => [n.id, []]));
    d.edges.forEach((e) => { if (inc.has(e.a)) inc.get(e.a).push(e); if (e.b !== e.a && inc.has(e.b)) inc.get(e.b).push(e); });
    const byEdge = new Map(d.edges.map((e) => [e.id, e]));
    const other = (e, id) => (e.a === id ? e.b : e.a);

    const real = d.nodes.filter((n) => isReal(n.id));
    const r0 = Math.min(...real.map((n) => n.r)), c0 = Math.min(...real.map((n) => n.c));
    const num = new Map(real.map((n, i) => [n.id, i]));
    const vertices = real.map((n) => {
      const k = kind(n.id), v = { id: num.get(n.id), t: k === 'B' ? 0 : k === 'Z' ? 1 : k === 'X' ? 2 : 3, pos: [n.c - c0, n.r - r0] };
      const ph = k === 'H' ? '1' : k === 'B' ? '' : phaseOut(n.label, warn);
      if (ph) v.phase = ph;
      return v;
    });
    const seen = new Set(), edges = [];
    real.forEach((v) => {
      inc.get(v.id).forEach((e0) => {
        if (seen.has(e0.id)) return;
        seen.add(e0.id);
        let h = hasH(e0) ? 1 : 0, edge = e0, cur = v.id, next = e0.a === e0.b ? v.id : other(e0, v.id), guard = 0;
        while (!isReal(next) && guard++ < 100000) {
          const k = kind(next);
          let ne;
          if (k === 'C') ne = byEdge.get(an.cross.get(next).get(edge.id));
          else ne = inc.get(next).find((x) => x !== edge) || null;   // pass-through, or an H box read as an edge
          if (k === 'H') h ^= 1;
          if (!ne) break;
          seen.add(ne.id);
          if (hasH(ne)) h ^= 1;
          cur = next; edge = ne; next = other(ne, cur);
        }
        if (isReal(next)) edges.push([num.get(v.id), num.get(next), h ? 2 : 1]);
      });
    });
    const io = ZXS.io(d0) || { ins: [], outs: [] };
    const vt = {};
    try { const si = ZXS.symInfo(d); si.symbols.forEach((k) => { vt[k.replace(/^\\/, '')] = si.bools.includes(k); }); } catch (_) {}
    const g = {
      version: 2, backend: 'simple', variable_types: vt,
      inputs: io.ins.filter((id) => num.has(id)).map((id) => num.get(id)),
      outputs: io.outs.filter((id) => num.has(id)).map((id) => num.get(id)),
      vertices, edges,
    };
    // compact JSON: one vertex / edge per line, readable and diff-friendly
    const json = '{\n' + [
      `"version": 2`, `"backend": "simple"`, `"variable_types": ${JSON.stringify(vt)}`,
      `"inputs": ${JSON.stringify(g.inputs)}`, `"outputs": ${JSON.stringify(g.outputs)}`,
      `"vertices": [\n${vertices.map((v) => '  ' + JSON.stringify(v)).join(',\n')}\n ]`,
      `"edges": [\n${edges.map((e) => '  ' + JSON.stringify(e)).join(',\n')}\n ]`,
    ].map((l) => ' ' + l).join(',\n') + '\n}';
    return { graph: g, json, warnings: [...new Set(warn)], stats: { vertices: vertices.length, edges: edges.length, hadamard: edges.filter((e) => e[2] === 2).length } };
  }
  function pythonSnippet(json, name = 'g') {
    return `import pyzx as zx\n\n${name} = zx.Graph.from_json(r'''${json}''')\nzx.draw(${name})\n`;
  }

  // ---------- import ----------
  function phaseIn(s, warn) {
    if (s == null) return '';
    s = String(s).trim();
    if (!s || s === '0') return '';
    const m = /^(-?\d+)\s*(?:\/\s*(\d+))?$/.exec(s);
    if (m) { const n = +m[1], dd = +(m[2] || 1); return ZXS.phaseTex({ pi: [n, dd], sym: {}, rad: 0 }); }
    if (/\\pi|π/.test(s)) return s.replace(/π/g, '\\pi');   // older files: "\pi/2"
    if (/^-?\d*\.\d+$/.test(s)) { warn.push(`Decimal phase ${s} kept as a fraction of π`); return `${s}\\pi`; }
    // PyZX variables mean name·π: Greek names become angles (\alpha, in units of π); single letters 0/1 symbols (aπ)
    const term = (t) => {
      t = t.trim(); const m2 = /^(-)?\s*(?:(\d+)\s*(?:\/\s*(\d+))?\s*\*?\s*)?([A-Za-z]\w*)$/.exec(t);
      if (!m2) return null;
      const [, neg, a, b, name] = m2, coef = a ? (b ? `\\frac{${a}}{${b}}` : a) : '';
      const sym = GREEK.has(name) ? `\\${name}` : name.length === 1 ? `${name}\\pi` : null;
      return sym && (neg ? '-' : '') + coef + sym;
    };
    const terms = s.split(/(?=[+-])/).map((t) => t.replace(/^\+/, '')).filter((t) => t.trim());
    const out = terms.map((t) => (/^\s*-?\d+(\s*\/\s*\d+)?\s*$/.test(t) ? ZXS.phaseTex({ pi: t.includes('/') ? t.split('/').map((x) => +x) : [+t, 1], sym: {}, rad: 0 }) : term(t)));
    if (out.every(Boolean)) return out.join('+').replace(/\+-/g, '-');
    warn.push(`Phase “${s}” kept as written — check it`);
    return s;
  }
  const GREEK = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'rho', 'sigma', 'tau', 'phi', 'chi', 'psi', 'omega']);
  const mkNode = (t, x, y, label = '') => ({ id: ZX.newId('n'), r: y, c: x, t, label, cmd: '', v: '', st: '', _x: x, _y: y });

  function readV2(j, warn) {
    const ns = new Map(), es = [];
    (j.vertices || []).forEach((v) => {
      const [x, y] = v.pos || [0, 0];
      const t = v.t | 0;
      let n;
      if (t === 0) n = mkNode('N', x, y);
      else if (t === 1 || t === 2) n = mkNode(t === 1 ? 'Z' : 'X', x, y, phaseIn(v.phase, warn));
      else if (t === 3) { n = mkNode('H', x, y); if (v.phase != null && String(v.phase).trim() !== '1') warn.push('An H box with a phase other than π was read as a plain H box'); }
      else { n = mkNode('T', x, y, t === 6 ? '\\text{Z-box}' : '\\text{W}'); warn.push(t === 6 ? 'Z boxes are not supported; shown as text' : 'W nodes are not supported; shown as text'); }
      ns.set(String(v.id), n);
    });
    (j.edges || []).forEach((e) => {
      const [s, t, ty] = Array.isArray(e) ? e : [e.src, e.tgt, e.type];
      if (!ns.has(String(s)) || !ns.has(String(t))) return;
      if (ty === 3) warn.push('W wires were read as plain wires');
      es.push({ a: ns.get(String(s)), b: ns.get(String(t)), h: ty === 2 });
    });
    return { ns, es };
  }
  function readLegacy(j, warn) {
    const ns = new Map(), es = [], hEdgeNodes = new Set();
    const co = (a) => { const c = (a && a.coord) || [0, 0]; return [c[0], -c[1]]; };
    Object.entries(j.wire_vertices || {}).forEach(([k, v]) => { const [x, y] = co(v.annotation); ns.set(k, mkNode('N', x, y)); });
    Object.entries(j.node_vertices || {}).forEach(([k, v]) => {
      const [x, y] = co(v.annotation), dt = v.data || {}, ty = String(dt.type || 'Z');
      if (ty === 'Z' || ty === 'X') ns.set(k, mkNode(ty, x, y, phaseIn(dt.value, warn)));
      else if (/^hadamard$/i.test(ty)) { const n = mkNode('H', x, y); ns.set(k, n); if (String(dt.is_edge) === 'true') hEdgeNodes.add(n); }
      else { ns.set(k, mkNode('T', x, y, `\\text{${ty.replace(/[^\w ]/g, '')}}`)); warn.push(`“${ty}” nodes are not supported; shown as text`); }
    });
    Object.values(j.undir_edges || {}).forEach((e) => {
      if (!ns.has(e.src) || !ns.has(e.tgt)) return;
      es.push({ a: ns.get(e.src), b: ns.get(e.tgt), h: e.type === 'hadamard' });
    });
    // an H vertex that stood for a Hadamard edge becomes that edge again
    hEdgeNodes.forEach((h) => {
      const mine = es.filter((e) => e.a === h || e.b === h);
      if (mine.length !== 2) return;
      const [p, q] = mine.map((e) => (e.a === h ? e.b : e.a));
      mine.forEach((e) => es.splice(es.indexOf(e), 1));
      es.push({ a: p, b: q, h: true });
      ns.forEach((n, k) => { if (n === h) ns.delete(k); });
    });
    return { ns, es };
  }
  // PyZX positions are often fractional: scale until they sit on whole cells, then resolve clashes
  function toGrid(nodes) {
    const vals = nodes.flatMap((n) => [n._x, n._y]);
    let k = 1;
    for (const f of [1, 2, 4, 3]) { if (vals.every((v) => Math.abs(v * f - Math.round(v * f)) < 0.12)) { k = f; break; } k = 2; }
    const used = new Set();
    const xs = nodes.map((n) => Math.round(n._x * k)), ys = nodes.map((n) => Math.round(n._y * k));
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    nodes.forEach((n, i) => {
      let r = ys[i] - y0, c = xs[i] - x0;
      while (used.has(r + ',' + c)) c++;
      used.add(r + ',' + c);
      n.r = r; n.c = c; delete n._x; delete n._y;
    });
  }
  // text → { diagram, warnings, stats } or null when it is not a PyZX graph
  function fromPyzx(text) {
    let j;
    try { j = typeof text === 'string' ? JSON.parse(text) : text; } catch (_) { return null; }
    if (!j || typeof j !== 'object') return null;
    const warn = [];
    let g;
    if (Array.isArray(j.vertices)) g = readV2(j, warn);
    else if (j.node_vertices || j.wire_vertices) g = readLegacy(j, warn);
    else return null;
    const nodes = [...new Set(g.ns.values())];
    if (!nodes.length) return null;
    toGrid(nodes);
    const d = ZX.newDiagram('');
    d.nodes = nodes;
    d.edges = g.es.map((e) => ({ id: ZX.newId('e'), a: e.a.id, b: e.b.id, o: e.h ? 'H' : '' }));
    return { diagram: d, warnings: [...new Set(warn)], stats: { vertices: nodes.length, edges: d.edges.length } };
  }
  const looksLikePyzx = (text) => /^\s*\{/.test(text) && /"(vertices|node_vertices|wire_vertices)"/.test(text);

  const ZXP = { toPyzx, fromPyzx, pythonSnippet, looksLikePyzx };
  if (typeof module !== 'undefined' && module.exports) module.exports.ZXP = ZXP;
  if (typeof window !== 'undefined') window.ZXP = ZXP;
})(typeof window !== 'undefined' ? window : globalThis);

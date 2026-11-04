// zx-sim.js — meaning of a ZX diagram (its matrix) and step-by-step simplification.
// No DOM. Browser: window.ZXS. Node: require('./zx-sim.js').ZXS (needs zx-core.js next to it).
//
// Conventions (zx-calculus / Coecke–Kissinger, unnormalised):
//   Z(α), n legs  = |0…0⟩⟨0…0| + e^{iα} |1…1⟩⟨1…1|
//   X(α), n legs  = |+…+⟩⟨+…+| + e^{iα} |−…−⟩⟨−…−|
//   H box / H wire = (1/√2)[[1,1],[1,−1]]
// Inputs are boundary points on the left of the wire they end, outputs on the right; both are
// ordered top to bottom. The matrix maps inputs to outputs, first wire = most significant bit.
//
// Every simplification step is checked by computing both diagrams: the relation written between
// two steps ('=' or '\propto') is what the computation shows, and a step that fails is never kept.
(function (root) {
  'use strict';
  const ZX = root.ZX || (typeof require !== 'undefined' ? require('./zx-core.js').ZX : null);

  // ---------- rationals ----------
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const Q = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; };
  const qadd = (a, b) => Q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
  const qmul = (a, b) => Q(a[0] * b[0], a[1] * b[1]);
  const qneg = (a) => [-a[0], a[1]];
  const qzero = (a) => a[0] === 0;

  // ---------- phases: linear forms  pi·π + Σ coeff·symbol (+ rad radians) ----------
  // A symbol's value is given in units of π (so α = 0.25 means π/4; for "aπ", a = 1 means π).
  const P0 = () => ({ pi: [0, 1], sym: {}, rad: 0 });
  function pAdd(a, b) {
    const r = { pi: qadd(a.pi, b.pi), sym: Object.assign({}, a.sym), rad: a.rad + b.rad };
    for (const k in b.sym) { r.sym[k] = r.sym[k] ? qadd(r.sym[k], b.sym[k]) : b.sym[k]; if (qzero(r.sym[k])) delete r.sym[k]; }
    return r;   // reduce mod 2π only once a phase is complete (pNorm), never mid-expression
  }
  function pScale(a, q) {
    const r = { pi: qmul(a.pi, q), sym: {}, rad: a.rad * q[0] / q[1] };
    for (const k in a.sym) { const v = qmul(a.sym[k], q); if (!qzero(v)) r.sym[k] = v; }
    return r;
  }
  function pNorm(a) {   // π part into (−1, 1]
    let [n, d] = a.pi;
    n = ((n % (2 * d)) + 2 * d) % (2 * d);
    if (n > d) n -= 2 * d;
    a.pi = Q(n, d);
    return a;
  }
  const pConst = (p) => !Object.keys(p.sym).length && !p.rad;
  const pIsZero = (p) => pConst(p) && qzero(p.pi);
  const pIsPi = (p) => pConst(p) && p.pi[0] === 1 && p.pi[1] === 1;
  // exact values live in Z[ζ_m], ζ_m = e^{2πi/m}; m is a multiple of 8 (so √2 is in it) and of 2·denominator
  const lcm = (a, b) => (a / gcd(a, b)) * b;
  const MAX_M = 240;
  const pNeedM = (p) => (pConst(p) ? 2 * p.pi[1] : Infinity);
  function pValue(p, vals) {             // radians
    let v = Math.PI * p.pi[0] / p.pi[1] + p.rad;
    for (const k in p.sym) { const base = symBase(k); v += Math.PI * (p.sym[k][0] / p.sym[k][1]) * (vals && base in vals ? vals[base] : 0); }
    return v;
  }
  const symBase = (k) => k.replace(/\\pi$/, '');
  // Put numbers in for symbols. Whole numbers stay exact (aπ with a = 1 is exactly π).
  function pSubst(p, vals) {
    if (!vals) return p;
    let r = { pi: p.pi.slice(), sym: {}, rad: p.rad };
    for (const k in p.sym) {
      const b = symBase(k), q = p.sym[k];
      if (!(b in vals)) { r.sym[k] = q; continue; }
      const v = vals[b];
      const v4 = Math.round(v * 4);
      if (Math.abs(v * 4 - v4) < 1e-9) r.pi = qadd(r.pi, qmul(q, Q(v4, 4)));   // multiples of π/4 stay exact
      else r.rad += Math.PI * v * q[0] / q[1];
    }
    return pNorm(r);
  }
  function pSymbols(p) { return Object.keys(p.sym).map(symBase); }
  // Symbols only ever written as "aπ" are 0/1 variables (the usual ZX convention for basis states).
  function boolSymbols(phs) {
    const withPi = new Set(), plain = new Set();
    phs.forEach((p) => Object.keys(p.sym).forEach((k) => (k.endsWith('\\pi') ? withPi : plain).add(symBase(k))));
    return [...withPi].filter((k) => !plain.has(k));
  }

  // Parse a phase written in LaTeX: \pi, \frac{\pi}{2}, -\frac{3\pi}{4}, \alpha+\beta, a\pi, 2\alpha, \pi/2 …
  function parsePhase(src) {
    let s = String(src || '').replace(/\\(left|right|,|;|!|quad)/g, ' ').replace(/\\cdot|\\times/g, '*').trim();
    if (!s) return P0();
    let i = 0;
    const peek = () => { while (s[i] === ' ') i++; return s[i]; };
    const fail = (m) => { throw new Error(`Can't read the phase “${src}”${m ? ': ' + m : ''}`); };
    // value = { c: Q constant, p: phase-linear-form } ; product allowed only when one side is a pure constant
    const K = (q) => ({ c: q, p: null });
    const isK = (v) => v.p === null;
    const toP = (v) => (isK(v) ? { pi: v.c, sym: {}, rad: 0 } : v.p);   // a plain number is a multiple of π
    const add = (a, b) => {
      if (isK(a) && isK(b)) return K(qadd(a.c, b.c));
      if (isK(a) && qzero(a.c)) return b;
      if (isK(b) && qzero(b.c)) return a;
      return { c: null, p: pAdd(toP(a), toP(b)) };
    };
    const mul = (a, b) => {
      if (isK(a) && isK(b)) return K(qmul(a.c, b.c));
      if (isK(a)) return { c: null, p: pScale(b.p, a.c) };
      if (isK(b)) return { c: null, p: pScale(a.p, b.c) };
      // symbol × π  (e.g. aπ): a symbol measured in π
      const pa = a.p, pb = b.p;
      const sym = (x) => Object.keys(x.sym).length === 1 && qzero(x.pi) && !x.rad;
      if (sym(pa) && pIsPi(pb)) return { c: null, p: symTimesPi(pa) };
      if (sym(pb) && pIsPi(pa)) return { c: null, p: symTimesPi(pb) };
      return fail('only linear phases are supported');
    };
    const symTimesPi = (x) => { const k = Object.keys(x.sym)[0]; return { pi: [0, 1], sym: { [k + '\\pi']: x.sym[k] }, rad: 0 }; };
    const group = () => {
      if (peek() !== '{') fail('expected {');
      let depth = 0, j = i;
      for (; j < s.length; j++) { if (s[j] === '{') depth++; else if (s[j] === '}' && --depth === 0) break; }
      const inner = s.slice(i + 1, j); i = j + 1;
      return parseExpr(inner);
    };
    function parseExpr(t) {
      const save = [s, i]; s = t; i = 0;
      let v = term();
      while (true) {
        const c = peek();
        if (c === '+') { i++; v = add(v, term()); } else if (c === '-') { i++; v = add(v, neg(term())); } else break;
      }
      if (peek() !== undefined) fail(`unexpected “${s.slice(i)}”`);
      [s, i] = save;
      return v;
    }
    const neg = (v) => (isK(v) ? K(qneg(v.c)) : { c: null, p: pScale(v.p, [-1, 1]) });
    function term() {
      let v = null;
      while (true) {
        const c = peek();
        if (c === undefined || c === '+' || c === '-' && v !== null || c === ')' ) break;
        if (c === '-' && v === null) { i++; v = neg(factor()); continue; }
        if (c === '*') { i++; continue; }
        if (c === '/') { i++; const d = factor(); if (!isK(d) || qzero(d.c)) fail('divide by a number'); v = mul(v, K(Q(d.c[1], d.c[0]))); continue; }
        const f = factor();
        v = v === null ? f : mul(v, f);
      }
      if (v === null) fail();
      return v;
    }
    function factor() {
      const c = peek();
      if (c === '(') { i++; let depth = 1, j = i; for (; j < s.length; j++) { if (s[j] === '(') depth++; else if (s[j] === ')' && --depth === 0) break; } const inner = s.slice(i, j); i = j + 1; return parseExpr(inner); }
      if (c === '{') return group();
      if (/[0-9.]/.test(c)) {
        const m = /^[0-9]*\.?[0-9]+/.exec(s.slice(i)); i += m[0].length;
        const str = m[0];
        if (str.includes('.')) { const dp = str.split('.')[1].length; return K(Q(Math.round(+str * 10 ** dp), 10 ** dp)); }
        return K([+str, 1]);
      }
      if (c === '\\') {
        const m = /^\\([A-Za-z]+)/.exec(s.slice(i)); if (!m) fail();
        i += m[0].length;
        const name = m[1];
        if (name === 'pi') return { c: null, p: { pi: [1, 1], sym: {}, rad: 0 } };
        if (name === 'frac' || name === 'dfrac' || name === 'tfrac') { const a = group(), b = group(); if (!isK(b) || qzero(b.c)) fail('denominator must be a number'); return mul(a, K(Q(b.c[1], b.c[0]))); }
        if (name === 'mathrm' || name === 'text' || name === 'mathbf') return group();
        return symbol('\\' + name);
      }
      if (/[A-Za-z]/.test(c)) { i++; return symbol(c); }
      return fail(`unexpected “${c}”`);
    }
    function symbol(name) {
      // optional subscript: \alpha_1, a_{12}
      if (s[i] === '_') { i++; if (s[i] === '{') { const j = s.indexOf('}', i); name += '_{' + s.slice(i + 1, j) + '}'; i = j + 1; } else { name += '_' + s[i]; i++; } }
      return { c: null, p: { pi: [0, 1], sym: { [name]: [1, 1] }, rad: 0 } };
    }
    const v = parseExpr(s);
    // Phases without π are read in units of π, as in PyZX / ZXLive: 1/2 means π/2
    if (isK(v)) return pNorm({ pi: v.c, sym: {}, rad: 0 });
    return pNorm(v.p);
  }
  function qTex(q, unit) {   // q·unit as LaTeX, sign handled by caller (q > 0)
    const [n, d] = q;
    const num = (n === 1 ? '' : String(n)) + unit;
    return d === 1 ? num : `\\frac{${num}}{${d}}`;
  }
  function phaseTex(p) {
    const parts = [];
    const push = (q, unit) => { if (qzero(q)) return; parts.push((q[0] < 0 ? '-' : '+') + qTex([Math.abs(q[0]), q[1]], unit)); };
    Object.keys(p.sym).sort().forEach((k) => push(p.sym[k], k));
    if (p.rad) parts.push((p.rad < 0 ? '-' : '+') + +Math.abs(p.rad).toFixed(6));
    push(p.pi, '\\pi');
    let t = parts.join('');
    if (t.startsWith('+')) t = t.slice(1);
    return t;
  }

  // ---------- the diagram as a graph ----------
  const WIRE_CMDS = new Set(['', 'N', 'None', 'NoneDouble']);
  const hasH = (e) => ZX.splitOpts(e.o || '').includes('H');
  // Text cells (⋮, labels) are ignored in computation, with any wires touching them.
  // Matrix arrows are computed as their Z/X normal form.
  function noText(d) {
    d = ZX.expandMats(d);
    if (!d.nodes.some((n) => n.t === 'T')) return d;
    const t = new Set(d.nodes.filter((n) => n.t === 'T').map((n) => n.id));
    return Object.assign({}, d, { nodes: d.nodes.filter((n) => !t.has(n.id)), edges: d.edges.filter((e) => !t.has(e.a) && !t.has(e.b)) });
  }
  // Classify nodes and check the diagram can be given a meaning.
  // an error about particular nodes carries their ids (the editor circles them)
  const nodeErr = (msg, ...ns) => { const e = new Error(msg); e.nodes = ns.map((n) => n.id); return e; };
  function analyse(d) {
    const byId = new Map(d.nodes.map((n) => [n.id, n]));
    const deg = new Map(d.nodes.map((n) => [n.id, 0]));
    d.edges.forEach((e) => { if (byId.has(e.a) && byId.has(e.b)) { deg.set(e.a, deg.get(e.a) + 1); deg.set(e.b, deg.get(e.b) + 1); } });
    const kind = new Map(), cross = new Map();
    // a wire point where 4 wires meet as two straight lines (─ and │, or two diagonals) is a crossing
    const crossing = (n, loose) => {
      const es = d.edges.filter((e) => e.a === n.id || e.b === n.id);
      if (es.length !== 4 || es.some((e) => e.a === e.b)) return null;
      const dir = es.map((e) => { const o = byId.get(e.a === n.id ? e.b : e.a), dr = o.r - n.r, dc = o.c - n.c, l = Math.hypot(dr, dc) || 1; return [dr / l, dc / l]; });
      const opp = (i, j) => dir[i][0] * dir[j][0] + dir[i][1] * dir[j][1] < -0.95;
      const pairs = [[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]];
      const mk = ([a, b, c, e]) => new Map([[es[a].id, es[b].id], [es[b].id, es[a].id], [es[c].id, es[e].id], [es[e].id, es[c].id]]);
      for (const p of pairs) if (opp(p[0], p[1]) && opp(p[2], p[3])) return mk(p);
      if (!loose) return null;
      // a Dot: the two wires that continue most straight pass through each other (swaps, bent crossings)
      const dot = (i, j) => dir[i][0] * dir[j][0] + dir[i][1] * dir[j][1];
      return mk(pairs.reduce((best, p) => (dot(p[0], p[1]) + dot(p[2], p[3]) < dot(best[0], best[1]) + dot(best[2], best[3]) ? p : best)));
    };
    for (const n of d.nodes) {
      const k = deg.get(n.id);
      if (n.t === 'T') { kind.set(n.id, 'skip'); continue; }
      if (n.t === 'P') {
        if (k === 0) kind.set(n.id, 'skip');
        else if (k === 1) kind.set(n.id, 'B');
        else if (k === 2) kind.set(n.id, 'W');
        else if (k === 4 && crossing(n, true)) { kind.set(n.id, 'C'); cross.set(n.id, crossing(n, true)); }
        else throw nodeErr(`A dot at row ${n.r + 1}, column ${n.c + 1} joins ${k} wires. A dot passes 2 wires through, or 4 as two crossing wires; to join wires use a spider`, n);
      } else if (n.t === 'N') {
        if (!WIRE_CMDS.has(n.cmd || '')) throw nodeErr(`\\zx${n.cmd}{} has no fixed meaning here`, n);
        if (k === 0) kind.set(n.id, 'skip');
        else if (k === 1) kind.set(n.id, 'B');
        else if (k === 2) kind.set(n.id, 'W');
        else if (k === 4 && crossing(n, true)) { kind.set(n.id, 'C'); cross.set(n.id, crossing(n, true)); }   // re-imported Dots are plain \zxN
        else throw nodeErr(`A wire point at row ${n.r + 1}, column ${n.c + 1} joins ${k} wires. Wires may only cross there in two straight lines; to join wires use a spider`, n);
      } else if (n.t === 'H') {
        if (k !== 2) throw nodeErr(`An H box with ${k} wire${k === 1 ? '' : 's'} (row ${n.r + 1}, column ${n.c + 1}) — H boxes need exactly 2`, n);
        kind.set(n.id, 'H');
      } else {
        kind.set(n.id, n.t);
        try { n._ph = parsePhase(n.label); } catch (e) { e.nodes = [n.id]; throw e; }
      }
    }
    return { byId, kind, cross };
  }
  // Boundary order: inputs left, outputs right, each top to bottom.
  function boundaries(d, an) {
    const B = d.nodes.filter((n) => an.kind.get(n.id) === 'B');
    if (!B.length) return { ins: [], outs: [] };
    const cs = d.nodes.filter((n) => an.kind.get(n.id) !== 'skip').map((n) => n.c);
    const mid = (Math.min(...cs) + Math.max(...cs)) / 2;
    const ins = [], outs = [];
    B.forEach((b) => {
      const e = d.edges.find((x) => x.a === b.id || x.b === b.id);
      const o = an.byId.get(e.a === b.id ? e.b : e.a);
      // the wire leaves to the right → input; to the left → output; vertical → by which half it sits in
      // a C-shaped wire (\ar[d, C]) bends back: both its ends face right (outputs); C- faces left (inputs)
      const sh = ZX.splitOpts(e.o || '');
      const bent = b.c === o.c && (sh.some((t) => /^C['.]?$/.test(t)) ? 'out' : sh.includes('C-') ? 'in' : null);
      const side = bent || (b.c < o.c ? 'in' : b.c > o.c ? 'out' : (b.c < mid ? 'in' : b.c > mid ? 'out' : (b.r <= o.r ? 'in' : 'out')));
      (side === 'in' ? ins : outs).push(b);
    });
    const ord = (a, b) => a.r - b.r || a.c - b.c;
    ins.sort(ord); outs.sort(ord);
    return { ins, outs };
  }

  // ---------- rings: exact cyclotomic integers Z[ζ_m] (with a factor 2^(−e/2)) and complex floats ----------
  // An exact number is a BigInt polynomial in ζ of degree < φ(m), reduced mod the cyclotomic polynomial Φ_m.
  // That form is unique, so equality is exact. m = 8 gives the familiar a + bω + cω² + dω³.
  const polyDiv = (num, den) => {   // exact integer division of polynomials (low → high), den monic
    num = num.slice(); const q = new Array(Math.max(1, num.length - den.length + 1)).fill(0n);
    for (let k = num.length - den.length; k >= 0; k--) { const c = num[k + den.length - 1]; if (!c) continue; q[k] = c; for (let t = 0; t < den.length; t++) num[k + t] -= c * den[t]; }
    return q;
  };
  const phiCache = new Map();
  function cyclotomic(m) {
    if (phiCache.has(m)) return phiCache.get(m);
    let p = new Array(m + 1).fill(0n); p[0] = -1n; p[m] = 1n;   // x^m − 1
    for (let d = 1; d < m; d++) if (m % d === 0) p = polyDiv(p, cyclotomic(d));
    while (p.length > 1 && !p[p.length - 1]) p.pop();
    phiCache.set(m, p);
    return p;
  }
  const ringCache = new Map();
  function cycloRing(m) {
    if (ringCache.has(m)) return ringCache.get(m);
    const P = cyclotomic(m), D = P.length - 1;
    const reduce = (a) => {
      for (let k = a.length - 1; k >= D; k--) { const c = a[k]; if (!c) continue; for (let t = 0; t < D; t++) a[k - D + t] -= c * P[t]; a[k] = 0n; }
      return a.length > D ? a.slice(0, D) : a;
    };
    const zero = () => new Array(D).fill(0n);
    const pw = [];   // ζ^k for k = 0 … m−1
    let cur = zero(); cur[0] = 1n;
    for (let k = 0; k < m; k++) { pw.push(cur); const nx = [0n].concat(cur); cur = reduce(nx); }
    const R = {
      m, D, exact: true,
      zero, one: () => pw[0].slice(),
      w: (k) => pw[((k % m) + m) % m].slice(),
      add: (x, y) => { const r = new Array(D); for (let t = 0; t < D; t++) r[t] = x[t] + y[t]; return r; },
      neg: (x) => x.map((c) => -c),
      mul: (x, y) => {
        const r = new Array(2 * D - 1).fill(0n);
        for (let a = 0; a < D; a++) { if (!x[a]) continue; for (let b = 0; b < D; b++) if (y[b]) r[a + b] += x[a] * y[b]; }
        return reduce(r);
      },
      isZero: (x) => x.every((c) => !c),
      eq: (x, y) => x.every((c, t) => c === y[t]),
      toC: (x) => { let re = 0, im = 0; for (let t = 0; t < D; t++) if (x[t]) { const c = Number(x[t]), a = 2 * Math.PI * t / m; re += c * Math.cos(a); im += c * Math.sin(a); } return [re, im]; },
      pw,
    };
    R.sqrt2 = R.add(R.w(m / 8), R.neg(R.w(3 * m / 8)));   // ζ_8 − ζ_8³ = √2
    ringCache.set(m, R);
    return R;
  }
  const Nm = {
    zero: () => [0, 0], one: () => [1, 0],
    add: (x, y) => [x[0] + y[0], x[1] + y[1]],
    mul: (x, y) => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]],
    isZero: (x) => x[0] === 0 && x[1] === 0,
    cis: (t) => [Math.cos(t), Math.sin(t)],
  };

  // Tensor = { legs: [label], data: [element], e: exponent of 1/√2 } ; legs[0] is the most significant bit
  function spiderTensor(R, exact, t, ph, legs, vals) {
    const n = legs.length, N = 1 << n, data = new Array(N);
    if (exact) {
      const k = ph.pi[0] * (R.m / (2 * ph.pi[1]));   // e^{iα} = ζ_m^k
      const z = R.w(k);
      if (t === 'Z') { for (let x = 0; x < N; x++) data[x] = R.zero(); data[0] = R.add(data[0], R.one()); data[N - 1] = R.add(data[N - 1], z); return { legs, data, e: 0 }; }
      const zn = R.neg(z);
      for (let x = 0; x < N; x++) data[x] = R.add(R.one(), popcount(x) & 1 ? zn : z);
      return { legs, data, e: n };
    }
    const c = Nm.cis(pValue(ph, vals));
    if (t === 'Z') { for (let x = 0; x < N; x++) data[x] = [0, 0]; data[0] = Nm.add(data[0], [1, 0]); data[N - 1] = Nm.add(data[N - 1], c); return { legs, data, e: 0 }; }
    for (let x = 0; x < N; x++) { const par = popcount(x) & 1; data[x] = par ? [1 - c[0], -c[1]] : [1 + c[0], c[1]]; }
    return { legs, data, e: n };
  }
  const popcount = (x) => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };
  function hTensor(R, exact, legs) {
    const one = R.one(), m1 = exact ? R.neg(R.one()) : [-1, 0];
    return { legs, data: [one, one, one, m1], e: 1 };
  }
  function idTensor(R, exact, legs) {
    const one = R.one(), z = R.zero();
    return { legs, data: [one, z, z, one], e: 0 };
  }

  const MAX_RANK = 20, MAX_EXACT_RANK = 16;
  function contractPair(R, A, B) {
    const shared = A.legs.filter((l) => B.legs.includes(l));
    const oa = A.legs.filter((l) => !shared.includes(l)), ob = B.legs.filter((l) => !shared.includes(l));
    const out = oa.concat(ob);
    if (R.exact && out.length > MAX_EXACT_RANK) { const er = new Error('too large for exact'); er.big = true; throw er; }
    if (out.length > MAX_RANK) throw new Error('This diagram is too large to compute (too many wires open at once)');
    const pos = (legs, l) => legs.length - 1 - legs.indexOf(l);   // bit position
    const scatter = (labels, legs) => {   // table: assignment of `labels` (MSB first) → index bits in `legs`
      const n = labels.length, T = new Array(1 << n);
      const ps = labels.map((l) => pos(legs, l));
      for (let x = 0; x < (1 << n); x++) { let v = 0; for (let j = 0; j < n; j++) if (x & (1 << (n - 1 - j))) v |= 1 << ps[j]; T[x] = v; }
      return T;
    };
    const sA = scatter(shared, A.legs), sB = scatter(shared, B.legs), oA = scatter(oa, A.legs), oB = scatter(ob, B.legs);
    const nb = ob.length, NS = 1 << shared.length, NO = 1 << out.length, data = new Array(NO);
    for (let o = 0; o < NO; o++) {
      const ai = oA[o >> nb], bi = oB[o & ((1 << nb) - 1)];
      let acc = R.zero();
      for (let s = 0; s < NS; s++) {
        const x = A.data[ai | sA[s]]; if (R.isZero(x)) continue;
        const y = B.data[bi | sB[s]]; if (R.isZero(y)) continue;
        acc = R.add(acc, R.mul(x, y));
      }
      data[o] = acc;
    }
    return { legs: out, data, e: A.e + B.e };
  }
  function contractAll(R, ts) {
    ts = ts.slice();
    if (!ts.length) return { legs: [], data: [R.one()], e: 0 };
    while (ts.length > 1) {
      let best = null;
      for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
        const sh = ts[i].legs.filter((l) => ts[j].legs.includes(l)).length;
        if (!sh) continue;
        const rank = ts[i].legs.length + ts[j].legs.length - 2 * sh;
        const cost = ts[i].legs.length + ts[j].legs.length - sh;
        if (!best || rank < best.rank || (rank === best.rank && cost < best.cost)) best = { i, j, rank, cost };
      }
      if (!best) {   // disconnected parts: outer product of the two smallest
        const ord = ts.map((t, k) => [t.legs.length, k]).sort((a, b) => a[0] - b[0]);
        best = { i: Math.min(ord[0][1], ord[1][1]), j: Math.max(ord[0][1], ord[1][1]) };
      }
      const C = contractPair(R, ts[best.i], ts[best.j]);
      ts.splice(best.j, 1); ts.splice(best.i, 1); ts.push(C);
    }
    return ts[0];
  }

  // Build the tensor network: every wire is its own identity / Hadamard tensor between two leg labels.
  function evaluate(d, opt) {
    opt = opt || {};
    d = noText(d);
    const an = analyse(d);
    const { ins, outs } = boundaries(d, an);
    const spiders = d.nodes.filter((n) => an.kind.get(n.id) === 'Z' || an.kind.get(n.id) === 'X');
    const eff = new Map(spiders.map((n) => [n.id, pSubst(n._ph, opt.values)]));
    let m = opt.m || 8;
    spiders.forEach((n) => { m = lcm(m, pNeedM(eff.get(n.id))); });
    const exactOk = isFinite(m) && m <= MAX_M;
    if (opt.exact === true && !exactOk) throw new Error('Exact values need every phase to be a fraction of π (with a small denominator)');
    if (opt.exact !== false && exactOk) {
      try { return run(cycloRing(m), true); } catch (e) { if (!e.big || opt.exact === true) throw e; }   // too big for exact → numbers
    }
    return run(Nm, false);
    function run(R, exact) {
    const ends = new Map(d.nodes.map((n) => [n.id, []]));
    const legOf = new Map();   // node|edge → leg label (for crossings)
    const ts = [];
    d.edges.forEach((e) => {
      if (!an.byId.has(e.a) || !an.byId.has(e.b)) return;
      const la = e.id + ':a', lb = e.id + ':b';
      ends.get(e.a).push(la); ends.get(e.b).push(lb);
      legOf.set(e.a + '|' + e.id, la); legOf.set(e.b + '|' + e.id, lb);
      ts.push(hasH(e) ? hTensor(R, exact, [la, lb]) : idTensor(R, exact, [la, lb]));
    });
    const open = new Map();
    d.nodes.forEach((n) => {
      const k = an.kind.get(n.id), legs = ends.get(n.id);
      if (k === 'B') { open.set(n.id, legs[0]); return; }
      if (k === 'skip') return;
      if (k === 'W') ts.push(idTensor(R, exact, legs));
      else if (k === 'C') { const done = new Set(); an.cross.get(n.id).forEach((p, q) => { if (done.has(q)) return; done.add(q); done.add(p); ts.push(idTensor(R, exact, [legOf.get(n.id + '|' + q), legOf.get(n.id + '|' + p)])); }); }
      else if (k === 'H') ts.push(hTensor(R, exact, legs));
      else ts.push(spiderTensor(R, exact, k, eff.get(n.id), legs, opt.values));
    });
    // a boundary's own leg is open: rename so the wire tensor's leg is the open index
    const T = contractAll(R, ts);
    const order = outs.map((b) => open.get(b.id)).concat(ins.map((b) => open.get(b.id)));
    const M = permute(T, order);
    return { exact, R, ins: ins.length, outs: outs.length, data: M.data, e: M.e, symbols: [...new Set(spiders.flatMap((n) => pSymbols(n._ph)))], bools: boolSymbols(spiders.map((n) => n._ph)), bigFallback: !exact && exactOk && opt.exact !== false };
    }
  }
  // the ζ_m an exact evaluation of d needs (Infinity if some phase has no exact value)
  function needM(d, values) {
    d = noText(d);
    const an = analyse(d);
    let m = 8;
    d.nodes.forEach((n) => { const k = an.kind.get(n.id); if (k === 'Z' || k === 'X') m = lcm(m, pNeedM(pSubst(n._ph, values))); });
    return m;
  }
  function permute(T, order) {
    if (T.legs.length !== order.length) throw new Error('internal: open wires do not match the boundaries');
    const n = order.length, N = 1 << n, data = new Array(N);
    const ps = order.map((l) => T.legs.length - 1 - T.legs.indexOf(l));
    for (let x = 0; x < N; x++) { let v = 0; for (let j = 0; j < n; j++) if (x & (1 << (n - 1 - j))) v |= 1 << ps[j]; data[x] = T.data[v]; }
    return { legs: order, data, e: T.e };
  }

  // ---------- comparing two meanings ----------
  const toNum = (m) => m.data.map((x) => {
    const f = Math.pow(2, -m.e / 2);
    if (!m.exact) return [x[0] * f, x[1] * f];
    const [re, im] = m.R.toC(x);
    return [re * f, im * f];
  });
  // where two matrices first disagree, as "⟨in| → |out⟩"
  function diffAt(A, i) {
    const out = i >> A.ins, inn = i & ((1 << A.ins) - 1);
    const bits = (x, n) => (n ? x.toString(2).padStart(n, '0') : '');
    return `the matrices differ at input ${A.ins ? '|' + bits(inn, A.ins) + '⟩' : '(none)'} → output ${A.outs ? '|' + bits(out, A.outs) + '⟩' : '(none)'}`;
  }
  // 'eq' (equal), 'prop' (equal up to a non-zero scalar), 'ne'; plus the scalar when proportional
  function relate(A, B) {
    if (A.ins !== B.ins || A.outs !== B.outs) return { rel: 'ne', why: `different numbers of inputs/outputs (${A.ins}→${A.outs} vs ${B.ins}→${B.outs})` };
    if (A.exact && B.exact && A.R === B.R) {
      const R = A.R;
      const zA = A.data.every(R.isZero), zB = B.data.every(R.isZero);
      if (zA || zB) return { rel: zA && zB ? 'eq' : 'ne', why: zA !== zB ? 'one side is zero' : '' };
      const j = A.data.findIndex((x) => !R.isZero(x));
      if (R.isZero(B.data[j])) return { rel: 'ne', why: diffAt(A, j) };
      for (let i = 0; i < A.data.length; i++) if (!R.eq(R.mul(A.data[i], B.data[j]), R.mul(B.data[i], A.data[j]))) return { rel: 'ne', why: diffAt(A, i) };
      const m = Math.max(A.e, B.e);
      let a = A.data[j], b = B.data[j];
      for (let k = A.e; k < m; k++) a = R.mul(a, R.sqrt2);
      for (let k = B.e; k < m; k++) b = R.mul(b, R.sqrt2);
      return { rel: R.eq(a, b) ? 'eq' : 'prop' };
    }
    const a = toNum(A), b = toNum(B);
    const nrm = (v) => Math.max(...v.map((x) => Math.hypot(x[0], x[1])));
    const na = nrm(a), nb = nrm(b), tol = 1e-9;
    if (na < tol || nb < tol) return { rel: na < tol && nb < tol ? 'eq' : 'ne' };
    let j = 0; for (let i = 1; i < a.length; i++) if (Math.hypot(...a[i]) > Math.hypot(...a[j])) j = i;
    for (let i = 0; i < a.length; i++) {
      const l = Nm.mul(a[i], b[j]), r = Nm.mul(b[i], a[j]);
      if (Math.hypot(l[0] - r[0], l[1] - r[1]) > tol * na * nb * 4) return { rel: 'ne', why: diffAt(A, i) };
    }
    const ratio = Math.hypot(b[j][0] - a[j][0], b[j][1] - a[j][1]) / Math.hypot(...a[j]);
    return { rel: ratio < 1e-9 ? 'eq' : 'prop' };
  }
  // Compare two diagrams for every value of their symbols: 0/1 symbols (aπ) are tried in every
  // combination, exactly when possible; angle symbols (α) get several random values.
  // fixed pseudo-random trial values (same for every step of one simplification, so results can be reused)
  const trialSeed = { v: Math.random() };
  function trialValue(name, t) {
    let h = Math.floor(trialSeed.v * 1e9) ^ (t * 2654435761);
    for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return ((h >>> 0) / 4294967296) * 4 - 2;
  }
  // symbols of a diagram without computing it
  function symInfo(d) {
    d = noText(d);
    const an = analyse(d);
    const phs = d.nodes.filter((n) => { const k = an.kind.get(n.id); return k === 'Z' || k === 'X'; }).map((n) => n._ph);
    return { symbols: [...new Set(phs.flatMap(pSymbols))], bools: boolSymbols(phs) };
  }
  // `cache` (optional, used while simplifying): Map diagram → Map(key → evaluation), for diagrams that no longer change
  function evalCached(d, opt, cache) {
    if (!cache) return evaluate(d, opt);
    const key = JSON.stringify([opt.values, opt.m, opt.exact]);
    let m = cache.get(d); if (!m) cache.set(d, (m = new Map()));
    if (!m.has(key)) m.set(key, evaluate(d, opt));
    return m.get(key);
  }
  function compare(d1, d2, cache) {
    const s1 = symInfo(d1), s2 = symInfo(d2);
    const syms = [...new Set(s1.symbols.concat(s2.symbols))];
    const b1 = new Set(s1.bools), b2 = new Set(s2.bools);
    const bools = syms.filter((k) => (b1.has(k) || !s1.symbols.includes(k)) && (b2.has(k) || !s2.symbols.includes(k)));
    const reals = syms.filter((k) => !bools.includes(k));
    if (bools.length > 8) throw new Error('Too many 0/1 symbols to check every case');
    const combos = [];
    for (let m = 0; m < (1 << bools.length); m++) combos.push(Object.fromEntries(bools.map((k, j) => [k, (m >> j) & 1])));
    const trials = reals.length ? 4 : 1;
    let worst = 'eq', exact = true;
    for (let t = 0; t < trials; t++) {
      const rv = Object.fromEntries(reals.map((k) => [k, cache ? trialValue(k, t) : Math.random() * 4 - 2]));
      for (const c of combos) {
        const values = Object.assign({}, rv, c);
        let A, B;
        try { const m = lcm(needM(d1, values), needM(d2, values)); A = evalCached(d1, { values, m }, cache); B = evalCached(d2, { values, m }, cache); } catch (e) { A = null; }
        if (!A || A.exact !== B.exact || (A.exact && A.R !== B.R)) { A = evalCached(d1, { exact: false, values }, cache); B = evalCached(d2, { exact: false, values }, cache); }
        if (!A.exact) exact = false;
        const r = relate(A, B);
        if (r.rel === 'ne') return Object.assign(r, { exact: A.exact, symbols: syms, bools, at: values });
        if (r.rel === 'prop') worst = 'prop';
      }
    }
    return { rel: worst, exact, symbols: syms, bools };
  }

  // Compare at one fixed choice of symbol values (exact when the values allow it).
  function compareAt(d1, d2, values) {
    let A, B;
    try { const m = lcm(needM(d1, values), needM(d2, values)); A = evaluate(d1, { values, m }); B = evaluate(d2, { values, m }); } catch (e) { A = null; }
    if (!A || A.exact !== B.exact || (A.exact && A.R !== B.R)) { A = evaluate(d1, { exact: false, values }); B = evaluate(d2, { exact: false, values }); }
    const syms = [...new Set(symInfo(d1).symbols.concat(symInfo(d2).symbols))];
    return Object.assign(relate(A, B), { exact: A.exact, symbols: syms, at: values });
  }

  // ---------- presenting a matrix ----------
  // exact entry a + bω + cω² + dω³ → LaTeX
  // e^{iπ·a/b} as LaTeX
  function unitTex(num, den) {
    let a = ((num % (2 * den)) + 2 * den) % (2 * den);
    const g = gcd(a, den); a /= g; const b = den / g;
    if (a === 0) return '1';
    if (b === 1) return '-1';
    if (b === 2) return a === 1 ? 'i' : '-i';
    if (a > b) return '-' + unitTex(a - b, b);   // e^{iπ(1+t)} = −e^{iπt}
    return `e^{${a === 1 ? '' : a}i\\pi/${b}}`;
  }
  function entryTex(R, x) {
    if (R.m === 8) return exTex(x);
    if (R.isZero(x)) return '0';
    // a single power of ζ?
    for (let k = 0; k < R.m; k++) {
      if (R.eq(x, R.pw[k])) return unitTex(2 * k, R.m);
    }
    // otherwise Σ c_t ζ^t in the power basis
    const terms = [];
    x.forEach((c, t) => {
      if (!c) return;
      const u = t ? unitTex(2 * t, R.m) : '1';
      const neg = c < 0n, a = neg ? -c : c;
      const body = u === '1' ? String(a) : (a === 1n ? u : `${a}${u}`);
      terms.push((neg ? '-' : '+') + body);
    });
    let s = terms.join(''); if (s.startsWith('+')) s = s.slice(1);
    return s;
  }
  function exTex(x) {
    const nz = x.map((v, i) => [v, i]).filter(([v]) => v);
    if (!nz.length) return '0';
    if (nz.length === 1 && (nz[0][0] === 1n || nz[0][0] === -1n)) {
      const k = nz[0][1] + (nz[0][0] < 0 ? 4 : 0);
      return ['1', 'e^{i\\pi/4}', 'i', 'e^{3i\\pi/4}', '-1', '-e^{i\\pi/4}', '-i', '-e^{3i\\pi/4}'][k];
    }
    // re = a + (b−d)/√2 , im = c + (b+d)/√2
    const [a, b, c, d] = x;
    const part = (int, s2) => {   // int + s2/√2  → string, or ''
      const terms = [];
      if (int) terms.push(String(int));
      if (s2) { const g = s2 < 0 ? -s2 : s2; terms.push((s2 < 0 ? '-' : '+') + (g === 1n ? '\\tfrac{1}{\\sqrt2}' : `\\tfrac{${g}}{\\sqrt2}`)); }
      let t = terms.join(''); if (t.startsWith('+')) t = t.slice(1);
      return t;
    };
    const re = part(a, b - d), im = part(c, b + d);
    if (!im) return re || '0';
    const imt = im === '1' ? 'i' : im === '-1' ? '-i' : (/[+-]/.test(im.slice(1)) ? `(${im})i` : im + 'i');
    if (!re) return imt;
    return re + (imt.startsWith('-') ? '' : '+') + imt;
  }
  function prefTex(e, g) {   // g · 2^(−e/2)
    const gs = g === 1n ? '' : String(g);
    if (e === 0) return gs || '1';
    if (e < 0) { const k = -e; const p2 = k % 2 ? '\\sqrt2' : ''; const pw = 2n ** BigInt(Math.floor(k / 2)); const num = (g * pw === 1n ? '' : String(g * pw)); return (num + p2) || '1'; }
    const den = (e % 2 ? '\\sqrt2' : '');
    const pw = 2n ** BigInt(Math.floor(e / 2));
    const d = (pw === 1n ? '' : String(pw)) + den;
    return `\\frac{${gs || 1}}{${d}}`;
  }
  const bgcd = (a, b) => { a = a < 0 ? -a : a; b = b < 0 ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
  // Exact matrix in a tidy form: prefactor × entries (common √2 and integer factors pulled out).
  function exactForm(M) {
    const R = M.R;
    let data = M.data.map((x) => x.slice()), e = M.e;
    if (data.every(R.isZero)) return { pref: '1', rows: grid(M, data.map(() => '0')), zero: true };
    for (;;) {   // divide everything by √2 while it stays a cyclotomic integer
      const y = data.map((x) => R.mul(x, R.sqrt2));
      if (!y.every((v) => v.every((c) => c % 2n === 0n))) break;
      data = y.map((v) => v.map((c) => c / 2n)); e -= 1;
    }
    // for ω = e^{iπ/4}: if multiplying by √2 makes every entry a + bi, show that (1+i rather than √2·e^{iπ/4})
    if (R.m === 8 && data.some((x) => x[1] || x[3])) {
      const y = data.map((x) => R.mul(x, R.sqrt2));
      if (y.every((x) => !x[1] && !x[3])) { data = y; e += 1; }
    }
    let g = 0n; data.forEach((x) => x.forEach((c) => { g = bgcd(g, c); }));
    if (g > 1n) data = data.map((x) => x.map((c) => c / g)); else g = 1n;
    return { pref: prefTex(e, g), rows: grid(M, data.map((x) => entryTex(R, x))) };
  }
  function grid(M, flat) {
    const R = 1 << M.outs, C = 1 << M.ins, rows = [];
    for (let r = 0; r < R; r++) rows.push(flat.slice(r * C, r * C + C));
    return rows;
  }
  function numForm(M, digits = 4) {
    const v = toNum(M), f = (x) => {
      const r = +x[0].toFixed(digits), i = +x[1].toFixed(digits);
      const rs = Object.is(r, -0) ? 0 : r, is = Object.is(i, -0) ? 0 : i;
      if (!is) return String(rs);
      if (!rs) return (is === 1 ? '' : is === -1 ? '-' : is) + 'i';
      return `${rs}${is < 0 ? '-' : '+'}${Math.abs(is) === 1 ? '' : Math.abs(is)}i`;
    };
    return { rows: grid(M, v.map(f)), raw: v };
  }

  // ---------- simplification ----------
  // Work on a copy of the editor's Diagram; positions are kept so the steps read naturally.
  const clone = (d) => JSON.parse(JSON.stringify(d));
  function freshIds(d) {
    const map = new Map();
    const c = ZX.newDiagram(d.opts);
    c.nodes = d.nodes.map((n) => { const m = Object.assign({}, n, { id: ZX.newId('n') }); delete m._ph; map.set(n.id, m.id); return m; });
    c.edges = d.edges.map((e) => ({ id: ZX.newId('e'), a: map.get(e.a), b: map.get(e.b), o: e.o }));
    return c;
  }
  // A link is a wire between two "ends" (spiders, boundaries), possibly through wire points and H boxes.
  function links(d, an) {
    const inc = new Map(d.nodes.map((n) => [n.id, []]));
    d.edges.forEach((e) => { inc.get(e.a).push(e); inc.get(e.b).push(e); });
    const isEnd = (id) => { const k = an.kind.get(id); return k === 'Z' || k === 'X' || k === 'B'; };
    const seen = new Set(), out = [];
    d.nodes.forEach((n) => {
      if (!isEnd(n.id)) return;
      inc.get(n.id).forEach((e0) => {
        if (seen.has(e0.id)) return;
        let cur = n.id, e = e0, h = 0;
        const mids = [], es = [];
        for (;;) {
          seen.add(e.id); es.push(e);
          if (hasH(e)) h++;
          const nx = e.a === cur ? e.b : e.a;
          if (e.a === e.b) { cur = nx; break; }
          if (isEnd(nx)) { cur = nx; break; }
          mids.push(nx);
          if (an.kind.get(nx) === 'H') h++;
          const e2 = an.kind.get(nx) === 'C' ? inc.get(nx).find((x) => x.id === an.cross.get(nx).get(e.id)) : inc.get(nx).find((x) => x !== e);
          cur = nx; e = e2;
        }
        out.push({ a: n.id, b: cur, h, mids, es, hNode: mids.find((m) => an.kind.get(m) === 'H') });
      });
    });
    // closed wire loops with no end at all
    const loops = [];
    d.edges.forEach((e) => {
      if (seen.has(e.id)) return;
      let h = 0; const es = [], mids = [];
      let cur = e.a, x = e;
      for (;;) { seen.add(x.id); es.push(x); if (hasH(x)) h++; const nx = x.a === cur ? x.b : x.a; if (an.kind.get(nx) === 'H') h++; mids.push(nx); const e2 = an.kind.get(nx) === 'C' ? inc.get(nx).find((y) => y.id === an.cross.get(nx).get(x.id) && !seen.has(y.id)) : inc.get(nx).find((y) => y !== x && !seen.has(y.id)); if (!e2) break; cur = nx; x = e2; }
      loops.push({ h, es, mids: [...new Set(mids)] });
    });
    return { list: out, loops };
  }
  function removeLink(d, L) {
    const kill = new Set(L.es.map((e) => e.id)), mids = new Set(L.mids);
    d.edges = d.edges.filter((e) => !kill.has(e.id));
    // a crossing point is kept while the other wire still runs through it
    d.nodes = d.nodes.filter((n) => !mids.has(n.id) || d.edges.some((e) => e.a === n.id || e.b === n.id));
  }
  function addLink(d, a, b, h, hNodePos) {
    if (h % 2 && hNodePos) {
      const H = { id: ZX.newId('n'), r: hNodePos.r, c: hNodePos.c, t: 'H', label: '', cmd: '', v: '', st: '' };
      d.nodes.push(H);
      d.edges.push({ id: ZX.newId('e'), a, b: H.id, o: '' }, { id: ZX.newId('e'), a: H.id, b, o: '' });
    } else d.edges.push({ id: ZX.newId('e'), a, b, o: h % 2 ? 'H' : '' });
  }
  const occupied = (d, r, c) => d.nodes.some((n) => n.r === r && n.c === c);
  function freeCell(d, r, c) {
    if (!occupied(d, r, c)) return { r, c };
    for (let rad = 1; rad < 6; rad++) for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
      if (!occupied(d, r + dr, c + dc)) return { r: r + dr, c: c + dc };
    }
    return { r: r + 6, c };
  }
  const setPhase = (n, p) => { p = pNorm(p); n._ph = p; n.label = phaseTex(p); if (n.cmd === 'Ctrl' || n.cmd === 'Not') { if (!pIsZero(p)) n.cmd = ''; } };
  const other = (L, id) => (L.a === id ? L.b : L.a);

  // Each rule finds every non-overlapping match, applies them all, and returns a rule label (or null).
  const RULES = [
    { key: 'loops', tex: '', fn: ruleClosedLoops },
    { key: 'hh', tex: '(hh)', fn: ruleHH },
    { key: 'self', tex: '(sp)', fn: ruleSelfLoops },
    { key: 'sp', tex: '(sp)', fn: ruleFuse },
    { key: 'id', tex: '(id)', fn: ruleId },
    { key: 'cc', tex: '(cc)', fn: ruleColour },
    { key: 'ho', tex: '(ho)', fn: ruleHopf },
    { key: 'sc', tex: '(sc)', fn: ruleCopy },
    { key: 'pi', tex: '(\\pi)', fn: rulePi },
    { key: 'bialg', tex: '(sc)', fn: ruleBialgebra },
    { key: 'scalar', tex: '', fn: ruleScalars },
  ];
  // closed wire loops: a plain circle is the scalar 2, a circle with one Hadamard is 0
  function ruleClosedLoops(d, an, Ls) {
    if (!Ls.loops.length) return null;
    if (Ls.loops.some((L) => L.h % 2)) throw new Error('This diagram is 0 (it contains a closed wire loop with a Hadamard)');
    Ls.loops.forEach((L) => removeLink(d, L));
    return '';
  }
  function ruleHH(d, an, Ls) {
    const hit = Ls.list.filter((L) => L.h >= 2 && L.a !== L.b);
    if (!hit.length) return null;
    hit.forEach((L) => { const hp = L.hNode && an.byId.get(L.hNode); removeLink(d, L); addLink(d, L.a, L.b, L.h % 2, hp && { r: hp.r, c: hp.c }); });
    return '(hh)';
  }
  // self-loops on a spider: a plain loop disappears; a loop with a Hadamard adds π (spider rule)
  function ruleSelfLoops(d, an, Ls) {
    const hit = Ls.list.filter((L) => L.a === L.b && an.kind.get(L.a) !== 'B');
    if (!hit.length) return null;
    hit.forEach((L) => {
      removeLink(d, L);
      if (L.h % 2) { const n = an.byId.get(L.a); setPhase(n, pAdd(n._ph, { pi: [1, 1], sym: {}, rad: 0 })); }
    });
    return '(sp)';
  }
  function ruleFuse(d, an, Ls) {
    const spider = (id) => an.kind.get(id) === 'Z' || an.kind.get(id) === 'X';
    const join = Ls.list.filter((L) => L.a !== L.b && L.h === 0 && spider(L.a) && an.kind.get(L.a) === an.kind.get(L.b));
    if (!join.length) return null;
    // groups of same-colour spiders joined by plain wires
    const parent = new Map();
    const find = (x) => { while (parent.get(x) !== x) x = parent.get(x); return x; };
    join.forEach((L) => { [L.a, L.b].forEach((x) => { if (!parent.has(x)) parent.set(x, x); }); parent.set(find(L.a), find(L.b)); });
    const groups = new Map();
    [...parent.keys()].forEach((x) => { const r = find(x); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(x); });
    const rep = new Map(), gone = new Set();
    groups.forEach((ids) => {
      const ns = ids.map((id) => an.byId.get(id));
      const cr = ns.reduce((t, n) => t + n.r, 0) / ns.length, cc = ns.reduce((t, n) => t + n.c, 0) / ns.length;
      const keep = ns.slice().sort((a, b) => Math.hypot(a.r - cr, a.c - cc) - Math.hypot(b.r - cr, b.c - cc))[0];
      let ph = P0();
      ns.forEach((n) => { ph = pAdd(ph, n._ph); rep.set(n.id, keep.id); if (n !== keep) gone.add(n.id); });
      setPhase(keep, ph);
    });
    const R = (id) => rep.get(id) || id;
    // every wire touching a group is rewritten once, between the representatives:
    // plain wires inside a group vanish, Hadamard wires inside become self-loops (next step)
    Ls.list.forEach((L) => {
      if (!rep.has(L.a) && !rep.has(L.b)) return;
      const a = R(L.a), b = R(L.b);
      if (a === L.a && b === L.b) return;
      const hp = L.hNode && an.byId.get(L.hNode);
      removeLink(d, L);
      if (a === b && L.h % 2 === 0) return;
      addLink(d, a, b, L.h, a === b ? null : hp && { r: hp.r, c: hp.c });
    });
    d.nodes = d.nodes.filter((n) => !gone.has(n.id));
    return '(sp)';
  }
  // a phase-free spider with exactly two wires is a wire
  function ruleId(d, an, Ls) {
    const ends = new Map();
    Ls.list.forEach((L) => { [L.a, L.b].forEach((x) => { if (!ends.has(x)) ends.set(x, []); ends.get(x).push(L); }); });
    const used = new Set();
    let any = false;
    d.nodes.slice().forEach((n) => {
      const k = an.kind.get(n.id);
      if ((k !== 'Z' && k !== 'X') || !pIsZero(n._ph)) return;
      const ls = ends.get(n.id) || [];
      if (ls.length !== 2 || ls[0] === ls[1] || ls.some((L) => L.a === L.b) || ls.some((L) => used.has(L))) return;
      const [L1, L2] = ls, h = L1.h + L2.h;
      if (h > 1) return;
      const A = other(L1, n.id), B = other(L2, n.id);
      if (A === n.id || B === n.id) return;
      // keep both far ends untouched this step so links stay valid
      if (used.has('n' + A) || used.has('n' + B)) return;
      used.add(L1); used.add(L2); used.add('n' + n.id); used.add('n' + A); used.add('n' + B);
      const hp = (L1.hNode && an.byId.get(L1.hNode)) || (L2.hNode && an.byId.get(L2.hNode));
      removeLink(d, L1); removeLink(d, L2);
      d.nodes = d.nodes.filter((m) => m !== n);
      addLink(d, A, B, h, hp && { r: hp.r, c: hp.c });
      any = true;
    });
    return any ? '(id)' : null;
  }
  // colour change: a spider with more Hadamard wires than plain ones swaps colour and toggles them
  function ruleColour(d, an, Ls) {
    const ends = new Map();
    Ls.list.forEach((L) => { if (L.a === L.b) return; [L.a, L.b].forEach((x) => { if (!ends.has(x)) ends.set(x, []); ends.get(x).push(L); }); });
    const touched = new Set();
    let any = false;
    d.nodes.slice().forEach((n) => {
      const k = an.kind.get(n.id);
      if (k !== 'Z' && k !== 'X') return;
      const ls = ends.get(n.id) || [];
      const odd = ls.filter((L) => L.h % 2).length;
      if (odd <= ls.length - odd || ls.some((L) => touched.has(L))) return;
      ls.forEach((L) => {
        touched.add(L);
        const hp = L.hNode && an.byId.get(L.hNode);
        removeLink(d, L); addLink(d, L.a, L.b, (L.h + 1) % 2, hp && { r: hp.r, c: hp.c });
      });
      n.t = k === 'Z' ? 'X' : 'Z';
      if (n.cmd === 'Ctrl') n.cmd = 'Not'; else if (n.cmd === 'Not') n.cmd = 'Ctrl';
      any = true;
    });
    return any ? '(cc)' : null;
  }
  // Hopf law: two plain wires between a Z and an X spider (or two Hadamard wires between same colours) cancel
  function ruleHopf(d, an, Ls) {
    const pairs = new Map();
    Ls.list.forEach((L) => {
      const ka = an.kind.get(L.a), kb = an.kind.get(L.b);
      if (L.a === L.b || !'ZX'.includes(ka) || !'ZX'.includes(kb) || ka === 'B' || kb === 'B') return;
      const ok = (ka !== kb && L.h % 2 === 0) || (ka === kb && L.h % 2 === 1);
      if (!ok) return;
      const key = [L.a, L.b].sort().join('|') + '|' + (L.h % 2);
      if (!pairs.has(key)) pairs.set(key, []);
      pairs.get(key).push(L);
    });
    let any = false;
    pairs.forEach((ls) => { for (let i = 0; i + 1 < ls.length; i += 2) { removeLink(d, ls[i]); removeLink(d, ls[i + 1]); any = true; } });
    return any ? '(ho)' : null;
  }
  // copy: a basis state (X spider 0 or π with one plain wire) passes through a Z spider and is copied (and colours swapped)
  function ruleCopy(d, an, Ls) {
    const ends = new Map();
    Ls.list.forEach((L) => { [L.a, L.b].forEach((x) => { if (!ends.has(x)) ends.set(x, []); ends.get(x).push(L); }); });
    const done = new Set();
    let any = false;
    d.nodes.slice().forEach((s) => {
      const ks = an.kind.get(s.id);
      if ((ks !== 'Z' && ks !== 'X') || done.has(s.id)) return;
      const ls = ends.get(s.id) || [];
      if (ls.length !== 1 || ls[0].h % 2 || ls[0].a === ls[0].b) return;
      if (!(pIsZero(s._ph) || pIsPi(s._ph))) return;
      const T = an.byId.get(other(ls[0], s.id)), kt = an.kind.get(T.id);
      if (!(kt === 'Z' || kt === 'X') || kt === ks || done.has(T.id)) return;
      const tl = (ends.get(T.id) || []).filter((L) => L !== ls[0]);
      if (tl.some((L) => L.a === L.b) || tl.some((L) => done.has(L))) return;
      done.add(s.id); done.add(T.id);
      removeLink(d, ls[0]);
      tl.forEach((L) => {
        done.add(L);
        const far = other(L, T.id), fn = an.byId.get(far);
        const at = freeCell(d, Math.round((T.r * 2 + fn.r) / 3), Math.round((T.c * 2 + fn.c) / 3));
        const c = { id: ZX.newId('n'), r: at.r, c: at.c, t: ks, label: '', cmd: '', v: '', st: '' };
        setPhase(c, s._ph);
        d.nodes.push(c);
        const hp = L.hNode && an.byId.get(L.hNode);
        removeLink(d, L); addLink(d, c.id, far, L.h, hp && { r: hp.r, c: hp.c });
      });
      d.nodes = d.nodes.filter((n) => n !== s && n !== T);
      any = true;
    });
    return any ? '(sc)' : null;
  }
  // π-commutation: an X(π) on one wire of a Z spider moves to its other wires and negates its phase;
  // used only when every other wire leads straight (plain) into an X spider, where the π is absorbed.
  function rulePi(d, an, Ls) {
    const ends = new Map();
    Ls.list.forEach((L) => { [L.a, L.b].forEach((x) => { if (!ends.has(x)) ends.set(x, []); ends.get(x).push(L); }); });
    const done = new Set();
    let any = false;
    d.nodes.slice().forEach((z) => {
      const kz = an.kind.get(z.id);
      if ((kz !== 'Z' && kz !== 'X') || done.has(z.id)) return;
      const kx = kz === 'Z' ? 'X' : 'Z';
      const ls = ends.get(z.id) || [];
      if (ls.length < 2 || ls.some((L) => L.a === L.b || L.h % 2)) return;
      const P = ls.map((L) => an.byId.get(other(L, z.id))).find((p) => an.kind.get(p.id) === kx && pIsPi(p._ph) && (ends.get(p.id) || []).length === 2 && !done.has(p.id));
      if (!P) return;
      const pl = ends.get(P.id), toZ = pl.find((L) => other(L, P.id) === z.id), away = pl.find((L) => L !== toZ);
      if (!toZ || !away || away.a === away.b) return;
      const rest = ls.filter((L) => L !== toZ);
      const tgt = rest.map((L) => an.byId.get(other(L, z.id)));
      if (!tgt.every((t) => an.kind.get(t.id) === kx && t !== P && !done.has(t.id))) return;
      if (new Set(tgt).size !== tgt.length) return;
      [z, P, ...tgt].forEach((n) => done.add(n.id));
      const hp = away.hNode && an.byId.get(away.hNode);
      const farP = other(away, P.id);
      if (farP === z.id || done.has(farP)) return;
      done.add(farP);
      removeLink(d, toZ); removeLink(d, away);
      d.nodes = d.nodes.filter((n) => n !== P);
      addLink(d, z.id, farP, away.h, hp && { r: hp.r, c: hp.c });
      setPhase(z, pScale(z._ph, [-1, 1]));
      tgt.forEach((t) => setPhase(t, pAdd(t._ph, { pi: [1, 1], sym: {}, rad: 0 })));
      any = true;
    });
    return any ? '(\\pi)(sp)' : null;
  }
  // Strong complementarity / bialgebra, in the simplifying direction: phase-free Z spiders Zs and
  // X spiders Xs (at least 2 each), every Z joined to every X by one plain wire and each with exactly one
  // other wire, become a single X spider (holding the Zs' outside wires) joined to a single Z spider
  // (holding the Xs' outside wires). Colours swap, as in the bialgebra rule. Scalar changes, so ∝.
  function ruleBialgebra(d, an, Ls) {
    const ends = new Map();
    Ls.list.forEach((L) => { [L.a, L.b].forEach((x) => { if (!ends.has(x)) ends.set(x, []); ends.get(x).push(L); }); });
    const isSp = (id, k) => an.kind.get(id) === k && pIsZero(an.byId.get(id)._ph);
    const plainTo = (id, k) => {   // neighbours of colour k joined by exactly one plain wire
      const m = new Map();
      (ends.get(id) || []).forEach((L) => { if (L.a === L.b) return; const o = other(L, id); m.set(o, (m.get(o) || []).concat(L)); });
      return m;
    };
    const used = new Set();
    let any = false;
    for (const kz of ['Z', 'X']) {
      const kx = kz === 'Z' ? 'X' : 'Z';
      d.nodes.slice().forEach((z) => {
        if (used.has(z.id) || !isSp(z.id, kz)) return;
        const lz = ends.get(z.id) || [];
        if (lz.length < 3 || lz.some((L) => L.a === L.b)) return;
        for (const ext of lz) {   // try each wire of z as its one outside wire
          const inner = lz.filter((L) => L !== ext);
          if (inner.some((L) => L.h % 2)) continue;
          const Xs = inner.map((L) => other(L, z.id));
          if (new Set(Xs).size !== Xs.length || !Xs.every((x) => isSp(x, kx) && !used.has(x))) continue;
          // the Z side: spiders of colour kz wired once, plainly, to every X in Xs and to nothing else but one outside wire
          const nb0 = plainTo(Xs[0]);
          const Zs = [...nb0.keys()].filter((c) => isSp(c, kz) && !used.has(c) && Xs.every((x) => { const ls = plainTo(x).get(c); return ls && ls.length === 1 && !(ls[0].h % 2); }));
          if (Zs.length < 2 || !Zs.includes(z.id)) continue;
          const okZ = Zs.every((c) => (ends.get(c) || []).length === Xs.length + 1 && !(ends.get(c) || []).some((L) => L.a === L.b));
          const okX = Xs.every((x) => (ends.get(x) || []).length === Zs.length + 1 && !(ends.get(x) || []).some((L) => L.a === L.b));
          if (!okZ || !okX) continue;
          const block = new Set(Zs.concat(Xs));
          const outside = (id) => (ends.get(id) || []).find((L) => !block.has(other(L, id)));
          const zExt = Zs.map((c) => [c, outside(c)]), xExt = Xs.map((x) => [x, outside(x)]);
          if (zExt.some(([, L]) => !L) || xExt.some(([, L]) => !L)) continue;
          // outside wires must not lead back into the block or to each other's far ends twice
          const fars = zExt.concat(xExt).map(([c, L]) => other(L, c));
          if (fars.some((f) => block.has(f) || used.has(f))) continue;
          block.forEach((id) => used.add(id)); fars.forEach((f) => used.add(f));
          const avg = (ids) => { const ns = ids.map((id) => an.byId.get(id)); return { r: Math.round(ns.reduce((t, n) => t + n.r, 0) / ns.length), c: Math.round(ns.reduce((t, n) => t + n.c, 0) / ns.length) }; };
          // remove the block's wires and spiders, then place the new pair
          const internal = new Set();
          block.forEach((id) => (ends.get(id) || []).forEach((L) => internal.add(L)));
          internal.forEach((L) => removeLink(d, L));
          d.nodes = d.nodes.filter((n) => !block.has(n.id));
          const pz = freeCell(d, avg(Zs).r, avg(Zs).c), nx = { id: ZX.newId('n'), r: pz.r, c: pz.c, t: kx, label: '', cmd: '', v: '', st: '' };
          d.nodes.push(nx);
          const px = freeCell(d, avg(Xs).r, avg(Xs).c), nz = { id: ZX.newId('n'), r: px.r, c: px.c, t: kz, label: '', cmd: '', v: '', st: '' };
          d.nodes.push(nz);
          d.edges.push({ id: ZX.newId('e'), a: nx.id, b: nz.id, o: '' });
          zExt.forEach(([c, L]) => { const hp = L.hNode && an.byId.get(L.hNode); addLink(d, nx.id, other(L, c), L.h, hp && { r: hp.r, c: hp.c }); });
          xExt.forEach(([x, L]) => { const hp = L.hNode && an.byId.get(L.hNode); addLink(d, nz.id, other(L, x), L.h, hp && { r: hp.r, c: hp.c }); });
          any = true;
          break;
        }
      });
    }
    return any ? '(sc)' : null;
  }
  // parts with no boundary are scalars: drop them (only if they are not 0)
  function ruleScalars(d, an, Ls) {
    const adj = new Map(d.nodes.map((n) => [n.id, []]));
    d.edges.forEach((e) => { adj.get(e.a).push(e.b); adj.get(e.b).push(e.a); });
    const seen = new Set();
    let parts = [];
    d.nodes.forEach((n) => {
      if (seen.has(n.id) || an.kind.get(n.id) === 'skip') return;
      const st = [n.id], comp = [];
      seen.add(n.id);
      while (st.length) { const x = st.pop(); comp.push(x); adj.get(x).forEach((y) => { if (!seen.has(y)) { seen.add(y); st.push(y); } }); }
      if (!comp.some((x) => an.kind.get(x) === 'B')) parts.push(comp);
    });
    if (!parts.length) return null;
    if (!d.nodes.some((n) => an.kind.get(n.id) === 'B')) return null;   // the whole diagram is a scalar: keep it
    // a scalar part may only be dropped if it is non-zero for every value of its symbols
    const keep = [];
    parts.forEach((comp) => {
      const set = new Set(comp);
      const sub = { nodes: d.nodes.filter((n) => set.has(n.id)), edges: d.edges.filter((e) => set.has(e.a)) };
      const zs = valueSets(sub).map((values) => { const [re, im] = toNum(evaluate(sub, { values }))[0]; return Math.hypot(re, im) < 1e-9; });
      if (zs.every(Boolean)) throw new Error('This diagram is 0 (it contains a scalar part equal to 0)');
      if (zs.some(Boolean)) keep.push(comp);
    });
    parts = parts.filter((c) => !keep.includes(c));
    if (!parts.length) return null;
    const kill = new Set(parts.flat());
    d.nodes = d.nodes.filter((n) => !kill.has(n.id));
    d.edges = d.edges.filter((e) => !kill.has(e.a));
    return '';
  }
  // every 0/1 combination of the aπ symbols, each with a few random values for the angle symbols
  function valueSets(d) {
    const phs = d.nodes.filter((n) => n._ph).map((n) => n._ph);
    const bools = boolSymbols(phs), reals = [...new Set(phs.flatMap(pSymbols))].filter((k) => !bools.includes(k));
    const out = [];
    for (let t = 0; t < (reals.length ? 3 : 1); t++) {
      const rv = Object.fromEntries(reals.map((k) => [k, Math.random() * 4 - 2]));
      for (let m = 0; m < (1 << Math.min(bools.length, 8)); m++) out.push(Object.assign({}, rv, Object.fromEntries(bools.map((k, j) => [k, (m >> j) & 1]))));
    }
    return out;
  }
  // Give parallel wires between the same two nodes distinct bends so they don't overlap in LaTeX.
  function spreadParallel(d) {
    const groups = new Map();
    d.edges.forEach((e) => { if (e.a === e.b) return; const k = [e.a, e.b].sort().join('|'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
    groups.forEach((es) => {
      if (es.length < 2) return;
      const free = es.filter((e) => !/bend|out=|in=|\bo'|\bo\.|\bC\b|\bs\b/.test(e.o || ''));
      if (free.length < 2) return;
      const k0 = es[0].a;
      free.forEach((e, i) => {
        const side = i % 2 ? 'right' : 'left', amt = 25 + 15 * Math.floor(i / 2);
        const flip = e.a !== k0;   // keep both bends on their own side whichever way the wire was written
        const s2 = flip ? (side === 'left' ? 'right' : 'left') : side;
        const keep = ZX.splitOpts(e.o || '').filter((t) => t === 'H');
        e.o = [`bend ${s2}=${amt}`].concat(keep).join(', ');
      });
    });
  }
  // Drop empty rows/columns.
  function compact(d) {
    const rows = [...new Set(d.nodes.map((n) => n.r))].sort((a, b) => a - b), cols = [...new Set(d.nodes.map((n) => n.c))].sort((a, b) => a - b);
    const rm = new Map(rows.map((r, i) => [r, i])), cm = new Map(cols.map((c, i) => [c, i]));
    d.nodes.forEach((n) => { n.r = rm.get(n.r); n.c = cm.get(n.c); });
  }

  // Simplify step by step. Returns { steps: [{ rule, rel, diagram }], note }.
  // rel is '=' or '\propto', taken from comparing the step with the one before it.
  // The F2 matrix of a parity map |x⟩ ↦ |Ax⟩ (up to a scalar), or null when d is not one.
  // Only phase-free Z / X spiders and plain wires; checked on the computed matrix.
  function parityOf(d) {
    let an;
    try { an = analyse(d); } catch (_) { return null; }
    for (const n of d.nodes) {
      const k = an.kind.get(n.id);
      if (k === 'H') return null;
      if ((k === 'Z' || k === 'X') && !pIsZero(n._ph)) return null;
    }
    if (d.edges.some(hasH) || !d.nodes.some((n) => { const k = an.kind.get(n.id); return k === 'Z' || k === 'X'; })) return null;
    let M;
    try { M = evaluate(d, { exact: false }); } catch (_) { return null; }
    const n = M.ins, m = M.outs, N = 1 << n;
    if (!n || !m || n + m > 16) return null;
    const mag = (z) => Math.hypot(z[0], z[1]);
    const y = []; let ref = null;
    for (let x = 0; x < N; x++) {
      let hit = -1;
      for (let r = 0; r < (1 << m); r++) {
        const v = mag(M.data[r * N + x]);
        if (v < 1e-9) continue;
        if (hit >= 0) return null;
        hit = r;
        if (ref == null) ref = v; else if (Math.abs(v - ref) > 1e-6 * ref) return null;
      }
      if (hit < 0) return null;
      y.push(hit);
    }
    if (y[0] !== 0) return null;
    const col = (j) => y[1 << (n - 1 - j)];
    for (let x = 0; x < N; x++) { let v = 0; for (let j = 0; j < n; j++) if ((x >> (n - 1 - j)) & 1) v ^= col(j); if (v !== y[x]) return null; }
    return Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => (col(j) >> (m - 1 - i)) & 1));
  }
  // Parity normal form of A: inputs → Z spiders → X spiders → outputs, Z_j–X_i wired when A_ij = 1.
  function pnfDiagram(A, opts) {
    const d = ZX.newDiagram(opts || ''), m = A.length, n = A[0].length;
    const mk = (t, r, c) => { const x = { id: ZX.newId('n'), r, c, t, label: '', cmd: t === 'N' ? 'N' : '', v: '', st: '' }; d.nodes.push(x); return x; };
    const ed = (a, b) => d.edges.push({ id: ZX.newId('e'), a: a.id, b: b.id, o: '' });
    const off = (k) => Math.floor((Math.max(m, n) - k) / 2);
    const Z = [], X = [];
    for (let j = 0; j < n; j++) { const b = mk('N', j + off(n), 0); Z.push(mk('Z', j + off(n), 1)); ed(b, Z[j]); }
    for (let i = 0; i < m; i++) { X.push(mk('X', i + off(m), 2)); ed(X[i], mk('N', i + off(m), 3)); }
    for (let j = 0; j < n; j++) for (let i = 0; i < m; i++) if (A[i][j]) ed(Z[j], X[i]);
    return d;
  }
  const sameMat = (A, B) => A && B && A.length === B.length && A.every((r, i) => r.length === B[i].length && r.every((v, j) => v === B[i][j]));

  function simplify(d0, opt) {
    opt = opt || {};
    const maxSteps = opt.maxSteps || 40;
    // matrix arrows: unfolded on the grid first (shown as the first step, :=), folded back at the end
    const arrows = d0.nodes.filter((n) => n.t === 'M').sort((a, b) => a.c - b.c || a.r - b.r);
    let unfold = null;
    if (arrows.length) {
      const g = clone(d0);
      arrows.forEach((a) => ZX.expandMat(g, a.id, true));   // clone keeps the ids
      compact(g);
      unfold = g; d0 = g;
    }
    const pnfOn = opt.pnf === true || (opt.pnf !== false && arrows.length > 0);
    d0 = noText(d0);
    analyse(d0);   // throws a readable error if the diagram has no meaning
    const cache = new Map();
    trialSeed.v = Math.random();
    let cur = clone(d0);
    compare(cur, cur, cache);   // throws if it is too large to check; also warms the cache
    const steps = [];
    let note = '';
    let rejected = null;
    outer: for (let n = 0; n < maxSteps; n++) {
      for (const R of RULES) {
        const next = clone(cur);
        const an = analyse(next);
        let label;
        try { label = R.fn(next, an, links(next, an)); } catch (err) { note = err.message; break outer; }
        if (label === null) continue;
        next.nodes.forEach((x) => { delete x._ph; });
        compact(next);
        spreadParallel(next);
        const cmp = compare(cur, next, cache);
        if (cmp.rel === 'ne') { note = `Stopped: a ${R.key} step did not check out, so it was not used.`; rejected = next; break outer; }
        const rel = cmp.rel === 'eq' ? '=' : '\\propto';
        steps.push({ rule: label, rel, diagram: next, key: R.key });
        cur = next;
        continue outer;
      }
      break;
    }
    if (!note && steps.length >= maxSteps) note = `Stopped after ${maxSteps} steps.`;
    // parity maps: rewrite to parity normal form, then (when the start had arrows) fold it into one arrow
    let parity = null;
    if (!note) {
      const A = parityOf(cur);
      if (A && pnfOn) {
        const blocks = ZX.findMatBlocks(cur), spiders = cur.nodes.filter((n) => n.t === 'Z' || n.t === 'X').length;
        const already = blocks.length === 1 && blocks[0].ids.length === spiders && sameMat(blocks[0].A, A);
        let pn = cur;
        if (!already) {
          pn = pnfDiagram(A, cur.opts);
          const cmp = compare(cur, pn, cache);
          if (cmp.rel === 'ne') { pn = null; note = 'Stopped: the parity normal form did not check out, so it was not used.'; }
          else { steps.push({ rule: '(pnf)', rel: cmp.rel === 'eq' ? '=' : '\\propto', diagram: pn, key: 'pnf' }); cur = pn; }
        }
        if (pn && arrows.length) {
          const f = clone(pn), bs = ZX.findMatBlocks(f, new Set(f.nodes.filter((n) => n.t === 'Z' || n.t === 'X').map((n) => n.id)));
          const M = bs.length === 1 ? ZX.foldMat(f, bs[0]) : null;
          if (M) {
            // the product of the arrows, written right to left (A then B → BA)
            M.label = arrows.map((a) => (a.label || '').trim()).every(Boolean) ? arrows.map((a) => a.label.trim()).reverse().join('') : 'A';
            compact(f);
            steps.push({ rule: '', rel: '=', diagram: f, key: 'fold' });
            cur = f;
          }
        }
      } else if (A) parity = { rows: A.length, cols: A[0].length };
    }
    // final safety check against the start
    if (steps.length) {
      const fin = compare(d0, cur);   // fresh random values for the final check
      if (fin.rel === 'ne') return { steps: [], note: 'The result did not match the start, so nothing was added.' };
    }
    // merge silent scalar / loop removals into the step before them
    const merged = [];
    steps.forEach((s) => {
      if (s.rule === '' && merged.length && s.key !== 'fold') { const p = merged[merged.length - 1]; p.diagram = s.diagram; if (s.rel !== '=') p.rel = '\\propto'; }
      else merged.push(s);
    });
    if (unfold) merged.unshift({ rule: '', rel: '=', diagram: noText(unfold), key: 'unfold' });
    merged.forEach((s) => { s.diagram = freshIds(s.diagram); s.sep = sepTex(s.rule, s.rel); });
    return { steps: merged, note, rejected, parity };
  }
  const sepTex = (rule, rel) => (rule ? `\\stackrel{\\mathbf{${rule}}}{${rel}}` : rel);

  // Check a chain of diagrams with the relations written between them.
  function checkChain(doc) {
    const out = [];
    for (let i = 0; i + 1 < doc.diagrams.length; i++) {
      const s = doc.seps[i] == null ? '=' : doc.seps[i];
      const claim = /\\propto|∝/.test(s) ? 'prop' : /\\approx|≈|Rightarrow|⇒/.test(s) ? 'other' : s.trim() ? 'eq' : 'none';
      try {
        const r = compare(doc.diagrams[i], doc.diagrams[i + 1]);
        const ok = claim === 'other' || claim === 'none' ? null : claim === 'eq' ? r.rel === 'eq' : r.rel !== 'ne';
        out.push({ i, claim, rel: r.rel, ok, exact: r.exact, symbols: r.symbols });
      } catch (e) { out.push({ i, claim, error: e.message }); }
    }
    return out;
  }

  // which open wire ends are inputs / outputs (ids, top first); null if the diagram has no meaning
  function io(d) {
    try { d = noText(d); const an = analyse(d), b = boundaries(d, an); return { ins: b.ins.map((n) => n.id), outs: b.outs.map((n) => n.id) }; }
    catch (_) { return null; }
  }
  // ---------- plain-data jobs (what the editor's panels need; safe to run in a Web Worker) ----------
  function matrixView(d, o = {}) {
    const M = evaluate(d, { exact: o.mode === 'exact' ? undefined : false, values: o.values || {} });
    const exact = M.exact && o.mode === 'exact';
    const F = exact ? exactForm(M) : numForm(M);
    let rows = F.rows, pref = exact ? F.pref : '';
    if (!exact && o.norm) {   // divide by the largest entry so the shape is easy to read
      const raw = F.raw; let j = 0; raw.forEach((v, t) => { if (Math.hypot(...v) > Math.hypot(...raw[j])) j = t; });
      const [a, b] = raw[j], m2 = a * a + b * b;
      if (m2 > 1e-18) { const scaled = raw.map(([x, y]) => [(x * a + y * b) / m2, (y * a - x * b) / m2]); rows = numForm({ exact: false, e: 0, data: scaled, ins: M.ins, outs: M.outs }).rows; pref = '\\propto'; }
    }
    return { ins: M.ins, outs: M.outs, exact, Mexact: !!M.exact, bigFallback: !!M.bigFallback, rows, pref };
  }
  function relationCheck(d1, d2, o = {}) {
    const syms = [...new Set(symInfo(d1).symbols.concat(symInfo(d2).symbols))];
    const r = syms.length && o.check === 'current' ? compareAt(d1, d2, o.values || {}) : compare(d1, d2);
    return { syms, r: { rel: r.rel, exact: r.exact, why: r.why, at: r.at } };
  }
  function symbolsOf(ds) {
    const reals = new Set(), bools = new Set();
    ds.forEach((d) => { try { const m = evaluate(d, { exact: false, values: {} }); m.symbols.forEach((k) => (m.bools.includes(k) ? bools : reals).add(k)); } catch (_) {} });
    bools.forEach((k) => reals.delete(k));
    return { reals: [...reals], bools: [...bools] };
  }
  const ZXS = { matrixView, relationCheck, symbolsOf, io, parsePhase, phaseTex, evaluate, compare, compareAt, symInfo, relate, exactForm, numForm, simplify, checkChain, analyse };
  if (typeof module !== 'undefined' && module.exports) module.exports.ZXS = ZXS;
  if (typeof window !== 'undefined') window.ZXS = ZXS;
  else if (typeof self !== 'undefined') self.ZXS = ZXS;   // Web Worker
})(typeof window !== 'undefined' ? window : globalThis);

// zx-worker.js — runs zx-sim jobs off the main thread so the page never freezes.
// Message in: { id, fn, args }. Out: { id, ok: true, r } or { id, ok: false, msg, nodes }.
importScripts('zx-core.js?v=29', 'zx-sim.js?v=31');
const JOBS = new Set(['matrixView', 'relationCheck', 'symbolsOf', 'simplify', 'evaluate', 'compare']);
self.onmessage = (e) => {
  const { id, fn, args } = e.data;
  if (!JOBS.has(fn)) return self.postMessage({ id, ok: false, msg: 'unknown job ' + fn });
  const t0 = performance.now();
  try {
    const r = self.ZXS[fn](...args);
    self.postMessage({ id, ok: true, r, ms: performance.now() - t0 });
  } catch (err) {
    self.postMessage({ id, ok: false, msg: err && err.message ? err.message : String(err), nodes: err && err.nodes });
  }
};
self.postMessage({ ready: true });

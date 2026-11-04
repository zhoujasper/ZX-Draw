# ZX Draw

[![Netlify Status](https://api.netlify.com/api/v1/badges/55fb401a-d88c-4aaa-8c8d-a4ad9709f435/deploy-status)](https://app.netlify.com/projects/zx-calculus/deploys)

A browser editor for **ZX-calculus** diagrams that reads and writes the LaTeX of the
[`zx-calculus`](https://ctan.org/pkg/zx-calculus) package (`\zx{…}`, tikz-cd syntax), and checks
every step of a rewrite by computing it.

**Live:** https://zx-calculus.netlify.app/

No install, no account, no build step: everything runs in your browser and is saved there.

## Features

- **Draw** Z / X spiders, H boxes, wire points, routing dots and text cells on a grid that matches
  tikz-cd. Wires come in every `zx-calculus` style (bends, `s`, caps, cups, `C` shapes, loops), with
  a drag handle for bends. Connect several nodes to one target in a single click.
- **Rewrite chains**: several diagrams per page, joined by relations such as
  `\stackrel{(sp)}{=}` or `\propto`. Pages, line wrapping, single-graph pages, and a per-page lock.
- **Check every step**: each relation gets a live ✓ / ≈ / ✗ badge. The engine computes the exact
  matrix of a diagram (cyclotomic arithmetic, symbolic phases as 0/1 symbols or angles) and compares
  both sides.
- **Simplify step by step** with spider fusion, identity, Hadamard cancel, colour change, Hopf,
  copy / strong complementarity and π-commutation. A step is kept only if the computation confirms it.
- **Matrix view**: exact or numeric, for one diagram or a whole chain, copyable as a LaTeX `pmatrix`.
- **Errors on the canvas**: when a diagram cannot be computed, the nodes at fault are circled.
- **Present**: play a page as full-screen slides. Nodes morph from one step to the next.
- **Import / export**
  - LaTeX for `zx-calculus` (with a small style file, `zxdiagram.sty`), import of whole `.tex` files
  - Plain **TikZ** that needs no extra package, drawn exactly like the image export
  - **PNG / SVG** images, typeset with the TeX fonts
  - **PyZX / ZXLive** graph JSON, both ways (plus a ready Python snippet)
  - `.zxd` canvas files with every page
- **Responsive**: heavy computations run in a Web Worker and can be cancelled. Works on desktop
  and phone.

## Using the LaTeX output

1. Download `zxdiagram.sty` (Help → Guide in the app) and put it next to your `.tex` file.
2. Add `\usepackage{zxdiagram}` to the preamble. It needs the `zx-calculus` package, which ships
   with TeX Live, MiKTeX and Overleaf.
3. Click **Export**, then **Copy**, and paste into your document:

```latex
\[
  \zx{\zxN{} \rar & \zxZ{\alpha} \rar & \zxX{\beta} \rar & \zxN{}}
\]
```

The TikZ export needs only `\usepackage{tikz}` and `\usepackage{graphicx}`.

## Running locally

It is a static site. Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8765
```

Then visit http://localhost:8765. Serving it (rather than opening the file) lets calculations run
in a background worker.

## Project layout

| File | What it does |
|---|---|
| `index.html` | Page shell |
| `style.css` | All styling, including the phone layout |
| `app.js` | The editor: drawing, input, panels, import / export, presentation |
| `zx-core.js` | `zx-calculus` LaTeX parser and exporter (no DOM, also runs in Node) |
| `zx-sim.js` | Meaning of a diagram: phases, exact tensor evaluation, comparison, simplification |
| `zx-pyzx.js` | PyZX / ZXLive graph JSON import and export |
| `zx-worker.js` | Web Worker that runs `zx-sim` jobs off the main thread |
| `zxdiagram.sty` | LaTeX style file used by the exported diagrams |

The engine files have no DOM dependencies and can be used from Node:

```js
const { ZX } = require('./zx-core.js');
const { ZXS } = require('./zx-sim.js');
const d = ZX.parseEquation(String.raw`\zx{\zxN{} \rar & \zxZ{\pi} \rar & \zxN{}}`).diagrams[0];
console.log(ZXS.matrixView(d, { mode: 'exact' }).rows);   // [['1','0'],['0','-1']]
```

## Deployment

The site is deployed on Netlify from this repository (`netlify.toml`: no build, publish the root).
Every push to `main` updates https://zx-calculus.netlify.app/.

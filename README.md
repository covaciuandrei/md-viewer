# Markdown Live Preview

A fast, zero-backend Markdown editor with a live preview pane, multi-file workspace, outline navigation, theme switcher, and Word / PDF / ZIP export. Everything runs in the browser — no server, no signup.

## Features

- **Split-screen editor + preview** with debounced live compilation
- **Synchronized scrolling** between editor and preview
- **Multi-file workspace** — sidebar tree with folders, tabs, drag-and-drop reordering, rename (F2), and per-file localStorage
- **File tree filter** — quick name search in the sidebar (Esc to clear)
- **Writer stats + save status** — live word / character counts and a save indicator in the sidebar footer
- **GitHub Flavored Markdown**: tables, task lists, strikethrough, autolinks, footnotes
- **Syntax highlighting** for code blocks (Prism.js)
- **Math** via KaTeX — `$inline$` and `$$display$$`
- **Diagrams** via Mermaid — ` ```mermaid ` code blocks
- **HTML sanitization** with DOMPurify (XSS-safe rendering)
- **Auto-generated outline panel** with collapsible nesting and smooth scroll
- **Theme switcher** — Light / Dark / System (defaults to OS preference)
- **Layout toggle** — editor only, split, or preview only
- **Resizable splitter** (drag the divider; width persists)
- **Drag-and-drop import** for `.md`, `.markdown`, `.txt` files and full folders (preserves structure)
- **Local persistence** — files, content, theme, layout, split, sidebar, and outline state survive reloads
- **Export** as Markdown (`.md`), true Office Open XML Word (`.docx`), PDF (via print), or a `.zip` of the whole workspace
- **Keyboard shortcuts** — `Ctrl/Cmd+N` new file, `Ctrl/Cmd+W` close tab, `Ctrl/Cmd+Tab` cycle tabs, `F2` rename, `Delete` remove

## Quick start

```bash
npm install
npm run build      # compiles src/app.ts -> app.js
npm test           # runs the full progressive test suite
```

Then open `index.html` in a browser. No dev server required — the app is a static page.

For local development you can serve it with any static server, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8000
```

## Project layout

```
.
├── index.html          # entry HTML, loads libraries from CDN
├── styles.css          # theme variables + layout
├── src/app.ts          # TypeScript source
├── app.js              # compiled output (committed for static hosting)
├── tsconfig.json       # TS build config
├── test-phase1.js      # jsdom-based test suite (phases 1–19)
├── build/              # tsc output (gitignored)
└── blueprint           # original spec
```

## Scripts

| Command         | What it does                                                  |
| --------------- | ------------------------------------------------------------- |
| `npm run build` | Compiles `src/app.ts` → `build/app.js` and copies to `app.js` |
| `npm test`      | Builds, then runs the jsdom progressive test suite            |

Run a subset of phases:

```bash
PHASE=10 node test-phase1.js   # run only phases 1..10
```

## Libraries

All loaded via CDN at runtime; no bundler required.

- [marked](https://marked.js.org/) — Markdown → HTML
- [marked-footnote](https://github.com/bent10/marked-extensions) — footnote support
- [DOMPurify](https://github.com/cure53/DOMPurify) — HTML sanitization
- [Prism.js](https://prismjs.com/) — code syntax highlighting
- [KaTeX](https://katex.org/) — math rendering
- [Mermaid](https://mermaid.js.org/) — diagrams
- [docx](https://docx.js.org/) — true `.docx` export

## Architecture

The whole app is a single IIFE in [`src/app.ts`](src/app.ts) with these stages in the render pipeline:

1. `marked.parse(md)` produces HTML.
2. `DOMPurify.sanitize(html)` removes dangerous markup.
3. Headings get slugified ids.
4. Mermaid code blocks become `<div class="mermaid">` and `mermaid.run()` renders them.
5. Prism highlights remaining `<pre><code>` blocks.
6. `renderMathInElement` rewrites KaTeX delimiters.
7. The outline panel is rebuilt from the heading tree.

Scroll synchronization uses a proportional `scrollTop / (scrollHeight - clientHeight)` ratio with a lock flag to avoid feedback loops.

Theme, layout, splitter width, outline visibility, and document content all persist in `localStorage` under the `md-viewer:*` namespace.

## Testing

`test-phase1.js` is a progressive jsdom suite covering 19 development phases — DOM structure, rendering, persistence, theming, sanitization, GFM, KaTeX, Mermaid, outline, layout, drag-and-drop, `.docx` export, multi-file workspace, and writer stats / save status / file filter. Heavy libraries are stubbed where appropriate.

```bash
npm test
```

## Deploying

Since the app is fully static, any static host works.

### GitHub Pages

1. Push the repo to GitHub (make sure `app.js` is committed).
2. `Settings` → `Pages` → `Source: Deploy from a branch` → `main` / `/ (root)`.
3. Visit `https://<user>.github.io/<repo>/`.

### Netlify / Vercel / Cloudflare Pages

Import the repo and configure:

- Build command: `npm run build`
- Publish directory: `.`

## Security notes

- All rendered Markdown is passed through DOMPurify before being inserted, so `<script>` tags and event-handler attributes in user input are stripped.
- Third-party libraries are loaded from public CDNs — if you need full offline operation, vendor them locally.

## License

ISC

# Copilot instructions — md-viewer

Project: a single-page, zero-backend Markdown editor + live preview. Static-hosted (GitHub Pages). One IIFE in `src/app.ts` compiled to `app.js`. State lives in `localStorage` under the `md-viewer:*` namespace. Tests are jsdom-based and progressive (`test-phase1.js`, phases 1..N).

## Workflow rules (always)

1. **Bump the app version on every user-visible change.**
   - Update **all three** in lock-step:
     - `package.json` → `"version"`
     - `index.html` → `<script src="app.js?v=X.Y.Z" defer>` cache-bust query
     - `src/app.ts` → `APP_VERSION` constant
   - Use semver: PATCH for fixes/small tweaks, MINOR for features, MAJOR for breaking storage/UI changes.
   - The version is shown bottom-left of the Files sidebar (in the usage line `vX.Y.Z · N files · NN KB`), so users immediately see whether they're on the latest deploy.
2. **Always rebuild before committing**: `npm run build` (compiles `src/app.ts` → `app.js`). The committed `app.js` is what GitHub Pages serves — `tsc` is **not** run on the server.
3. **Run the full test suite before committing**: `npm test` must pass (currently 105+ assertions across phases 1..18). Never weaken or skip a test to make it pass.
4. **Do not create markdown docs for changes** unless the user asks. Update existing docs (README.md) only when behaviour or public APIs change.

## Architecture rules

- The whole app is a single IIFE in `src/app.ts`. Keep it that way — no bundlers, no modules at runtime.
- All third-party libraries load from CDN in `index.html`. Declare them with `declare const` at the top of `src/app.ts`.
- Persistence schema (`md-viewer:*`):
  - `md-viewer:files` → `{ nodes, activeId, openIds, version }`
  - `md-viewer:doc:<id>` → raw markdown per file (one key per doc — keeps per-keystroke writes cheap)
  - `md-viewer:folders:expanded`, `md-viewer:sidebar`, `md-viewer:theme`, `md-viewer:layout`, `md-viewer:split`, `md-viewer:outline`
  - Legacy `md-viewer:content` is migrated to a seeded `Untitled.md` on first load and then deleted. Do not reintroduce it.
- New persisted state must use the `md-viewer:` prefix and survive reloads.
- All writes go through `safeSet` (catches `QuotaExceededError`). All reads through `safeGet`.

## Render pipeline (in order)

1. `marked.parse(md)` → HTML
2. `DOMPurify.sanitize(html)` (XSS-safe; never bypass)
3. Heading id slugification
4. Mermaid `<pre><code class="language-mermaid">` → `<div class="mermaid">` + `mermaid.run`
5. Prism highlight for remaining code blocks
6. KaTeX `renderMathInElement` for `$…$` / `$$…$$`
7. Outline panel rebuilt from heading tree

Preserve this order; new transforms should slot in by phase, not replace.

## UI conventions

- Toolbar: `📁 Files` and `📑 Outline` toggle their respective panels and reflect state via `.is-active`. `⬇ Export ▾` opens the export dropdown (closes on Escape / outside click).
- Files sidebar and Outline share one left column (`.shell-sidebar`, 260 px wide, vertical flex split). Each takes 50 % height when both visible; the visible one expands to 100 % when the other is hidden. Sidebar is hidden entirely only when both panels are off.
- Tab bar lives inside `.pane-editor` above the textarea. Click switches; middle-click or `×` closes; `Ctrl/Cmd+Tab` / `+Shift+Tab` cycle; `Ctrl/Cmd+W` closes active; `Ctrl/Cmd+N` new file.
- Tree drag-and-drop: rows are `draggable="true"` carrying a custom MIME `application/x-md-viewer-node` so the external-file overlay ignores them. Drop targets cover the **whole folder `<li>`** (header + expanded children), with `stopPropagation` so nested folders win. Cycle guard rejects folder-into-own-descendant.
- External drag-and-drop accepts both individual files and full folders (via `webkitGetAsEntry()`), filtered to `.md` / `.markdown` / `.txt` / `text/*`. Imports all, opens all, activates the first.

## Code style

- Functional, closure-based. No classes (the existing IIFE pattern stands).
- Be defensive: every external call (`marked`, `DOMPurify`, `mermaid`, `docx`, `JSZip`, `localStorage`) is wrapped in `try/catch` or a typeof guard. Keep this discipline.
- Prefer `const`. Use `Record<string, ...>` over `any` where practical, but `any` for CDN globals is fine.
- Two-space indent, semicolons, double-quoted strings (matches the existing file).

## Testing

- `test-phase1.js` runs in jsdom with stubbed CDN globals. Add new behaviour to the next phase (currently Phase 18 is multi-file). Mirror the progressive structure — `if (PHASE >= N) { … }`.
- Stub external libs (`docx`, `JSZip`, `FileReader`) the same way existing phases do.
- Default `PHASE` in the script must equal the highest implemented phase.

## Deployment

- GitHub Pages serves committed files from `main`. `tsc` is **not** run server-side, so:
  - `npm run build` locally → commit `app.js` along with sources.
  - Push → Pages redeploys in ~30–90 s.
- The cache-bust query (`app.js?v=X.Y.Z`) ensures browsers always pick up the new build after a deploy.

## Don'ts

- Don't add a service worker (would defeat the cache-bust strategy and complicate updates).
- Don't introduce a build step beyond `tsc`. No bundlers, no transpilers, no PostCSS.
- Don't write per-keystroke into the big `md-viewer:files` blob — use the per-doc `md-viewer:doc:<id>` keys.
- Don't store secrets, tokens, or remote URLs; this app is offline-first.

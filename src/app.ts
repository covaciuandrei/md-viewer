// Markdown Live Preview — TypeScript source.
// Compiled to ../app.js via `npm run build`.

declare const marked: any;
declare const Prism: any;
declare const DOMPurify: any;
declare const katex: any;
declare const mermaid: any;
declare const docx: any;
declare const renderMathInElement: any;
declare const markedFootnote: any;

interface ThemeState { pref: string; effective: string; }

(function () {
  'use strict';
  const w = window as any;

  // ---- Element lookups ----
  const editor          = document.getElementById('editor')          as HTMLTextAreaElement;
  const preview         = document.getElementById('preview')         as HTMLElement;
  const outlineEl       = document.getElementById('outline')         as HTMLElement | null;
  const splitter        = document.getElementById('splitter')        as HTMLElement | null;
  const clearBtn        = document.getElementById('clearBtn');
  const exportBtn       = document.getElementById('exportBtn');
  const exportDocxBtn   = document.getElementById('exportDocxBtn');
  const themeBtn        = document.getElementById('themeBtn');
  const outlineBtn      = document.getElementById('outlineBtn');
  const layoutSplitBtn  = document.getElementById('layoutSplitBtn');
  const layoutEditorBtn = document.getElementById('layoutEditorBtn');
  const layoutPreviewBtn= document.getElementById('layoutPreviewBtn');
  const prismThemeLink  = document.getElementById('prismTheme')      as HTMLLinkElement | null;
  const dropOverlay     = document.getElementById('dropOverlay');

  // ---- Constants ----
  const STORAGE_KEY = 'md-viewer:content';
  const THEME_KEY   = 'md-viewer:theme';
  const LAYOUT_KEY  = 'md-viewer:layout';
  const SPLIT_KEY   = 'md-viewer:split';
  const OUTLINE_KEY = 'md-viewer:outline';
  const PRISM_LIGHT = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css';
  const PRISM_DARK  = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';

  const DEBOUNCE_MS: number = w.__DEBOUNCE_MS !== undefined ? w.__DEBOUNCE_MS : 150;

  // ---- marked configuration (Phase 10: GFM + footnotes) ----
  function configureMarked(): void {
    if (typeof marked === 'undefined' || !marked) return;
    try {
      if (typeof marked.setOptions === 'function') {
        marked.setOptions({ gfm: true, breaks: true });
      }
      if (typeof markedFootnote === 'function' && typeof marked.use === 'function') {
        try { marked.use(markedFootnote()); } catch (_) {}
      }
    } catch (_) {}
  }
  configureMarked();

  // ---- Slug helpers ----
  const slugCounts: Record<string, number> = {};
  function slugify(text: string): string {
    return String(text || '').toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  }
  function uniqueSlug(text: string): string {
    const base = slugify(text) || 'section';
    const count = slugCounts[base] || 0;
    slugCounts[base] = count + 1;
    return count === 0 ? base : `${base}-${count}`;
  }

  // ---- Highlight (Phase 4) ----
  function highlightCodeBlocks(root: Element): void {
    if (typeof Prism === 'undefined' || !Prism) return;
    const blocks = root.querySelectorAll('pre code');
    blocks.forEach((block: Element) => {
      let lang: string | null = null;
      block.classList.forEach((c) => {
        if (c.indexOf('language-') === 0) lang = c.slice('language-'.length);
      });
      if (lang === 'mermaid') return; // handled separately
      const grammar = lang && Prism.languages[lang];
      if (grammar) {
        (block as HTMLElement).innerHTML = Prism.highlight(block.textContent || '', grammar, lang);
      } else if (typeof Prism.highlightElement === 'function') {
        Prism.highlightElement(block);
      }
    });
  }

  // ---- Mermaid (Phase 12) ----
  let mermaidCounter = 0;
  function processMermaidBlocks(root: Element): void {
    const blocks = root.querySelectorAll('pre > code.language-mermaid');
    blocks.forEach((code: Element) => {
      const pre = code.parentElement;
      if (!pre) return;
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = code.textContent || '';
      div.id = 'mermaid-' + (++mermaidCounter);
      pre.replaceWith(div);
    });
    try {
      if (typeof mermaid !== 'undefined' && mermaid && typeof mermaid.run === 'function') {
        const nodes = Array.from(root.querySelectorAll('.mermaid')) as HTMLElement[];
        if (nodes.length) mermaid.run({ nodes });
      }
    } catch (_) {}
  }

  // ---- Heading IDs + Outline/TOC (Phases 13 & 14) ----
  function addHeadingIds(root: Element): void {
    for (const k of Object.keys(slugCounts)) delete slugCounts[k];
    const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((h: Element) => {
      if (!h.id) h.id = uniqueSlug(h.textContent || '');
    });
  }

  function buildOutline(root: Element): void {
    if (!outlineEl) return;
    outlineEl.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'outline-header';
    header.textContent = 'Outline';
    outlineEl.appendChild(header);

    const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];
    if (headings.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'outline-empty';
      empty.textContent = 'No headings yet.';
      outlineEl.appendChild(empty);
      return;
    }

    const rootUl = document.createElement('ul');
    rootUl.className = 'outline-root';
    outlineEl.appendChild(rootUl);

    const stack: { level: number; ul: HTMLUListElement }[] = [{ level: 0, ul: rootUl }];

    headings.forEach((h) => {
      const level = parseInt(h.tagName.substring(1), 10);
      const li = document.createElement('li');
      li.className = 'outline-item';
      li.setAttribute('data-level', String(level));

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'outline-toggle';
      toggle.setAttribute('aria-expanded', 'true');
      toggle.textContent = '▾';

      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.className = 'outline-link';
      a.textContent = h.textContent || '';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        try { history.replaceState(null, '', '#' + h.id); } catch (_) {}
      });

      li.appendChild(toggle);
      li.appendChild(a);

      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
      stack[stack.length - 1].ul.appendChild(li);

      const childUl = document.createElement('ul');
      childUl.className = 'outline-children';
      li.appendChild(childUl);

      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') !== 'false';
        toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        toggle.textContent = expanded ? '▸' : '▾';
        childUl.style.display = expanded ? 'none' : '';
      });

      stack.push({ level, ul: childUl });
    });
  }

  // ---- Render pipeline ----
  function render(): void {
    const md = editor.value;
    const parser: any = (typeof marked !== 'undefined' && marked && (marked.parse || marked));
    let html = '';
    if (typeof parser === 'function') {
      html = parser(md);
    } else {
      html = md.replace(/[&<>]/g, (c) =>
        (({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as Record<string, string>)[c]));
    }
    // Phase 9: sanitize before injection
    if (typeof DOMPurify !== 'undefined' && DOMPurify && typeof DOMPurify.sanitize === 'function') {
      html = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
    }
    preview.innerHTML = html;
    addHeadingIds(preview);
    processMermaidBlocks(preview);
    highlightCodeBlocks(preview);
    // Phase 11: KaTeX math
    try {
      if (typeof renderMathInElement === 'function') {
        renderMathInElement(preview, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$',  right: '$',  display: false },
          ],
          throwOnError: false,
        });
      }
    } catch (_) {}
    buildOutline(preview);
  }
  w.mdRender = render;

  let timer: any = null;
  function scheduleRender(): void {
    if (DEBOUNCE_MS <= 0) { render(); return; }
    clearTimeout(timer);
    timer = setTimeout(render, DEBOUNCE_MS);
  }

  // ---- Scroll sync ----
  let scrollLock = false;
  function syncScroll(source: HTMLElement, target: HTMLElement): void {
    if (scrollLock) return;
    scrollLock = true;
    try {
      const sMax = source.scrollHeight - source.clientHeight;
      const tMax = target.scrollHeight - target.clientHeight;
      const ratio = sMax > 0 ? (source.scrollTop / sMax) : 0;
      target.scrollTop = ratio * tMax;
    } finally { setTimeout(() => { scrollLock = false; }, 0); }
  }
  w.__syncScroll = syncScroll;
  editor.addEventListener('scroll', () => syncScroll(editor, preview));
  preview.addEventListener('scroll', () => syncScroll(preview, editor));

  // ---- Persistence ----
  function loadFromStorage(): void {
    try {
      const saved = w.localStorage && w.localStorage.getItem(STORAGE_KEY);
      if (saved !== null && saved !== undefined) editor.value = saved;
    } catch (_) {}
  }
  function saveToStorage(): void {
    try { if (w.localStorage) w.localStorage.setItem(STORAGE_KEY, editor.value); } catch (_) {}
  }
  w.__mdStorageKey = STORAGE_KEY;

  // ---- Theme (Phase 6) ----
  function readStoredTheme(): string {
    try {
      const v = w.localStorage && w.localStorage.getItem(THEME_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch (_) {}
    return 'system';
  }
  function systemTheme(): string {
    try {
      if (typeof w.matchMedia === 'function') {
        return w.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } catch (_) {}
    return 'light';
  }
  function effectiveTheme(pref: string): string {
    return pref === 'system' ? systemTheme() : pref;
  }
  function applyTheme(pref: string): void {
    const eff = effectiveTheme(pref);
    document.documentElement.setAttribute('data-theme', eff);
    if (prismThemeLink) {
      prismThemeLink.setAttribute('href', eff === 'dark' ? PRISM_DARK : PRISM_LIGHT);
    }
    if (themeBtn) {
      const label = pref === 'system' ? 'System' : (pref === 'dark' ? 'Dark' : 'Light');
      themeBtn.textContent = 'Theme: ' + label;
      themeBtn.setAttribute('data-pref', pref);
      themeBtn.setAttribute('data-effective', eff);
    }
    try {
      if (typeof mermaid !== 'undefined' && mermaid && typeof mermaid.initialize === 'function') {
        mermaid.initialize({ startOnLoad: false, theme: eff === 'dark' ? 'dark' : 'default' });
      }
    } catch (_) {}
    highlightCodeBlocks(preview);
  }
  function setThemePref(pref: string): void {
    try { if (w.localStorage) w.localStorage.setItem(THEME_KEY, pref); } catch (_) {}
    applyTheme(pref);
  }
  function cycleTheme(): void {
    const order = ['system', 'light', 'dark'];
    const cur = readStoredTheme();
    const next = order[(order.indexOf(cur) + 1) % order.length];
    setThemePref(next);
  }
  w.__mdSetTheme = setThemePref;
  w.__mdCycleTheme = cycleTheme;
  w.__mdGetTheme = (): ThemeState =>
    ({ pref: readStoredTheme(), effective: effectiveTheme(readStoredTheme()) });
  if (themeBtn) themeBtn.addEventListener('click', cycleTheme);
  try {
    if (typeof w.matchMedia === 'function') {
      const mql = w.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => { if (readStoredTheme() === 'system') applyTheme('system'); };
      if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onChange);
      else if (typeof mql.addListener === 'function') mql.addListener(onChange);
    }
  } catch (_) {}

  // ---- Layout (Phase 15) ----
  function readLayout(): string {
    try {
      const v = w.localStorage && w.localStorage.getItem(LAYOUT_KEY);
      if (v === 'split' || v === 'editor' || v === 'preview') return v;
    } catch (_) {}
    return 'split';
  }
  function applyLayout(mode: string): void {
    document.body.setAttribute('data-layout', mode);
    try { if (w.localStorage) w.localStorage.setItem(LAYOUT_KEY, mode); } catch (_) {}
    [layoutSplitBtn, layoutEditorBtn, layoutPreviewBtn].forEach((btn) => {
      if (btn) btn.classList.remove('is-active');
    });
    const map: Record<string, HTMLElement | null> = {
      split: layoutSplitBtn as any,
      editor: layoutEditorBtn as any,
      preview: layoutPreviewBtn as any,
    };
    if (map[mode]) map[mode]!.classList.add('is-active');
  }
  w.__mdApplyLayout = applyLayout;
  w.__mdGetLayout = readLayout;
  if (layoutSplitBtn)   layoutSplitBtn.addEventListener('click',   () => applyLayout('split'));
  if (layoutEditorBtn)  layoutEditorBtn.addEventListener('click',  () => applyLayout('editor'));
  if (layoutPreviewBtn) layoutPreviewBtn.addEventListener('click', () => applyLayout('preview'));

  // ---- Splitter drag (Phase 15) ----
  function readSplit(): number {
    try {
      const raw = w.localStorage && w.localStorage.getItem(SPLIT_KEY);
      const v = parseFloat(raw || '');
      if (!isNaN(v) && v > 10 && v < 90) return v;
    } catch (_) {}
    return 50;
  }
  function applySplit(pct: number): void {
    const main = document.querySelector('.split') as HTMLElement | null;
    if (main) main.style.gridTemplateColumns = pct + '% 6px 1fr';
    try { if (w.localStorage) w.localStorage.setItem(SPLIT_KEY, String(pct)); } catch (_) {}
  }
  w.__mdApplySplit = applySplit;
  w.__mdGetSplit = readSplit;
  if (splitter) {
    let dragging = false;
    splitter.addEventListener('mousedown', (e) => {
      dragging = true;
      e.preventDefault();
      document.body.style.cursor = 'col-resize';
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const main = document.querySelector('.split') as HTMLElement | null;
      if (!main) return;
      const rect = main.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      if (pct > 10 && pct < 90) applySplit(pct);
    });
    document.addEventListener('mouseup', () => {
      if (dragging) { dragging = false; document.body.style.cursor = ''; }
    });
  }

  // ---- Outline toggle ----
  function setOutlineVisible(visible: boolean): void {
    document.body.setAttribute('data-outline', visible ? 'on' : 'off');
    try {
      if (w.localStorage) w.localStorage.setItem(OUTLINE_KEY, visible ? 'on' : 'off');
    } catch (_) {}
  }
  w.__mdSetOutline = setOutlineVisible;
  if (outlineBtn) outlineBtn.addEventListener('click', () => {
    const cur = document.body.getAttribute('data-outline') !== 'off';
    setOutlineVisible(!cur);
  });

  // ---- Drag and drop .md (Phase 16) ----
  function loadFileText(text: string): void {
    editor.value = text;
    saveToStorage();
    render();
  }
  w.__mdLoadFileText = loadFileText;

  function setupDragDrop(): void {
    let depth = 0;
    const show = () => { if (dropOverlay) dropOverlay.classList.add('is-active'); };
    const hide = () => { if (dropOverlay) dropOverlay.classList.remove('is-active'); };
    const isFileDrag = (e: DragEvent) =>
      !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') !== -1);

    window.addEventListener('dragenter', (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      depth++; show(); e.preventDefault();
    });
    window.addEventListener('dragover', (e: DragEvent) => {
      if (isFileDrag(e)) e.preventDefault();
    });
    window.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) hide();
    });
    window.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      depth = 0; hide();
      const dt = e.dataTransfer;
      if (!dt || !dt.files || dt.files.length === 0) return;
      const file = dt.files[0];
      const reader = new FileReader();
      reader.onload = () => loadFileText(String(reader.result || ''));
      reader.readAsText(file);
    });
  }
  setupDragDrop();

  // ---- Utilities ----
  function clearAll(): void {
    editor.value = '';
    try { if (w.localStorage) w.localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    render();
  }
  function exportMd(): void {
    triggerDownload(editor.value, 'document.md', 'text/markdown;charset=utf-8');
  }
  w.__mdClear = clearAll;
  w.__mdExport = exportMd;
  if (clearBtn)  clearBtn.addEventListener('click', clearAll);
  if (exportBtn) exportBtn.addEventListener('click', exportMd);

  function triggerDownload(content: BlobPart, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    triggerBlobDownload(blob, filename);
  }
  function triggerBlobDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // ---- True .docx export (Phase 17) ----
  function inlineRuns(el: Element, fmt: any): any[] {
    const { TextRun, ExternalHyperlink } = docx;
    const runs: any[] = [];
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        const text = n.textContent || '';
        if (!text.length) return;
        runs.push(new TextRun({ text, ...fmt }));
      } else if (n.nodeType === 1) {
        const child = n as Element;
        const tag = child.tagName.toLowerCase();
        const next: any = { ...fmt };
        if (tag === 'strong' || tag === 'b') next.bold = true;
        else if (tag === 'em' || tag === 'i') next.italics = true;
        else if (tag === 's' || tag === 'del' || tag === 'strike') next.strike = true;
        else if (tag === 'code') { next.font = 'Courier New'; next.size = 20; }
        else if (tag === 'br') { runs.push(new TextRun({ text: '', break: 1 })); return; }
        else if (tag === 'a') {
          const href = child.getAttribute('href') || '';
          runs.push(new ExternalHyperlink({
            link: href,
            children: inlineRuns(child, { ...next, style: 'Hyperlink', color: '2563eb' }),
          }));
          return;
        }
        runs.push(...inlineRuns(child, next));
      }
    });
    return runs;
  }

  function elementsToBlocks(root: Element): any[] {
    const { Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType, TextRun } = docx;
    const headingMap: Record<string, any> = {
      h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3,
      h4: HeadingLevel.HEADING_4, h5: HeadingLevel.HEADING_5, h6: HeadingLevel.HEADING_6,
    };
    const blocks: any[] = [];
    Array.from(root.children).forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (headingMap[tag]) {
        blocks.push(new Paragraph({ heading: headingMap[tag], children: inlineRuns(el, {}) }));
      } else if (tag === 'p') {
        blocks.push(new Paragraph({ children: inlineRuns(el, {}) }));
      } else if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li');
        items.forEach((li, i) => {
          const prefix = tag === 'ol' ? (i + 1) + '. ' : '• ';
          const runs = [new TextRun({ text: prefix }), ...inlineRuns(li, {})];
          blocks.push(new Paragraph({ children: runs, indent: { left: 360 } }));
        });
      } else if (tag === 'blockquote') {
        Array.from(el.children).forEach((child) => {
          blocks.push(new Paragraph({
            children: inlineRuns(child, { italics: true, color: '64748b' }),
            indent: { left: 360 },
          }));
        });
      } else if (tag === 'pre') {
        const code = el.querySelector('code');
        const text = (code ? code.textContent : el.textContent) || '';
        text.split('\n').forEach((line) => {
          blocks.push(new Paragraph({
            children: [new TextRun({ text: line, font: 'Courier New', size: 20 })],
          }));
        });
      } else if (tag === 'hr') {
        blocks.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
      } else if (tag === 'table') {
        const rows: any[] = [];
        Array.from(el.querySelectorAll('tr')).forEach((tr) => {
          const cells = Array.from(tr.children).map((td) =>
            new TableCell({ children: [new Paragraph({ children: inlineRuns(td, {}) })] }));
          rows.push(new TableRow({ children: cells }));
        });
        if (rows.length) {
          blocks.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        }
      } else {
        blocks.push(new Paragraph({ children: inlineRuns(el, {}) }));
      }
    });
    return blocks;
  }

  function exportDocxTrue(): Promise<void> {
    if (typeof docx === 'undefined' || !docx) {
      return Promise.reject(new Error('docx library not loaded'));
    }
    const { Document, Packer } = docx;
    const blocks = elementsToBlocks(preview);
    const doc = new Document({ sections: [{ children: blocks }] });
    return Packer.toBlob(doc).then((blob: Blob) => {
      const renamed = new Blob([blob], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      triggerBlobDownload(renamed, 'document.docx');
    });
  }
  w.__mdExportDocx = exportDocxTrue;
  if (exportDocxBtn) exportDocxBtn.addEventListener('click', () => { exportDocxTrue(); });

  // ---- Init ----
  editor.addEventListener('input', () => { saveToStorage(); scheduleRender(); });

  applyTheme(readStoredTheme());
  applyLayout(readLayout());
  applySplit(readSplit());
  try {
    const outlinePref = w.localStorage && w.localStorage.getItem(OUTLINE_KEY);
    setOutlineVisible(outlinePref !== 'off');
  } catch (_) { setOutlineVisible(true); }

  loadFromStorage();
  render();
})();

(function () {
  'use strict';

  const editor = document.getElementById('editor');
  const preview = document.getElementById('preview');
  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');
  const exportDocxBtn = document.getElementById('exportDocxBtn');
  const themeBtn = document.getElementById('themeBtn');
  const prismThemeLink = document.getElementById('prismTheme');

  const STORAGE_KEY = 'md-viewer:content';
  const THEME_KEY = 'md-viewer:theme';
  const PRISM_LIGHT = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css';
  const PRISM_DARK = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';

  const DEBOUNCE_MS = (typeof window !== 'undefined' && window.__DEBOUNCE_MS !== undefined)
    ? window.__DEBOUNCE_MS
    : 150;

  // ---- Rendering ----
  function highlightCodeBlocks(root) {
    if (typeof window === 'undefined' || !window.Prism) return;
    const blocks = root.querySelectorAll('pre code');
    blocks.forEach(function (block) {
      let lang = null;
      block.classList.forEach(function (c) {
        if (c.indexOf('language-') === 0) lang = c.slice('language-'.length);
      });
      const grammar = lang && window.Prism.languages[lang];
      if (grammar) {
        block.innerHTML = window.Prism.highlight(block.textContent, grammar, lang);
      } else if (typeof window.Prism.highlightElement === 'function') {
        window.Prism.highlightElement(block);
      }
    });
  }

  function render() {
    const md = editor.value;
    const parser = (window.marked && (window.marked.parse || window.marked));
    let html = '';
    if (typeof parser === 'function') {
      html = parser(md);
    } else {
      html = md.replace(/[&<>]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
      });
    }
    preview.innerHTML = html;
    highlightCodeBlocks(preview);
  }
  window.mdRender = render;

  let timer = null;
  function scheduleRender() {
    if (DEBOUNCE_MS <= 0) { render(); return; }
    clearTimeout(timer);
    timer = setTimeout(render, DEBOUNCE_MS);
  }

  // ---- Scroll sync ----
  let scrollLock = false;
  function syncScroll(source, target) {
    if (scrollLock) return;
    scrollLock = true;
    try {
      const sMax = source.scrollHeight - source.clientHeight;
      const tMax = target.scrollHeight - target.clientHeight;
      const ratio = sMax > 0 ? (source.scrollTop / sMax) : 0;
      target.scrollTop = ratio * tMax;
    } finally {
      setTimeout(function () { scrollLock = false; }, 0);
    }
  }
  window.__syncScroll = syncScroll;
  editor.addEventListener('scroll', function () { syncScroll(editor, preview); });
  preview.addEventListener('scroll', function () { syncScroll(preview, editor); });

  // ---- Persistence ----
  function loadFromStorage() {
    try {
      const saved = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
      if (saved !== null && saved !== undefined) editor.value = saved;
    } catch (e) {}
  }
  function saveToStorage() {
    try {
      if (window.localStorage) window.localStorage.setItem(STORAGE_KEY, editor.value);
    } catch (e) {}
  }
  window.__mdStorageKey = STORAGE_KEY;

  // ---- Theme (Phase 6) ----
  // Stored preference can be 'light' | 'dark' | 'system' (default).
  function readStoredTheme() {
    try {
      const v = window.localStorage && window.localStorage.getItem(THEME_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch (e) {}
    return 'system';
  }
  function systemTheme() {
    try {
      if (typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } catch (e) {}
    return 'light';
  }
  function effectiveTheme(pref) {
    return pref === 'system' ? systemTheme() : pref;
  }
  function applyTheme(pref) {
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
    // Re-highlight so any cached token classes pick up the new Prism stylesheet
    highlightCodeBlocks(preview);
  }
  function setThemePref(pref) {
    try { if (window.localStorage) window.localStorage.setItem(THEME_KEY, pref); } catch (e) {}
    applyTheme(pref);
  }
  function cycleTheme() {
    const order = ['system', 'light', 'dark'];
    const cur = readStoredTheme();
    const next = order[(order.indexOf(cur) + 1) % order.length];
    setThemePref(next);
  }
  window.__mdSetTheme = setThemePref;
  window.__mdCycleTheme = cycleTheme;
  window.__mdGetTheme = function () {
    return { pref: readStoredTheme(), effective: effectiveTheme(readStoredTheme()) };
  };

  if (themeBtn) themeBtn.addEventListener('click', cycleTheme);

  // React to system changes only when user picked 'system'
  try {
    if (typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = function () {
        if (readStoredTheme() === 'system') applyTheme('system');
      };
      if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onChange);
      else if (typeof mql.addListener === 'function') mql.addListener(onChange);
    }
  } catch (e) {}

  // ---- Utilities ----
  function clearAll() {
    editor.value = '';
    try { if (window.localStorage) window.localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    render();
  }
  function exportMd() {
    triggerDownload(editor.value, 'document.md', 'text/markdown;charset=utf-8');
  }

  // ---- Word export (Phase 7) ----
  // Produces a .doc file containing HTML wrapped in Word-compatible headers.
  // Microsoft Word opens HTML .doc files and preserves the embedded CSS,
  // so the document looks like the right-hand preview pane.
  function collectPageCss() {
    let css = '';
    const sheets = document.styleSheets;
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      let rules = null;
      try { rules = sheet.cssRules || sheet.rules; } catch (e) { rules = null; }
      if (!rules) continue;
      for (let j = 0; j < rules.length; j++) {
        css += rules[j].cssText + '\n';
      }
    }
    return css;
  }

  function buildDocxHtml(bodyHtml, themePref) {
    const eff = effectiveTheme(themePref || readStoredTheme());
    const css = collectPageCss();
    // Word-specific @page setup to control margins.
    const wordPage = '@page WordSection1 { size: 8.5in 11in; margin: 1in; } '
      + 'div.WordSection1 { page: WordSection1; }';
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" '
      + 'xmlns:w="urn:schemas-microsoft-com:office:word" '
      + 'xmlns="http://www.w3.org/TR/REC-html40">'
      + '<head><meta charset="utf-8"><title>Document</title>'
      + '<style>' + wordPage + '\n' + css + '</style>'
      + '</head><body>'
      + '<div class="WordSection1" data-theme="' + eff + '">'
      + '<article class="preview">' + bodyHtml + '</article>'
      + '</div></body></html>';
  }

  function exportDocx() {
    const html = buildDocxHtml(preview.innerHTML);
    const preamble = '\uFEFF'; // BOM so Word reads as UTF-8
    triggerDownload(preamble + html, 'document.doc', 'application/msword');
  }

  function triggerDownload(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  window.__mdClear = clearAll;
  window.__mdExport = exportMd;
  window.__mdExportDocx = exportDocx;
  window.__mdBuildDocxHtml = buildDocxHtml;

  if (clearBtn) clearBtn.addEventListener('click', clearAll);
  if (exportBtn) exportBtn.addEventListener('click', exportMd);
  if (exportDocxBtn) exportDocxBtn.addEventListener('click', exportDocx);

  // ---- Init ----
  editor.addEventListener('input', function () {
    saveToStorage();
    scheduleRender();
  });

  applyTheme(readStoredTheme());
  loadFromStorage();
  render();
})();

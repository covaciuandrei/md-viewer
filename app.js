(function () {
  'use strict';

  const editor = document.getElementById('editor');
  const preview = document.getElementById('preview');
  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');

  const STORAGE_KEY = 'md-viewer:content';
  const DEBOUNCE_MS = (typeof window !== 'undefined' && window.__DEBOUNCE_MS !== undefined)
    ? window.__DEBOUNCE_MS
    : 150;

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
        const html = window.Prism.highlight(block.textContent, grammar, lang);
        block.innerHTML = html;
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

  // ---- Scroll synchronization ----
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

  // ---- Utilities ----
  function clearAll() {
    editor.value = '';
    try { if (window.localStorage) window.localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    render();
  }
  function exportMd() {
    const blob = new Blob([editor.value], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }
  window.__mdClear = clearAll;
  window.__mdExport = exportMd;

  if (clearBtn) clearBtn.addEventListener('click', clearAll);
  if (exportBtn) exportBtn.addEventListener('click', exportMd);

  editor.addEventListener('input', function () {
    saveToStorage();
    scheduleRender();
  });

  loadFromStorage();
  render();
})();

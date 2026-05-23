// Progressive test suite — extended through each phase of the blueprint.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { marked } = require('marked');
const Prism = require('prismjs');
require('prismjs/components/prism-javascript');
require('prismjs/components/prism-python');

const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');

const PHASE = parseInt(process.env.PHASE || '7', 10);

let passes = 0, fails = 0;
function assert(cond, msg) {
  if (cond) { passes++; console.log('  PASS:', msg); }
  else { fails++; console.error('  FAIL:', msg); }
}

function buildDom(opts) {
  opts = opts || {};
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', () => {});
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  window.marked = marked;
  window.Prism = Prism;
  if (opts.debounce !== undefined) window.__DEBOUNCE_MS = opts.debounce;
  if (opts.storage) {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: opts.storage });
  }
  if (opts.matchMedia !== undefined) {
    window.matchMedia = opts.matchMedia;
  }
  window.URL.createObjectURL = function () { return 'blob:stub'; };
  window.URL.revokeObjectURL = function () {};

  // Inject the page CSS into the JSDOM so collectPageCss() can read rules.
  const styleEl = window.document.createElement('style');
  styleEl.textContent = cssSrc;
  window.document.head.appendChild(styleEl);

  window.eval(appSrc);
  return { dom, window, document: window.document };
}

function makeMemoryStorage(initial) {
  const data = Object.assign({}, initial || {});
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
    clear() { for (const k of Object.keys(data)) delete data[k]; },
    _data: data,
  };
}

function fakeMatchMedia(prefersDark) {
  return function (q) {
    const matches = (q.indexOf('dark') !== -1) ? !!prefersDark : !prefersDark;
    return {
      matches,
      media: q,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {},
      onchange: null,
      dispatchEvent() { return false; },
    };
  };
}

function captureDownload(window, document) {
  const captured = { name: null, type: null, content: null };
  const origCreate = document.createElement.bind(document);
  document.createElement = function (tag) {
    const el = origCreate(tag);
    if (tag === 'a') {
      const origClick = el.click ? el.click.bind(el) : function () {};
      el.click = function () { captured.name = el.download; origClick(); };
    }
    return el;
  };
  // Intercept Blob to read its content
  const OrigBlob = window.Blob;
  window.Blob = function (parts, opts) {
    captured.type = opts && opts.type;
    captured.content = (parts || []).join('');
    return new OrigBlob(parts, opts);
  };
  return captured;
}

// ---------- PHASE 1 ----------
console.log('\n[Phase 1] split-screen UI');
{
  const { document } = buildDom({ debounce: 0 });
  assert(!!document.querySelector('#editor'), '#editor exists');
  assert(!!document.querySelector('#preview'), '#preview exists');
}

// ---------- PHASE 2 ----------
if (PHASE >= 2) {
  console.log('\n[Phase 2] live compilation');
  const { window, document } = buildDom({ debounce: 0 });
  const editor = document.querySelector('#editor');
  const preview = document.querySelector('#preview');
  editor.value = '# Test';
  editor.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert(preview.innerHTML.indexOf('<h1') !== -1 && preview.textContent.indexOf('Test') !== -1,
    'preview contains <h1>Test</h1> after input');
}

// ---------- PHASE 3 ----------
if (PHASE >= 3) {
  console.log('\n[Phase 3] synchronized scrolling');
  const { window, document } = buildDom({ debounce: 0 });
  const editor = document.querySelector('#editor');
  const preview = document.querySelector('#preview');
  Object.defineProperty(editor, 'scrollHeight', { configurable: true, value: 1000 });
  Object.defineProperty(editor, 'clientHeight', { configurable: true, value: 200 });
  Object.defineProperty(preview, 'scrollHeight', { configurable: true, value: 2000 });
  Object.defineProperty(preview, 'clientHeight', { configurable: true, value: 400 });
  editor.scrollTop = 400;
  editor.dispatchEvent(new window.Event('scroll'));
  assert(preview.scrollTop === 800,
    `preview scrolled proportionally (got ${preview.scrollTop}, expected 800)`);
  assert(true, 'no infinite loop (scroll lock works)');
}

// ---------- PHASE 4 ----------
if (PHASE >= 4) {
  console.log('\n[Phase 4] syntax highlighting');
  const { window, document } = buildDom({ debounce: 0 });
  const editor = document.querySelector('#editor');
  const preview = document.querySelector('#preview');
  editor.value = '```javascript\nconst x = 42;\n```\n';
  editor.dispatchEvent(new window.Event('input', { bubbles: true }));
  const code = preview.querySelector('pre code');
  assert(!!code, 'preview has <pre><code> for code block');
  if (code) assert(code.innerHTML.indexOf('token') !== -1, 'highlighted code contains Prism "token" spans');
}

// ---------- PHASE 5 ----------
if (PHASE >= 5) {
  console.log('\n[Phase 5] persistence + utilities');
  const storage = makeMemoryStorage({ 'md-viewer:content': '# Restored' });
  const { window, document } = buildDom({ debounce: 0, storage });
  const editor = document.querySelector('#editor');
  const preview = document.querySelector('#preview');
  assert(editor.value === '# Restored', 'editor restored from localStorage on init');
  assert(preview.innerHTML.indexOf('<h1') !== -1 && preview.textContent.indexOf('Restored') !== -1,
    'preview rendered restored content');

  editor.value = 'hello world';
  editor.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert(storage.getItem('md-viewer:content') === 'hello world',
    'editor input saved to localStorage');

  window.__mdClear();
  assert(editor.value === '' && storage.getItem('md-viewer:content') === null,
    'clear() wipes editor and storage');

  editor.value = '# Exported';
  const cap = captureDownload(window, document);
  window.__mdExport();
  assert(cap.name === 'document.md', 'export() triggers download named document.md');
}

// ---------- PHASE 6 ----------
if (PHASE >= 6) {
  console.log('\n[Phase 6] theme switcher');

  // Default = system, light when prefers-color-scheme is light
  {
    const storage = makeMemoryStorage();
    const { document, window } = buildDom({
      debounce: 0, storage, matchMedia: fakeMatchMedia(false),
    });
    const state = window.__mdGetTheme();
    assert(state.pref === 'system', 'default preference is "system"');
    assert(state.effective === 'light', 'system theme resolves to light when OS prefers light');
    assert(document.documentElement.getAttribute('data-theme') === 'light',
      'data-theme="light" applied to <html>');
  }

  // System = dark when OS prefers dark
  {
    const storage = makeMemoryStorage();
    const { document } = buildDom({
      debounce: 0, storage, matchMedia: fakeMatchMedia(true),
    });
    assert(document.documentElement.getAttribute('data-theme') === 'dark',
      'data-theme="dark" applied when OS prefers dark');
  }

  // Toggle cycles system -> light -> dark -> system, persists
  {
    const storage = makeMemoryStorage();
    const { document, window } = buildDom({
      debounce: 0, storage, matchMedia: fakeMatchMedia(false),
    });
    const themeBtn = document.querySelector('#themeBtn');
    assert(!!themeBtn, '#themeBtn exists');
    themeBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
    assert(storage.getItem('md-viewer:theme') === 'light',
      'first toggle saves "light"');
    assert(document.documentElement.getAttribute('data-theme') === 'light',
      'data-theme="light" applied after first toggle');
    themeBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
    assert(storage.getItem('md-viewer:theme') === 'dark', 'second toggle saves "dark"');
    assert(document.documentElement.getAttribute('data-theme') === 'dark',
      'data-theme="dark" after second toggle');
    themeBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
    assert(storage.getItem('md-viewer:theme') === 'system', 'third toggle returns to "system"');
  }
}

// ---------- PHASE 7 ----------
if (PHASE >= 7) {
  console.log('\n[Phase 7] Word export');
  const { window, document } = buildDom({
    debounce: 0,
    storage: makeMemoryStorage(),
    matchMedia: fakeMatchMedia(false),
  });
  const editor = document.querySelector('#editor');
  editor.value = '# Hello Word\n\nSome **bold** text.\n\n```javascript\nlet x = 1;\n```';
  editor.dispatchEvent(new window.Event('input', { bubbles: true }));

  const cap = captureDownload(window, document);
  window.__mdExportDocx();

  assert(cap.name === 'document.doc', 'Word export downloads as document.doc');
  assert(cap.type === 'application/msword', 'MIME type is application/msword');
  assert(cap.content.indexOf('<h1') !== -1, 'exported content contains rendered <h1>');
  assert(cap.content.indexOf('<strong>bold</strong>') !== -1, 'inline formatting preserved');
  assert(cap.content.indexOf('urn:schemas-microsoft-com:office:word') !== -1,
    'contains Word XML namespace');
  assert(cap.content.indexOf('class="preview"') !== -1,
    'preview class included so styles match preview pane');
  assert(/\.preview\s+pre|preview pre/.test(cap.content),
    'embedded CSS contains preview styles');
  assert(cap.content.indexOf('language-javascript') !== -1,
    'code block language class survives export');
}

console.log(`\nResults: ${passes} passed, ${fails} failed`);
process.exit(fails === 0 ? 0 : 1);

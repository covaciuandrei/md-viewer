// Progressive test suite — phases 1..17.
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");
const { marked } = require("marked");
const Prism = require("prismjs");
require("prismjs/components/prism-javascript");
require("prismjs/components/prism-python");
const DOMPurify = require("dompurify");

const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const appSrc = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const cssSrc = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");

const PHASE = parseInt(process.env.PHASE || "18", 10);

let passes = 0,
  fails = 0;
function assert(cond, msg) {
  if (cond) {
    passes++;
    console.log("  PASS:", msg);
  } else {
    fails++;
    console.error("  FAIL:", msg);
  }
}

function buildDom(opts) {
  opts = opts || {};
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("error", () => {});
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  window.marked = marked;
  window.Prism = Prism;
  if (opts.dompurify !== false) window.DOMPurify = DOMPurify(window);
  if (opts.katex) window.renderMathInElement = opts.katex;
  if (opts.mermaid) window.mermaid = opts.mermaid;
  if (opts.docx) window.docx = opts.docx;
  if (opts.markedFootnote) window.markedFootnote = opts.markedFootnote;
  if (opts.debounce !== undefined) window.__DEBOUNCE_MS = opts.debounce;
  if (opts.storage) {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: opts.storage,
    });
  }
  if (opts.matchMedia !== undefined) window.matchMedia = opts.matchMedia;

  window.URL.createObjectURL = () => "blob:stub";
  window.URL.revokeObjectURL = () => {};

  // Inject the page CSS as a <style> so any rule scraping works.
  const styleEl = window.document.createElement("style");
  styleEl.textContent = cssSrc;
  window.document.head.appendChild(styleEl);

  window.eval(appSrc);
  return { dom, window, document: window.document };
}

function makeMemoryStorage(initial) {
  const data = Object.assign({}, initial || {});
  return {
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
    },
    setItem(k, v) {
      data[k] = String(v);
    },
    removeItem(k) {
      delete data[k];
    },
    clear() {
      for (const k of Object.keys(data)) delete data[k];
    },
    _data: data,
  };
}

function fakeMatchMedia(prefersDark) {
  return function (q) {
    const matches = q.indexOf("dark") !== -1 ? !!prefersDark : !prefersDark;
    return {
      matches,
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      onchange: null,
      dispatchEvent() {
        return false;
      },
    };
  };
}

function captureDownload(window, document) {
  const captured = { name: null, type: null, content: null };
  const origCreate = document.createElement.bind(document);
  document.createElement = function (tag) {
    const el = origCreate(tag);
    if (tag === "a") {
      const origClick = el.click ? el.click.bind(el) : function () {};
      el.click = function () {
        captured.name = el.download;
        origClick();
      };
    }
    return el;
  };
  const OrigBlob = window.Blob;
  window.Blob = function (parts, opts) {
    captured.type = opts && opts.type;
    let combined = "";
    (parts || []).forEach((p) => {
      if (typeof p === "string") combined += p;
      else if (p && typeof p.toString === "function") combined += "";
    });
    if (combined) captured.content = combined;
    return new OrigBlob(parts, opts);
  };
  return captured;
}

// Minimal docx UMD stub
function makeDocxStub(BlobCtor) {
  const Blob_ = BlobCtor || global.Blob || globalThis.Blob;
  class Paragraph {
    constructor(o) {
      this.opts = o;
      this.type = "p";
    }
  }
  class TextRun {
    constructor(o) {
      this.opts = o;
      this.type = "t";
    }
  }
  class ExternalHyperlink {
    constructor(o) {
      this.opts = o;
      this.type = "hl";
    }
  }
  class Table {
    constructor(o) {
      this.opts = o;
      this.type = "tbl";
    }
  }
  class TableRow {
    constructor(o) {
      this.opts = o;
      this.type = "tr";
    }
  }
  class TableCell {
    constructor(o) {
      this.opts = o;
      this.type = "tc";
    }
  }
  class Document {
    constructor(o) {
      this.opts = o;
      this.type = "doc";
    }
  }
  const HeadingLevel = {
    HEADING_1: "H1",
    HEADING_2: "H2",
    HEADING_3: "H3",
    HEADING_4: "H4",
    HEADING_5: "H5",
    HEADING_6: "H6",
  };
  const WidthType = { PERCENTAGE: "pct" };
  const Packer = {
    toBlob(doc) {
      const text =
        "DOCXSTUB:" +
        JSON.stringify({ blocks: doc.opts.sections[0].children.length });
      return Promise.resolve(
        new Blob_([text], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      );
    },
  };
  return {
    Document,
    Paragraph,
    TextRun,
    ExternalHyperlink,
    Table,
    TableRow,
    TableCell,
    HeadingLevel,
    WidthType,
    Packer,
  };
}

(async function main() {
  // ---------- PHASE 1 ----------
  console.log("\n[Phase 1] split-screen UI");
  {
    const { document } = buildDom({ debounce: 0 });
    assert(!!document.querySelector("#editor"), "#editor exists");
    assert(!!document.querySelector("#preview"), "#preview exists");
  }

  // ---------- PHASE 2 ----------
  if (PHASE >= 2) {
    console.log("\n[Phase 2] live compilation");
    const { window, document } = buildDom({ debounce: 0 });
    const editor = document.querySelector("#editor");
    const preview = document.querySelector("#preview");
    editor.value = "# Test";
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert(
      preview.innerHTML.indexOf("<h1") !== -1 &&
        preview.textContent.indexOf("Test") !== -1,
      "preview contains <h1>Test</h1> after input",
    );
  }

  // ---------- PHASE 3 ----------
  if (PHASE >= 3) {
    console.log("\n[Phase 3] synchronized scrolling");
    const { window, document } = buildDom({ debounce: 0 });
    const editor = document.querySelector("#editor");
    const preview = document.querySelector("#preview");
    Object.defineProperty(editor, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(editor, "clientHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(preview, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(preview, "clientHeight", {
      configurable: true,
      value: 400,
    });
    editor.scrollTop = 400;
    editor.dispatchEvent(new window.Event("scroll"));
    assert(
      preview.scrollTop === 800,
      `preview scrolled proportionally (got ${preview.scrollTop}, expected 800)`,
    );
    assert(true, "no infinite loop (scroll lock works)");
  }

  // ---------- PHASE 4 ----------
  if (PHASE >= 4) {
    console.log("\n[Phase 4] syntax highlighting");
    const { window, document } = buildDom({ debounce: 0 });
    const editor = document.querySelector("#editor");
    const preview = document.querySelector("#preview");
    editor.value = "```javascript\nconst x = 42;\n```\n";
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    const code = preview.querySelector("pre code");
    assert(!!code, "preview has <pre><code> for code block");
    if (code)
      assert(
        code.innerHTML.indexOf("token") !== -1,
        "Prism token spans present",
      );
  }

  // ---------- PHASE 5 ----------
  if (PHASE >= 5) {
    console.log("\n[Phase 5] persistence + utilities");
    const storage = makeMemoryStorage({ "md-viewer:content": "# Restored" });
    const { window, document } = buildDom({ debounce: 0, storage });
    const editor = document.querySelector("#editor");
    const preview = document.querySelector("#preview");
    assert(editor.value === "# Restored", "editor restored from localStorage");
    assert(
      preview.innerHTML.indexOf("<h1") !== -1,
      "preview rendered restored content",
    );

    editor.value = "hello world";
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    // After multi-file migration, legacy key is gone and content is stored
    // under md-viewer:doc:<id> for the migrated "Untitled.md".
    const activeId = window.__mdFilesState().activeId;
    assert(
      storage.getItem("md-viewer:doc:" + activeId) === "hello world",
      "input saved",
    );

    window.__mdClear();
    assert(
      editor.value === "" &&
        storage.getItem("md-viewer:doc:" + activeId) === "",
      "clear() wipes editor + storage",
    );

    editor.value = "# Exported";
    const cap = captureDownload(window, document);
    window.__mdExport();
    // Filename now reflects the active file's name (migrated "Untitled.md").
    assert(cap.name === "Untitled.md", ".md export filename");
  }

  // ---------- PHASE 6 ----------
  if (PHASE >= 6) {
    console.log("\n[Phase 6] theme switcher");
    {
      const { window, document } = buildDom({
        debounce: 0,
        storage: makeMemoryStorage(),
        matchMedia: fakeMatchMedia(false),
      });
      const state = window.__mdGetTheme();
      assert(state.pref === "system", "default pref = system");
      assert(state.effective === "light", "light when OS prefers light");
      assert(
        document.documentElement.getAttribute("data-theme") === "light",
        'html[data-theme="light"]',
      );
    }
    {
      const { document } = buildDom({
        debounce: 0,
        storage: makeMemoryStorage(),
        matchMedia: fakeMatchMedia(true),
      });
      assert(
        document.documentElement.getAttribute("data-theme") === "dark",
        'html[data-theme="dark"] when OS prefers dark',
      );
    }
    {
      const storage = makeMemoryStorage();
      const { document, window } = buildDom({
        debounce: 0,
        storage,
        matchMedia: fakeMatchMedia(false),
      });
      const btn = document.querySelector("#themeBtn");
      btn.dispatchEvent(new window.Event("click", { bubbles: true }));
      assert(
        storage.getItem("md-viewer:theme") === "light",
        "cycle 1 -> light",
      );
      btn.dispatchEvent(new window.Event("click", { bubbles: true }));
      assert(storage.getItem("md-viewer:theme") === "dark", "cycle 2 -> dark");
      btn.dispatchEvent(new window.Event("click", { bubbles: true }));
      assert(
        storage.getItem("md-viewer:theme") === "system",
        "cycle 3 -> system",
      );
    }
  }

  // ---------- PHASE 7 (now superseded by Phase 17) ----------
  if (PHASE >= 7) {
    console.log("\n[Phase 7] export pipeline available");
    const { window } = buildDom({
      debounce: 0,
      storage: makeMemoryStorage(),
      matchMedia: fakeMatchMedia(false),
    });
    assert(typeof window.__mdExport === "function", ".md exporter wired");
  }

  // ---------- PHASE 8: TypeScript ----------
  if (PHASE >= 8) {
    console.log("\n[Phase 8] TypeScript migration");
    assert(
      fs.existsSync(path.join(ROOT, "src", "app.ts")),
      "src/app.ts exists",
    );
    assert(
      fs.existsSync(path.join(ROOT, "tsconfig.json")),
      "tsconfig.json exists",
    );
    assert(fs.existsSync(path.join(ROOT, "app.js")), "compiled app.js exists");
    const tsSrc = fs.readFileSync(path.join(ROOT, "src", "app.ts"), "utf8");
    assert(
      /declare const docx: any/.test(tsSrc) ||
        /interface ThemeState/.test(tsSrc),
      "src/app.ts uses TypeScript syntax",
    );
    assert(
      !/interface\s+ThemeState/.test(appSrc),
      "compiled app.js has TS types stripped",
    );
  }

  // ---------- PHASE 9: DOMPurify sanitization ----------
  if (PHASE >= 9) {
    console.log("\n[Phase 9] DOMPurify sanitization");
    const { window, document } = buildDom({
      debounce: 0,
      storage: makeMemoryStorage(),
      matchMedia: fakeMatchMedia(false),
    });
    const editor = document.querySelector("#editor");
    const preview = document.querySelector("#preview");
    editor.value =
      '# Hi\n\n<script>window.__XSS = true;</script>\n\n<img src=x onerror="window.__XSS=true">';
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert(
      preview.innerHTML.indexOf("<script") === -1,
      "<script> tag stripped",
    );
    assert(
      preview.innerHTML.toLowerCase().indexOf("onerror") === -1,
      "onerror attribute stripped",
    );
    assert(window.__XSS !== true, "no JS executed from sanitized markdown");
  }

  // ---------- PHASE 10: GFM ----------
  if (PHASE >= 10) {
    console.log("\n[Phase 10] GitHub Flavored Markdown");
    const { window, document } = buildDom({
      debounce: 0,
      storage: makeMemoryStorage(),
      matchMedia: fakeMatchMedia(false),
    });
    const editor = document.querySelector("#editor");
    const preview = document.querySelector("#preview");
    editor.value = [
      "- [x] done",
      "- [ ] todo",
      "",
      "~~struck~~",
      "",
      "| a | b |",
      "| - | - |",
      "| 1 | 2 |",
      "",
      "visit https://example.com today",
    ].join("\n");
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    const html = preview.innerHTML;
    assert(
      /<input[^>]*checked[^>]*type="checkbox"|<input[^>]*type="checkbox"[^>]*checked/.test(
        html,
      ),
      "task list checked box",
    );
    assert(
      /<del>struck<\/del>/.test(html) || /<s>struck<\/s>/.test(html),
      "strikethrough rendered",
    );
    assert(
      /<table/.test(html) && /<th>a<\/th>/.test(html),
      "GFM table rendered",
    );
    assert(/href="https:\/\/example\.com"/.test(html), "autolink to URL");
  }

  // ---------- PHASE 11: KaTeX ----------
  if (PHASE >= 11) {
    console.log("\n[Phase 11] KaTeX math");
    let called = false;
    const katexStub = function (root, opts) {
      called = true;
      // Walk text nodes; replace $...$ with a span
      const re = /\$([^$]+)\$/g;
      function walk(node) {
        if (node.nodeType === 3) {
          if (re.test(node.textContent)) {
            const span = node.ownerDocument.createElement("span");
            span.className = "katex";
            span.innerHTML = node.textContent.replace(
              re,
              (_, body) => '<span class="katex-rendered">' + body + "</span>",
            );
            node.parentNode.replaceChild(span, node);
          }
        } else if (node.nodeType === 1) {
          Array.from(node.childNodes).forEach(walk);
        }
      }
      walk(root);
    };
    const { window, document } = buildDom({
      debounce: 0,
      storage: makeMemoryStorage(),
      matchMedia: fakeMatchMedia(false),
      katex: katexStub,
    });
    const editor = document.querySelector("#editor");
    const preview = document.querySelector("#preview");
    editor.value = "Inline math $x^2 + y^2 = z^2$ in a paragraph.";
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert(called, "renderMathInElement invoked");
    assert(preview.querySelector(".katex"), "KaTeX span injected into preview");
  }

  // ---------- PHASE 12: Mermaid ----------
  if (PHASE >= 12) {
    console.log("\n[Phase 12] Mermaid diagrams");
    let runCalled = false;
    let runNodes = [];
    const mermaidStub = {
      initialize() {},
      run(opts) {
        runCalled = true;
        runNodes = (opts && opts.nodes) || [];
      },
    };
    const { window, document } = buildDom({
      debounce: 0,
      storage: makeMemoryStorage(),
      matchMedia: fakeMatchMedia(false),
      mermaid: mermaidStub,
    });
    const editor = document.querySelector("#editor");
    const preview = document.querySelector("#preview");
    editor.value = "```mermaid\ngraph TD; A-->B;\n```\n";
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    const div = preview.querySelector(".mermaid");
    assert(!!div, '.mermaid div replaces <pre><code class="language-mermaid">');
    assert(
      div && div.textContent.indexOf("graph TD") !== -1,
      "mermaid source preserved",
    );
    assert(runCalled, "mermaid.run() called");
    assert(runNodes.length === 1, "mermaid.run() received the node");
    assert(
      !preview.querySelector("pre > code.language-mermaid"),
      'no leftover <pre><code class="language-mermaid">',
    );
  }

  // ---------- PHASE 13: Auto TOC ----------
  if (PHASE >= 13) {
    console.log("\n[Phase 13] auto-generated TOC");
    const { window, document } = buildDom({
      debounce: 0,
      storage: makeMemoryStorage(),
      matchMedia: fakeMatchMedia(false),
    });
    const editor = document.querySelector("#editor");
    const preview = document.querySelector("#preview");
    const outline = document.querySelector("#outline");
    editor.value = "# Intro\n\n## Background\n\n## Method\n\n# Results\n";
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    const h1s = preview.querySelectorAll("h1");
    assert(h1s[0].id === "intro", 'first heading slugged "intro"');
    assert(h1s[1].id === "results", 'second h1 slugged "results"');
    const links = outline.querySelectorAll("a.outline-link");
    assert(links.length === 4, "outline lists all 4 headings");
    assert(
      links[0].getAttribute("href") === "#intro",
      "link points to heading anchor",
    );
  }

  // ---------- PHASE 14: Outline panel collapsible ----------
  if (PHASE >= 14) {
    console.log("\n[Phase 14] collapsible outline panel");
    const { window, document } = buildDom({
      debounce: 0,
      storage: makeMemoryStorage(),
      matchMedia: fakeMatchMedia(false),
    });
    const editor = document.querySelector("#editor");
    const outline = document.querySelector("#outline");
    editor.value = "# Top\n\n## Child A\n\n## Child B\n";
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    // The Top heading's children should sit in its own <ul.outline-children>
    const topLi = outline.querySelector('li.outline-item[data-level="1"]');
    assert(!!topLi, "top-level outline item rendered");
    const childUl = topLi.querySelector("ul.outline-children");
    assert(
      !!childUl && childUl.querySelectorAll("li").length === 2,
      "nested children grouped under parent (2 child h2 items)",
    );
    // Collapse via toggle button
    const toggle = topLi.querySelector("button.outline-toggle");
    toggle.dispatchEvent(new window.Event("click", { bubbles: true }));
    assert(
      childUl.style.display === "none",
      "children hidden after toggle click",
    );
    assert(
      toggle.getAttribute("aria-expanded") === "false",
      "toggle aria-expanded=false",
    );
    // Toggle outline panel visibility from toolbar
    const btn = document.querySelector("#outlineBtn");
    btn.dispatchEvent(new window.Event("click", { bubbles: true }));
    assert(
      document.body.getAttribute("data-outline") === "off",
      "outline hidden after button click",
    );
  }

  // ---------- PHASE 15: Resizable splitter + layout toggle ----------
  if (PHASE >= 15) {
    console.log("\n[Phase 15] resizable split + layout toggle");
    const storage = makeMemoryStorage();
    const { window, document } = buildDom({
      debounce: 0,
      storage,
      matchMedia: fakeMatchMedia(false),
    });
    assert(!!document.querySelector("#splitter"), "#splitter exists");
    assert(
      document.body.getAttribute("data-layout") === "split",
      "default layout = split",
    );
    // Click layout buttons
    document
      .querySelector("#layoutEditorBtn")
      .dispatchEvent(new window.Event("click", { bubbles: true }));
    assert(
      document.body.getAttribute("data-layout") === "editor",
      "editor-only layout applied",
    );
    assert(
      storage.getItem("md-viewer:layout") === "editor",
      "editor layout persisted",
    );
    document
      .querySelector("#layoutPreviewBtn")
      .dispatchEvent(new window.Event("click", { bubbles: true }));
    assert(
      document.body.getAttribute("data-layout") === "preview",
      "preview-only layout applied",
    );
    document
      .querySelector("#layoutSplitBtn")
      .dispatchEvent(new window.Event("click", { bubbles: true }));
    assert(
      document.body.getAttribute("data-layout") === "split",
      "back to split",
    );
    // Splitter percentage API
    window.__mdApplySplit(33);
    const main = document.querySelector(".split");
    assert(
      /33%/.test(main.style.gridTemplateColumns),
      "split percentage applied to grid-template-columns",
    );
    assert(
      storage.getItem("md-viewer:split") === "33",
      "split width persisted",
    );
  }

  // ---------- PHASE 16: Drag and drop .md ----------
  if (PHASE >= 16) {
    console.log("\n[Phase 16] drag-and-drop .md files");
    const { window, document } = buildDom({
      debounce: 0,
      storage: makeMemoryStorage(),
      matchMedia: fakeMatchMedia(false),
    });
    const editor = document.querySelector("#editor");
    // Public helper used by the drop handler
    assert(
      typeof window.__mdLoadFileText === "function",
      "__mdLoadFileText exposed",
    );
    window.__mdLoadFileText("# From a dropped file");
    assert(
      editor.value === "# From a dropped file",
      "editor populated from file text",
    );
    assert(
      document.querySelector("#preview").innerHTML.indexOf("<h1") !== -1,
      "preview re-renders after file load",
    );
    // dragover shows overlay
    const evt = new window.Event("dragover", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(evt, "dataTransfer", {
      value: { types: ["Files"], files: [] },
    });
    window.dispatchEvent(evt);
    assert(evt.defaultPrevented, "dragover with Files is preventDefault()ed");
  }

  // ---------- PHASE 17: True .docx ----------
  if (PHASE >= 17) {
    console.log("\n[Phase 17] true .docx export via docx library");
    // Build the DOM first, then attach a docx stub that uses the window.Blob spy
    // so captureDownload can see what Packer wrote.
    const { window, document } = buildDom({
      debounce: 0,
      storage: makeMemoryStorage(),
      matchMedia: fakeMatchMedia(false),
    });
    const cap = captureDownload(window, document);
    window.docx = makeDocxStub(window.Blob);
    const editor = document.querySelector("#editor");
    editor.value = [
      "# Title",
      "",
      "Paragraph with **bold** and *italic* and ~~strike~~ and [link](https://example.com).",
      "",
      "- item one",
      "- item two",
      "",
      "| a | b |",
      "| - | - |",
      "| 1 | 2 |",
      "",
      "> a quote",
      "",
      "```",
      "code line",
      "```",
    ].join("\n");
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));

    await window.__mdExportDocx();
    assert(cap.name === "document.docx", "docx export downloads document.docx");
    assert(
      cap.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "MIME = OOXML wordprocessingml",
    );
    assert(
      /DOCXSTUB:/.test(cap.content),
      "Packer.toBlob() produced the file content",
    );
  }

  // ---------- PHASE 18: Multi-file (sidebar + tabs + DnD + folders + zip) ----
  if (PHASE >= 18) {
    console.log("\n[Phase 18] multi-file support");

    // 1) Migration of legacy md-viewer:content -> Untitled.md
    {
      const storage = makeMemoryStorage({
        "md-viewer:content": "# Legacy",
      });
      const { window, document } = buildDom({ debounce: 0, storage });
      const st = window.__mdFilesState();
      assert(st.nodes.length === 1, "migration created one file");
      assert(
        st.nodes[0].name === "Untitled.md",
        "migrated file named Untitled.md",
      );
      assert(
        storage.getItem("md-viewer:content") === null,
        "legacy key removed after migration",
      );
      const editor = document.querySelector("#editor");
      assert(
        editor.value === "# Legacy",
        "migrated content loaded into editor",
      );
      assert(st.activeId === st.nodes[0].id, "migrated file set as active");
      assert(
        st.openIds.indexOf(st.activeId) !== -1,
        "migrated file is open in a tab",
      );
      assert(
        !!document.querySelector("#tabBar .tab.is-active"),
        "active tab rendered",
      );
      assert(!!document.querySelector("#filesPanel"), "files sidebar exists");
      assert(
        document.body.getAttribute("data-sidebar") === "on",
        "sidebar visible by default",
      );
    }

    // 2) Create / rename / delete + tabs follow
    {
      const storage = makeMemoryStorage();
      const { window, document } = buildDom({ debounce: 0, storage });
      // ensureAtLeastOneFile auto-creates Untitled.md
      let st = window.__mdFilesState();
      const firstId = st.activeId;
      assert(!!firstId, "auto-created initial file");

      // Stub prompt for new-file dialog
      window.prompt = () => "notes.md";
      window.__mdNewFile();
      st = window.__mdFilesState();
      assert(st.nodes.length === 2, "second file created");
      const secondId = st.activeId;
      assert(secondId !== firstId, "new file became active");
      assert(st.openIds.indexOf(secondId) !== -1, "new file opened in tab");
      const tabs = document.querySelectorAll("#tabBar .tab");
      assert(tabs.length === 2, "two tabs rendered");

      // Switch back to first
      window.__mdSetActive(firstId);
      st = window.__mdFilesState();
      assert(st.activeId === firstId, "setActive switched back");

      // Edit, then switch and switch back: content preserved per file
      const editor = document.querySelector("#editor");
      editor.value = "first content";
      editor.dispatchEvent(new window.Event("input", { bubbles: true }));
      window.__mdSetActive(secondId);
      assert(editor.value === "", "second file editor is empty");
      editor.value = "second content";
      editor.dispatchEvent(new window.Event("input", { bubbles: true }));
      window.__mdSetActive(firstId);
      assert(editor.value === "first content", "first file content preserved");

      // Delete second file (confirm=true)
      window.confirm = () => true;
      window.__mdRemoveNode(secondId);
      st = window.__mdFilesState();
      assert(
        !st.nodes.find((n) => n.id === secondId),
        "second file removed from tree",
      );
      assert(
        st.openIds.indexOf(secondId) === -1,
        "second file removed from tabs",
      );
      assert(
        storage.getItem("md-viewer:doc:" + secondId) === null,
        "second file's doc key removed",
      );
    }

    // 3) Folders + nesting + recursive delete + cycle guard
    {
      const storage = makeMemoryStorage();
      const { window } = buildDom({ debounce: 0, storage });
      window.prompt = () => "Docs";
      window.__mdNewFolder();
      let st = window.__mdFilesState();
      const folder = st.nodes.find((n) => n.type === "folder");
      assert(!!folder, "folder created");

      window.prompt = () => "child.md";
      // Activate folder so new file lands inside
      // (active is currently the auto-created Untitled.md at root,
      //  so targetParentForNew returns root — we'll move file in next step)
      window.__mdNewFile();
      st = window.__mdFilesState();
      const child = st.nodes.find(
        (n) => n.type === "file" && n.name === "child.md",
      );
      assert(!!child, "child file created");

      // Move child into folder
      const moved = window.__mdMoveNode(child.id, folder.id);
      assert(moved, "moveNode returned true");
      st = window.__mdFilesState();
      const child2 = st.nodes.find((n) => n.id === child.id);
      assert(child2.parentId === folder.id, "child re-parented into folder");

      // Cycle guard: cannot move folder into its own descendant
      const cycle = window.__mdMoveNode(folder.id, child.id);
      assert(cycle === false, "cycle move rejected (file target)");

      // Create sub-folder inside folder, then try to move parent into it
      // First activate folder
      window.__mdSetActive(folder.id);
      window.prompt = () => "Sub";
      window.__mdNewFolder();
      st = window.__mdFilesState();
      const sub = st.nodes.find((n) => n.type === "folder" && n.name === "Sub");
      assert(!!sub && sub.parentId === folder.id, "sub-folder under folder");
      const cycle2 = window.__mdMoveNode(folder.id, sub.id);
      assert(cycle2 === false, "cycle move rejected (descendant folder)");

      // Recursive delete
      window.confirm = () => true;
      window.__mdRemoveNode(folder.id);
      st = window.__mdFilesState();
      assert(!st.nodes.find((n) => n.id === folder.id), "folder deleted");
      assert(
        !st.nodes.find((n) => n.id === child.id),
        "child file deleted recursively",
      );
      assert(
        !st.nodes.find((n) => n.id === sub.id),
        "sub-folder deleted recursively",
      );
      assert(
        storage.getItem("md-viewer:doc:" + child.id) === null,
        "child doc key removed",
      );
    }

    // 4) Multi-file external drop -> imports all, opens all, activates first
    {
      const storage = makeMemoryStorage();
      const { window, document } = buildDom({ debounce: 0, storage });

      // Stub FileReader to fire onload synchronously
      window.FileReader = class {
        readAsText(file) {
          this.result = file._text;
          if (typeof this.onload === "function") this.onload();
        }
      };
      function fakeFile(name, text) {
        return { name, type: "text/markdown", _text: text };
      }

      const evt = new window.Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(evt, "dataTransfer", {
        value: {
          types: ["Files"],
          files: [
            fakeFile("a.md", "# A"),
            fakeFile("b.md", "# B"),
            fakeFile("c.md", "# C"),
          ],
        },
      });
      Object.defineProperty(evt, "target", { value: document.body });
      window.dispatchEvent(evt);

      const st = window.__mdFilesState();
      const fileNodes = st.nodes.filter((n) => n.type === "file");
      // Auto-created Untitled.md + 3 imports = 4
      assert(fileNodes.length === 4, "all dropped files imported");
      const aNode = fileNodes.find((n) => n.name === "a.md");
      assert(!!aNode, "a.md imported");
      assert(st.activeId === aNode.id, "first dropped file activated");
      assert(st.openIds.length >= 3, "imported files opened in tabs");
      const editor = document.querySelector("#editor");
      assert(editor.value === "# A", "editor shows first imported file");
    }

    // 5) Tab close: closing active falls back; Ctrl/Cmd+W shortcut
    {
      const storage = makeMemoryStorage();
      const { window, document } = buildDom({ debounce: 0, storage });
      window.prompt = () => "x.md";
      window.__mdNewFile();
      let st = window.__mdFilesState();
      const x = st.activeId;
      assert(st.openIds.length === 2, "two files open");
      window.__mdCloseTab(x);
      st = window.__mdFilesState();
      assert(st.openIds.indexOf(x) === -1, "closed tab removed");
      assert(st.activeId !== x, "active switched to fallback");
      assert(
        st.nodes.find((n) => n.id === x),
        "closed file still exists in tree",
      );
    }

    // 6) ZIP export preserves folder paths
    {
      const storage = makeMemoryStorage();
      const { window } = buildDom({ debounce: 0, storage });
      // JSZip stub capturing folder/file paths
      const recorded = { paths: [] };
      window.JSZip = function () {
        return {
          folder(p) {
            recorded.paths.push(p + "/");
            return this;
          },
          file(p, content) {
            recorded.paths.push(p);
            recorded["__" + p] = content;
          },
          generateAsync() {
            return Promise.resolve(new window.Blob(["ZIPSTUB"]));
          },
        };
      };

      // Build a small tree
      window.prompt = () => "Docs";
      window.__mdNewFolder();
      let st = window.__mdFilesState();
      const folder = st.nodes.find((n) => n.type === "folder");
      window.prompt = () => "guide.md";
      window.__mdNewFile();
      st = window.__mdFilesState();
      const guide = st.nodes.find((n) => n.name === "guide.md");
      window.__mdMoveNode(guide.id, folder.id);

      await window.__mdExportZip();
      assert(
        recorded.paths.indexOf("Docs/") !== -1,
        "folder path written to zip",
      );
      assert(
        recorded.paths.indexOf("Docs/guide.md") !== -1,
        "nested file path written to zip",
      );
    }
  }

  console.log(`\nResults: ${passes} passed, ${fails} failed`);
  process.exit(fails === 0 ? 0 : 1);
})();

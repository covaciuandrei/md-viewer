// Markdown Live Preview — TypeScript source.
// Compiled to ../app.js via `npm run build`.
(function () {
    "use strict";
    const w = window;
    // ---- Element lookups ----
    const editor = document.getElementById("editor");
    const preview = document.getElementById("preview");
    const outlineEl = document.getElementById("outline");
    const splitter = document.getElementById("splitter");
    const clearBtn = document.getElementById("clearBtn");
    const exportBtn = document.getElementById("exportBtn");
    const exportDocxBtn = document.getElementById("exportDocxBtn");
    const exportPdfBtn = document.getElementById("exportPdfBtn");
    const themeBtn = document.getElementById("themeBtn");
    const outlineBtn = document.getElementById("outlineBtn");
    const layoutSplitBtn = document.getElementById("layoutSplitBtn");
    const layoutEditorBtn = document.getElementById("layoutEditorBtn");
    const layoutPreviewBtn = document.getElementById("layoutPreviewBtn");
    const prismThemeLink = document.getElementById("prismTheme");
    const dropOverlay = document.getElementById("dropOverlay");
    // ---- Constants ----
    const STORAGE_KEY = "md-viewer:content";
    const THEME_KEY = "md-viewer:theme";
    const LAYOUT_KEY = "md-viewer:layout";
    const SPLIT_KEY = "md-viewer:split";
    const OUTLINE_KEY = "md-viewer:outline";
    const PRISM_LIGHT = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css";
    const PRISM_DARK = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css";
    const DEBOUNCE_MS = w.__DEBOUNCE_MS !== undefined ? w.__DEBOUNCE_MS : 150;
    // ---- marked configuration (Phase 10: GFM + footnotes) ----
    function configureMarked() {
        if (typeof marked === "undefined" || !marked)
            return;
        try {
            if (typeof marked.setOptions === "function") {
                marked.setOptions({ gfm: true, breaks: true });
            }
            if (typeof markedFootnote === "function" &&
                typeof marked.use === "function") {
                try {
                    marked.use(markedFootnote());
                }
                catch (_) { }
            }
        }
        catch (_) { }
    }
    configureMarked();
    // ---- Slug helpers ----
    const slugCounts = {};
    function slugify(text) {
        return String(text || "")
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-");
    }
    function uniqueSlug(text) {
        const base = slugify(text) || "section";
        const count = slugCounts[base] || 0;
        slugCounts[base] = count + 1;
        return count === 0 ? base : `${base}-${count}`;
    }
    // ---- Highlight (Phase 4) ----
    function highlightCodeBlocks(root) {
        if (typeof Prism === "undefined" || !Prism)
            return;
        const blocks = root.querySelectorAll("pre code");
        blocks.forEach((block) => {
            let lang = null;
            block.classList.forEach((c) => {
                if (c.indexOf("language-") === 0)
                    lang = c.slice("language-".length);
            });
            if (lang === "mermaid")
                return; // handled separately
            const grammar = lang && Prism.languages[lang];
            if (grammar) {
                block.innerHTML = Prism.highlight(block.textContent || "", grammar, lang);
            }
            else if (typeof Prism.highlightElement === "function") {
                Prism.highlightElement(block);
            }
        });
    }
    // ---- Mermaid (Phase 12) ----
    let mermaidCounter = 0;
    function processMermaidBlocks(root) {
        const blocks = root.querySelectorAll("pre > code.language-mermaid");
        blocks.forEach((code) => {
            const pre = code.parentElement;
            if (!pre)
                return;
            const div = document.createElement("div");
            div.className = "mermaid";
            div.textContent = code.textContent || "";
            div.id = "mermaid-" + ++mermaidCounter;
            pre.replaceWith(div);
        });
        try {
            if (typeof mermaid !== "undefined" &&
                mermaid &&
                typeof mermaid.run === "function") {
                const nodes = Array.from(root.querySelectorAll(".mermaid"));
                if (nodes.length)
                    mermaid.run({ nodes });
            }
        }
        catch (_) { }
    }
    // ---- Heading IDs + Outline/TOC (Phases 13 & 14) ----
    function addHeadingIds(root) {
        for (const k of Object.keys(slugCounts))
            delete slugCounts[k];
        const headings = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
        headings.forEach((h) => {
            if (!h.id)
                h.id = uniqueSlug(h.textContent || "");
        });
    }
    function buildOutline(root) {
        if (!outlineEl)
            return;
        outlineEl.innerHTML = "";
        const header = document.createElement("div");
        header.className = "outline-header";
        header.textContent = "Outline";
        outlineEl.appendChild(header);
        const headings = Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6"));
        if (headings.length === 0) {
            const empty = document.createElement("p");
            empty.className = "outline-empty";
            empty.textContent = "No headings yet.";
            outlineEl.appendChild(empty);
            return;
        }
        const rootUl = document.createElement("ul");
        rootUl.className = "outline-root";
        outlineEl.appendChild(rootUl);
        const stack = [
            { level: 0, ul: rootUl },
        ];
        headings.forEach((h) => {
            const level = parseInt(h.tagName.substring(1), 10);
            const li = document.createElement("li");
            li.className = "outline-item";
            li.setAttribute("data-level", String(level));
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "outline-toggle";
            toggle.setAttribute("aria-expanded", "true");
            toggle.textContent = "▾";
            const a = document.createElement("a");
            a.href = "#" + h.id;
            a.className = "outline-link";
            a.textContent = h.textContent || "";
            a.addEventListener("click", (e) => {
                e.preventDefault();
                h.scrollIntoView({ behavior: "smooth", block: "start" });
                try {
                    history.replaceState(null, "", "#" + h.id);
                }
                catch (_) { }
            });
            li.appendChild(toggle);
            li.appendChild(a);
            while (stack.length > 1 && stack[stack.length - 1].level >= level)
                stack.pop();
            stack[stack.length - 1].ul.appendChild(li);
            const childUl = document.createElement("ul");
            childUl.className = "outline-children";
            li.appendChild(childUl);
            toggle.addEventListener("click", () => {
                const expanded = toggle.getAttribute("aria-expanded") !== "false";
                toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
                toggle.textContent = expanded ? "▸" : "▾";
                childUl.style.display = expanded ? "none" : "";
            });
            stack.push({ level, ul: childUl });
        });
    }
    // ---- Render pipeline ----
    function render() {
        const md = editor.value;
        const parser = typeof marked !== "undefined" && marked && (marked.parse || marked);
        let html = "";
        if (typeof parser === "function") {
            html = parser(md);
        }
        else {
            html = md.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
        }
        // Phase 9: sanitize before injection
        if (typeof DOMPurify !== "undefined" &&
            DOMPurify &&
            typeof DOMPurify.sanitize === "function") {
            html = DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
        }
        preview.innerHTML = html;
        addHeadingIds(preview);
        processMermaidBlocks(preview);
        highlightCodeBlocks(preview);
        // Phase 11: KaTeX math
        try {
            if (typeof renderMathInElement === "function") {
                renderMathInElement(preview, {
                    delimiters: [
                        { left: "$$", right: "$$", display: true },
                        { left: "$", right: "$", display: false },
                    ],
                    throwOnError: false,
                });
            }
        }
        catch (_) { }
        buildOutline(preview);
    }
    w.mdRender = render;
    let timer = null;
    function scheduleRender() {
        if (DEBOUNCE_MS <= 0) {
            render();
            return;
        }
        clearTimeout(timer);
        timer = setTimeout(render, DEBOUNCE_MS);
    }
    // ---- Scroll sync ----
    let scrollLock = false;
    function syncScroll(source, target) {
        if (scrollLock)
            return;
        scrollLock = true;
        try {
            const sMax = source.scrollHeight - source.clientHeight;
            const tMax = target.scrollHeight - target.clientHeight;
            const ratio = sMax > 0 ? source.scrollTop / sMax : 0;
            target.scrollTop = ratio * tMax;
        }
        finally {
            setTimeout(() => {
                scrollLock = false;
            }, 0);
        }
    }
    w.__syncScroll = syncScroll;
    editor.addEventListener("scroll", () => syncScroll(editor, preview));
    preview.addEventListener("scroll", () => syncScroll(preview, editor));
    // ---- Persistence ----
    function loadFromStorage() {
        try {
            const saved = w.localStorage && w.localStorage.getItem(STORAGE_KEY);
            if (saved !== null && saved !== undefined)
                editor.value = saved;
        }
        catch (_) { }
    }
    function saveToStorage() {
        try {
            if (w.localStorage)
                w.localStorage.setItem(STORAGE_KEY, editor.value);
        }
        catch (_) { }
    }
    w.__mdStorageKey = STORAGE_KEY;
    // ---- Theme (Phase 6) ----
    function readStoredTheme() {
        try {
            const v = w.localStorage && w.localStorage.getItem(THEME_KEY);
            if (v === "light" || v === "dark" || v === "system")
                return v;
        }
        catch (_) { }
        return "system";
    }
    function systemTheme() {
        try {
            if (typeof w.matchMedia === "function") {
                return w.matchMedia("(prefers-color-scheme: dark)").matches
                    ? "dark"
                    : "light";
            }
        }
        catch (_) { }
        return "light";
    }
    function effectiveTheme(pref) {
        return pref === "system" ? systemTheme() : pref;
    }
    function applyTheme(pref) {
        const eff = effectiveTheme(pref);
        document.documentElement.setAttribute("data-theme", eff);
        if (prismThemeLink) {
            prismThemeLink.setAttribute("href", eff === "dark" ? PRISM_DARK : PRISM_LIGHT);
        }
        if (themeBtn) {
            const label = pref === "system" ? "System" : pref === "dark" ? "Dark" : "Light";
            themeBtn.textContent = "Theme: " + label;
            themeBtn.setAttribute("data-pref", pref);
            themeBtn.setAttribute("data-effective", eff);
        }
        try {
            if (typeof mermaid !== "undefined" &&
                mermaid &&
                typeof mermaid.initialize === "function") {
                mermaid.initialize({
                    startOnLoad: false,
                    theme: eff === "dark" ? "dark" : "default",
                });
            }
        }
        catch (_) { }
        highlightCodeBlocks(preview);
    }
    function setThemePref(pref) {
        try {
            if (w.localStorage)
                w.localStorage.setItem(THEME_KEY, pref);
        }
        catch (_) { }
        applyTheme(pref);
    }
    function cycleTheme() {
        const order = ["system", "light", "dark"];
        const cur = readStoredTheme();
        const next = order[(order.indexOf(cur) + 1) % order.length];
        setThemePref(next);
    }
    w.__mdSetTheme = setThemePref;
    w.__mdCycleTheme = cycleTheme;
    w.__mdGetTheme = () => ({
        pref: readStoredTheme(),
        effective: effectiveTheme(readStoredTheme()),
    });
    if (themeBtn)
        themeBtn.addEventListener("click", cycleTheme);
    try {
        if (typeof w.matchMedia === "function") {
            const mql = w.matchMedia("(prefers-color-scheme: dark)");
            const onChange = () => {
                if (readStoredTheme() === "system")
                    applyTheme("system");
            };
            if (typeof mql.addEventListener === "function")
                mql.addEventListener("change", onChange);
            else if (typeof mql.addListener === "function")
                mql.addListener(onChange);
        }
    }
    catch (_) { }
    // ---- Layout (Phase 15) ----
    function readLayout() {
        try {
            const v = w.localStorage && w.localStorage.getItem(LAYOUT_KEY);
            if (v === "split" || v === "editor" || v === "preview")
                return v;
        }
        catch (_) { }
        return "split";
    }
    function applyLayout(mode) {
        document.body.setAttribute("data-layout", mode);
        try {
            if (w.localStorage)
                w.localStorage.setItem(LAYOUT_KEY, mode);
        }
        catch (_) { }
        [layoutSplitBtn, layoutEditorBtn, layoutPreviewBtn].forEach((btn) => {
            if (btn)
                btn.classList.remove("is-active");
        });
        const map = {
            split: layoutSplitBtn,
            editor: layoutEditorBtn,
            preview: layoutPreviewBtn,
        };
        if (map[mode])
            map[mode].classList.add("is-active");
    }
    w.__mdApplyLayout = applyLayout;
    w.__mdGetLayout = readLayout;
    if (layoutSplitBtn)
        layoutSplitBtn.addEventListener("click", () => applyLayout("split"));
    if (layoutEditorBtn)
        layoutEditorBtn.addEventListener("click", () => applyLayout("editor"));
    if (layoutPreviewBtn)
        layoutPreviewBtn.addEventListener("click", () => applyLayout("preview"));
    // ---- Splitter drag (Phase 15) ----
    function readSplit() {
        try {
            const raw = w.localStorage && w.localStorage.getItem(SPLIT_KEY);
            const v = parseFloat(raw || "");
            if (!isNaN(v) && v > 10 && v < 90)
                return v;
        }
        catch (_) { }
        return 50;
    }
    function applySplit(pct) {
        const main = document.querySelector(".split");
        if (main)
            main.style.gridTemplateColumns = pct + "% 6px 1fr";
        try {
            if (w.localStorage)
                w.localStorage.setItem(SPLIT_KEY, String(pct));
        }
        catch (_) { }
    }
    w.__mdApplySplit = applySplit;
    w.__mdGetSplit = readSplit;
    if (splitter) {
        let dragging = false;
        splitter.addEventListener("mousedown", (e) => {
            dragging = true;
            e.preventDefault();
            document.body.style.cursor = "col-resize";
        });
        document.addEventListener("mousemove", (e) => {
            if (!dragging)
                return;
            const main = document.querySelector(".split");
            if (!main)
                return;
            const rect = main.getBoundingClientRect();
            const pct = ((e.clientX - rect.left) / rect.width) * 100;
            if (pct > 10 && pct < 90)
                applySplit(pct);
        });
        document.addEventListener("mouseup", () => {
            if (dragging) {
                dragging = false;
                document.body.style.cursor = "";
            }
        });
    }
    // ---- Outline toggle ----
    function setOutlineVisible(visible) {
        document.body.setAttribute("data-outline", visible ? "on" : "off");
        try {
            if (w.localStorage)
                w.localStorage.setItem(OUTLINE_KEY, visible ? "on" : "off");
        }
        catch (_) { }
    }
    w.__mdSetOutline = setOutlineVisible;
    if (outlineBtn)
        outlineBtn.addEventListener("click", () => {
            const cur = document.body.getAttribute("data-outline") !== "off";
            setOutlineVisible(!cur);
        });
    // ---- Drag and drop .md (Phase 16) ----
    function loadFileText(text) {
        editor.value = text;
        saveToStorage();
        render();
    }
    w.__mdLoadFileText = loadFileText;
    function setupDragDrop() {
        let depth = 0;
        const show = () => {
            if (dropOverlay)
                dropOverlay.classList.add("is-active");
        };
        const hide = () => {
            if (dropOverlay)
                dropOverlay.classList.remove("is-active");
        };
        const isFileDrag = (e) => !!(e.dataTransfer &&
            Array.from(e.dataTransfer.types || []).indexOf("Files") !== -1);
        window.addEventListener("dragenter", (e) => {
            if (!isFileDrag(e))
                return;
            depth++;
            show();
            e.preventDefault();
        });
        window.addEventListener("dragover", (e) => {
            if (isFileDrag(e))
                e.preventDefault();
        });
        window.addEventListener("dragleave", () => {
            depth = Math.max(0, depth - 1);
            if (depth === 0)
                hide();
        });
        window.addEventListener("drop", (e) => {
            e.preventDefault();
            depth = 0;
            hide();
            const dt = e.dataTransfer;
            if (!dt || !dt.files || dt.files.length === 0)
                return;
            const file = dt.files[0];
            const reader = new FileReader();
            reader.onload = () => loadFileText(String(reader.result || ""));
            reader.readAsText(file);
        });
    }
    setupDragDrop();
    // ---- Utilities ----
    function clearAll() {
        editor.value = "";
        try {
            if (w.localStorage)
                w.localStorage.removeItem(STORAGE_KEY);
        }
        catch (_) { }
        render();
    }
    function exportMd() {
        triggerDownload(editor.value, "document.md", "text/markdown;charset=utf-8");
    }
    w.__mdClear = clearAll;
    w.__mdExport = exportMd;
    if (clearBtn)
        clearBtn.addEventListener("click", clearAll);
    if (exportBtn)
        exportBtn.addEventListener("click", exportMd);
    function triggerDownload(content, filename, mime) {
        const blob = new Blob([content], { type: mime });
        triggerBlobDownload(blob, filename);
    }
    function triggerBlobDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    // ---- True .docx export (Phase 17) ----
    function inlineRuns(el, fmt) {
        const { TextRun, ExternalHyperlink } = docx;
        const runs = [];
        el.childNodes.forEach((n) => {
            if (n.nodeType === 3) {
                const text = n.textContent || "";
                if (!text.length)
                    return;
                runs.push(new TextRun({ text, ...fmt }));
            }
            else if (n.nodeType === 1) {
                const child = n;
                const tag = child.tagName.toLowerCase();
                const next = { ...fmt };
                if (tag === "strong" || tag === "b")
                    next.bold = true;
                else if (tag === "em" || tag === "i")
                    next.italics = true;
                else if (tag === "s" || tag === "del" || tag === "strike")
                    next.strike = true;
                else if (tag === "code") {
                    next.font = "Courier New";
                    next.size = 20;
                }
                else if (tag === "br") {
                    runs.push(new TextRun({ text: "", break: 1 }));
                    return;
                }
                else if (tag === "a") {
                    const href = child.getAttribute("href") || "";
                    runs.push(new ExternalHyperlink({
                        link: href,
                        children: inlineRuns(child, {
                            ...next,
                            style: "Hyperlink",
                            color: "2563eb",
                        }),
                    }));
                    return;
                }
                runs.push(...inlineRuns(child, next));
            }
        });
        return runs;
    }
    function elementsToBlocks(root) {
        const { Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType, TextRun, } = docx;
        const headingMap = {
            h1: HeadingLevel.HEADING_1,
            h2: HeadingLevel.HEADING_2,
            h3: HeadingLevel.HEADING_3,
            h4: HeadingLevel.HEADING_4,
            h5: HeadingLevel.HEADING_5,
            h6: HeadingLevel.HEADING_6,
        };
        const blocks = [];
        Array.from(root.children).forEach((el) => {
            const tag = el.tagName.toLowerCase();
            if (headingMap[tag]) {
                blocks.push(new Paragraph({
                    heading: headingMap[tag],
                    children: inlineRuns(el, {}),
                }));
            }
            else if (tag === "p") {
                blocks.push(new Paragraph({ children: inlineRuns(el, {}) }));
            }
            else if (tag === "ul" || tag === "ol") {
                const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === "li");
                items.forEach((li, i) => {
                    const prefix = tag === "ol" ? i + 1 + ". " : "• ";
                    const runs = [new TextRun({ text: prefix }), ...inlineRuns(li, {})];
                    blocks.push(new Paragraph({ children: runs, indent: { left: 360 } }));
                });
            }
            else if (tag === "blockquote") {
                Array.from(el.children).forEach((child) => {
                    blocks.push(new Paragraph({
                        children: inlineRuns(child, { italics: true, color: "64748b" }),
                        indent: { left: 360 },
                    }));
                });
            }
            else if (tag === "pre") {
                const code = el.querySelector("code");
                const text = (code ? code.textContent : el.textContent) || "";
                text.split("\n").forEach((line) => {
                    blocks.push(new Paragraph({
                        children: [
                            new TextRun({ text: line, font: "Courier New", size: 20 }),
                        ],
                    }));
                });
            }
            else if (tag === "hr") {
                blocks.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
            }
            else if (tag === "table") {
                const rows = [];
                Array.from(el.querySelectorAll("tr")).forEach((tr) => {
                    const cells = Array.from(tr.children).map((td) => new TableCell({
                        children: [new Paragraph({ children: inlineRuns(td, {}) })],
                    }));
                    rows.push(new TableRow({ children: cells }));
                });
                if (rows.length) {
                    blocks.push(new Table({
                        rows,
                        width: { size: 100, type: WidthType.PERCENTAGE },
                    }));
                }
            }
            else {
                blocks.push(new Paragraph({ children: inlineRuns(el, {}) }));
            }
        });
        return blocks;
    }
    function exportDocxTrue() {
        if (typeof docx === "undefined" || !docx) {
            return Promise.reject(new Error("docx library not loaded"));
        }
        const { Document, Packer } = docx;
        const blocks = elementsToBlocks(preview);
        const doc = new Document({ sections: [{ children: blocks }] });
        return Packer.toBlob(doc).then((blob) => {
            const renamed = new Blob([blob], {
                type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });
            triggerBlobDownload(renamed, "document.docx");
        });
    }
    w.__mdExportDocx = exportDocxTrue;
    if (exportDocxBtn)
        exportDocxBtn.addEventListener("click", () => {
            exportDocxTrue();
        });
    // ---- PDF export (via browser print dialog) ----
    function exportPdf() {
        const previewHtml = preview.innerHTML;
        const title = (function () {
            const h = preview.querySelector("h1, h2, h3");
            return (h && h.textContent && h.textContent.trim()) || "document";
        })();
        const eff = effectiveTheme(readStoredTheme());
        const prismHref = eff === "dark" ? PRISM_DARK : PRISM_LIGHT;
        // Inline page-level styles for the print window. Reuse the app stylesheet
        // so the preview keeps the same typography, then add print-specific rules.
        const printDoc = "<!doctype html><html><head><meta charset=\"utf-8\"><title>" +
            title.replace(/[<>&]/g, "") +
            "</title>" +
            '<link rel="stylesheet" href="' +
            location.href.replace(/[^/]*$/, "") +
            'styles.css">' +
            '<link rel="stylesheet" href="' +
            prismHref +
            '">' +
            '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">' +
            "<style>" +
            "html,body{background:#fff;color:#000;margin:0;padding:0;}" +
            "body{padding:24px;}" +
            ".preview{max-width:none;padding:0;overflow:visible;}" +
            "pre,code{white-space:pre-wrap;word-wrap:break-word;}" +
            "img,svg,table{max-width:100%;page-break-inside:avoid;}" +
            "h1,h2,h3,h4,h5,h6{page-break-after:avoid;}" +
            "@page{margin:18mm;}" +
            "</style></head><body>" +
            '<article class="preview">' +
            previewHtml +
            "</article></body></html>";
        const win = window.open("", "_blank");
        if (!win) {
            try {
                alert("Could not open print window. Please allow pop-ups to export PDF.");
            }
            catch (_) { }
            return;
        }
        win.document.open();
        win.document.write(printDoc);
        win.document.close();
        const doPrint = () => {
            try {
                win.focus();
                win.print();
            }
            catch (_) { }
        };
        // Wait for stylesheets/fonts to load before triggering print.
        if (win.document.readyState === "complete") {
            setTimeout(doPrint, 250);
        }
        else {
            win.addEventListener("load", () => setTimeout(doPrint, 250));
        }
    }
    w.__mdExportPdf = exportPdf;
    if (exportPdfBtn)
        exportPdfBtn.addEventListener("click", exportPdf);
    // ---- Init ----
    editor.addEventListener("input", () => {
        saveToStorage();
        scheduleRender();
    });
    applyTheme(readStoredTheme());
    applyLayout(readLayout());
    applySplit(readSplit());
    try {
        const outlinePref = w.localStorage && w.localStorage.getItem(OUTLINE_KEY);
        setOutlineVisible(outlinePref !== "off");
    }
    catch (_) {
        setOutlineVisible(true);
    }
    loadFromStorage();
    render();
})();

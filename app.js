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
    const exportBtn = document.getElementById("exportBtn");
    const exportDocxBtn = document.getElementById("exportDocxBtn");
    const exportPdfBtn = document.getElementById("exportPdfBtn");
    const exportZipBtn = document.getElementById("exportZipBtn");
    const exportMenuBtn = document.getElementById("exportMenuBtn");
    const exportMenu = document.getElementById("exportMenu");
    const themeBtn = document.getElementById("themeBtn");
    const outlineBtn = document.getElementById("outlineBtn");
    const filesBtn = document.getElementById("filesBtn");
    const newFileBtn = document.getElementById("newFileBtn");
    const newFolderBtn = document.getElementById("newFolderBtn");
    const clearAllBtn = document.getElementById("clearAllBtn");
    const filesTreeEl = document.getElementById("filesTree");
    const filesUsageEl = document.getElementById("filesUsage");
    const tabBarEl = document.getElementById("tabBar");
    const layoutSplitBtn = document.getElementById("layoutSplitBtn");
    const layoutEditorBtn = document.getElementById("layoutEditorBtn");
    const layoutPreviewBtn = document.getElementById("layoutPreviewBtn");
    const prismThemeLink = document.getElementById("prismTheme");
    const dropOverlay = document.getElementById("dropOverlay");
    // ---- Constants ----
    const STORAGE_KEY = "md-viewer:content"; // legacy single-doc key (migration only)
    const FILES_KEY = "md-viewer:files";
    const DOC_PREFIX = "md-viewer:doc:";
    const EXPANDED_KEY = "md-viewer:folders:expanded";
    const SIDEBAR_KEY = "md-viewer:sidebar";
    const NODE_MIME = "application/x-md-viewer-node";
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
    function genId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
    function safeGet(k) {
        try {
            return (w.localStorage && w.localStorage.getItem(k)) || null;
        }
        catch (_) {
            return null;
        }
    }
    function safeSet(k, v) {
        try {
            if (!w.localStorage)
                return false;
            w.localStorage.setItem(k, v);
            return true;
        }
        catch (e) {
            if (e &&
                (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014)) {
                try {
                    if (filesUsageEl)
                        filesUsageEl.textContent =
                            "Storage full — delete files or shrink content.";
                }
                catch (_) { }
            }
            return false;
        }
    }
    function safeRemove(k) {
        try {
            if (w.localStorage)
                w.localStorage.removeItem(k);
        }
        catch (_) { }
    }
    function defaultState() {
        return { nodes: [], activeId: null, openIds: [], version: 1 };
    }
    function loadState() {
        const raw = safeGet(FILES_KEY);
        if (raw) {
            try {
                const s = JSON.parse(raw);
                if (s && Array.isArray(s.nodes)) {
                    return {
                        nodes: s.nodes,
                        activeId: s.activeId || null,
                        openIds: Array.isArray(s.openIds) ? s.openIds : [],
                        version: s.version || 1,
                    };
                }
            }
            catch (_) { }
        }
        return defaultState();
    }
    function saveState(s) {
        safeSet(FILES_KEY, JSON.stringify(s));
    }
    let state = loadState();
    function findNode(id) {
        if (!id)
            return undefined;
        return state.nodes.find((n) => n.id === id);
    }
    function childrenOf(parentId) {
        return state.nodes
            .filter((n) => n.parentId === parentId)
            .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    }
    function uniqueName(name, parentId, ignoreId) {
        const siblings = state.nodes.filter((n) => n.parentId === parentId && n.id !== ignoreId);
        const taken = new Set(siblings.map((n) => n.name.toLowerCase()));
        if (!taken.has(name.toLowerCase()))
            return name;
        const m = name.match(/^(.*?)(?:\s\((\d+)\))?(\.[^.]+)?$/);
        const base = (m && m[1]) || name;
        const ext = (m && m[3]) || "";
        let i = 2;
        while (taken.has((base + " (" + i + ")" + ext).toLowerCase()))
            i++;
        return base + " (" + i + ")" + ext;
    }
    function maxOrder(parentId) {
        const sibs = state.nodes.filter((n) => n.parentId === parentId);
        return sibs.reduce((m, n) => Math.max(m, n.order), 0);
    }
    function createFile(name, parentId, content) {
        const id = genId();
        const node = {
            id,
            type: "file",
            name: uniqueName(name, parentId),
            parentId,
            order: maxOrder(parentId) + 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        state.nodes.push(node);
        safeSet(DOC_PREFIX + id, content || "");
        saveState(state);
        return node;
    }
    function createFolder(name, parentId) {
        const id = genId();
        const node = {
            id,
            type: "folder",
            name: uniqueName(name, parentId),
            parentId,
            order: maxOrder(parentId) + 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        state.nodes.push(node);
        saveState(state);
        return node;
    }
    function renameNode(id, name) {
        const n = findNode(id);
        if (!n)
            return;
        const trimmed = name.trim();
        if (!trimmed)
            return;
        n.name = uniqueName(trimmed, n.parentId, id);
        n.updatedAt = Date.now();
        saveState(state);
    }
    function descendantIds(id) {
        const out = [];
        const stack = [id];
        while (stack.length) {
            const cur = stack.pop();
            for (const n of state.nodes) {
                if (n.parentId === cur) {
                    out.push(n.id);
                    if (n.type === "folder")
                        stack.push(n.id);
                }
            }
        }
        return out;
    }
    function removeNode(id) {
        const n = findNode(id);
        if (!n)
            return;
        const ids = [id, ...descendantIds(id)];
        state.nodes = state.nodes.filter((x) => ids.indexOf(x.id) === -1);
        state.openIds = state.openIds.filter((x) => ids.indexOf(x) === -1);
        ids.forEach((x) => safeRemove(DOC_PREFIX + x));
        if (state.activeId && ids.indexOf(state.activeId) !== -1) {
            state.activeId = state.openIds[state.openIds.length - 1] || null;
        }
        saveState(state);
    }
    function moveNode(id, newParentId) {
        const n = findNode(id);
        if (!n)
            return false;
        if (id === newParentId)
            return false;
        if (n.type === "folder") {
            // cycle guard
            const desc = descendantIds(id);
            if (newParentId && desc.indexOf(newParentId) !== -1)
                return false;
        }
        if (newParentId !== null) {
            const target = findNode(newParentId);
            if (!target || target.type !== "folder")
                return false;
        }
        n.parentId = newParentId;
        n.order = maxOrder(newParentId) + 1;
        n.name = uniqueName(n.name, newParentId, id);
        n.updatedAt = Date.now();
        saveState(state);
        return true;
    }
    function readDoc(id) {
        return safeGet(DOC_PREFIX + id) || "";
    }
    function writeDoc(id, text) {
        safeSet(DOC_PREFIX + id, text);
        const n = findNode(id);
        if (n) {
            n.updatedAt = Date.now();
        }
    }
    function openFile(id) {
        if (state.openIds.indexOf(id) === -1)
            state.openIds.push(id);
    }
    function closeFile(id) {
        state.openIds = state.openIds.filter((x) => x !== id);
        if (state.activeId === id) {
            state.activeId = state.openIds[state.openIds.length - 1] || null;
        }
        saveState(state);
    }
    // ---- Expanded folders ----
    function loadExpanded() {
        try {
            const raw = safeGet(EXPANDED_KEY);
            if (raw)
                return new Set(JSON.parse(raw));
        }
        catch (_) { }
        return new Set();
    }
    function saveExpanded() {
        try {
            safeSet(EXPANDED_KEY, JSON.stringify(Array.from(expanded)));
        }
        catch (_) { }
    }
    const expanded = loadExpanded();
    // ---- Migration from legacy single-doc key ----
    function migrateLegacy() {
        const legacy = safeGet(STORAGE_KEY);
        if (legacy !== null && state.nodes.length === 0) {
            const f = createFile("Untitled.md", null, legacy);
            state.activeId = f.id;
            openFile(f.id);
            saveState(state);
            safeRemove(STORAGE_KEY);
        }
    }
    function ensureAtLeastOneFile() {
        if (state.nodes.filter((n) => n.type === "file").length === 0) {
            const f = createFile("Untitled.md", null, "");
            state.activeId = f.id;
            openFile(f.id);
            saveState(state);
        }
        else if (!state.activeId || !findNode(state.activeId)) {
            const first = state.nodes.find((n) => n.type === "file");
            if (first) {
                state.activeId = first.id;
                openFile(first.id);
                saveState(state);
            }
        }
        else if (state.openIds.indexOf(state.activeId) === -1) {
            openFile(state.activeId);
            saveState(state);
        }
    }
    // ---- Active file <-> editor ----
    function loadActiveIntoEditor() {
        if (!state.activeId) {
            editor.value = "";
            return;
        }
        editor.value = readDoc(state.activeId);
    }
    function saveEditorToActive() {
        if (!state.activeId)
            return;
        writeDoc(state.activeId, editor.value);
    }
    function setActive(id) {
        if (!findNode(id))
            return;
        if (state.activeId === id)
            return;
        saveEditorToActive();
        state.activeId = id;
        openFile(id);
        saveState(state);
        loadActiveIntoEditor();
        render();
        renderTabs();
        renderTree();
    }
    // ---- Storage usage indicator ----
    function updateUsage() {
        if (!filesUsageEl)
            return;
        try {
            let bytes = 0;
            if (w.localStorage) {
                for (let i = 0; i < w.localStorage.length; i++) {
                    const k = w.localStorage.key(i) || "";
                    if (k.indexOf("md-viewer:") !== 0)
                        continue;
                    const v = w.localStorage.getItem(k) || "";
                    bytes += k.length + v.length;
                }
            }
            const fileCount = state.nodes.filter((n) => n.type === "file").length;
            const kb = (bytes / 1024).toFixed(1);
            filesUsageEl.textContent =
                fileCount + " file" + (fileCount === 1 ? "" : "s") + " · " + kb + " KB";
        }
        catch (_) { }
    }
    // Legacy storage helpers kept as no-ops for back-compat with tests/window API.
    function loadFromStorage() {
        loadActiveIntoEditor();
    }
    function saveToStorage() {
        saveEditorToActive();
        updateUsage();
    }
    w.__mdStorageKey = STORAGE_KEY;
    w.__mdFilesKey = FILES_KEY;
    w.__mdDocPrefix = DOC_PREFIX;
    w.__mdFilesState = () => state;
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
        if (outlineBtn)
            outlineBtn.classList.toggle("is-active", visible);
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
    // ---- Sidebar (files panel) toggle ----
    function setSidebarVisible(visible) {
        document.body.setAttribute("data-sidebar", visible ? "on" : "off");
        if (filesBtn)
            filesBtn.classList.toggle("is-active", visible);
        safeSet(SIDEBAR_KEY, visible ? "on" : "off");
    }
    w.__mdSetSidebar = setSidebarVisible;
    if (filesBtn)
        filesBtn.addEventListener("click", () => {
            const cur = document.body.getAttribute("data-sidebar") !== "off";
            setSidebarVisible(!cur);
        });
    // ---- Tab bar ----
    function renderTabs() {
        if (!tabBarEl)
            return;
        tabBarEl.innerHTML = "";
        state.openIds.forEach((id) => {
            const node = findNode(id);
            if (!node)
                return;
            const tab = document.createElement("button");
            tab.type = "button";
            tab.className = "tab" + (id === state.activeId ? " is-active" : "");
            tab.setAttribute("data-id", id);
            tab.setAttribute("role", "tab");
            tab.title = node.name;
            const label = document.createElement("span");
            label.className = "tab-label";
            label.textContent = node.name;
            const close = document.createElement("span");
            close.className = "tab-close";
            close.textContent = "×";
            close.title = "Close";
            close.addEventListener("click", (e) => {
                e.stopPropagation();
                closeTab(id);
            });
            tab.appendChild(label);
            tab.appendChild(close);
            tab.addEventListener("click", () => setActive(id));
            tab.addEventListener("mousedown", (e) => {
                if (e.button === 1) {
                    e.preventDefault();
                    closeTab(id);
                }
            });
            tabBarEl.appendChild(tab);
        });
    }
    function closeTab(id) {
        const wasActive = state.activeId === id;
        closeFile(id);
        if (state.openIds.length === 0) {
            ensureAtLeastOneFile();
        }
        if (wasActive && state.activeId) {
            loadActiveIntoEditor();
            render();
        }
        renderTabs();
        renderTree();
    }
    w.__mdRenderTabs = renderTabs;
    w.__mdCloseTab = closeTab;
    // ---- Files tree ----
    function renderTree() {
        if (!filesTreeEl)
            return;
        filesTreeEl.innerHTML = "";
        const roots = childrenOf(null);
        if (roots.length === 0) {
            const empty = document.createElement("li");
            empty.className = "files-empty";
            empty.textContent = "No files yet";
            filesTreeEl.appendChild(empty);
        }
        else {
            roots.forEach((n) => filesTreeEl.appendChild(renderNode(n, 0)));
        }
    }
    function renderNode(node, depth) {
        const li = document.createElement("li");
        li.className =
            "tree-node " + (node.type === "folder" ? "folder-node" : "file-node");
        li.setAttribute("data-id", node.id);
        const row = document.createElement("div");
        row.className = "tree-row";
        if (node.id === state.activeId)
            row.classList.add("is-active");
        row.style.paddingLeft = 8 + depth * 12 + "px";
        row.setAttribute("draggable", "true");
        row.setAttribute("tabindex", "0");
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "tree-toggle";
        if (node.type === "folder") {
            const isOpen = expanded.has(node.id);
            toggle.textContent = isOpen ? "▾" : "▸";
            toggle.addEventListener("click", (e) => {
                e.stopPropagation();
                if (expanded.has(node.id))
                    expanded.delete(node.id);
                else
                    expanded.add(node.id);
                saveExpanded();
                renderTree();
            });
        }
        else {
            toggle.textContent = "";
            toggle.style.visibility = "hidden";
        }
        row.appendChild(toggle);
        const icon = document.createElement("span");
        icon.className = "tree-icon";
        icon.textContent = node.type === "folder" ? "📁" : "📄";
        row.appendChild(icon);
        const label = document.createElement("span");
        label.className = "tree-label";
        label.textContent = node.name;
        row.appendChild(label);
        const actions = document.createElement("span");
        actions.className = "tree-actions";
        const renameBtn = document.createElement("button");
        renameBtn.type = "button";
        renameBtn.title = "Rename";
        renameBtn.textContent = "✎";
        renameBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            startRename(label, node);
        });
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.title = "Delete";
        delBtn.textContent = "🗑";
        delBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            confirmDelete(node);
        });
        actions.appendChild(renameBtn);
        actions.appendChild(delBtn);
        row.appendChild(actions);
        row.addEventListener("click", () => {
            if (node.type === "folder") {
                if (expanded.has(node.id))
                    expanded.delete(node.id);
                else
                    expanded.add(node.id);
                saveExpanded();
                renderTree();
            }
            else {
                setActive(node.id);
            }
        });
        row.addEventListener("dblclick", (e) => {
            e.preventDefault();
            startRename(label, node);
        });
        row.addEventListener("keydown", (e) => {
            if (e.key === "F2") {
                e.preventDefault();
                startRename(label, node);
            }
            else if (e.key === "Delete" || e.key === "Backspace") {
                e.preventDefault();
                confirmDelete(node);
            }
            else if (e.key === "Enter") {
                e.preventDefault();
                if (node.type === "file")
                    setActive(node.id);
            }
        });
        // Internal DnD
        row.addEventListener("dragstart", (e) => {
            if (!e.dataTransfer)
                return;
            try {
                e.dataTransfer.setData(NODE_MIME, node.id);
                e.dataTransfer.setData("text/plain", node.id);
            }
            catch (_) { }
            e.dataTransfer.effectAllowed = "move";
        });
        li.appendChild(row);
        if (node.type === "folder" && expanded.has(node.id)) {
            const ul = document.createElement("ul");
            ul.className = "tree-children";
            childrenOf(node.id).forEach((c) => ul.appendChild(renderNode(c, depth + 1)));
            li.appendChild(ul);
        }
        // Folder-wide drop zone: drop anywhere inside the folder's <li>
        // (header row OR children area) targets this folder. stopPropagation
        // lets nested folders take precedence over their parent.
        if (node.type === "folder") {
            li.addEventListener("dragover", (e) => {
                if (!e.dataTransfer || !hasNodeMime(e))
                    return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
                row.classList.add("is-drop-target");
            });
            li.addEventListener("dragleave", (e) => {
                // Only clear when the pointer truly leaves this li (relatedTarget
                // outside), to avoid flicker when moving between child elements.
                const to = e.relatedTarget;
                if (to && li.contains(to))
                    return;
                row.classList.remove("is-drop-target");
            });
            li.addEventListener("drop", (e) => {
                if (!e.dataTransfer || !hasNodeMime(e))
                    return;
                e.preventDefault();
                e.stopPropagation();
                row.classList.remove("is-drop-target");
                const id = e.dataTransfer.getData(NODE_MIME) ||
                    e.dataTransfer.getData("text/plain");
                if (!id)
                    return;
                if (moveNode(id, node.id)) {
                    if (!expanded.has(node.id)) {
                        expanded.add(node.id);
                        saveExpanded();
                    }
                    renderTree();
                }
            });
        }
        return li;
    }
    function hasNodeMime(e) {
        if (!e.dataTransfer || !e.dataTransfer.types)
            return false;
        const types = Array.from(e.dataTransfer.types);
        return types.indexOf(NODE_MIME) !== -1;
    }
    function startRename(labelEl, node) {
        const row = labelEl.parentElement;
        if (row)
            row.classList.add("is-renaming");
        labelEl.setAttribute("contenteditable", "true");
        labelEl.focus();
        const range = document.createRange();
        range.selectNodeContents(labelEl);
        const sel = window.getSelection();
        if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
        }
        const finish = (commit) => {
            labelEl.removeAttribute("contenteditable");
            if (row)
                row.classList.remove("is-renaming");
            labelEl.removeEventListener("keydown", onKey);
            labelEl.removeEventListener("blur", onBlur);
            if (commit) {
                const newName = (labelEl.textContent || "").trim();
                if (newName && newName !== node.name) {
                    renameNode(node.id, newName);
                }
            }
            renderTree();
            renderTabs();
        };
        const onKey = (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                finish(true);
            }
            else if (e.key === "Escape") {
                e.preventDefault();
                labelEl.textContent = node.name;
                finish(false);
            }
        };
        const onBlur = () => finish(true);
        labelEl.addEventListener("keydown", onKey);
        labelEl.addEventListener("blur", onBlur);
    }
    function confirmDelete(node) {
        const isFolder = node.type === "folder";
        const kids = isFolder ? descendantIds(node.id).length : 0;
        const msg = isFolder
            ? 'Delete folder "' +
                node.name +
                '"' +
                (kids ? " and " + kids + " item(s) inside?" : "?")
            : 'Delete "' + node.name + '"?';
        let ok = true;
        try {
            ok = window.confirm(msg);
        }
        catch (_) { }
        if (!ok)
            return;
        const wasActive = node.id === state.activeId;
        removeNode(node.id);
        if (wasActive || !state.activeId) {
            ensureAtLeastOneFile();
            loadActiveIntoEditor();
            render();
        }
        renderTabs();
        renderTree();
        updateUsage();
    }
    function targetParentForNew() {
        // Create new items inside the active file's folder when possible.
        const active = findNode(state.activeId);
        if (!active)
            return null;
        if (active.type === "folder")
            return active.id;
        return active.parentId;
    }
    function promptNewFile() {
        let name = "Untitled.md";
        try {
            const v = window.prompt("New file name", name);
            if (v === null)
                return;
            if (v.trim())
                name = v.trim();
        }
        catch (_) { }
        if (!/\.[a-z0-9]+$/i.test(name))
            name += ".md";
        const parent = targetParentForNew();
        const f = createFile(name, parent, "");
        if (parent) {
            expanded.add(parent);
            saveExpanded();
        }
        openFile(f.id);
        saveEditorToActive();
        state.activeId = f.id;
        saveState(state);
        loadActiveIntoEditor();
        render();
        renderTabs();
        renderTree();
        updateUsage();
    }
    function promptNewFolder() {
        let name = "New folder";
        try {
            const v = window.prompt("New folder name", name);
            if (v === null)
                return;
            if (v.trim())
                name = v.trim();
        }
        catch (_) { }
        const parent = targetParentForNew();
        createFolder(name, parent);
        if (parent) {
            expanded.add(parent);
            saveExpanded();
        }
        renderTree();
        updateUsage();
    }
    if (newFileBtn)
        newFileBtn.addEventListener("click", promptNewFile);
    if (newFolderBtn)
        newFolderBtn.addEventListener("click", promptNewFolder);
    // ---- Clear all workspace ----
    function clearAllWorkspace() {
        let ok = true;
        try {
            ok = window.confirm("Clear all workspace? This will permanently delete every file and folder.");
        }
        catch (_) { }
        if (!ok)
            return;
        // Remove every per-doc key for current nodes.
        state.nodes.forEach((n) => {
            if (n.type === "file")
                safeRemove(DOC_PREFIX + n.id);
        });
        state = defaultState();
        expanded.clear();
        saveExpanded();
        saveState(state);
        ensureAtLeastOneFile();
        loadActiveIntoEditor();
        render();
        renderTabs();
        renderTree();
        updateUsage();
    }
    w.__mdClearAllWorkspace = clearAllWorkspace;
    if (clearAllBtn)
        clearAllBtn.addEventListener("click", clearAllWorkspace);
    w.__mdRenderTree = renderTree;
    w.__mdNewFile = promptNewFile;
    w.__mdNewFolder = promptNewFolder;
    w.__mdSetActive = setActive;
    w.__mdMoveNode = moveNode;
    w.__mdRemoveNode = (id) => {
        const n = findNode(id);
        if (!n)
            return;
        removeNode(id);
        if (!state.activeId) {
            ensureAtLeastOneFile();
            loadActiveIntoEditor();
            render();
        }
        renderTabs();
        renderTree();
        updateUsage();
    };
    // Files-tree root drop target (move to root)
    if (filesTreeEl) {
        filesTreeEl.addEventListener("dragover", (e) => {
            if (hasNodeMime(e)) {
                e.preventDefault();
                if (e.target === filesTreeEl) {
                    filesTreeEl.classList.add("is-root-drop-target");
                }
            }
        });
        filesTreeEl.addEventListener("dragleave", (e) => {
            if (e.target === filesTreeEl)
                filesTreeEl.classList.remove("is-root-drop-target");
        });
        filesTreeEl.addEventListener("drop", (e) => {
            filesTreeEl.classList.remove("is-root-drop-target");
            if (!e.dataTransfer)
                return;
            const id = e.dataTransfer.getData(NODE_MIME) ||
                e.dataTransfer.getData("text/plain");
            if (!id)
                return;
            // Only treat as root-move if dropped directly on the list background.
            if (e.target !== filesTreeEl)
                return;
            e.preventDefault();
            if (moveNode(id, null))
                renderTree();
        });
    }
    // ---- Keyboard shortcuts (tabs + new file) ----
    document.addEventListener("keydown", (e) => {
        const mod = e.ctrlKey || e.metaKey;
        if (!mod)
            return;
        if (e.key === "Tab") {
            if (state.openIds.length < 2)
                return;
            e.preventDefault();
            const idx = state.activeId ? state.openIds.indexOf(state.activeId) : -1;
            const len = state.openIds.length;
            const next = e.shiftKey ? (idx - 1 + len) % len : (idx + 1) % len;
            setActive(state.openIds[next]);
        }
        else if (e.key === "w" || e.key === "W") {
            if (!state.activeId)
                return;
            e.preventDefault();
            closeTab(state.activeId);
        }
        else if (e.key === "n" || e.key === "N") {
            e.preventDefault();
            promptNewFile();
        }
    });
    // ---- Drag and drop .md (multi-file import) ----
    function loadFileText(text) {
        // Backward-compat: load text into the active file's editor.
        editor.value = text;
        saveToStorage();
        render();
    }
    w.__mdLoadFileText = loadFileText;
    function importTextAsFile(name, text, parentId) {
        return createFile(name || "Untitled.md", parentId, text);
    }
    w.__mdImportFile = importTextAsFile;
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
        const isExternalFileDrag = (e) => {
            if (!e.dataTransfer)
                return false;
            const types = Array.from(e.dataTransfer.types || []);
            if (types.indexOf("Files") === -1)
                return false;
            // Ignore internal node drags (they also carry Files=false typically, but be defensive).
            if (types.indexOf(NODE_MIME) !== -1)
                return false;
            return true;
        };
        window.addEventListener("dragenter", (e) => {
            if (!isExternalFileDrag(e))
                return;
            depth++;
            show();
            e.preventDefault();
        });
        window.addEventListener("dragover", (e) => {
            if (isExternalFileDrag(e))
                e.preventDefault();
        });
        window.addEventListener("dragleave", () => {
            depth = Math.max(0, depth - 1);
            if (depth === 0)
                hide();
        });
        window.addEventListener("drop", (e) => {
            depth = 0;
            hide();
            const dt = e.dataTransfer;
            if (!dt)
                return;
            // If this is an internal node drag, let tree handlers deal with it.
            const types = Array.from(dt.types || []);
            if (types.indexOf(NODE_MIME) !== -1)
                return;
            if (!dt.files || dt.files.length === 0)
                return;
            e.preventDefault();
            // Determine drop target folder by walking up the DOM from e.target.
            let parentId = null;
            let el = e.target;
            while (el && el !== document.body) {
                if (el.classList && el.classList.contains("tree-node")) {
                    const id = el.getAttribute("data-id");
                    const n = id ? findNode(id) : null;
                    if (n) {
                        parentId = n.type === "folder" ? n.id : n.parentId;
                    }
                    break;
                }
                el = el.parentElement;
            }
            const files = Array.from(dt.files);
            const accepted = files.filter((f) => {
                const name = (f.name || "").toLowerCase();
                return (name.endsWith(".md") ||
                    name.endsWith(".markdown") ||
                    name.endsWith(".txt") ||
                    (f.type && f.type.indexOf("text") === 0));
            });
            if (accepted.length === 0) {
                try {
                    console.warn("md-viewer: no markdown/text files in drop");
                }
                catch (_) { }
                return;
            }
            let firstId = null;
            let remaining = accepted.length;
            accepted.forEach((file) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const text = String(reader.result || "");
                    const node = importTextAsFile(file.name, text, parentId);
                    openFile(node.id);
                    if (!firstId)
                        firstId = node.id;
                    remaining--;
                    if (remaining === 0) {
                        saveEditorToActive();
                        state.activeId = firstId;
                        saveState(state);
                        loadActiveIntoEditor();
                        if (parentId) {
                            expanded.add(parentId);
                            saveExpanded();
                        }
                        render();
                        renderTabs();
                        renderTree();
                        updateUsage();
                    }
                };
                try {
                    reader.readAsText(file);
                }
                catch (_) {
                    remaining--;
                }
            });
        });
    }
    setupDragDrop();
    // ---- Utilities ----
    function clearAll() {
        editor.value = "";
        if (state.activeId)
            writeDoc(state.activeId, "");
        render();
        updateUsage();
    }
    function exportMd() {
        const active = findNode(state.activeId);
        const name = active ? active.name : "document.md";
        triggerDownload(editor.value, name, "text/markdown;charset=utf-8");
    }
    w.__mdClear = clearAll;
    w.__mdExport = exportMd;
    if (exportBtn)
        exportBtn.addEventListener("click", exportMd);
    // ---- ZIP export of all files ----
    function pathFor(node) {
        const parts = [node.name];
        let cur = node;
        while (cur && cur.parentId) {
            const p = findNode(cur.parentId);
            if (!p)
                break;
            parts.unshift(p.name);
            cur = p;
        }
        return parts.join("/");
    }
    function exportZip() {
        if (typeof JSZip === "undefined" || !JSZip) {
            try {
                alert("JSZip not loaded.");
            }
            catch (_) { }
            return Promise.reject(new Error("JSZip not loaded"));
        }
        saveEditorToActive();
        const zip = new JSZip();
        state.nodes.forEach((n) => {
            if (n.type === "folder") {
                zip.folder(pathFor(n));
            }
            else {
                zip.file(pathFor(n), readDoc(n.id));
            }
        });
        return zip.generateAsync({ type: "blob" }).then((blob) => {
            triggerBlobDownload(blob, "md-viewer-export.zip");
        });
    }
    w.__mdExportZip = exportZip;
    if (exportZipBtn)
        exportZipBtn.addEventListener("click", () => exportZip());
    // ---- Export dropdown menu ----
    function setExportMenuOpen(open) {
        if (!exportMenu || !exportMenuBtn)
            return;
        if (open) {
            exportMenu.removeAttribute("hidden");
            exportMenuBtn.setAttribute("aria-expanded", "true");
        }
        else {
            exportMenu.setAttribute("hidden", "");
            exportMenuBtn.setAttribute("aria-expanded", "false");
        }
    }
    if (exportMenuBtn && exportMenu) {
        exportMenuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = !exportMenu.hasAttribute("hidden");
            setExportMenuOpen(!isOpen);
        });
        exportMenu.addEventListener("click", (e) => {
            const target = e.target;
            if (target && target.tagName === "BUTTON") {
                setExportMenuOpen(false);
            }
        });
        document.addEventListener("click", (e) => {
            if (exportMenu.hasAttribute("hidden"))
                return;
            const t = e.target;
            if (t &&
                exportMenu.contains(t) === false &&
                exportMenuBtn.contains(t) === false) {
                setExportMenuOpen(false);
            }
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !exportMenu.hasAttribute("hidden")) {
                setExportMenuOpen(false);
                exportMenuBtn.focus();
            }
        });
    }
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
        const printDoc = '<!doctype html><html><head><meta charset="utf-8"><title>' +
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
    // Sidebar default on, persisted toggle
    const sidebarPref = safeGet(SIDEBAR_KEY);
    setSidebarVisible(sidebarPref !== "off");
    migrateLegacy();
    ensureAtLeastOneFile();
    loadActiveIntoEditor();
    render();
    renderTabs();
    renderTree();
    updateUsage();
})();

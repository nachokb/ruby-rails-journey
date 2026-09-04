import { Notes } from "./notes.js";
import { Router } from "./router.js";
import { Grid } from "./grid.js";
import { PathsTable } from "./table.js";
import { Popover } from "./popover.js";
import { lifecycleStatus, bothEol } from "./lifecycle.js";
import { encodeJourney, decodeJourney, cellsToRuns } from "./journey.js";

// Reusable app wiring. `root` is a Document or a ShadowRoot exposing
// getElementById/querySelectorAll. DOM is looked up relative to `root` so the
// same code drives both the site page and the embedded widget.
// `opts`: { urlSync?: boolean (default true), initial?: {home:{i,j}, target:{i,j}} }
export function createApp(DATA, root, opts) {
  const options = opts || {};
  const urlSync = options.urlSync !== false;
  const getEl = (id) => root.getElementById(id);
  const doc = root.ownerDocument || document;

  const rubyMeta = DATA.ruby_versions;
  const rubyVersions = rubyMeta.map((o) => o.version);
  const railsMeta = DATA.rails_versions;
  const railsVersions = railsMeta.map((o) => o.version);
  const minRuby = {};
  railsMeta.forEach((o) => { minRuby[o.version] = o.min_ruby; });
  const railMeta = {};
  railsMeta.forEach((o) => { railMeta[o.version] = o; });
  const rubyMetaMap = {};
  rubyMeta.forEach((o) => { rubyMetaMap[o.version] = o; });

  const notes = new Notes({
    cells: DATA.cells,
    noteTemplates: DATA.noteTemplates,
    noteRules: DATA.noteRules || [],
    minRuby: minRuby
  });

  const router = new Router({
    railsVersions: railsVersions,
    rubyVersions: rubyVersions,
    cells: DATA.cells,
    weights: DATA.router.weights,
    turnPenalty: DATA.router.turnPenalty,
    maxPaths: DATA.router.maxPaths
  });

  const state = { home: null, target: null, paths: [], selectedPathIndex: -1, currentStep: null };
  let suppressUrl = false;
  let lastWrittenHash = null;

  const popover = new Popover(root);

  function cellPopoverNode(i, j, badge) {
    const rv = railsVersions[i], ruv = rubyVersions[j];
    const resolved = notes.resolveCell(rv, ruv);
    const now = new Date();
    const rs = lifecycleStatus(railMeta[rv], now);
    const us = lifecycleStatus(rubyMetaMap[ruv], now);

    const node = doc.createElement("div");
    if (badge) {
      const b = doc.createElement("span");
      b.className = "popover-badge popover-badge-" + badge.toLowerCase();
      b.textContent = badge;
      node.appendChild(b);
    }
    const h = doc.createElement("div"); h.className = "popover-title";
    h.textContent = "Rails " + rv + " + Ruby " + ruv;
    node.appendChild(h);
    const sub = doc.createElement("div"); sub.className = "popover-sub";
    sub.textContent = resolved.status.toUpperCase() + " · " + resolved.confidence;
    node.appendChild(sub);
    const lc = doc.createElement("div"); lc.className = "popover-lifecycle";
    lc.textContent = "Rails: " + rs + " · Ruby: " + us;
    node.appendChild(lc);
    const body = doc.createElement("div"); body.className = "popover-body";
    resolved.note.split("\n\n").forEach((p) => {
      const pe = doc.createElement("p");
      pe.innerHTML = p; // notes may contain links (HTML)
      body.appendChild(pe);
    });
    node.appendChild(body);
    return node;
  }

  function axisPopoverNode(kind, idx) {
    const label = kind === "rails" ? "Rails" : "Ruby";
    const version = kind === "rails" ? railsVersions[idx] : rubyVersions[idx];
    const meta = kind === "rails" ? railMeta[version] : rubyMetaMap[version];
    const now = new Date();
    const lc = lifecycleStatus(meta, now);

    const node = doc.createElement("div");
    const h = doc.createElement("div"); h.className = "popover-title";
    h.textContent = label + " " + version;
    node.appendChild(h);

    const sub = doc.createElement("div"); sub.className = "popover-sub";
    sub.textContent = lc;
    node.appendChild(sub);

    const lcLine = doc.createElement("div"); lcLine.className = "popover-lifecycle";
    const parts = ["Released: " + (meta && meta.released || "—")];
    if (kind === "rails" && meta && meta.support) parts.push("Until: " + meta.support);
    if (meta && meta.eol) parts.push("EOL: " + meta.eol);
    lcLine.textContent = parts.join(" · ");
    node.appendChild(lcLine);

    const body = doc.createElement("div"); body.className = "popover-body";
    if (meta && meta.release_notes_url) {
      const p = doc.createElement("p");
      const a = doc.createElement("a");
      a.href = meta.release_notes_url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Release notes";
      p.appendChild(a);
      body.appendChild(p);
    }
    node.appendChild(body);
    return node;
  }

  const table = new PathsTable({
    tbody: getEl("paths-tbody"),
    caption: getEl("paths-caption"),
    router: router,
    popover: popover
  });

  const grid = new Grid({
    svg: getEl("matrix"),
    railsVersions: railsVersions,
    rubyVersions: rubyVersions,
    notes: notes,
    router: router,
    popover: popover,
    onCellClick: onCellClick,
    onPinUpdate: onPinUpdate,
    makeCellPopover: cellPopoverNode,
    isBothEol: (i, j) => bothEol(railMeta[railsVersions[i]], rubyMetaMap[rubyVersions[j]], new Date()),
    axisPopover: (kind, idx) => axisPopoverNode(kind, idx)
  });

  const resetBtn = getEl("reset-btn");
  const copyBtn = getEl("copy-link-btn");
  const journeyNote = getEl("journey-note");

// Generic data-driven popovers: any [data-popover-text] gets a plain-text
// popover ("\n" = line break). Any [data-popover-title] gets a structured
// popover (title/sub/lifecycle as plain text, body as HTML), mirroring the
// cell/axis popovers. data-popover-title takes precedence over data-popover-text.
const structuredPopovers = root.querySelectorAll ? root.querySelectorAll("[data-popover-title]") : [];
for (const el of structuredPopovers) {
  popover.wire(el, () => makeStructuredPopover(el));
}
const textPopovers = root.querySelectorAll ? root.querySelectorAll("[data-popover-text]") : [];
for (const el of textPopovers) {
  if (el.hasAttribute && el.hasAttribute("data-popover-title")) continue;
  popover.wire(el, () => makeTextPopover(el.getAttribute("data-popover-text") || ""));
}
// Legend items with a data-desc attribute get a popover instead of a title.
const legendEls = root.querySelectorAll ? root.querySelectorAll(".legend-item[data-desc]") : [];
for (const el of legendEls) {
  popover.wire(el, function () {
    return makeTextPopover(el.getAttribute("data-desc") || "");
  });
}

function makeTextPopover(text) {
  const wrap = doc.createElement("div");
  text.split("\n").forEach((line) => {
    const n = doc.createElement("div");
    n.textContent = line;
    wrap.appendChild(n);
  });
  return wrap;
}

// Builds: .popover-title, .popover-sub, .popover-lifecycle (plain text) then
// .popover-body (HTML). Only present attributes are rendered.
function makeStructuredPopover(el) {
  const wrap = doc.createElement("div");
  const part = (attr, cls) => {
    const v = el.getAttribute(attr);
    if (!v) return;
    const d = doc.createElement("div");
    d.className = cls;
    d.textContent = v;
    wrap.appendChild(d);
  };
  part("data-popover-title", "popover-title");
  part("data-popover-sub", "popover-sub");
  part("data-popover-lifecycle", "popover-lifecycle");
  const body = el.getAttribute("data-popover-body");
  if (body) {
    const b = doc.createElement("div");
    b.className = "popover-body";
    b.innerHTML = body; // body may contain links (HTML)
    wrap.appendChild(b);
  }
  return wrap;
}

  // ---- state transitions ----

  function refresh() {
    grid.renderMarkers(state);
    resetBtn.classList.toggle("visible", !!state.home);
    recomputeAndRenderPaths();
  }

  function onCellClick(i, j) {
    if (!state.home) {
      if (router.isRed(i, j)) return;
      state.home = { i: i, j: j };
      const t = router.findNearestAllowed(router.cols - 1, router.rows - 1);
      state.target = { i: t.i, j: t.j };
      state.currentStep = null;
      refresh();
      return;
    }
    // Home is set: clicking a cell on the drawn path advances the current step.
    const selected = state.paths[state.selectedPathIndex];
    if (selected) {
      const idx = selected.cells.findIndex((c) => c.i === i && c.j === j);
      if (idx >= 0) {
        state.currentStep = idx;
        grid.drawPath(selected.cells, idx);
        syncUrl();
        return;
      }
    }
    // Clicking the Home cell (or any non-path cell) does nothing.
  }

  function onPinUpdate(role, cell) {
    if (cell) {
      if (role === "home") state.home = { i: cell.i, j: cell.j };
      else state.target = { i: cell.i, j: cell.j };
    }
    // if the drop cell is red, `cell` is null and state is left unchanged;
    // renderMarkers() snaps the pin back to its last valid spot.
    state.currentStep = null;
    refresh();
  }

  resetBtn.addEventListener("click", function () {
    state.home = null;
    state.target = null;
    state.currentStep = null;
    refresh();
    if (urlSync) {
      suppressUrl = true;
      try {
        lastWrittenHash = "#";
        history.replaceState(null, "", "#");
      } finally {
        suppressUrl = false;
      }
    }
  });

  function selectPath(idx) {
    state.selectedPathIndex = idx;
    table.select(idx);
    grid.drawPath(state.paths[idx].cells, state.currentStep);
    syncUrl();
  }

  function setJourneyNote(text) {
    if (journeyNote) {
      journeyNote.textContent = text || "";
      journeyNote.hidden = !text;
    }
  }

  function recomputeAndRenderPaths(override) {
    const panel = getEl("paths-panel");
    const tableEl = getEl("paths-table");
    const noPathMsg = getEl("no-path-msg");

    state.paths = [];
    state.selectedPathIndex = -1;

    if (!state.home || !state.target) {
      panel.hidden = true;
      grid.clearPath();
      setJourneyNote(null);
      return;
    }

    panel.hidden = false;
    tableEl.hidden = false;
    noPathMsg.hidden = true;

    if (state.home.i === state.target.i && state.home.j === state.target.j) {
      tableEl.hidden = true;
      grid.clearPath();
      noPathMsg.hidden = false;
      noPathMsg.textContent = "Home and Target are the same cell — nothing to upgrade.";
      setJourneyNote(null);
      return;
    }

    const paths = router.computeKShortestPaths(state.home, state.target);
    state.paths = paths;

    if (!paths.length) {
      tableEl.hidden = true;
      grid.clearPath();
      noPathMsg.hidden = false;
      noPathMsg.textContent = "No upgrade path avoids the unsupported cells between these two points — try dragging Home or Target somewhere else.";
      setJourneyNote(null);
      return;
    }

    table.render(paths, selectPath);

    if (override && override.pathIdx != null && override.pathIdx >= 0) {
      state.selectedPathIndex = override.pathIdx;
      table.select(override.pathIdx);
      grid.drawPath(paths[override.pathIdx].cells, override.step);
    } else if (override && override.route) {
      grid.drawPath(override.route, override.step);
    } else {
      selectPath(0);
    }

    if (override && override.stale) {
      setJourneyNote("Bookmark references an older data set — re-mapped to the current grid.");
    } else {
      setJourneyNote(null);
    }
  }

  // ---- URL serialization ----

  function syncUrl() {
    if (!urlSync || suppressUrl) return;
    const frag = encodeJourney(DATA, state, router);
    lastWrittenHash = frag;
    history.replaceState(null, "", frag);
  }

  if (urlSync) {
    window.addEventListener("hashchange", function () {
      if (location.hash === lastWrittenHash) return;
      restoreFromUrl();
    });
  }

  function restoreFromUrl() {
    if (!location.hash || location.hash.indexOf("#j;") !== 0) {
      clearAll();
      return;
    }
    const dec = decodeJourney(location.hash, DATA, router);
    if (!dec) {
      clearAll();
      return;
    }
    applyDecoded(dec);
  }

  function clearAll() {
    suppressUrl = true;
    try {
      state.home = null;
      state.target = null;
      state.currentStep = null;
      refresh();
    } finally {
      suppressUrl = false;
    }
  }

  function applyDecoded(dec) {
    suppressUrl = true;
    try {
      state.home = dec.home;
      state.target = dec.target;
      state.currentStep = null;
      resetBtn.classList.toggle("visible", true);
      grid.renderMarkers(state);

      if (dec.route && routeIsValid(dec.route)) {
        const paths = router.computeKShortestPaths(dec.home, dec.target);
        state.paths = paths;
        const runs = cellsToRuns(dec.route).flag + cellsToRuns(dec.route).runs;
        let idx = -1;
        paths.forEach((p, k) => {
          const pr = cellsToRuns(p.cells).flag + cellsToRuns(p.cells).runs;
          if (pr === runs) idx = k;
        });
        const step = dec.step != null ? Math.min(dec.step, dec.route.length - 1) : null;
        state.currentStep = step;
        recomputeAndRenderPaths({
          route: dec.route,
          step: step,
          pathIdx: idx >= 0 ? idx : null,
          stale: dec.stale
        });
      } else if (dec.route) {
        // bookmarked route no longer viable on this grid
        clearAll();
      } else {
        recomputeAndRenderPaths();
      }
    } finally {
      suppressUrl = false;
    }
  }

  function routeIsValid(cells) {
    if (!cells || cells.length < 2) return false;
    const last = cells[cells.length - 1];
    if (last.i !== state.target.i || last.j !== state.target.j) return false;
    for (const c of cells) {
      if (c.i < 0 || c.i >= router.cols || c.j < 0 || c.j >= router.rows) return false;
      if (router.isRed(c.i, c.j)) return false;
    }
    return true;
  }

  // ---- Copy Link ----

  function flashCopied() {
    const old = copyBtn.textContent;
    copyBtn.textContent = "Copied!";
    setTimeout(function () { copyBtn.textContent = old; }, 1200);
  }

  function fallbackCopy(text) {
    const ta = doc.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    (doc.body || doc).appendChild(ta);
    ta.select();
    try { doc.execCommand("copy"); } catch (e) {}
    ta.remove();
    flashCopied();
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      const url = makeCopyUrl();
      if (!url) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(flashCopied).catch(() => fallbackCopy(url));
      } else {
        fallbackCopy(url);
      }
    });
  }

  function makeCopyUrl() {
    if (urlSync) {
      // Ensure the journey is current in the URL before copying.
      syncUrl();
      return location.origin + location.pathname + location.hash;
    }
    // Widget: build a canonical standalone URL for the site app.
    const base = options.copyLinkBase;
    if (!base) return null;
    const frag = encodeJourney(DATA, state, router);
    return base.split("#")[0] + "#" + (frag.charAt(0) === "#" ? frag.slice(1) : frag);
  }

  // Initial restore: from the URL fragment on the site, from opts.initial
  // (widget attributes), or from the location hash when
  // opts.initialFromHash is set (embed page, where scripts are stripped).
  if (urlSync) {
    restoreFromUrl();
  } else if (options.initialFromHash) {
    restoreFromUrl();
  } else if (options.initial) {
    suppressUrl = true;
    try {
      state.home = options.initial.home;
      state.target = options.initial.target;
      state.currentStep = null;
      refresh(); // renders markers, reset visibility, and paths
    } finally {
      suppressUrl = false;
    }
  }
}
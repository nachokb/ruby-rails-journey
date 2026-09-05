import fs from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";

// Resolve paths relative to this file's own location so the repo is portable.
const HERE = new URL(".", import.meta.url);
export const SRC = fileURLToPath(new URL("../src/", HERE));
export const ROOT = fileURLToPath(new URL("../", HERE));

export function loadData(path = ROOT + "/test/fixtures/data.json") {
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

export class El {
  constructor(tag) {
    this.tagName = tag;
    this.nodeType = 1;
    this.children = [];
    this.attrs = {};
    this._style = {};
    this.hidden = false;
    this.listeners = {};
    this._html = "";
    this.parentNode = null;
    this.textContent = "";
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  cloneNode() { const c = new El(this.tagName); c.attrs = { ...this.attrs }; c.textContent = this.textContent; return c; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  remove() { if (this.parentNode) { const i = this.parentNode.children.indexOf(this); if (i >= 0) this.parentNode.children.splice(i, 1); } }
  addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  removeEventListener(ev, fn) { const l = this.listeners[ev]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } }
  dispatch(ev, data) { (this.listeners[ev] || []).forEach((fn) => fn(data || {})); }
  setPointerCapture() {}
  getScreenCTM() { return { inverse: () => ({ matrixTransform: (p) => ({ x: p.x, y: p.y }) }) }; }
  createSVGPoint() { return {}; }
  querySelector(sel) { return this._findAll(sel)[0] || null; }
  querySelectorAll(sel) { return this._findAll(sel); }
  _findAll(sel) { const out = []; const walk = (n) => { for (const c of n.children) { if (this._match(c, sel)) out.push(c); walk(c); } }; walk(this); return out; }
  _match(el, sel) {
    if (sel === "tr") return el.tagName === "tr";
    if (sel.startsWith(".")) return (el.attrs["class"] || "").split(/\s+/).includes(sel.slice(1));
    if (sel.startsWith("#")) return el.attrs["id"] === sel.slice(1);
    return el.tagName === sel;
  }
  get style() { return this._style; }
  get classList() { return { toggle: () => {}, add: () => {}, remove: () => {} }; }
  set innerHTML(v) { this._html = v; this.children = []; }
  get innerHTML() { return this._html; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }; }
  get offsetWidth() { return 100; }
  get offsetHeight() { return 50; }
}

export const IDS = ["matrix", "reset-btn", "copy-link-btn", "paths-tbody", "paths-caption", "paths-panel", "paths-table", "no-path-msg", "path-layer", "markers-layer", "notes", "journey-note"];

// Build a fake Document for createApp. Returns { doc, map }.
export function makeDoc() {
  const map = {};
  for (const id of IDS) map[id] = new El("div");
  const body = new El("body");
  const doc = {
    getElementById: (id) => map[id] || null,
    createElement: (t) => new El(t),
    createElementNS: (ns, t) => new El(t),
    querySelectorAll: () => [],
    addEventListener: () => {},
    appendChild: (c) => {},
    execCommand: () => true,
    ownerDocument: null,
    body: body
  };
  return { doc, map };
}

// Install globals a single createApp run needs.
export function installGlobals({ hash = "#", fetchImpl, clipboardImpl, doc } = {}) {
  const written = { hash };
  globalThis.window = globalThis;
  globalThis.addEventListener = globalThis.addEventListener || (() => {});
  globalThis.location = { hash, origin: "http://test", pathname: "/", href: "http://test/" + hash };
  globalThis.history = { replaceState: (s, t, u) => { written.hash = u; globalThis.location.hash = u; } };
  if (fetchImpl) globalThis.fetch = fetchImpl;
  if (doc) globalThis.document = doc;
  try {
    Object.defineProperty(globalThis, "navigator", { value: { clipboard: clipboardImpl || { writeText: async () => {} } }, configurable: true });
  } catch (e) { /* already defined */ }
  return written;
}

export async function importCore(cacheBust = "") {
  return (await import(pathToFileURL(SRC + "/core.js").href + (cacheBust || "?v=" + Math.random()))).createApp;
}

export function clickCell(map, colIdx, rowIdx) {
  const matrix = map["matrix"];
  const groups = matrix.children.filter((c) => c.attrs["class"] === "cell-group");
  const g = groups.find((gr) => {
    const r = gr.children.find((c) => c.attrs["class"] === "cell-rect");
    const col = Math.round((parseFloat(r.attrs["x"]) - 56) / 32);
    const row = Math.round((parseFloat(r.attrs["y"]) - 74) / 32);
    return col === colIdx && row === rowIdx;
  });
  if (!g) throw new Error("cell not found " + colIdx + "," + rowIdx);
  g.dispatch("click");
}

export function findCells(map) {
  return map["matrix"].children.filter((c) => c.attrs["class"] === "cell-group");
}

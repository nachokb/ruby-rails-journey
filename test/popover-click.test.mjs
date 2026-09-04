import { loadData, SRC } from "./helpers.mjs";
import { pathToFileURL } from "node:url";

const DATA = loadData();
let failed = false;
function assert(cond, msg) { if (!cond) { failed = true; console.log("FAIL:", msg); } }

class El {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.style = {}; this.hidden = true; this.listeners = {}; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  appendChild(c) { this.children.push(c); return c; }
  contains(el) { return el === this || this.children.includes(el); }
  set innerHTML(v) { this._html = v; }
  get innerHTML() { return this._html; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 10, bottom: 10 }; }
  get offsetWidth() { return 100; }
  get offsetHeight() { return 50; }
}

const body = new El("body");
const doc = {
  createElement: (t) => new El(t),
  body,
  listeners: {},
  addEventListener: (ev, fn, opts) => { (doc.listeners[ev] ||= []).push({ fn, opts }); }
};

globalThis.window = globalThis;
globalThis.addEventListener = globalThis.addEventListener || (() => {});
globalThis.document = doc;
globalThis.location = { hash: "#" };
globalThis.innerWidth = 1000; globalThis.innerHeight = 800;

const { Popover } = await import(pathToFileURL(SRC + "/popover.js").href);
const p = new Popover(doc);
const anchor = new El("button");
p.wire(anchor, () => "hi");
p.show(anchor, "hi");
assert(!p.el.hidden, "popover visible after show");

const link = new El("a");
p.el.appendChild(link);

const capture = doc.listeners["pointerdown"][0];

// (1) pointerdown with e.composedPath() including the popover -> do NOT hide
capture.fn({ composedPath: () => [link, p.el, body, doc], target: link });
assert(!p.el.hidden, "composedPath through popover should NOT hide");

// (2) pointerdown with composedPath NOT including popover (e.g. retargeted to host) -> hide
const host = new El("ruby-rails-matrix");
capture.fn({ composedPath: () => [body, host, doc], target: host });
assert(p.el.hidden, "composedPath outside popover should hide");

console.log(failed ? "POPOVER-CLICK: FAIL" : "POPOVER-CLICK: ALL PASS");

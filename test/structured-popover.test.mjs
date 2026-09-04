import { loadData, makeDoc, installGlobals, importCore } from "./helpers.mjs";
const DATA = loadData();
let failed = false;
function assert(cond, msg) { if (!cond) { failed = true; console.log("FAIL:", msg); } }

class El2 {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.className = ""; this.listeners = {}; this.textContent = ""; this.hidden = false; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  hasAttribute(k) { return k in this.attrs; }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  getBoundingClientRect() { return { left: 0, top: 0, right: 10, bottom: 10 }; }
  get offsetWidth() { return 100; }
  get offsetHeight() { return 50; }
  set innerHTML(v) { this._html = v; }
  get innerHTML() { return this._html; }
}

const { doc, map } = makeDoc();
// element with structured attrs + a conflicting data-popover-text
const el = new El2("button");
el.attrs["data-popover-title"] = "The Title";
el.attrs["data-popover-sub"] = "sub text";
el.attrs["data-popover-lifecycle"] = "lifecycle text";
el.attrs["data-popover-body"] = "Body <a href='https://x'>link</a>";
el.attrs["data-popover-text"] = "IGNORED";
doc.body.appendChild(el);
doc.querySelectorAll = (sel) => (sel === "[data-popover-title]") ? [el] : (sel === "[data-popover-text]") ? [el] : [];

installGlobals({ hash: "#", doc, fetchImpl: async () => ({ ok: true, status: 200, json: async () => DATA }) });
const createApp = await importCore("?struct");
createApp(DATA, doc);

// The popover content provider isn't directly accessible; but we can trigger
// show() via the wire'd pointerenter + a short timer, then inspect the popover el.
const showFn = el.listeners["pointerenter"][0];
showFn({});
await new Promise((r) => setTimeout(r, 400));
const popEl = doc.body.children.find((c) => c.className === "popover");
assert(!!popEl, "popover element created");
const wrap = popEl.children[0];
const kids = (wrap ? wrap.children : []).map((c) => ({ cls: c.className, text: c.textContent, html: c._html || "" }));
console.log("popover children:", JSON.stringify(kids));
assert(kids.some((k) => k.cls === "popover-title" && k.text === "The Title"), "title rendered");
assert(kids.some((k) => k.cls === "popover-sub" && k.text === "sub text"), "sub rendered");
assert(kids.some((k) => k.cls === "popover-lifecycle" && k.text === "lifecycle text"), "lifecycle rendered");
assert(kids.some((k) => k.cls === "popover-body" && /<a href/.test(k.html)), "body rendered as HTML");
assert(!kids.some((k) => /IGNORED/.test(k.text)), "data-popover-text ignored");
console.log(failed ? "STRUCTURED-POPOVER: FAIL" : "STRUCTURED-POPOVER: ALL PASS");

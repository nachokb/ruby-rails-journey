import { loadData, makeDoc, installGlobals, importCore } from "./helpers.mjs";

const DATA = loadData();
let failed = false;
function assert(cond, msg) { if (!cond) { failed = true; console.log("FAIL:", msg); } }

const { doc, map } = makeDoc();
// Add a [data-popover-text] element to the fake doc's body, scannable by querySelectorAll.
const target = { tagName: "button", attrs: { "data-popover-text": "line one\nline two" }, className: "el", listeners: {} };
target.addEventListener = (ev, fn) => { (target.listeners[ev] ||= []).push(fn); };
doc.body.appendChild(target);
doc.querySelectorAll = (sel) => (sel === "[data-popover-text]") ? [target] : [];

installGlobals({ hash: "#", doc, fetchImpl: async () => ({ ok: true, status: 200, json: async () => DATA }) });
const createApp = await importCore("?poptext");
createApp(DATA, doc);

// The popover should have been wired: pointerenter listener present.
assert((target.listeners["pointerenter"] || []).length >= 1, "data-popover-text element should be wired for hover");
console.log(failed ? "POPOVER-TEXT: FAIL" : "POPOVER-TEXT: ALL PASS");

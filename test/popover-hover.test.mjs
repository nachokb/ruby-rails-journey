import { loadData, makeDoc, installGlobals, importCore } from "./helpers.mjs";
const DATA = loadData();
let failed = false;
function assert(cond, msg) { if (!cond) { failed = true; console.log("FAIL:", msg); } }

const { doc, map } = makeDoc();
const anchor = { tagName: "button", attrs: { "data-popover-text": "hello" }, listeners: {} };
anchor.addEventListener = (ev, fn) => { (anchor.listeners[ev] ||= []).push(fn); };
doc.body.appendChild(anchor);
doc.querySelectorAll = (sel) => (sel === "[data-popover-text]") ? [anchor] : [];

installGlobals({ hash: "#", doc, fetchImpl: async () => ({ ok: true, status: 200, json: async () => DATA }) });
const createApp = await importCore("?hover");
createApp(DATA, doc);

const popEl = doc.body.children.find((c) => c.className === "popover");
assert(!!popEl, "popover element created");
assert((popEl.listeners["pointerenter"] || []).length >= 1, "popover cancels hide on pointerenter");
assert((popEl.listeners["pointerleave"] || []).length >= 1, "popover schedules hide on pointerleave");

console.log(failed ? "POPOVER-HOVER: FAIL" : "POPOVER-HOVER: ALL PASS");

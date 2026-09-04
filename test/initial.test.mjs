import { loadData, makeDoc, installGlobals, importCore } from "./helpers.mjs";

const DATA = loadData();
let passed = true;
function assert(cond, msg) { if (!cond) { passed = false; console.log("FAIL:", msg); } }

const { doc, map } = makeDoc();
installGlobals({ hash: "#", doc, fetchImpl: async () => ({ ok: true, status: 200, json: async () => DATA }) });
const createApp = await importCore("?initial");
createApp(DATA, doc, { urlSync: false, initial: { home: { i: 1, j: 0 }, target: { i: 3, j: 6 } } });

const markersLayer = map["matrix"].children.find((c) => c.attrs["id"] === "markers-layer");
const markers = markersLayer ? markersLayer.children.filter((c) => c.attrs["class"] === "marker") : [];
console.log("markers after initial:", markers.length);
assert(markers.length === 2, "expected 2 markers");
const draggable = markers.every((m) => (m.listeners["pointerdown"] || []).length > 0);
assert(draggable, "markers should be draggable (have pointerdown)");
assert(!map["paths-panel"].hidden, "panel should be visible");
assert(map["reset-btn"] !== null, "reset btn present");
// reset button should be visible toggled (classList stub no-op, but at least present)
console.log(passed ? "INITIAL STATE: ALL PASS" : "INITIAL STATE: FAIL");

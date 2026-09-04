import { loadData, makeDoc, installGlobals, importCore, clickCell } from "./helpers.mjs";
const DATA = loadData();
let failed = false;
function assert(cond, msg) { if (!cond) { failed = true; console.log("FAIL:", msg); } }

// Build a journey hash against the mock grid, then boot with it + urlSync true.
const frag = "#j;deadbeef;h6125;t7133"; // home 6.1|2.5 -> target 7.1|3.3 (mock)
const { doc, map } = makeDoc();
const wrote = installGlobals({ hash: frag, doc, fetchImpl: async () => ({ ok: true, status: 200, json: async () => DATA }) });
const createApp = await importCore("?urlsync");
createApp(DATA, doc, { urlSync: true });

// restoreFromUrl decodes; home/target should be set -> markers rendered, panel visible.
const markersLayer = map["matrix"].children.find((c) => c.attrs["id"] === "markers-layer");
const markers = markersLayer ? markersLayer.children.filter((c) => c.attrs["class"] === "marker") : [];
console.log("markers after urlSync restore:", markers.length);
assert(markers.length === 2, "urlSync restore should place 2 markers");
assert(!map["paths-panel"].hidden, "panel visible after restore");
console.log(failed ? "URLSYNC: FAIL" : "URLSYNC: ALL PASS");

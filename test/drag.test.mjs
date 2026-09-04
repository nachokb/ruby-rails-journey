import { loadData, makeDoc, installGlobals, importCore } from "./helpers.mjs";
const DATA = loadData();
let failed = false;
function assert(cond, msg) { if (!cond) { failed = true; console.log("FAIL:", msg); } }

const { doc, map } = makeDoc();
installGlobals({ hash: "#", doc, fetchImpl: async () => ({ ok: true, status: 200, json: async () => DATA }) });
const createApp = await importCore("?drag");
createApp(DATA, doc, { urlSync: false, initial: { home: { i: 1, j: 0 }, target: { i: 3, j: 6 } } });

const markersLayer = map["matrix"].children.find((c) => c.attrs["id"] === "markers-layer");
const markers = markersLayer ? markersLayer.children.filter((c) => c.attrs["class"] === "marker") : [];
assert(markers.length === 2, "2 markers");
const home = markers.find((m) => m.attrs["data-overlay"] === "home");

// simulate pointerdown (drag start) on the home marker
home.dispatch("pointerdown", { pointerId: 1, clientX: 0, clientY: 0, stopPropagation: () => {}, preventDefault: () => {} });
console.log(failed ? "DRAG: FAIL" : "DRAG: ALL PASS");

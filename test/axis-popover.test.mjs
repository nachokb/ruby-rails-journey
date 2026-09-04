import { loadData, makeDoc, installGlobals, importCore } from "./helpers.mjs";

const DATA = loadData();
let failed = false;
function assert(cond, msg) { if (!cond) { failed = true; console.log("FAIL:", msg); } }

const { doc, map } = makeDoc();
installGlobals({ hash: "#", doc, fetchImpl: async () => ({ ok: true, status: 200, json: async () => DATA }) });
const createApp = await importCore("?axis");
createApp(DATA, doc);

const svg = map["matrix"];
const axisLabels = svg.children.filter((c) => (c.attrs["class"] || "").includes("axis-label"));
const expected = DATA.rails_versions.length + DATA.ruby_versions.length;
console.log("axis-label count:", axisLabels.length, "(expected", expected + ")");
assert(axisLabels.length === expected, "all axis labels present");

const wired = axisLabels.filter((el) => (el.listeners["pointerenter"] || []).length > 0);
console.log("axis labels wired for popover:", wired.length, "/", axisLabels.length);
assert(wired.length === axisLabels.length, "every axis label should be wired for hover");

console.log(failed ? "AXIS-POPOVER: FAIL" : "AXIS-POPOVER: ALL PASS");

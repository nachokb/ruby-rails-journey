// Smoke test: validates the REAL data.json (not the mock fixture) still boots
// and that every note/template reference resolves. Run explicitly:
//   npm run test:smoke
import { loadData, makeDoc, installGlobals, importCore, findCells, ROOT } from "./helpers.mjs";

const DATA = loadData(ROOT + "/data.json");

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ---- structure ----
assert(Array.isArray(DATA.ruby_versions) && DATA.ruby_versions.length > 0, "ruby_versions present");
assert(Array.isArray(DATA.rails_versions) && DATA.rails_versions.length > 0, "rails_versions present");
const rails = new Set(DATA.rails_versions.map((o) => o.version));
const ruby = new Set(DATA.ruby_versions.map((o) => o.version));

// ---- every cell: status/confidence valid, all note refs resolve ----
let cellCount = 0;
for (const [key, cell] of Object.entries(DATA.cells)) {
  cellCount++;
  const [rv, ru] = key.split("|");
  assert(rails.has(rv), "cell key rails not in rails_versions: " + key);
  assert(ruby.has(ru), "cell key ruby not in ruby_versions: " + key);
  assert(["green", "blue", "red", "gray"].includes(cell.status), "bad status " + key);
  assert(["confirmed", "inferred"].includes(cell.confidence), "bad confidence " + key);
  for (const note of cell.notes || []) {
    if (typeof note === "object" && note.ref) {
      assert(DATA.noteTemplates[note.ref], "unresolved note template ref '" + note.ref + "' in " + key);
    }
  }
}
// every (rails, ruby) combo should have a cell entry
assert(cellCount === rails.size * ruby.size, "cell count mismatch: " + cellCount + " vs " + (rails.size * ruby.size));

// ---- noteRules refs resolve ----
for (const rule of DATA.noteRules || []) {
  for (const note of rule.notes || []) {
    if (note.ref) assert(DATA.noteTemplates[note.ref], "unresolved rule ref '" + note.ref + "'");
  }
}

// ---- boot the real app: all cells render, no errors ----
const { doc, map } = makeDoc();
installGlobals({ hash: "#", doc, fetchImpl: async () => ({ ok: true, status: 200, json: async () => DATA }) });
const createApp = await importCore("?smoke");
createApp(DATA, doc);
assert(findCells(map).length === rails.size * ruby.size, "grid cell count mismatch");

console.log("smoke: " + cellCount + " cells, all refs resolve, app boots on real data: OK");
console.log("\nSMOKE: ALL PASS");
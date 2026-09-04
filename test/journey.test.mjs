import { loadData, SRC } from "./helpers.mjs";
import { pathToFileURL } from "node:url";

const DATA = loadData(); // mock fixture (test/fixtures/data.json)
const J = await import(pathToFileURL(SRC + "/journey.js").href);
const { encodeJourney, decodeJourney, cellsToRuns, runsToCells, fingerprint, verToHex, hexToVer } = J;
const { Router } = await import(pathToFileURL(SRC + "/router.js").href);

function assert(cond, msg) { if (!cond) throw new Error(msg); }

const rails = DATA.rails_versions.map((o) => o.version);
const ruby = DATA.ruby_versions.map((o) => o.version);
const router = new Router({
  railsVersions: rails, rubyVersions: ruby, cells: DATA.cells,
  weights: DATA.router.weights, turnPenalty: DATA.router.turnPenalty, maxPaths: DATA.router.maxPaths
});

// ---- version packing ----
assert(verToHex("4.2") === "42", "4.2 -> 42");
assert(verToHex("8.1") === "81", "8.1 -> 81");
assert(verToHex("11.13") === "bd", "11.13 -> bd");
assert(hexToVer("bd") === "11.13", "bd -> 11.13");
assert(hexToVer("42") === "4.2", "42 -> 4.2");
console.log("1. version packing: OK");

// ---- runs <-> cells round trip on real computed paths ----
const home = { i: 1, j: 2 }, target = { i: 3, j: 5 }; // 6.1|2.7 -> 7.1|3.2
const paths = router.computeKShortestPaths(home, target);
assert(paths.length > 0, "paths exist");
for (const p of paths) {
  const runs = cellsToRuns(p.cells);
  const rt = runsToCells(home, target, runs.flag, runs.runs);
  assert(rt.length === p.cells.length, "run length mismatch");
  for (let k = 0; k < rt.length; k++) {
    assert(rt[k].i === p.cells[k].i && rt[k].j === p.cells[k].j, "cell mismatch at " + k);
  }
}
console.log("2. runs <-> cells round-trip on all " + paths.length + " paths: OK");

// ---- full journey round trip ----
const fakeState = { home, target, paths, selectedPathIndex: 0, currentStep: 2 };
const frag = encodeJourney(DATA, fakeState, router);
assert(frag.indexOf("#j;") === 0, "frag prefix");
const dec = decodeJourney(frag, DATA, router);
assert(dec.home.i === 1 && dec.home.j === 2, "home round trip");
assert(dec.target.i === 3 && dec.target.j === 5, "target round trip");
assert(dec.step === 2, "step round trip");
assert(dec.stale === false, "not stale on same data");
console.log("3. journey round-trip: OK (" + frag + ")");

// ---- stale detection ----
const d2 = JSON.parse(JSON.stringify(DATA));
d2.cells["7.1|3.2"].confidence = "inferred";
const dec2 = decodeJourney(frag, d2, router);
assert(dec2.stale === true, "should be stale after data change");
console.log("4. stale detection: OK");

// ---- fingerprint sensitivity ----
const base = fingerprint(DATA);
const d3 = JSON.parse(JSON.stringify(DATA));
d3.ruby_versions.push({ version: "3.4", released: "2024-12", eol: "2028-03" });
assert(fingerprint(d3) !== base, "append changes fingerprint");
console.log("5. fingerprint sensitivity (data + router version): OK");

// ---- unmappable -> null ----
// cull an unrelated version from the front (allowed): still mappable
const d4 = JSON.parse(JSON.stringify(DATA));
d4.ruby_versions = d4.ruby_versions.filter((o) => o.version !== "2.5");
const router4 = new Router({
  railsVersions: d4.rails_versions.map((o) => o.version), rubyVersions: d4.ruby_versions.map((o) => o.version), cells: d4.cells,
  weights: d4.router.weights, turnPenalty: d4.router.turnPenalty, maxPaths: d4.router.maxPaths
});
const dec4 = decodeJourney(frag, d4, router4);
assert(dec4 !== null, "still mappable after culling unrelated version");
// remove the bookmarked home version -> unmappable
const d5 = JSON.parse(JSON.stringify(DATA));
d5.rails_versions = d5.rails_versions.filter((o) => o.version !== "6.1");
const router5 = new Router({
  railsVersions: d5.rails_versions.map((o) => o.version), rubyVersions: d5.ruby_versions.map((o) => o.version), cells: d5.cells,
  weights: d5.router.weights, turnPenalty: d5.router.turnPenalty, maxPaths: d5.router.maxPaths
});
const dec5 = decodeJourney(frag, d5, router5);
assert(dec5 === null, "unmappable when bookmarked version removed");
console.log("6. unmappable bookmark -> null: OK");

console.log("\nJOURNEY MODULE: ALL PASS");
import { loadData, makeDoc, installGlobals, importCore, clickCell, findCells } from "./helpers.mjs";

const DATA = loadData(); // mock fixture

function fresh() {
  const { doc, map } = makeDoc();
  installGlobals({ hash: "#", doc, fetchImpl: async () => ({ ok: true, status: 200, json: async () => DATA }) });
  return { doc, map };
}

async function boot() {
  const ctx = fresh();
  const createApp = await importCore();
  createApp(DATA, ctx.doc);
  return ctx;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ---- 1. grid builds (4 rails x 7 ruby = 28) ----
{
  const { map } = await boot();
  assert(findCells(map).length === 28, "expected 28 cell groups, got " + findCells(map).length);
  console.log("1. grid builds: OK");
}

// ---- 2. click a cell -> home/target/paths + URL hash ----
{
  const { map } = await boot();
  clickCell(map, 1, 0); // 6.1|2.5
  assert(!map["paths-panel"].hidden, "panel should be visible");
  const hash = globalThis.location.hash;
  assert(hash.indexOf("#j;") === 0, "expected journey hash, got " + hash);
  const markersLayer = map["matrix"].children.find((c) => c.attrs["id"] === "markers-layer");
  const markers = markersLayer ? markersLayer.children.filter((c) => c.attrs["class"] === "marker") : [];
  assert(markers.length === 2, "expected 2 markers, got " + markers.length);
  console.log("2. click -> pins+panel+hash: OK (" + hash + ")");
}

// ---- 3. reset clears URL and hides panel ----
{
  const { map } = await boot();
  clickCell(map, 1, 0);
  assert(globalThis.location.hash.indexOf("#j;") === 0, "prereq: journey hash set");
  map["reset-btn"].dispatch("click");
  assert(globalThis.location.hash === "#", "reset should clear hash, got " + globalThis.location.hash);
  assert(map["paths-panel"].hidden, "reset should hide panel");
  console.log("3. reset clears URL + panel: OK");
}

// ---- 4. share menu: copy URL copies current URL ----
{
  const { doc, map } = makeDoc();
  let copied = null;
  installGlobals({ hash: "#", doc, fetchImpl: async () => ({ ok: true, status: 200, json: async () => DATA }),
    clipboardImpl: { writeText: async (s) => { copied = s; } } });
  const createApp = await importCore("?clip");
  createApp(DATA, doc);
  clickCell(map, 1, 0);
  map["copy-link-btn"].dispatch("click");
  // the menu is appended to doc.body; find the "Copy URL" option
  const backdrop = doc.body.children.find((c) => c.className === "share-backdrop");
  assert(!!backdrop, "share menu should open");
  const option = backdrop.children[0].children.find((c) => (c.textContent || "").trim() === "Copy URL");
  assert(!!option, "Copy URL option present");
  option.dispatch("click");
  await new Promise((r) => setTimeout(r, 10));
  assert(copied !== null, "clipboard.writeText should be called");
  assert(copied.indexOf("#j;") >= 0, "copied URL should contain the journey hash, got " + copied);
  console.log("4. share menu copies journey URL: OK (" + copied + ")");
}

// ---- 5. current step: clicking a path cell advances, hash updates ----
{
  const { map } = await boot();
  clickCell(map, 1, 0); // home 6.1|2.5 -> target auto (3,6) 7.1|3.3
  const hash0 = globalThis.location.hash;
  assert(hash0.indexOf(";s") < 0, "no step before clicking a path cell");
  clickCell(map, 1, 4); // 6.1|3.1 is on the drawn path
  const hash1 = globalThis.location.hash;
  assert(hash1.indexOf(";s") >= 0, "step should be in hash after clicking path cell, got " + hash1);
  console.log("5. current-step hash update: OK (" + hash1 + ")");
}

// ---- 6. restore journey from URL (home/target markers + step) ----
{
  const { doc: docA, map: mapA } = makeDoc();
  installGlobals({ hash: "#", doc: docA, fetchImpl: async () => ({ ok: true, status: 200, json: async () => DATA }) });
  const createAppA = await importCore("?a");
  createAppA(DATA, docA);
  clickCell(mapA, 1, 0);
  clickCell(mapA, 1, 4); // intermediate step
  const frag = globalThis.location.hash;
  assert(frag.indexOf("#j;") === 0, "prereq hash");

  const { doc, map } = makeDoc();
  installGlobals({ hash: frag, doc, fetchImpl: async () => ({ ok: true, status: 200, json: async () => DATA }) });
  const createAppB = await importCore("?b");
  createAppB(DATA, doc);
  assert(!map["paths-panel"].hidden, "panel should be visible after restore");
  const markersLayer = map["matrix"].children.find((c) => c.attrs["id"] === "markers-layer");
  const markers = markersLayer ? markersLayer.children.filter((c) => c.attrs["class"] === "marker") : [];
  assert(markers.length === 2, "expected 2 markers after restore, got " + markers.length);
  const stepMarkers = map["matrix"].children.flatMap((c) => c.children).filter((c) => c.attrs["class"] === "path-step");
  assert(stepMarkers.length >= 1, "expected a current-step marker after restore");
  console.log("6. restore journey (markers + step): OK (" + frag + ")");
}

// ---- 7. both-EOL hatch + overlay data attributes ----
{
  const { map } = await boot();
  const groups = findCells(map);
  function cellAt(i, j) {
    return groups.find((g) => g._i === i && g._j === j);
  }
  // (2,3) = 7.0|3.0 green + both EOL -> hatch present
  const hatched = cellAt(2, 3).children.find((c) => c.attrs["class"] === "cell-hatch");
  assert(!!hatched, "expected EOL hatch on green both-EOL cell 7.0|3.0");
  // (1,5) = 6.1|3.2 blue + both EOL -> hatch present
  const hatched2 = cellAt(1, 5).children.find((c) => c.attrs["class"] === "cell-hatch");
  assert(!!hatched2, "expected EOL hatch on blue both-EOL cell 6.1|3.2");
  // (1,3) = 6.1|3.0 green but Ruby 3.0 not EOL? actually 3.0 EOL is 2024-04 < now -> both EOL. pick (1,0)=6.1|2.5 both-EOL green -> hatch
  const hatched3 = cellAt(1, 0).children.find((c) => c.attrs["class"] === "cell-hatch");
  assert(!!hatched3, "expected hatch on 6.1|2.5");

  // a red both-EOL cell should NOT be hatched: (3,0) = 7.1|2.5 red/both-EOL
  const redHatch = cellAt(3, 0).children.find((c) => c.attrs["class"] === "cell-hatch");
  assert(!redHatch, "red both-EOL cell should not be hatched");

  // after placing pins, markers carry data-overlay
  clickCell(map, 1, 0);
  const markersLayer = map["matrix"].children.find((c) => c.attrs["id"] === "markers-layer");
  const markers = markersLayer ? markersLayer.children.filter((c) => c.attrs["class"] === "marker") : [];
  assert(markers.some((m) => m.attrs["data-overlay"] === "home"), "home marker has data-overlay");
  assert(markers.some((m) => m.attrs["data-overlay"] === "target"), "target marker has data-overlay");
  // path elements carry data-overlay
  const pathLayer = map["matrix"].children.find((c) => c.attrs["id"] === "path-layer");
  const overlaid = pathLayer ? pathLayer.children.filter((c) => c.attrs["data-overlay"]) : [];
  assert(overlaid.length >= 2, "path layer has data-overlay elements");
  console.log("7. EOL hatch + overlay data attrs: OK");
}

console.log("\nCORE BEHAVIOR: ALL PASS");
// ---- 8. share menu: iframe + web component snippets ----
{
  const { doc, map } = makeDoc();
  const copied = [];
  installGlobals({ hash: "#", doc, fetchImpl: async () => ({ ok: true, status: 200, json: async () => DATA }),
    clipboardImpl: { writeText: async (s) => { copied.push(s); } } });
  const createApp = await importCore("?share2");
  createApp(DATA, doc, { copyLinkBase: "http://test/site/index.html" });
  clickCell(map, 1, 0);

  function clickOption(label) {
    map["copy-link-btn"].dispatch("click");
    const backdrop = doc.body.children.find((c) => c.className === "share-backdrop");
    const option = backdrop.children[0].children.find((c) => (c.textContent || "").trim() === label);
    option.dispatch("click");
    return backdrop;
  }
  clickOption("Copy iframe code");
  clickOption("Copy Web Component code");

  await new Promise((r) => setTimeout(r, 10));
  const iframe = copied[0] || "";
  const wc = copied[1] || "";
  assert(iframe.includes("<iframe") && iframe.includes("embed.html") && iframe.includes("width=\"840\"") && iframe.includes("height=\"800\""), "iframe snippet");
  assert(iframe.indexOf("#j;") >= 0, "iframe carries journey fragment");
  assert(wc.includes("<script") && wc.includes("widget.js") && wc.includes("<ruby-rails-matrix"), "web component snippet");
  assert(wc.includes("home=\"6.1|2.5\"") && wc.includes("target=\"7.1|3.3\"") && wc.includes("data-journey"), "wc has home/target/data-journey");
  assert(copied.length === 2, "only iframe + wc copied");
  console.log("8. share menu iframe + web component snippets: OK");
}

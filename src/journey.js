// Journey serialization for URL bookmarks.
//
// Format: #j;<fp8>;h<hh><hr>;t<th><tr>[;<H|V><runs>][;s<hexstep>]
//   j        namespace prefix (future formats use other letters)
//   fp8      FNV-1a-32 fingerprint (8 hex) over versions + cells + router version
//   h<hh><hr> home  rails+ruby each packed as 2 hex digits ("4.2"->"42", "11.13"->"bd")
//   t<th><tr> target same
//   H|V      first-move direction of the route (uppercase)
//   runs     one hex digit per straight segment (max 16 cells/segment)
//   s        current step, hex byte (0-255), omitted when none
//
// Versions are only appended at the end / culled from the front, so surviving
// version strings always remap. The runs encode the route exactly, so a changed
// router/data set can still reconstruct the bookmarked route for validation.

import { Router } from "./router.js";

// Bump when the path-finding semantics change; folded into the fingerprint so
// stale bookmarks can be detected even with identical data.
export const ROUTER_VERSION = 1;

function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function canonicalData(DATA) {
  const parts = [];
  parts.push("rv:" + DATA.ruby_versions.map((o) => o.version).join(","));
  parts.push("R:" + DATA.rails_versions.map((o) => o.version + "/" + o.min_ruby).join(","));
  const keys = Object.keys(DATA.cells).sort();
  for (const k of keys) {
    const c = DATA.cells[k];
    parts.push(k + ":" + c.status + "/" + c.confidence);
  }
  parts.push("rv:" + ROUTER_VERSION);
  return parts.join("|");
}

export function fingerprint(DATA) {
  return fnv1a32(canonicalData(DATA)).toString(16).padStart(8, "0");
}

export function verToHex(v) {
  const [maj, min] = v.split(".").map((x) => parseInt(x, 10));
  return maj.toString(16) + min.toString(16);
}

export function hexToVer(s) {
  return parseInt(s[0], 16) + "." + parseInt(s[1], 16);
}

function axisOf(a, b) {
  return a.i !== b.i ? "H" : "V";
}

// path cells (index space) -> { flag: "H"|"V", runs: "342133" }
export function cellsToRuns(cells) {
  if (!cells || cells.length < 2) return { flag: "H", runs: "" };
  const flag = axisOf(cells[0], cells[1]);
  const runs = [];
  let count = 1;
  let prevAxis = flag;
  for (let k = 2; k < cells.length; k++) {
    const ax = axisOf(cells[k - 1], cells[k]);
    if (ax === prevAxis) count++;
    else { runs.push(count); count = 1; prevAxis = ax; }
  }
  runs.push(count);
  return { flag: flag, runs: runs.map((r) => r.toString(16)).join("") };
}

// {flag, runs} + home/target -> full cell path in index space (monotone toward target)
export function runsToCells(home, target, flag, runs) {
  const di = Math.sign(target.i - home.i);
  const dj = Math.sign(target.j - home.j);
  let i = home.i, j = home.j;
  let axis = flag === "H" ? "H" : "V";
  const cells = [{ i: i, j: j }];
  for (const ch of runs) {
    const n = parseInt(ch, 16);
    for (let s = 0; s < n; s++) {
      if (axis === "H") i += di; else j += dj;
      cells.push({ i: i, j: j });
    }
    axis = axis === "H" ? "V" : "H";
  }
  return cells;
}

export function encodeJourney(DATA, state, router) {
  if (!state.home || !state.target) return "#";
  const homeRails = router.railsVersions[state.home.i];
  const homeRuby = router.rubyVersions[state.home.j];
  const tRails = router.railsVersions[state.target.i];
  const tRuby = router.rubyVersions[state.target.j];

  let routePart = "";
  if (state.paths[state.selectedPathIndex]) {
    const { flag, runs } = cellsToRuns(state.paths[state.selectedPathIndex].cells);
    routePart = ";" + flag + runs;
  }
  let stepPart = "";
  if (state.currentStep != null && state.currentStep > 0) {
    stepPart = ";s" + state.currentStep.toString(16);
  }
  return "#j;" + fingerprint(DATA)
    + ";h" + verToHex(homeRails) + verToHex(homeRuby)
    + ";t" + verToHex(tRails) + verToHex(tRuby)
    + routePart + stepPart;
}

// Parse a fragment. Returns null when unparsable or a bookmarked version no
// longer exists (unmappable). Otherwise {home, target, route, step, stale}.
export function decodeJourney(hash, DATA, router) {
  if (!hash || hash.indexOf("#j;") !== 0) return null;
  const parts = hash.slice(3).split(";");
  if (parts.length < 3) return null;
  const fp = parts[0];
  const h = parts[1].charAt(0) === "h" ? parts[1].slice(1) : parts[1];
  const t = parts[2].charAt(0) === "t" ? parts[2].slice(1) : parts[2];

  const homeRails = hexToVer(h.slice(0, 2)), homeRuby = hexToVer(h.slice(2, 4));
  const tRails = hexToVer(t.slice(0, 2)), tRuby = hexToVer(t.slice(2, 4));
  const homeI = router.railsVersions.indexOf(homeRails);
  const homeJ = router.rubyVersions.indexOf(homeRuby);
  const targetI = router.railsVersions.indexOf(tRails);
  const targetJ = router.rubyVersions.indexOf(tRuby);
  if (homeI < 0 || homeJ < 0 || targetI < 0 || targetJ < 0) return null;

  const home = { i: homeI, j: homeJ }, target = { i: targetI, j: targetJ };
  let route = null, step = null;
  for (const p of parts.slice(3)) {
    if (!p) continue;
    if (p[0] === "H" || p[0] === "V") {
      route = runsToCells(home, target, p[0], p.slice(1));
    } else if (p[0] === "s") {
      step = parseInt(p.slice(1), 16) || 0;
    }
  }
  return {
    home: home,
    target: target,
    route: route,
    step: step,
    stale: fp !== fingerprint(DATA)
  };
}
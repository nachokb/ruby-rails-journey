// Version lifecycle status derived from release/support/eol dates vs today.
// No stored "as of" — computed at render time from the visitor's clock.

function ym(s) {
  if (!s) return null;
  const [y, m] = s.split("-").map(Number);
  return y * 12 + (m - 1);
}

export function lifecycleStatus(meta, now) {
  if (!meta) return "maintained";
  const eol = ym(meta.eol);
  const support = ym(meta.support);
  const today = now.getFullYear() * 12 + now.getMonth();
  if (eol != null && today >= eol) return "EOL";
  if (support != null && today >= support) return "security-only";
  return "maintained";
}

export function statusLabel(status) {
  if (status === "EOL") return "EOL";
  if (status === "security-only") return "security-only";
  return "maintained";
}

export function isEol(meta, now) {
  return lifecycleStatus(meta, now) === "EOL";
}

export function bothEol(railsMeta, rubyMeta, now) {
  return isEol(railsMeta, now) && isEol(rubyMeta, now);
}
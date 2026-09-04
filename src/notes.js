export function versionNumber(v) {
  return String(v).split(".").map(function (n) { return parseInt(n, 10) || 0; });
}

export function versionCmp(a, b) {
  const A = versionNumber(a), B = versionNumber(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = i < A.length ? A[i] : 0, y = i < B.length ? B[i] : 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

// Predicate dispatcher: each predicate is a named function taking its
// argument (the `when` value) and the resolved cell context (`ctx`).
const predicates = {
  match: function (arg, ctx) { return ctx[arg[0]] === arg[1]; },
  belowFloor: function (arg, ctx) { return ctx.belowFloor === arg; }
};

function predTrue(pred, ctx) {
  const label = Object.keys(pred)[0];
  const fn = predicates[label];
  return fn ? fn(pred[label], ctx) : false;
}

export function fillTemplate(tmpl, vars) {
  return tmpl.replace(/\{(\w+)\}/g, function (_, name) {
    return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : "{" + name + "}";
  });
}

export function defaultFallbackNote(rails, ruby) {
  return "No data available for Ruby " + ruby + " with Rails " + rails + ".";
}

// Resolves a cell's status/confidence and its note text, using the cell's
// explicit `notes[]` when present and falling back to the declarative rules.
export class Notes {
  constructor({ cells, noteTemplates, noteRules, minRuby }) {
    this.cells = cells;
    this.noteTemplates = noteTemplates;
    this.noteRules = noteRules || [];
    this.minRuby = minRuby;
  }

  resolveCell(rails, ruby) {
    const cellData = this.cells[rails + "|" + ruby] || {};
    const status = cellData.status || "gray";
    const confidence = cellData.confidence || "inferred";

    const ctx = {
      rails: rails, ruby: ruby, status: status, confidence: confidence,
      belowFloor: this.minRuby[rails] ? versionCmp(ruby, this.minRuby[rails]) < 0 : false,
      minRuby: this.minRuby[rails]
    };

    let list = cellData.notes || null;
    if (!list) {
      for (const rule of this.noteRules) {
        if (rule.when.every(function (p) { return predTrue(p, ctx); })) { list = rule.notes; break; }
      }
    }

    const texts = [];
    (list || []).forEach((entry) => {
      const t = this.resolveEntry(entry, ctx);
      if (t) texts.push(t);
    });

    return {
      status: status,
      confidence: confidence,
      note: texts.join("\n\n") || defaultFallbackNote(rails, ruby)
    };
  }

  resolveEntry(entry, ctx) {
    if (typeof entry === "string") return entry;
    const tmpl = this.noteTemplates[entry.ref];
    if (!tmpl) {
      console.error("Ruby × Rails Matrix: unknown note template ref: " + entry.ref);
      return "";
    }
    const vars = {};
    for (const k in entry) if (k !== "ref") vars[k] = entry[k];
    vars.rails = ctx.rails;
    vars.ruby = ctx.ruby;
    if (ctx.minRuby) vars.minRuby = ctx.minRuby;
    return fillTemplate(tmpl, vars);
  }
}
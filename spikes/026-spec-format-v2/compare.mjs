// Structural model diff (T012): lists every differing field with its location.
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

export function diffModels(a, b, { ignoreFormats = true } = {}) {
  const out = [];
  const walk = (x, y, path) => {
    if (Array.isArray(x) && Array.isArray(y)) {
      const idKey = (v) => (isObj(v) && v.id !== undefined ? String(v.id) : isObj(v) && v.phase !== undefined ? `phase${v.phase}` : null);
      const keyed = x.every((v) => idKey(v) !== null) && y.every((v) => idKey(v) !== null);
      if (keyed) {
        const ys = new Map(y.map((v) => [idKey(v), v]));
        const xs = new Map(x.map((v) => [idKey(v), v]));
        for (const [k, v] of xs) ys.has(k) ? walk(v, ys.get(k), `${path}[${k}]`) : out.push({ path: `${path}[${k}]`, a: "present", b: "missing" });
        for (const k of ys.keys()) if (!xs.has(k)) out.push({ path: `${path}[${k}]`, a: "missing", b: "present" });
        // order matters for stories/tasks: report an order difference when keys are the same set
        const ox = x.map(idKey).join(","), oy = y.map(idKey).join(",");
        if (ox !== oy && xs.size === ys.size && [...xs.keys()].every((k) => ys.has(k))) out.push({ path: `${path}.order`, a: ox, b: oy });
        return;
      }
      if (x.length !== y.length) out.push({ path: `${path}.length`, a: x.length, b: y.length });
      x.forEach((v, i) => i < y.length && walk(v, y[i], `${path}[${i}]`));
      return;
    }
    if (isObj(x) && isObj(y)) {
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
        if (ignoreFormats && path === "" && k === "formats") continue;
        if (!(k in x)) out.push({ path: `${path}.${k}`, a: undefined, b: JSON.stringify(y[k]) });
        else if (!(k in y)) out.push({ path: `${path}.${k}`, a: JSON.stringify(x[k]), b: undefined });
        else walk(x[k], y[k], `${path}.${k}`);
      }
      return;
    }
    if (x !== y) out.push({ path, a: JSON.stringify(x), b: JSON.stringify(y) });
  };
  walk(a, b, "");
  return out;
}

export const showDiff = (d) => d.map((x) => `  ${x.path}: ${x.a} ≠ ${x.b}`).join("\n");

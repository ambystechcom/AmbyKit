// Spike A measurements (T002/T004). Run after `npm run build`: node specs/029-fleet-control-room/spike/measure.mjs
import { performance } from "node:perf_hooks";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const spike = await import("../../../dist/cli/ui/interactive/spike/fleet-spike.js");
const states = ["working", "waiting", "blocked", "paused", "done", "unreported", "unknown", "working", "working", "waiting"];
const lanes = states.map((state, i) => ({ lane: `lane-1-${i + 1}`, assistant: ["claude", "codex", "claude"][i % 3], state, stalled: i === 7, idleMinutes: i * 3, directive: { action: "continue", status: "none" }, tasks: [] }));
const out = {};
for (const icons of ["nerd", "unicode", "ascii"]) {
  for (const columns of [120, 80, 50]) {
    const N = 2000;
    const t0 = performance.now();
    let rows;
    for (let i = 0; i < N; i++) rows = spike.layoutRows(lanes, { icons, columns, rows: 10 });
    const per = (performance.now() - t0) / N;
    const widths = new Set(rows.map((r) => spike.displayWidth(r)));
    out[`${icons}@${columns}`] = { msPerFrame: Number(per.toFixed(4)), allRowsExactWidth: widths.size === 1 && [...widths][0] === columns };
  }
}
console.log(JSON.stringify(out, null, 1));
console.log("sample (unicode@80):\n" + spike.layoutRows(lanes, { icons: "unicode", columns: 80, rows: 10 }).join("\n"));
console.log("sample (ascii@50):\n" + spike.layoutRows(lanes, { icons: "ascii", columns: 50, rows: 4 }).join("\n"));
const loc = readFileSync("src/cli/ui/interactive/spike/fleet-spike.ts", "utf8").split("\n").filter((l) => l.trim() && !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).length;
console.log(`spike A source lines (non-comment): ${loc}`);

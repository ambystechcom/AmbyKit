#!/usr/bin/env node
// Fake headless runner (feature 028, T001). Never calls a model. Behavior comes from FAKE_RUNNER (JSON):
//   { exit: 0, delayMs: 0, hang: false, tick: ["T001"], marker: { feature, lane, state }, record: "<file>" }
// It reads the prompt from stdin, appends one line to `record` (cwd, argv, prompt), ticks tasks in
// specs/<feature>/tasks.md of its cwd, writes an activity marker, waits, then exits with `exit`.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const plan = JSON.parse(process.env.FAKE_RUNNER ?? "{}");
let prompt = "";
if (!process.stdin.isTTY) {
  for await (const chunk of process.stdin) prompt += chunk;
}
if (plan.record) appendFileSync(plan.record, JSON.stringify({ cwd: process.cwd(), argv: process.argv.slice(2), prompt }) + "\n");

if (plan.marker) {
  const dir = join(process.cwd(), ".amby", "activity");
  mkdirSync(dir, { recursive: true });
  const m = plan.marker;
  const file = `${m.feature}.fake${m.lane ? `~${m.lane}` : ""}.json`;
  writeFileSync(join(dir, file), JSON.stringify({ agent: "fake", at: new Date().toISOString(), state: m.state ?? "working", lane: m.lane }) + "\n");
}
for (const id of plan.tick ?? []) {
  const tasks = join(process.cwd(), "specs", plan.feature ?? "", "tasks.md");
  if (existsSync(tasks)) writeFileSync(tasks, readFileSync(tasks, "utf8").replace(`- [ ] [${id}]`, `- [x] [${id}]`));
}
if (plan.hang) await new Promise(() => setInterval(() => {}, 1000));
if (plan.delayMs) await new Promise((r) => setTimeout(r, plan.delayMs));
process.exit(plan.exit ?? 0);

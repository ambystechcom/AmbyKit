import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTasks } from "../../src/core/dashboard.js";
import {
  manifestDrift,
  mergeCheckoffs,
  readManifest,
  writeManifest,
  type LaneManifest,
} from "../../src/core/lanes.js";
import { phase, tasksMd } from "../helpers/tasks-fixture.js";

const body = (done: string[], eol: "\n" | "\r\n" = "\n") =>
  tasksMd(
    [
      phase(1, ["T001", "T002", "T003"].map((id) => ({ id, parallel: true, done: done.includes(id), paths: [`s/${id}.ts`] }))),
    ],
    { eol },
  );

describe("mergeCheckoffs", () => {
  const base = body([]);
  it("unions adjacent check-offs", () => {
    const merged = mergeCheckoffs(base, body(["T001"]), body(["T002"]));
    expect(merged).toBe(body(["T001", "T002"]));
  });
  it("keeps a tick that only one side has", () => {
    expect(mergeCheckoffs(base, body([]), body(["T003"]))).toBe(body(["T003"]));
  });
  it("returns null when anything but a checkbox differs", () => {
    const theirs = body(["T001"]).replace("task T002", "renamed T002");
    expect(mergeCheckoffs(base, body([]), theirs)).toBeNull();
    expect(mergeCheckoffs(base, body([]), body([]) + "- [ ] [T004] extra (a.ts)\n")).toBeNull();
  });
  it("preserves CRLF line endings of ours", () => {
    const merged = mergeCheckoffs(body([], "\r\n"), body(["T001"], "\r\n"), body(["T002"], "\r\n"));
    expect(merged).toBe(body(["T001", "T002"], "\r\n"));
  });
});

describe("manifest", () => {
  const manifest: LaneManifest = {
    version: 1,
    feature: "015-parallel-lanes",
    phase: 1,
    lane: "015-parallel-lanes.lane-1-1",
    base: "015-parallel-lanes",
    tasks: [
      { id: "T001", paths: ["s/t001.ts"] },
      { id: "T002", paths: ["s/t002.ts"] },
    ],
  };

  it("round-trips through disk and self-ignores", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambykit-lane-"));
    try {
      writeManifest(dir, manifest);
      expect(readManifest(dir)).toEqual(manifest);
      expect(readManifest(join(dir, "nope"))).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports drift for missing ids and changed paths only", () => {
    const current = parseTasks(
      tasksMd([phase(1, [{ id: "T001", parallel: true, paths: ["s/other.ts"] }, { id: "T009", paths: ["s/x.ts"] }])]),
    );
    expect(manifestDrift(manifest, current)).toEqual(["T001", "T002"]);
    const same = parseTasks(body([]));
    expect(manifestDrift(manifest, same)).toEqual([]);
  });
});

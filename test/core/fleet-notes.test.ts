import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRun } from "../../src/core/fleet/runs.js";
import { NOTE_MAX_TEXT, formatNote, notesPath, parseNote, postNote, readNotes } from "../../src/core/fleet/notes.js";

const setup = () => {
  const r = mkdtempSync(join(tmpdir(), "ambykit-notes-"));
  mkdirSync(join(r, ".amby"));
  const out = createRun(r, "a-one");
  if (!out.ok) throw new Error(out.warning);
  return { root: r, run: out.run.run };
};

describe("notes board", () => {
  it("025:FR-016: appends one line `T### | files | text` to notes.log", () => {
    const { root, run } = setup();
    expect(postNote(root, run, { task: "T012", files: ["src/a.ts", "src/b.ts"], text: "renamed the export" })).toEqual({ ok: true, line: "T012 | src/a.ts, src/b.ts | renamed the export" });
    postNote(root, run, { task: "T013", files: [], text: "no files involved" });
    expect(readFileSync(notesPath(root, run), "utf8")).toBe("T012 | src/a.ts, src/b.ts | renamed the export\nT013 | - | no files involved\n");
  });

  it("025:FR-016: reads them back in order", () => {
    const { root, run } = setup();
    postNote(root, run, { task: "T001", files: ["a.ts"], text: "first" });
    postNote(root, run, { task: "T002", files: [], text: "second | with a bar" });
    expect(readNotes(root, run)).toEqual([
      { task: "T001", files: ["a.ts"], text: "first" },
      { task: "T002", files: [], text: "second | with a bar" },
    ]);
  });

  it("025:FR-016: refuses a missing or malformed task id", () => {
    const { root, run } = setup();
    for (const task of ["", "12", "t001", "T", "TASK1"]) expect(postNote(root, run, { task, files: [], text: "x" }), task).toMatchObject({ ok: false });
    expect(readNotes(root, run)).toEqual([]);
  });

  it("025:FR-016: refuses any newline, empty text, over-long text and awkward file names, and writes nothing", () => {
    const { root, run } = setup();
    expect(postNote(root, run, { task: "T001", files: [], text: "two\nlines" })).toMatchObject({ ok: false, error: expect.stringMatching(/one line/) });
    expect(postNote(root, run, { task: "T001", files: [], text: "carriage\rreturn" })).toMatchObject({ ok: false });
    expect(postNote(root, run, { task: "T001", files: [], text: "   " })).toMatchObject({ ok: false });
    expect(postNote(root, run, { task: "T001", files: [], text: "x".repeat(NOTE_MAX_TEXT + 1) })).toMatchObject({ ok: false });
    expect(postNote(root, run, { task: "T001", files: ["a,b.ts"], text: "x" })).toMatchObject({ ok: false });
    expect(postNote(root, run, { task: "T001", files: ["a|b.ts"], text: "x" })).toMatchObject({ ok: false });
    expect(readNotes(root, run)).toEqual([]);
  });

  it("025:FR-016: parseNote accepts only the form, and formatNote round-trips", () => {
    expect(parseNote("T001 | a.ts | hello")).toEqual({ task: "T001", files: ["a.ts"], text: "hello" });
    expect(parseNote("T001 | - | hello")).toEqual({ task: "T001", files: [], text: "hello" });
    for (const bad of ["hello", "T001 hello", "T001 | a.ts", "T001 |  | x", "t001 | - | x", "T001 | a.ts, | x"]) expect(parseNote(bad), bad).toBeNull();
    const n = { task: "T009", files: ["x.ts", "y.ts"], text: "ok" };
    expect(parseNote(formatNote(n))).toEqual(n);
  });

  it("025:FR-016: malformed lines already in the log are ignored when reading", () => {
    const { root, run } = setup();
    postNote(root, run, { task: "T001", files: [], text: "good" });
    expect(readNotes(root, run)).toHaveLength(1);
  });
});

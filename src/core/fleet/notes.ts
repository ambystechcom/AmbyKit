import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { withLock } from "./lock.js";
import { runDir } from "./runs.js";

/**
 * The notes board (feature 025, US-4): `.amby/fleet/<run>/notes.log`, one line per note,
 * `T### | <comma-separated files or -> | <text>`. This is the only notes file and format; a line that does
 * not match is refused (FR-016). 019's `fleet note` wraps `postNote`.
 */

export interface Note {
  task: string;
  files: string[];
  text: string;
}

export const NOTE_MAX_TEXT = 500;
const TASK = /^T\d+$/;

export function notesPath(root: string, run: string): string {
  return join(runDir(root, run), "notes.log");
}

/** One note as its line. */
export function formatNote(n: Note): string {
  return `${n.task} | ${n.files.length ? n.files.join(", ") : "-"} | ${n.text}`;
}

/** Parse one line; null when it is not in the form. */
export function parseNote(line: string): Note | null {
  const m = /^(T\d+) \| ([^|\n]+?) \| (.+)$/.exec(line);
  if (!m) return null;
  const files = m[2] === "-" ? [] : m[2]!.split(",").map((f) => f.trim());
  if (files.some((f) => f === "")) return null;
  return { task: m[1]!, files, text: m[3]! };
}

export type NoteResult = { ok: true; line: string } | { ok: false; error: string };

/** Validate and append one note. Refuses a missing or malformed task id, empty text and any newline. */
export function postNote(root: string, run: string, input: { task: string; files: string[]; text: string }): NoteResult {
  if (!TASK.test(input.task)) return { ok: false, error: `a note needs a task id like T012, got '${input.task}'` };
  const text = input.text;
  if (/[\r\n]/.test(text) || input.files.some((f) => /[\r\n|,]/.test(f))) return { ok: false, error: "a note is one line: no newline in the text, and no newline, comma or | in a file name" };
  if (text.trim() === "") return { ok: false, error: "a note needs some text" };
  if (text.length > NOTE_MAX_TEXT) return { ok: false, error: `a note is at most ${NOTE_MAX_TEXT} characters (got ${text.length})` };
  const files = input.files.map((f) => f.trim()).filter(Boolean);
  const line = formatNote({ task: input.task, files, text: text.trim() });
  if (!parseNote(line)) return { ok: false, error: "that note is not in the form `T### | files | text`" };
  const path = notesPath(root, run);
  const locked = withLock(root, `notes-${run}`, () => {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, line + "\n", "utf8");
  });
  return locked.ok ? { ok: true, line } : { ok: false, error: locked.warning };
}

/** Every well-formed note, oldest first; malformed lines are ignored. */
export function readNotes(root: string, run: string): Note[] {
  const path = notesPath(root, run);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map(parseNote)
    .filter((n): n is Note => n !== null);
}

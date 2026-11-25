import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { main } from "../../src/cli/main.js";

/**
 * 034:FR-002 — "Upgrade a 1.x project to 2.0" uses only documented commands: every `ambykit <command>` in it is a registered
 * command and every flag is documented for that command in `docs/cli-reference.md`; every link to another section of the guide
 * resolves; and the guide names each skip reason of `migrate` (the section links the skip table, which holds them all).
 */
const root = resolve(__dirname, "..", "..");
const guide = readFileSync(resolve(root, "docs", "migration.md"), "utf8").replace(/\r\n/g, "\n");
const reference = readFileSync(resolve(root, "docs", "cli-reference.md"), "utf8").replace(/\r\n/g, "\n");

function section(text: string, heading: string): string {
  const at = text.indexOf(`\n## ${heading}\n`);
  expect(at, heading).toBeGreaterThanOrEqual(0);
  const rest = text.slice(at + 1);
  const end = rest.slice(3).search(/\n## /);
  return end < 0 ? rest : rest.slice(0, end + 3);
}

const upgrade = section(guide, "Upgrade a 1.x project to 2.0");
/** GitHub's heading anchor: lowercase, spaces to dashes, punctuation dropped. */
const slug = (h: string) => h.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s/g, "-");

let commands: string[] = [];
beforeAll(async () => {
  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void lines.push(a.join(" ")));
  await main(["--help"]);
  spy.mockRestore();
  commands = lines.join("\n").split("\n").map((l) => /^ {2}([a-z]+) {2,}/.exec(l)?.[1]).filter((c): c is string => !!c);
});
afterAll(() => vi.restoreAllMocks());

/** Every `ambykit …` invocation in the section, from code blocks and inline code. */
function invocations(): string[][] {
  const found: string[][] = [];
  for (const m of upgrade.matchAll(/```bash\n([\s\S]*?)```/g)) for (const line of m[1]!.split("\n")) if (line.trim().startsWith("ambykit")) found.push(line.trim().split(/\s+/));
  for (const m of upgrade.matchAll(/`(ambykit [^`]+)`/g)) found.push(m[1]!.trim().split(/\s+/));
  return found;
}

describe("upgrade guide (034, US-1)", () => {
  it("034:FR-002: the upgrade section is the first section of the guide", () => {
    expect(guide.indexOf("\n## Upgrade a 1.x project to 2.0\n")).toBe(guide.indexOf("\n## "));
  });

  it("034:FR-002: every ambykit command in the upgrade section is registered", () => {
    expect(commands).toContain("migrate");
    const used = invocations();
    expect(used.length).toBeGreaterThanOrEqual(6);
    for (const words of used) {
      const name = words[1]!;
      if (name.startsWith("--")) expect(["--version", "--help"], words.join(" ")).toContain(name);
      else expect(commands, words.join(" ")).toContain(name);
    }
  });

  it("034:FR-002: every flag is documented for its command in the CLI reference", () => {
    for (const words of invocations()) {
      const name = words[1]!;
      if (name.startsWith("--")) continue;
      const heading = reference.split("\n").findIndex((l) => l.startsWith(`## \`ambykit ${name}`));
      expect(heading, `cli-reference has a section for ${name}`).toBeGreaterThanOrEqual(0);
      const lines = reference.split("\n").slice(heading);
      const end = lines.slice(1).findIndex((l) => l.startsWith("## "));
      const body = lines.slice(0, end < 0 ? undefined : end + 1).join("\n");
      for (const flag of words.slice(2).filter((w) => w.startsWith("--"))) expect(body, `${name} ${flag}`).toContain(flag);
    }
  });

  it("034:FR-002: every in-page link of the upgrade section resolves to a heading of the guide", () => {
    const anchors = new Set(guide.split("\n").filter((l) => /^#{2,3} /.test(l)).map((l) => slug(l.replace(/^#+ /, ""))));
    const links = [...upgrade.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]!);
    expect(links.length).toBeGreaterThanOrEqual(5);
    for (const l of links) expect(anchors, l).toContain(l);
  });

  it("034:FR-002: the order is Node 22, upgrade readers, dry run, migrate, review, Antigravity, run and plugin API, pinned 1.x CI", () => {
    const order = ["Node 22", "Upgrade every tool", "ambykit migrate --dry-run", "ambykit migrate\n", "ambykit analyze", "Antigravity", "plugin API", "--dual-write"];
    const at = order.map((s) => upgrade.indexOf(s));
    for (let i = 0; i < at.length; i++) expect(at[i], order[i]).toBeGreaterThanOrEqual(0);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("034:FR-002: the guide names each skip reason of migrate, and the upgrade section sends the reader to them", () => {
    expect(upgrade).toContain("(#when-it-skips-a-file)");
    const table = section(guide, "It is safe by construction");
    for (const reason of ["inside a sentence", "inside a code fence", "Two `status`", "conflicts with a priority bullet", "Two `**Verify:**` lines", "task id repeated", "Mixed line endings", "byte-order mark", "not closed"]) {
      expect(table, reason).toContain(reason);
    }
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 034:FR-007, FR-008, FR-009 — the release-process statements of the spec, checked against the workflow files as text
 * (Principle 4: a statement about the release process is checked, not remembered).
 */
const wf = (name: string) => readFileSync(resolve(__dirname, "..", "..", ".github", "workflows", name), "utf8").replace(/\r\n/g, "\n");
const ci = wf("ci.yml");
const publish = wf("publish.yml");

describe("CI (034, US-4)", () => {
  it("034:FR-007: the build matrix is Linux, macOS and Windows on Node 22", () => {
    expect(ci).toMatch(/os: \[ubuntu-latest, windows-latest, macos-latest\]/);
    const versions = [...ci.matchAll(/node-version: (\S+)/g)].map((m) => m[1]);
    expect(versions[0]).toBe("22");
    expect(ci).not.toMatch(/node-version: \[/); // no node-version matrix
  });

  it("034:FR-007: Node 20 appears exactly once, as the negative check of the required-version message (D-1)", () => {
    const versions = [...ci.matchAll(/node-version: (\S+)/g)].map((m) => m[1]);
    expect(versions).toEqual(["22", "20"]);
    const after20 = ci.slice(ci.indexOf("node-version: 20"));
    // Nothing that builds, tests or publishes runs after Node 20 is set up: only the one check step.
    expect(after20).not.toMatch(/npm (ci|test|run|publish)/);
    expect(after20.match(/- name:/g)).toHaveLength(1);
    expect(after20).toContain('grep -q "Node.js 22 or newer"');
    expect(after20).toContain('test "$code" -ne 0');
  });
});

describe("publish (034, US-4, US-6)", () => {
  it("034:FR-008: the tag must equal the package version", () => {
    expect(publish).toContain("name: Verify tag matches package version");
    expect(publish).toMatch(/TAG=\$\{GITHUB_REF_NAME#v\}[\s\S]*"\$PKG" != "\$TAG"/);
  });

  it("034:FR-008: trusted publishing with provenance and no stored token", () => {
    expect(publish).toMatch(/permissions:[\s\S]*id-token: write/);
    const code = publish.split("\n").filter((l) => !l.trimStart().startsWith("#")).join("\n");
    expect(code).not.toMatch(/NODE_AUTH_TOKEN|NPM_TOKEN|secrets\./);
    expect(publish).toContain("environment: Prod");
  });

  it("034:FR-008: plugin tags are ignored by the core workflow", () => {
    expect(publish).toContain("!startsWith(github.event.release.tag_name, 'plugin/')");
  });

  it("034:FR-009: the dist-tag comes from release-tag.mjs and is passed to npm publish", () => {
    expect(publish).toMatch(/id: disttag\n\s+run: echo "tag=\$\(node scripts\/release-tag\.mjs\)" >> "\$GITHUB_OUTPUT"/);
    expect(publish).toContain('npm publish --access public --tag "${{ steps.disttag.outputs.tag }}"');
    expect(publish.match(/npm publish/g)).toHaveLength(1);
  });

  it("034:FR-004: the release gate runs before publishing", () => {
    const gate = publish.indexOf("node scripts/release-gate.mjs");
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(publish.indexOf("npm publish --access"));
    expect(gate).toBeGreaterThan(publish.indexOf("name: Build"));
  });
});

describe("specs-only changes (034, US-4)", () => {
  const specs = wf("specs.yml");
  const on = (w: string): string => w.slice(w.indexOf("\non:"), w.indexOf("\npermissions:") > 0 ? w.indexOf("\npermissions:") : w.indexOf("\njobs:"));

  it("034:FR-007: the full matrix skips a change that touches only specs/, on push and on pull requests", () => {
    expect(on(ci)).toMatch(/push:\n\s+branches: \[main\]\n\s+paths-ignore:\n\s+- "specs\/\*\*"/);
    expect(on(ci)).toMatch(/pull_request:\n\s+paths-ignore:\n\s+- "specs\/\*\*"/);
  });

  it("034:FR-007: such a change still builds, runs analyze and the full test suite on Linux and Node 22", () => {
    expect(on(specs)).toMatch(/push:\n\s+branches: \[main\]\n\s+paths:\n\s+- "specs\/\*\*"/);
    expect(on(specs)).toMatch(/pull_request:\n\s+paths:\n\s+- "specs\/\*\*"/);
    expect(specs).toContain("runs-on: ubuntu-latest");
    expect(specs).toContain("node-version: 22");
    for (const step of ["npm ci", "npm run build", "dist/cli/index.js analyze", "npm test"]) expect(specs).toContain(step);
  });
});

import { describe, expect, it } from "vitest";
import { resolveIconMode } from "../../src/cli/ui/icons.js";

const uni = { unicode: true };
const plain = { unicode: false };

describe("resolveIconMode (feature 029, FR-011)", () => {
  it("029:FR-011: flag beats env beats config beats auto", () => {
    expect(resolveIconMode({ flag: "ascii", env: "nerd", config: "unicode", caps: uni })).toEqual({ mode: "ascii", source: "flag" });
    expect(resolveIconMode({ env: "nerd", config: "ascii", caps: uni })).toEqual({ mode: "nerd", source: "env" });
    expect(resolveIconMode({ config: "nerd", caps: uni })).toEqual({ mode: "nerd", source: "config" });
    expect(resolveIconMode({ caps: uni })).toEqual({ mode: "unicode", source: "auto" });
  });

  it("029:FR-011: auto and an absent value fall through to the next level", () => {
    expect(resolveIconMode({ flag: undefined, env: undefined, config: "auto", caps: uni })).toEqual({ mode: "unicode", source: "auto" });
    expect(resolveIconMode({ env: "auto", config: "nerd", caps: uni })).toEqual({ mode: "nerd", source: "config" });
  });

  it("029:FR-011: an unrecognised env or config value is ignored, never an error", () => {
    expect(resolveIconMode({ env: "emoji", config: "ascii", caps: uni })).toEqual({ mode: "ascii", source: "config" });
    expect(resolveIconMode({ config: "bogus", caps: uni })).toEqual({ mode: "unicode", source: "auto" });
  });

  it("029:FR-011: values are matched case-insensitively and trimmed", () => {
    expect(resolveIconMode({ env: " NERD ", caps: uni }).mode).toBe("nerd");
  });

  it("029:FR-011: a terminal without unicode (non-TTY) is always ASCII, whatever was asked", () => {
    for (const flag of ["nerd", "unicode", "ascii", undefined]) {
      expect(resolveIconMode({ flag, env: "nerd", config: "nerd", caps: plain }).mode).toBe("ascii");
    }
  });

  it("029:FR-011: auto never picks Nerd Font glyphs (they cannot be detected)", () => {
    expect(resolveIconMode({ caps: uni }).mode).not.toBe("nerd");
  });

  it("029:FR-010: the full precedence matrix over every level and value yields one of the three modes", () => {
    const vals = [undefined, "nerd", "unicode", "ascii", "auto", "x"];
    for (const flag of vals) for (const env of vals) for (const config of vals) for (const caps of [uni, plain]) {
      expect(["nerd", "unicode", "ascii"]).toContain(resolveIconMode({ flag, env, config, caps }).mode);
    }
  });
});

import type { Overview } from "../../../core/overview-types.js";
import { paintToken } from "../theme.js";
import type { Capabilities } from "../types.js";
import { glyph, panel } from "./panel.js";
import { TOKENS } from "./tokens.js";

/** "Up next" panel (feature 014, ui.md US-4): the next ready tasks, or the completion line. */

type UpNext = Overview["upNext"];

const CONVERGE = "/amby.converge";

function upNextLines(caps: Capabilities, upNext: UpNext, cursor?: number): string[] {
  const u = TOKENS.component["up-next-item"];
  const muted = TOKENS.semantic.color.muted;
  if (upNext.allDone) {
    const dash = caps.unicode ? " — " : " - ";
    return [
      paintToken(caps, muted, `All tasks done${dash}run `) +
        paintToken(caps, TOKENS.component["hint-line"]["command-fg"], CONVERGE) +
        paintToken(caps, muted, "."),
    ];
  }
  if (upNext.items.length === 0) return [paintToken(caps, muted, "No ready tasks: every open task is held in Attention.")];
  const keyWidth = Math.max(...upNext.items.map((i) => (i.storyKey ?? "unassigned").length));
  return upNext.items.map((item, i) => {
    const mark = cursor === undefined ? "" : i === cursor ? `${paintToken(caps, TOKENS.component.row["cursor-fg"], glyph(caps, TOKENS.component.row.cursor))} ` : "  ";
    return (
      mark +
      `${paintToken(caps, u["task-id-fg"], item.taskId)}  ` +
      `${paintToken(caps, u["story-id-fg"], (item.storyKey ?? "unassigned").padEnd(keyWidth))}  ` +
      paintToken(caps, u["text-fg"], item.description)
    );
  });
}

/** `UP NEXT · 5 of 17`, or plain `UP NEXT` once everything is done. */
export function upNextTitle(caps: Capabilities, upNext: UpNext): string {
  if (upNext.allDone) return "UP NEXT";
  return `UP NEXT${caps.unicode ? " · " : " - "}${upNext.items.length} of ${upNext.eligible}`;
}

export function upNextPanel(
  caps: Capabilities,
  upNext: UpNext,
  width: number,
  opts: { focused?: boolean; cursor?: number } = {},
): string[] {
  return panel(caps, { title: upNextTitle(caps, upNext), width, focused: opts.focused }, upNextLines(caps, upNext, opts.cursor));
}

/** Plain layout: `UP NEXT (5 of 17)` then indented task lines. */
export function plainUpNext(caps: Capabilities, upNext: UpNext): string[] {
  const title = upNext.allDone ? "UP NEXT" : `UP NEXT (${upNext.items.length} of ${upNext.eligible})`;
  return [title, ...upNextLines(caps, upNext).map((l) => `  ${l}`)];
}

// Fenced yaml blocks of a tasks.md (026 `scanBlocks`). A block is ours only if it has a top-level `files` or `verify`
// key (026:D-10); any other yaml fence is documentation and is ignored.
export const FENCE_OPEN = /^(\s*)(`{3,})\s*yaml\s*$/;
const FENCE_CLOSE = /^\s*(`{3,})\s*$/;

export interface Block {
  /** 1-based line of the opening and closing fence. */
  start: number;
  end: number;
  indent: string;
  /** Block body, de-indented. */
  src: string;
  ours: boolean;
  /** Number of `## ` headings seen up to the block (1-based phase ordinal; 0 before the first heading). */
  ordinal: number;
  /** The task id of the task line the block directly follows, or null. */
  followsTask: string | null;
  unclosed: boolean;
}

export function scanBlocks(text: string): { lines: string[]; blocks: Block[] } {
  const lines = text.split(/\r?\n/);
  const taskRe = /^\s*-\s*\[([ xX])\]\s*\[(T\d+)\]/;
  const blocks: Block[] = [];
  let ordinal = 0;
  let lastTask: string | null = null;
  let sinceTask = 0; // non-blank, non-block lines since the last task line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^##\s+/.test(line)) {
      ordinal += 1;
      lastTask = null;
      continue;
    }
    const o = FENCE_OPEN.exec(line);
    if (o) {
      const indent = o[1] ?? "";
      const ticks = (o[2] ?? "").length;
      let j = i + 1;
      while (j < lines.length) {
        const c = FENCE_CLOSE.exec(lines[j] ?? "");
        if (c && (c[1] ?? "").length >= ticks) break;
        j++;
      }
      const src = lines
        .slice(i + 1, j)
        .map((l) => (l.startsWith(indent) ? l.slice(indent.length) : l))
        .join("\n");
      blocks.push({
        start: i + 1,
        end: j + 1,
        indent,
        src,
        ours: /^(files|verify):/m.test(src),
        ordinal,
        followsTask: lastTask && sinceTask === 0 ? lastTask : null,
        unclosed: j >= lines.length,
      });
      i = j;
      continue;
    }
    const t = taskRe.exec(line);
    if (t) {
      lastTask = t[2] ?? null;
      sinceTask = 0;
      continue;
    }
    if (line.trim() !== "") sinceTask += 1;
  }
  return { lines, blocks };
}

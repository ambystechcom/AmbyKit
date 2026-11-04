/**
 * A strict parser for the TOML subset the Gemini/LLxprt emitters write (feature 016): `#` comment
 * lines and `key = <string>` where the string is basic (`"…"`), multi-line basic (`"""…"""`) or
 * multi-line literal (`'''…'''`). Test-only — AmbyKit never parses TOML. Anything else throws, so a
 * malformed emission fails loudly instead of being half-read.
 */
export function parseMiniToml(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  const rest = (): string => text.slice(i);
  while (i < text.length) {
    if (text[i] === "\n") {
      i++;
      continue;
    }
    if (text[i] === "#") {
      i = text.indexOf("\n", i);
      if (i === -1) break;
      continue;
    }
    const m = /^([A-Za-z0-9_-]+) = /.exec(rest());
    if (!m) throw new Error(`Unexpected TOML at offset ${i}: ${JSON.stringify(rest().slice(0, 40))}`);
    i += m[0].length;
    if (rest().startsWith("'''")) {
      i += 3;
      if (text[i] === "\n") i++; // a newline right after the opening delimiter is trimmed
      const end = text.indexOf("'''", i);
      if (end === -1) throw new Error("Unterminated ''' string");
      out[m[1]!] = text.slice(i, end);
      i = end + 3;
    } else if (rest().startsWith('"""')) {
      i += 3;
      if (text[i] === "\n") i++;
      const [value, next] = readBasic(text, i, true);
      out[m[1]!] = value;
      i = next;
    } else if (text[i] === '"') {
      const [value, next] = readBasic(text, i + 1, false);
      out[m[1]!] = value;
      i = next;
    } else {
      throw new Error(`Unsupported TOML value at offset ${i}`);
    }
    if (text[i] !== undefined && text[i] !== "\n") throw new Error(`Trailing content after value at offset ${i}`);
  }
  return out;
}

const SIMPLE: Record<string, string> = { b: "\b", t: "\t", n: "\n", f: "\f", r: "\r", '"': '"', "\\": "\\" };

function readBasic(text: string, start: number, multiline: boolean): [string, number] {
  let i = start;
  let value = "";
  for (;;) {
    const ch = text[i];
    if (ch === undefined) throw new Error("Unterminated basic string");
    if (multiline && text.startsWith('"""', i)) return [value, i + 3];
    if (!multiline && ch === '"') return [value, i + 1];
    if (!multiline && ch === "\n") throw new Error("Newline in a single-line basic string");
    if (ch === "\\") {
      const esc = text[i + 1]!;
      if (esc === "u") {
        value += String.fromCodePoint(parseInt(text.slice(i + 2, i + 6), 16));
        i += 6;
      } else if (SIMPLE[esc] !== undefined) {
        value += SIMPLE[esc];
        i += 2;
      } else {
        throw new Error(`Invalid escape \\${esc}`);
      }
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code < 0x20 && ch !== "\n" && ch !== "\t") throw new Error(`Unescaped control character U+${code.toString(16)}`);
    value += ch;
    i++;
  }
}

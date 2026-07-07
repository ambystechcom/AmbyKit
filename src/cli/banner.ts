const ART = [
  "  ▄▀█ █▀▄▀█ █▄▄ █▄█ █▄▀ █ ▀█▀",
  "  █▀█ █░▀░█ █▄█ ░█░ █░█ █ ░█░",
];

const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function useColor(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env["NO_COLOR"];
}

/** The AmbyKit ASCII banner (with a tagline), colorized when the terminal supports it. */
export function banner(): string {
  const color = useColor();
  const art = ART.map((l) => (color ? `${CYAN}${l}${RESET}` : l)).join("\n");
  const tagline = "  Spec-Driven Development for AI coding assistants";
  const tag = color ? `${DIM}${tagline}${RESET}` : tagline;
  return `\n${art}\n${tag}\n`;
}

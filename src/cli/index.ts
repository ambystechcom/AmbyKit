#!/usr/bin/env node
// The `bin` entry (030:FR-015). It checks the Node version BEFORE the CLI's module graph is loaded: on an older Node a
// newer-syntax import would fail with a SyntaxError that hides the message, so the CLI proper lives in `main.ts` and is
// imported dynamically only once the check has passed. This file imports nothing but `node-guard.ts` (itself import-free).
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkNode } from "./node-guard.js";

/** Run the CLI. A lazy wrapper so importing this module (tests, tools) never loads the whole command graph up front. */
export async function main(argv: string[]): Promise<number> {
  const mod = await import("./main.js");
  return mod.main(argv);
}

// Run only when invoked as the CLI entry point — importing this module (e.g. in tests) must not
// execute the CLI. Resolve real paths so a symlinked/global bin still matches.
function isEntryPoint(): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(invoked);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  const problem = checkNode(process.versions.node);
  if (problem) {
    console.error(problem);
    process.exitCode = 1;
  } else {
    main(process.argv.slice(2))
      .then((code) => {
        process.exitCode = code;
      })
      .catch((err) => {
        console.error(err);
        process.exitCode = 1;
      });
  }
}

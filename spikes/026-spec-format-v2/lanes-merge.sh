#!/usr/bin/env bash
# T041 entry point: the experiment itself is lanes-merge.mjs (needs the built dist/ for mergeCheckoffs).
# It only ever creates and deletes repositories under the OS temp directory.
set -euo pipefail
cd "$(dirname "$0")/../.."
node spikes/026-spec-format-v2/lanes-merge.mjs

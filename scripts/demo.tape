# AmbyKit README demo — reproducible terminal recording.
#
# RECORD THIS ON macOS, with zsh. The tape uses the real `tree` and `head`, so the commands on
# camera are exactly what a viewer runs — nothing is aliased or stood in for.
#
# Prerequisites:
#   brew install vhs tree
#
# Run from the repo root:
#   node scripts/demo-reset.mjs     # start from a clean example/
#   vhs scripts/demo.tape           # writes public/demo.gif
#
# Records against example/ (the TaskFlow app) so AmbyKit lands in a project that already exists.
# Everything it generates there is gitignored; demo-reset.mjs puts it back between takes.
#
# ONE GIF SERVES EVERY READER.
# GitHub markdown cannot detect the visitor's OS — no JS, no OS media query, and images are proxied
# through camo, so one cached copy is served to everyone. There is therefore no point recording a
# per-platform take: keep every visible command to ones that read correctly to a macOS, Linux, or
# Windows viewer. `npx`, `tree`, and `head` all qualify. Shell-specific setup (the prompt, `clear`)
# is wrapped in Hide/Show so it never appears on screen.
#
# Two things that have bitten this tape before:
#   * Do not drive the tool picker with blind Space/Down keystrokes — a picker change silently
#     records the wrong selection. `--tools=… --yes` is deterministic.
#   * Do not add a command that only exists in one shell. If you change a visible line, check it
#     runs unmodified in zsh and bash.
#
# The money shot is the multi-tool emit: one init, and .claude/ + .cursor/ + .github/ all appear.
# Keep the whole thing under ~30s and ~5 MB — the README embeds it above the fold.

Output public/demo.gif

Set Shell         zsh
Set FontSize      18
Set Width         1200
Set Height        700
Set Padding       20
Set Theme         "Catppuccin Mocha"
Set TypingSpeed   35ms
Set PlaybackSpeed 1.0

# --- setup (hidden) -------------------------------------------------------
Hide
Type "cd example" Enter
# A stylized prompt for visual punch: the project name in bold sky-blue, then a mauve→pink
# gradient triple-chevron. Uses only zsh %F{…} color escapes and the ❯ glyph already proven to
# render in VHS's font (no Nerd Font / powerline glyphs, which would tofu-box). RPROMPT is cleared
# so no right-hand git status drifts into frame.
Type "export PROMPT='%F{117}%Btaskflow%b%f %F{141}❯%F{176}❯%F{212}❯%f '" Enter
Type "export RPROMPT=''" Enter
# Pre-warm the npx cache. Without this the visible `npx … init` spends ~10s downloading and the
# GIF is mostly dead air. The command on camera is still the real one — this only skips the
# first-run download, exactly as it would be skipped for anyone who has run it before.
Type "npx --yes @ambystech/ambykit --version >/dev/null 2>&1" Enter
Sleep 20s
Type "clear" Enter
Sleep 1s
Show

# --- an ordinary project, before AmbyKit ---------------------------------
Sleep 600ms
Type "tree -L 2"
Sleep 300ms
Enter
Sleep 2500ms

# --- one init, three assistants ------------------------------------------
Hide
Type "clear" Enter
Sleep 250ms
Show
Type "npx @ambystech/ambykit init --tools=claude,cursor,copilot --yes"
Sleep 400ms
Enter
Sleep 6s

# --- what it emitted: the money shot -------------------------------------
# --filelimit keeps the frame short while still naming the file counts, which is the whole point:
#   commands [11 entries exceeds filelimit, not opening dir]
Hide
Type "clear" Enter
Sleep 250ms
Show
Type "tree -L 2 --filelimit 5 .claude .cursor .github"
Sleep 300ms
Enter
Sleep 4s

# --- the design phase, the differentiator --------------------------------
Hide
Type "clear" Enter
Sleep 250ms
Show
Type "head -16 .claude/commands/amby.design.md"
Sleep 300ms
Enter
Sleep 4s

Sleep 1500ms

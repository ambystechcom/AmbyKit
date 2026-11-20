# Runner verification records

A runner (`RUNNERS` in `src/core/runners.ts`) may be marked `verified: true` only when this folder holds a record of a live check
for **every operating system in its `verifiedOn` list** (033 FR-004, Principle 4). The file is named `<runner id>-<os>.md` with `<os>`
one of `linux`, `macos` or `windows` (`verifiedOn` uses Node's `linux`, `darwin` and `win32`). `test/core/runner-records.test.ts` fails
when a verified runner has a missing or incomplete record.

A record is a person's note of what was seen on a real install, in this shape (each line is `- **Label:** value`, none empty):

```
# claude on windows

- **Runner:** claude
- **OS:** windows
- **Assistant version:** 1.2.3
- **Invocation:** the exact command, for example `claude -p --model <id>` (with the .cmd shim if that is how it installs)
- **Prompt delivery:** stdin | file | argument, as the check showed
- **Exit behaviour:** what exit code a finished turn and a failed one gave
- **Usage reported:** yes | no (and where it appears)
- **Checked by:** name, date
```

`verifiedVersion` is the **Assistant version** above and `verifiedRange` is the semver range the person is willing to vouch for
(for example `>=1.2.0 <2.0.0`); a version outside it is reported unverified. Nothing here is written by a tool: these are the
person's tasks T063 and T064 of spec 033. Until a record exists, the runner stays `verified: false` and is not runnable by default.

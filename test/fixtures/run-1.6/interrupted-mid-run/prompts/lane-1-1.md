You are the worker of lane lane-1-1 of 028-ambykit-run (run 028-ambykit-run.1), phase 1. Build only these tasks, in order, and check each off in tasks.md: T001, T003.
Read: @specs/028-ambykit-run/spec.md @specs/028-ambykit-run/tasks.md.
Edit only the files you own: src/f1.ts, src/f3.ts.
Report: ambykit activity 028-ambykit-run --phase=implement --task=T### --lane=lane-1-1 --state=<working|waiting|blocked|done> --run=028-ambykit-run.1; then read your directive with: ambykit fleet directive 028-ambykit-run lane-1-1 --run=028-ambykit-run.1.
Report at the start of a task, at the end of a task, and whenever you are blocked or waiting. Never report on a timer and never report progress. The reply carries a directive: continue, pause or stop. On pause or stop, finish the task you are on, then obey it at your next report: do not start another task.

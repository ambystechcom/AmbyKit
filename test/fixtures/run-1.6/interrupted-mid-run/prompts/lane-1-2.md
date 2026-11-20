You are the worker of lane lane-1-2 of 028-ambykit-run (run 028-ambykit-run.1), phase 1. Build only these tasks, in order, and check each off in tasks.md: T002, T004.
Read: @specs/028-ambykit-run/spec.md @specs/028-ambykit-run/tasks.md.
Edit only the files you own: src/f2.ts, src/f4.ts.
Report: ambykit activity 028-ambykit-run --phase=implement --task=T### --lane=lane-1-2 --state=<working|waiting|blocked|done> --run=028-ambykit-run.1; then read your directive with: ambykit fleet directive 028-ambykit-run lane-1-2 --run=028-ambykit-run.1.
Report at the start of a task, at the end of a task, and whenever you are blocked or waiting. Never report on a timer and never report progress. The reply carries a directive: continue, pause or stop. On pause or stop, finish the task you are on, then obey it at your next report: do not start another task.

import { describe, expect, it } from "vitest";
import { parseTasks } from "../../src/core/dashboard.js";
import { laneConflicts, planLanes } from "../../src/core/lanes.js";
import { phase, tasksMd, type TaskDef } from "../helpers/tasks-fixture.js";

describe("lane analysis performance (SC-005)", () => {
  it("handles a 200-task fixture in under 200 ms", () => {
    const mk = (offset: number): TaskDef[] =>
      Array.from({ length: 50 }, (_, i) => ({
        id: `T${String(offset + i).padStart(3, "0")}`,
        parallel: i % 2 === 0,
        paths: [`src/m${offset}/f${i}.ts`, `docs/d${offset}-${i}.md`],
      }));
    const tasks = parseTasks(tasksMd([1, 2, 3, 4].map((n) => phase(n, mk(n * 100)))));
    expect(tasks).toHaveLength(200);

    const t0 = performance.now();
    const conflicts = laneConflicts("015-parallel-lanes", tasks);
    const plan = planLanes("015-parallel-lanes", tasks, { phase: 1, lanes: 4 });
    const elapsed = performance.now() - t0;

    expect(conflicts).toEqual([]);
    expect(plan.status).toBe("planned");
    expect(elapsed).toBeLessThan(200);
  });
});

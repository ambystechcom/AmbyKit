// Tasks live in localStorage. No backend — this is a demo fixture, not a product.

const KEY = "taskflow.tasks";

export const COLUMNS = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "In progress" },
  { id: "done", label: "Done" },
];

const SEED = [
  { id: 1, title: "Sketch the board layout", column: "done" },
  { id: 2, title: "Persist tasks across reloads", column: "doing" },
  { id: 3, title: "Drag a card between columns", column: "todo" },
];

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : structuredClone(SEED);
  } catch {
    // Private windows and cleared site data both land here. Seed rather than break.
    return structuredClone(SEED);
  }
}

export function save(tasks) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks));
  } catch {
    // Nothing to do — the board still works for this session.
  }
}

export function add(tasks, title) {
  const id = tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;
  return [...tasks, { id, title, column: "todo" }];
}

export function moveTo(tasks, id, column) {
  return tasks.map((t) => (t.id === id ? { ...t, column } : t));
}

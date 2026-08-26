import { COLUMNS, add, load, moveTo, save } from "./store.mjs";

let tasks = load();

const board = document.getElementById("board");
const form = document.getElementById("new-task");
const input = document.getElementById("new-task-title");

function render() {
  board.replaceChildren(
    ...COLUMNS.map((col) => {
      const section = document.createElement("section");
      section.className = "column";

      const heading = document.createElement("h2");
      const inColumn = tasks.filter((t) => t.column === col.id);
      heading.textContent = `${col.label} (${inColumn.length})`;
      section.append(heading);

      for (const task of inColumn) {
        section.append(card(task));
      }
      return section;
    }),
  );
}

function card(task) {
  const el = document.createElement("article");
  el.className = "card";

  const title = document.createElement("p");
  title.textContent = task.title;
  el.append(title);

  const moves = document.createElement("div");
  moves.className = "moves";
  for (const col of COLUMNS) {
    if (col.id === task.column) continue;
    const button = document.createElement("button");
    button.textContent = col.label;
    button.addEventListener("click", () => {
      tasks = moveTo(tasks, task.id, col.id);
      save(tasks);
      render();
    });
    moves.append(button);
  }
  el.append(moves);

  return el;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = input.value.trim();
  if (!title) return;
  tasks = add(tasks, title);
  save(tasks);
  input.value = "";
  render();
});

render();

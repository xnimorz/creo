import { createApp, view, div, input, button, ul, li, span, HtmlRender, _, } from "creo";
import type { InputEventData, KeyEventData } from "creo";

type Todo = { id: number; title: string; done: boolean };

const TodoApp = view(({ use }) => {
  const items = use<Todo[]>([
    { id: 1, title: "Try Creo", done: true },
    { id: 2, title: "Build something", done: false },
  ]);
  let draft = "";

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    items.update((list) => [...list, { id: Date.now(), title, done: false }]);
    draft = "";
    const el = document.querySelector<HTMLInputElement>(".new-todo");
    if (el) el.value = "";
  };

  const toggle = (id: number) =>
    items.update((list) =>
      list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );

  const remove = (id: number) =>
    items.update((list) => list.filter((t) => t.id !== id));

  const onDraft = (e: InputEventData) => {
    draft = e.value;
  };

  const onKey = (e: KeyEventData) => {
    if (e.key === "Enter") add();
  };

  return {
    render() {
      div({ class: "todo" }, () => {
        div({ class: "row" }, () => {
          input({
            class: "new-todo",
            placeholder: "What needs doing?",
            on: { input: onDraft, keyDown: onKey },
          });
          button({ on: { click: add } }, "Add");
        });

        ul({ class: "list" }, () => {
          for (const t of items.get()) {
            li({ key: t.id, class: t.done ? "done" : "" }, () => {
              input({
                type: "checkbox",
                checked: t.done,
                on: { change: () => toggle(t.id) },
              });
              span({ class: "title" }, t.title);
              button(
                { class: "remove", on: { click: () => remove(t.id) } },
                "×",
              );
            });
          }
        });
      });
    },
  };
});

createApp(
  () => TodoApp(),
  new HtmlRender(document.getElementById("app")!),
).mount();

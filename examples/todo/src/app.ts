import { view } from "@/public/view";
import { _ } from "@/functional/maybe";
import { store } from "@/public/store";
import { div, text, button, input, span, h1 } from "@/public/primitives/primitives";
import type {
  InputEventData,
  KeyEventData,
  PointerEventData,
} from "@/public/primitives/primitives";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Todo = { id: number; text: string; done: boolean };
type DragInfo = {
  draggedId: number;
  dropIndex: number;
  x: number;
  y: number;
  /** Y of the grabbed item's center at drag start */
  originY: number;
  /** Approximate item height in px */
  itemH: number;
};

// ---------------------------------------------------------------------------
// Global store
// ---------------------------------------------------------------------------

let nextId = 4;

const todosStore = store.new<Todo[]>([
  { id: 1, text: "Learn Creo", done: false },
  { id: 2, text: "Build a todo app", done: true },
  { id: 3, text: "Ship it", done: false },
]);

// ---------------------------------------------------------------------------
// Composite wrapper: Card with header + slotted body
// ---------------------------------------------------------------------------

const Card = view<{ header: string }>(({ props, slot }) => ({
  render() {
    div({ class: "card" }, () => {
      div({ class: "card-header" }, () => {
        text(props().header);
      });
      div({ class: "card-body" }, slot);
    });
  },
}));

// ---------------------------------------------------------------------------
// Drag ghost — fixed-position clone that follows the pointer
// ---------------------------------------------------------------------------

const DragGhost = view<{ label: string; done: boolean; x: number; y: number }>(({ props }) => ({
  render() {
    const { label, done, x, y } = props();
    div(
      {
        class: "drag-ghost",
        style: `left:${x}px;top:${y}px`,
      },
      () => {
        span({ class: "drag-handle" }, () => { text("⠿"); });
        span({ class: "todo-check" }, () => { text(done ? "☑" : "☐"); });
        span({ class: "todo-text" }, () => { text(label); });
      },
    );
  },
}));

// ---------------------------------------------------------------------------
// TodoItem — display mode
// ---------------------------------------------------------------------------

const TodoDisplay = view<{
  todo: Todo;
  isDragged: boolean;
  dropEdge: "above" | "below" | false;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onDragStart: (e: PointerEventData) => void;
  onDrop: () => void;
}>(({ props }) => {
  const handleToggle = () => props().onToggle();
  const handleEdit = () => props().onEdit();
  const handleDelete = () => props().onDelete();
  const handleDragStart = (e: PointerEventData) => {
    e.preventDefault();
    props().onDragStart(e);
  };
  const handlePointerUp = () => props().onDrop();

  return {
    render() {
      const { todo, isDragged, dropEdge } = props();
      const cls = [
        "todo-item",
        todo.done ? "done" : "",
        isDragged ? "dragging" : "",
        dropEdge === "above" ? "drop-above" : "",
        dropEdge === "below" ? "drop-below" : "",
      ]
        .filter(Boolean)
        .join(" ");

      div(
        {
          class: cls,
          onPointerUp: handlePointerUp,
        },
        () => {
          span(
            { class: "drag-handle", onPointerDown: handleDragStart },
            () => { text("⠿"); },
          );
          span({ class: "todo-check", onClick: handleToggle }, () => {
            text(todo.done ? "☑" : "☐");
          });
          span({ class: "todo-text", onClick: handleEdit }, () => {
            text(todo.text);
          });
          span({ class: "todo-delete", onClick: handleDelete }, () => {
            text("×");
          });
        },
      );
    },
  };
});

// ---------------------------------------------------------------------------
// TodoItem — edit mode
// ---------------------------------------------------------------------------

const TodoEditor = view<{
  text: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}>(({ props }) => {
  let draft = props().text;
  let committed = false;

  const commit = () => {
    if (committed) return;
    committed = true;
    props().onSave(draft);
  };

  const handleInput = (e: InputEventData) => {
    draft = e.value;
  };
  const handleKeyDown = (e: KeyEventData) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") {
      committed = true;
      props().onCancel();
    }
  };
  const handleBlur = () => commit();

  return {
    render() {
      div({ class: "todo-item editing" }, () => {
        input({
          class: "edit-input",
          value: draft,
          autofocus: true,
          onInput: handleInput,
          onKeyDown: handleKeyDown,
          onBlur: handleBlur,
        });
      });
    },
  };
});

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export const App = view(({ use }) => {
  const todos = use(todosStore);
  let draft = "";

  const editingId = use<number | null>(null);
  const drag = use<DragInfo | null>(null);
  const hideCompleted = use(false);

  // -- Add ------------------------------------------------------------------

  const handleInput = (e: InputEventData) => {
    draft = e.value;
  };

  const addTodo = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    todos.update((list) => [
      ...list,
      { id: nextId++, text: trimmed, done: false },
    ]);
    draft = "";
  };

  const handleAddKeyDown = (e: KeyEventData) => {
    if (e.key === "Enter") addTodo();
  };

  // -- CRUD -----------------------------------------------------------------

  const toggle = (id: number) => {
    todos.update((list) =>
      list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  };

  const remove = (id: number) => {
    todos.update((list) => list.filter((t) => t.id !== id));
  };

  const saveEdit = (id: number, newText: string) => {
    const trimmed = newText.trim();
    if (trimmed) {
      const current = todos.get().find((t) => t.id === id);
      if (current && current.text !== trimmed) {
        todos.update((list) =>
          list.map((t) => (t.id === id ? { ...t, text: trimmed } : t)),
        );
      }
    }
    editingId.set(null);
  };

  const cancelEdit = () => {
    editingId.set(null);
  };

  const toggleHideCompleted = () => {
    hideCompleted.update((v) => !v);
  };

  // -- Drag & Drop ----------------------------------------------------------

  // Item height estimate (padding + font + border ≈ 41px).
  // Refined on first pointer-move from the actual drag delta.
  const ITEM_H = 41;

  const startDrag = (id: number, e: PointerEventData) => {
    if (hideCompleted.get()) return;
    const idx = todos.get().findIndex((t) => t.id === id);
    drag.set({
      draggedId: id,
      dropIndex: idx,
      x: e.x,
      y: e.y,
      originY: e.y,
      itemH: ITEM_H,
    });
  };

  const handlePointerMove = (e: PointerEventData) => {
    const d = drag.get();
    if (!d) return;
    const count = todos.get().length;
    const fromIdx = todos.get().findIndex((t) => t.id === d.draggedId);
    // How far the pointer moved from the grab point, in item-height units
    const delta = (e.y - d.originY) / d.itemH;
    let newIndex = Math.round(fromIdx + delta);
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= count) newIndex = count - 1;
    drag.set({ ...d, dropIndex: newIndex, x: e.x, y: e.y });
  };

  const drop = () => {
    const d = drag.get();
    if (!d) return;
    const list = todos.get();
    const fromIndex = list.findIndex((t) => t.id === d.draggedId);
    if (fromIndex === -1 || fromIndex === d.dropIndex) {
      drag.set(null);
      return;
    }
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(d.dropIndex, 0, moved!);
    todos.set(next);
    drag.set(null);
  };

  const cancelDrag = () => {
    if (drag.get()) drag.set(null);
  };

  // -- Render ---------------------------------------------------------------

  return {
    render() {
      const d = drag.get();

      div(
        {
          class: d ? "app dragging-active" : "app",
          onPointerMove: handlePointerMove,
          onPointerUp: cancelDrag,
        },
        () => {
          h1({}, () => {
            text("Todo App");
          });

          div({ class: "add-form" }, () => {
            input({
              class: "add-input",
              value: draft,
              placeholder: "What needs to be done?",
              onInput: handleInput,
              onKeyDown: handleAddKeyDown,
            });
            button({ class: "btn btn-primary", onClick: addTodo }, () => {
              text("Add");
            });
          });

          const list = todos.get();
          const editing = editingId.get();
          const hiding = hideCompleted.get();
          const visibleList = hiding ? list.filter((t) => !t.done) : list;

          div({ class: "filter-bar" }, () => {
            button(
              { class: "btn btn-filter", onClick: toggleHideCompleted },
              () => { text(hiding ? "Show completed" : "Hide completed"); },
            );
          });

          const doneCount = list.filter((t) => t.done).length;
          const headerText = hiding
            ? `${visibleList.length} item${visibleList.length !== 1 ? "s" : ""} (${doneCount} hidden)`
            : `${list.length} item${list.length !== 1 ? "s" : ""}`;

          Card({ header: headerText }, () => {
            if (visibleList.length === 0) {
              div({ class: "empty" }, () => {
                text(hiding ? "No active tasks!" : "Nothing to do!");
              });
            } else {
              for (let i = 0; i < visibleList.length; i++) {
                const todo = visibleList[i]!;
                if (editing === todo.id) {
                  TodoEditor({
                    key: todo.id,
                    text: todo.text,
                    onSave: (t: string) => saveEdit(todo.id, t),
                    onCancel: cancelEdit,
                  });
                } else {
                  const fromIdx = d ? list.findIndex((t) => t.id === d.draggedId) : -1;
                  let dropEdge: "above" | "below" | false = false;
                  if (d && d.draggedId !== todo.id && d.dropIndex === i) {
                    dropEdge = fromIdx < d.dropIndex ? "below" : "above";
                  }
                  TodoDisplay({
                    key: todo.id,
                    todo,
                    isDragged: d != null && d.draggedId === todo.id,
                    dropEdge,
                    onEdit: () => editingId.set(todo.id),
                    onToggle: () => toggle(todo.id),
                    onDelete: () => remove(todo.id),
                    onDragStart: (e: PointerEventData) => startDrag(todo.id, e),
                    onDrop: drop,
                  });
                }
              }
            }
          });

          // Floating ghost while dragging
          if (d) {
            const draggedTodo = list.find((t) => t.id === d.draggedId);
            if (draggedTodo) {
              DragGhost({
                label: draggedTodo.text,
                done: draggedTodo.done,
                x: d.x,
                y: d.y,
              });
            }
          }
        },
      );
    },
  };
});

import { view, store } from "creo";
import type {
  InputEventData,
  KeyEventData,
  PointerEventData,
} from "creo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Todo = { id: number; text: string; done: boolean };
type DragInfo = {
  draggedId: number;
  dropIndex: number;
  x: number;
  y: number;
  originY: number;
  itemH: number;
};

// ---------------------------------------------------------------------------
// Global store
// ---------------------------------------------------------------------------

let nextId = 4;

const todosStore = store.new<Todo[]>([
  { id: 1, text: "Learn Creo", done: false },
  { id: 2, text: "Try JSX in Creo", done: true },
  { id: 3, text: "Ship it", done: false },
]);

// ---------------------------------------------------------------------------
// Card — header + slotted body
// ---------------------------------------------------------------------------

const Card = view<{ header: string }>(({ props, slot }) => ({
  render: () => (
    <div class="card">
      <div class="card-header">{props().header}</div>
      <div class="card-body">{slot}</div>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Drag ghost
// ---------------------------------------------------------------------------

const DragGhost = view<{ label: string; done: boolean; x: number; y: number }>(
  ({ props }) => ({
    render() {
      const { label, done, x, y } = props();
      return (
        <div class="drag-ghost" style={`left:${x}px;top:${y}px`}>
          <span class="drag-handle">⠿</span>
          <span class="todo-check">{done ? "☑" : "☐"}</span>
          <span class="todo-text">{label}</span>
        </div>
      );
    },
  }),
);

// ---------------------------------------------------------------------------
// TodoItem — display mode
// ---------------------------------------------------------------------------

type TodoDisplayProps = {
  todo: Todo;
  isDragged: boolean;
  dropEdge: "above" | "below" | false;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onDragStart: (e: PointerEventData) => void;
  onDrop: () => void;
};

const TodoDisplay = view<TodoDisplayProps>(({ props }) => {
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

      return (
        <div class={cls} onPointerUp={handlePointerUp}>
          <span class="drag-handle" onPointerDown={handleDragStart}>⠿</span>
          <span class="todo-check" onClick={handleToggle}>
            {todo.done ? "☑" : "☐"}
          </span>
          <span class="todo-text" onClick={handleEdit}>{todo.text}</span>
          <span class="todo-delete" onClick={handleDelete}>×</span>
        </div>
      );
    },
  };
});

// ---------------------------------------------------------------------------
// TodoItem — edit mode
// ---------------------------------------------------------------------------

type TodoEditorProps = {
  text: string;
  onSave: (text: string) => void;
  onCancel: () => void;
};

const TodoEditor = view<TodoEditorProps>(({ props }) => {
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
    render: () => (
      <div class="todo-item editing">
        <input
          class="edit-input"
          value={draft}
          autofocus
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      </div>
    ),
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
      const list = todos.get();
      const editing = editingId.get();
      const hiding = hideCompleted.get();
      const visibleList = hiding ? list.filter((t) => !t.done) : list;

      const doneCount = list.filter((t) => t.done).length;
      const headerText = hiding
        ? `${visibleList.length} item${visibleList.length !== 1 ? "s" : ""} (${doneCount} hidden)`
        : `${list.length} item${list.length !== 1 ? "s" : ""}`;

      const fromIdx = d ? list.findIndex((t) => t.id === d.draggedId) : -1;

      const draggedTodo = d ? list.find((t) => t.id === d.draggedId) : undefined;

      return (
        <div
          class={d ? "app dragging-active" : "app"}
          onPointerMove={handlePointerMove}
          onPointerUp={cancelDrag}
        >
          <h1>JSX Todo App</h1>

          <div class="add-form">
            <input
              class="add-input"
              value={draft}
              placeholder="What needs to be done?"
              onInput={handleInput}
              onKeyDown={handleAddKeyDown}
            />
            <button class="btn btn-primary" onClick={addTodo}>Add</button>
          </div>

          <div class="filter-bar">
            <button class="btn btn-filter" onClick={toggleHideCompleted}>
              {hiding ? "Show completed" : "Hide completed"}
            </button>
          </div>

          <Card header={headerText}>
            {visibleList.length === 0 ? (
              <div class="empty">{hiding ? "No active tasks!" : "Nothing to do!"}</div>
            ) : (
              visibleList.map((todo, i) => {
                if (editing === todo.id) {
                  return (
                    <TodoEditor
                      key={todo.id}
                      text={todo.text}
                      onSave={(t: string) => saveEdit(todo.id, t)}
                      onCancel={cancelEdit}
                    />
                  );
                }
                let dropEdge: "above" | "below" | false = false;
                if (d && d.draggedId !== todo.id && d.dropIndex === i) {
                  dropEdge = fromIdx < d.dropIndex ? "below" : "above";
                }
                return (
                  <TodoDisplay
                    key={todo.id}
                    todo={todo}
                    isDragged={d != null && d.draggedId === todo.id}
                    dropEdge={dropEdge}
                    onEdit={() => editingId.set(todo.id)}
                    onToggle={() => toggle(todo.id)}
                    onDelete={() => remove(todo.id)}
                    onDragStart={(e: PointerEventData) => startDrag(todo.id, e)}
                    onDrop={drop}
                  />
                );
              })
            )}
          </Card>

          {d && draggedTodo ? (
            <DragGhost
              label={draggedTodo.text}
              done={draggedTodo.done}
              x={d.x}
              y={d.y}
            />
          ) : null}
        </div>
      );
    },
  };
});

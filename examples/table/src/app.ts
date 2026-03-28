import { view } from "@/public/view";
import { div, text, button, input } from "@/public/primitives/primitives";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Row = { id: string; cells: Record<string, string> };
type CellPos = { rowIdx: number; colIdx: number };

// ---------------------------------------------------------------------------
// Child views
// ---------------------------------------------------------------------------

const HeaderRow = view<{ columns: string[] }>((ctx) => ({
  render() {
    div({ class: "row header" }, () => {
      for (const col of ctx.props().columns) {
        div({ class: "cell header-cell", key: col }, () => text(col));
      }
    });
  },
}));

const EditableCell = view<{
  value: string;
  onSave: (value: string) => void;
  onDiscard: () => void;
}>((ctx) => {
  let current = ctx.props().value;

  const handleInput = (e: { value: string }) => {
    current = e.value;
  };

  const handleKeyDown = (e: { key: string; stopPropagation: () => void }) => {
    if (e.key === "Enter") {
      e.stopPropagation();
      ctx.props().onSave(current);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      ctx.props().onDiscard();
    }
  };

  const handleBlur = () => {
    ctx.props().onSave(current);
  };

  return {
    render() {
      input({
        class: "cell-input",
        value: ctx.props().value,
        autofocus: true,
        onInput: handleInput,
        onKeyDown: handleKeyDown,
        onBlur: handleBlur,
      });
    },
  };
});

const DisplayCell = view<{
  value: string;
  selected: boolean;
  onEdit: () => void;
  onSelect: () => void;
}>((ctx) => ({
  render() {
    div(
      {
        class: ctx.props().selected ? "cell selected" : "cell",
        onClick: () => ctx.props().onEdit(),
        onDblclick: () => ctx.props().onEdit(),
      },
      () => {
        text(ctx.props().value || "\u00A0");
      },
    );
  },
}));

// ---------------------------------------------------------------------------
// Root app view
// ---------------------------------------------------------------------------

let nextId = 1;

export const App = view(({ use }) => {
  const columns = use<string[]>(["A", "B", "C"]);
  const rows = use<Row[]>([
    { id: String(nextId++), cells: { A: "", B: "", C: "" } },
    { id: String(nextId++), cells: { A: "", B: "", C: "" } },
  ]);
  const selected = use<CellPos | null>(null);
  const editing = use<CellPos | null>(null);

  // -- Helpers --

  const addRow = () => {
    const id = String(nextId++);
    const cells: Record<string, string> = {};
    for (const c of columns.get()) cells[c] = "";
    rows.set([...rows.get(), { id, cells }]);
  };

  const addCol = () => {
    const next = String.fromCharCode(65 + columns.get().length);
    for (const r of rows.get()) r.cells[next] = "";
    columns.set([...columns.get(), next]);
    rows.set([...rows.get()]);
  };

  // -- Handlers --

  const refocusTable = () => {
    setTimeout(() => {
      (document.querySelector(".table") as HTMLElement)?.focus();
    }, 0);
  };

  const handleSave = (rowIdx: number, colIdx: number, val: string) => {
    const r = rows.get();
    const col = columns.get()[colIdx]!;
    r[rowIdx]!.cells[col] = val;
    rows.set([...r]);
    editing.set(null);
    selected.set({ rowIdx, colIdx });
    refocusTable();
  };

  const handleDiscard = () => {
    editing.set(null);
    refocusTable();
  };

  const handleTableKeyDown = (e: { key: string }) => {
    if (editing.get()) return;

    const sel = selected.get() ?? { rowIdx: 0, colIdx: 0 };
    const maxRow = rows.get().length - 1;
    const maxCol = columns.get().length - 1;

    switch (e.key) {
      case "ArrowUp":
        if (sel.rowIdx > 0) {
          selected.set({ rowIdx: sel.rowIdx - 1, colIdx: sel.colIdx });
        }
        break;
      case "ArrowDown":
        if (sel.rowIdx >= maxRow) {
          addRow();
        }
        selected.set({ rowIdx: sel.rowIdx + 1, colIdx: sel.colIdx });
        break;
      case "ArrowLeft":
        if (sel.colIdx > 0) {
          selected.set({ rowIdx: sel.rowIdx, colIdx: sel.colIdx - 1 });
        }
        break;
      case "ArrowRight":
        if (sel.colIdx >= maxCol) {
          addCol();
        }
        selected.set({ rowIdx: sel.rowIdx, colIdx: sel.colIdx + 1 });
        break;
      case "Enter":
        editing.set(sel);
        break;
    }
  };

  return {
    render() {
      div({ class: "toolbar" }, () => {
        button({ class: "btn", onClick: addRow }, () => {
          text("Add Row");
        });
        button({ class: "btn", onClick: addCol }, () => {
          text("Add Column");
        });
      });

      div(
        { class: "table", tabindex: 0, onKeyDown: handleTableKeyDown },
        () => {
          HeaderRow({ columns: columns.get() });

          const r = rows.get();
          const c = columns.get();
          const sel = selected.get();
          const ed = editing.get();

          for (let ri = 0; ri < r.length; ri++) {
            const row = r[ri]!;
            div({ class: "row", key: row.id }, () => {
              for (let ci = 0; ci < c.length; ci++) {
                const col = c[ci]!;
                const isSelected = sel?.rowIdx === ri && sel?.colIdx === ci;
                const isEditing = ed?.rowIdx === ri && ed?.colIdx === ci;

                if (isEditing) {
                  EditableCell({
                    key: `${row.id}-${col}`,
                    value: row.cells[col] ?? "",
                    onSave: (val: string) => handleSave(ri, ci, val),
                    onDiscard: handleDiscard,
                  });
                } else {
                  DisplayCell({
                    key: `${row.id}-${col}`,
                    value: row.cells[col] ?? "",
                    selected: isSelected,
                    onEdit: () => {
                      selected.set({ rowIdx: ri, colIdx: ci });
                      editing.set({ rowIdx: ri, colIdx: ci });
                    },
                    onSelect: () => {
                      selected.set({ rowIdx: ri, colIdx: ci });
                    },
                  });
                }
              }
            });
          }
        },
      );
    },
  };
});

import { view } from "@/public/view";
import {
  div,
  span,
  text,
  button,
  table,
  tbody,
  tr,
  td,
  a,
  h1,
} from "@/public/primitives/primitives";
import { _ } from "@/functional/maybe";

// ---------------------------------------------------------------------------
// Data generation
// ---------------------------------------------------------------------------

const random = (max: number) => Math.round(Math.random() * 1000) % max;

const A = [
  "pretty",
  "large",
  "big",
  "small",
  "tall",
  "short",
  "long",
  "handsome",
  "plain",
  "quaint",
  "clean",
  "elegant",
  "easy",
  "angry",
  "crazy",
  "helpful",
  "mushy",
  "odd",
  "unsightly",
  "adorable",
  "important",
  "inexpensive",
  "cheap",
  "expensive",
  "fancy",
];
const C = [
  "red",
  "yellow",
  "blue",
  "green",
  "pink",
  "brown",
  "purple",
  "brown",
  "white",
  "black",
  "orange",
];
const N = [
  "table",
  "chair",
  "house",
  "bbq",
  "desk",
  "car",
  "pony",
  "cookie",
  "sandwich",
  "burger",
  "pizza",
  "mouse",
  "keyboard",
];

let nextId = 1;

type RowData = { id: number; label: string };

const buildData = (count: number): RowData[] => {
  const data = new Array<RowData>(count);
  for (let i = 0; i < count; i++) {
    data[i] = {
      id: nextId++,
      label: `${A[random(A.length)]} ${C[random(C.length)]} ${N[random(N.length)]}`,
    };
  }
  return data;
};

// ---------------------------------------------------------------------------
// Row view
// ---------------------------------------------------------------------------

const Row = view<{
  item: RowData;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}>(({ props }) => ({
  update: {
    should(next) {
      return (
        next.item.label !== props.item.label || next.selected !== props.selected
      );
    },
  },
  render() {
    tr({ class: props.selected ? "danger" : "" }, () => {
      td({ class: "col-md-1" }, () => {
        text(props.item.id);
      });
      td({ class: "col-md-4" }, () => {
        a({ onClick: props.onSelect }, () => {
          text(props.item.label);
        });
      });
      td({ class: "col-md-1" }, () => {
        a({ onClick: props.onRemove }, () => {
          span({ class: "glyphicon glyphicon-remove", "aria-hidden": "true" });
        });
      });
      td({ class: "col-md-6" });
    });
  },
}));

// ---------------------------------------------------------------------------
// Styled button
// ---------------------------------------------------------------------------

const ActionButton = view<{
  title: string;
  id: string;
  onClick: () => void;
}>(({ props }) => ({
  update: { should: () => false },
  render() {
    div({ class: "col-sm-6 smallpad" }, () => {
      button(
        {
          type: "button",
          class: "btn btn-primary btn-block",
          id: props.id,
          onClick: props.onClick,
        },
        () => {
          text(props.title);
        },
      );
    });
  },
}));

// ---------------------------------------------------------------------------
// Root app view
// ---------------------------------------------------------------------------

export const App = view(({ state }) => {
  const list = state<RowData[]>([]);
  const selectedId = state(0);

  // -- Actions --

  const run = () => {
    list.set(buildData(1000));
    selectedId.set(0);
  };

  const runLots = () => {
    list.set(buildData(10000));
    selectedId.set(0);
  };

  const add = () => {
    list.set(list.get().concat(buildData(1000)));
  };

  const update = () => {
    const data = list.get();
    const next = data.slice();
    for (let i = 0; i < next.length; i += 10) {
      const r = next[i]!;
      next[i] = { id: r.id, label: r.label + " !!!" };
    }
    list.set(next);
  };

  const clear = () => {
    list.set([]);
    selectedId.set(0);
  };

  const swapRows = () => {
    const data = list.get();
    if (data.length > 998) {
      const next = data.slice();
      const tmp = next[1]!;
      next[1] = next[998]!;
      next[998] = tmp;
      list.set(next);
    }
  };

  const select = (id: number) => {
    selectedId.set(id);
  };

  const remove = (id: number) => {
    list.set(list.get().filter((i) => i.id !== id));
  };

  return {
    render() {
      div({ class: "container" }, () => {
        // Panel
        div({ class: "jumbotron" }, () => {
          div({ class: "row" }, () => {
            div({ class: "col-md-6" }, () => {
              h1({}, () => {
                text("Creo keyed");
              });
            });
            div({ class: "col-md-6" }, () => {
              div({ class: "row" }, () => {
                ActionButton({
                  title: "Create 1,000 rows",
                  id: "run",
                  onClick: run,
                });
                ActionButton({
                  title: "Create 10,000 rows",
                  id: "runlots",
                  onClick: runLots,
                });
                ActionButton({
                  title: "Append 1,000 rows",
                  id: "add",
                  onClick: add,
                });
                ActionButton({
                  title: "Update every 10th row",
                  id: "update",
                  onClick: update,
                });
                ActionButton({ title: "Clear", id: "clear", onClick: clear });
                ActionButton({
                  title: "Swap Rows",
                  id: "swaprows",
                  onClick: swapRows,
                });
              });
            });
          });
        });

        // Table
        table({ class: "table table-hover table-striped test-data" }, () => {
          tbody(_, () => {
            const data = list.get();
            const sel = selectedId.get();
            for (const item of data) {
              Row({
                key: item.id,
                item,
                selected: sel === item.id,
                onSelect: () => select(item.id),
                onRemove: () => remove(item.id),
              });
            }
          });
        });

        span({
          class: "preloadicon glyphicon glyphicon-remove",
          "aria-hidden": "true",
        });
      });
    },
  };
});

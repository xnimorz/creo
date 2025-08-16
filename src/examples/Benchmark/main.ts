import { Block, Button, creo, Inline, Text, ui } from "../../creo";
import { Maybe } from "../../data-structures/maybe/Maybe";
import { _ } from "../../data-structures/null/null";
import { record } from "../../data-structures/record/Record";
import { Wildcard } from "../../data-structures/wildcard/wildcard";
import { DomEngine } from "../../DOM/DomEngine";
import { Key } from "../../DOM/Key";

const random = (max: number) => Math.round(Math.random() * 1000) % max;

const state: { list: Array<{ id: number; label: string }>; selected: number } =
  record({ list: [], selected: 0 });

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

const buildData = (count: number) => {
  const data = new Array(count);

  for (let i = 0; i < count; i++) {
    data[i] = {
      id: nextId++,
      label: `${A[random(A.length)]} ${C[random(C.length)]} ${N[random(N.length)]}`,
    };
  }

  return data;
};

const tr = ui<Wildcard>("tr");
const td = ui<Wildcard>("td");
const Link = ui<Wildcard>("a");

const Row = creo<{
  key: Key;
  selected: boolean;
  item: { id: number; label: string };
}>((c) => {
  let selectEl!: () => Maybe<HTMLElement>;
  let removeEl!: () => Maybe<HTMLElement>;
  return {
    shouldUpdate(pendingParams) {
      const { item, selected } = c.p;
      return (
        pendingParams.item.label !== item.label ||
        pendingParams.selected !== selected
      );
    },
    didMount() {
      selectEl()?.addEventListener("click", () => {
        console.log("click", c.p.item);
        select(c.p.item.id);
      });
      removeEl()?.addEventListener("click", () => {
        console.log("click", c.p.item);
        remove(c.p.item.id);
      });
    },
    render() {
      const { selected, item } = c.p;
      tr({ class: selected ? "danger" : "" }, () => {
        td({ class: "col-md-1" }, () => {
          Text(String(item.id));
        });
        td({ class: "col-md-4" }, () => {
          selectEl = Link(_, () => {
            Text(item.label);
          });
        });
        td({ class: "col-md-1" }, () => {
          removeEl = Link(_, () => {
            Inline({
              class: "glyphicon glyphicon-remove",
              "aria-hidden": "true",
            });
          });
        });
        td({ class: "col-md-6" });
      });
    },
  };
});

const StyledButton = creo<{ title: string; id: string; cb: () => void }>(
  (c) => {
    let button: () => Maybe<HTMLElement>;
    return {
      // Single render component
      shouldUpdate: () => false,
      didMount() {
        button()?.addEventListener("click", c.p.cb);
      },
      render() {
        const { id, title } = c.p;
        Block({ class: "col-sm-6 smallpad" }, () => {
          button = Button(
            {
              type: "button",
              class: "btn btn-primary btn-block",
              id,
            },
            () => {
              Text(title);
            },
          );
        });
      },
    };
  },
);

const H1 = ui("h1");

const Panel = creo(() => {
  return {
    shouldUpdate() {
      return false;
    },
    render() {
      Block({ class: "jumbotron" }, () => {
        Block({ class: "row" }, () => {
          Block({ class: "col-md-6" }, () => {
            H1(_, () => {
              Text("Creo keyed");
            });
          });
          Block({ class: "col-md-6" }, () => {
            Block({ class: "row" }, () => {
              StyledButton({
                title: "Create 1000 rows",
                id: "run",
                cb: run,
              });
              StyledButton({
                title: "Create 10,000 rows",
                id: "runlots",
                cb: runLots,
              });
              StyledButton({
                title: "Append 1,000 rows",
                id: "add",
                cb: add,
              });
              StyledButton({
                title: "Update every 10th row",
                id: "update",
                cb: update,
              });
              StyledButton({
                title: "Clear",
                id: "clear",
                cb: clear,
              });
              StyledButton({
                title: "Swap Rows",
                id: "swaprows",
                cb: swapRows,
              });
            });
          });
        });
      });
    },
  };
});

const table = ui<Wildcard>("table");
const tbody = ui<Wildcard>("tbody");

const Main = creo((c) => {
  const data = c.tracked(state);
  return {
    render() {
      Block({ class: "container" }, () => {
        Panel();
        table({ class: "table table-hover table-striped test-data" }, () => {
          tbody(_, () => {
            data.list.map((item) => {
              Row({
                key: item.id,
                item,
                selected: data.selected === item.id,
              });
            });
          });
        });
        Inline({
          class: "preloadicon glyphicon glyphicon-remove",
          "aria-hidden": "true",
        });
      });
    },
  };
});

function run() {
  const data = buildData(1000);
  state.list = data;
  state.selected = 0;
}

function runLots() {
  const data = buildData(10000);
  state.list = data;
  state.selected = 0;
}

function add() {
  const data = buildData(1000);
  state.list = state.list.concat(data);
  state.selected = 0;
}

function update() {
  const list = state.list;
  for (let i = 0; i < list.length; i += 10) {
    const r = list[i];

    list[i] = { id: r.id, label: r.label + " !!!" };
  }
}

function clear() {
  state.list = [];
  state.selected = 0;
}

function swapRows() {
  if (state.list.length > 998) {
    const d1 = state.list[1];
    const d998 = state.list[998];
    state.list[1] = d998;
    state.list[998] = d1;
  }
}

function remove(id: number) {
  state.list = state.list.filter((i) => i.id != id);
}

function select(id: number) {
  state.selected = id;
}

const engine = new DomEngine(document.querySelector("#app") as HTMLElement);
engine.render(() => {
  Main();
});

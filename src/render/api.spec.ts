import { describe, it, expect } from "bun:test";
import { Window } from "happy-dom";
import { view } from "@/public/view";
import { div, span, button, input, text } from "@/public/primitives/primitives";
import { Engine } from "@/internal/engine";
import { orchestrator } from "@/internal/orchestrator";
import { HtmlRender } from "./html_render";

// ---------------------------------------------------------------------------
// Happy-dom setup
// ---------------------------------------------------------------------------

const win = new Window({ url: "http://localhost" });
Object.assign(globalThis, {
  document: win.document,
  HTMLElement: win.HTMLElement,
  Text: win.Text,
  HTMLImageElement: win.HTMLImageElement,
  HTMLInputElement: win.HTMLInputElement,
  DocumentFragment: win.DocumentFragment,
  Comment: win.Comment,
  Node: win.Node,
  Event: win.Event,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mount(viewFn: (props?: any, slot?: any) => void) {
  const container = document.createElement("div");
  const renderer = new HtmlRender(container);
  const engine = new Engine(renderer);
  orchestrator.setCurrentEngine(engine);
  engine.createRoot(() => {
    viewFn();
  }, {});
  engine.render();
  return { container, engine };
}

// ---------------------------------------------------------------------------
// Primitive element api
// ---------------------------------------------------------------------------

describe("Primitive element api", () => {
  it("should return the DOM element from div api after mount", () => {
    let getDiv: (() => unknown) | undefined;

    const App = view<void>(({}) => ({
      onMount() {
        const el = getDiv!() as HTMLElement;
        expect(el).toBeInstanceOf(HTMLElement);
        expect(el.tagName).toBe("DIV");
        expect(el.className).toBe("target");
      },
      render() {
        getDiv = div({ class: "target" });
      },
    }));

    mount(App);
    // onMount assertion runs synchronously in engine.render()
    expect(getDiv).toBeDefined();
  });

  it("should return the DOM element from button api", () => {
    let getBtn: (() => unknown) | undefined;

    const App = view<void>(({}) => ({
      onMount() {
        const el = getBtn!() as HTMLElement;
        expect(el.tagName).toBe("BUTTON");
      },
      render() {
        getBtn = button({ class: "btn" });
      },
    }));

    mount(App);
  });

  it("should return the DOM element from input api", () => {
    let getInput: (() => unknown) | undefined;

    const App = view<void>(({}) => ({
      onMount() {
        const el = getInput!() as HTMLInputElement;
        expect(el.tagName).toBe("INPUT");
      },
      render() {
        getInput = input({ type: "text", placeholder: "hi" });
      },
    }));

    mount(App);
  });

  it("should return correct element when multiple primitives exist", () => {
    let getFirst: (() => unknown) | undefined;
    let getSecond: (() => unknown) | undefined;

    const App = view<void>(({}) => ({
      onMount() {
        const first = getFirst!() as HTMLElement;
        const second = getSecond!() as HTMLElement;
        expect(first.tagName).toBe("DIV");
        expect(first.className).toBe("first");
        expect(second.tagName).toBe("SPAN");
        expect(second.className).toBe("second");
      },
      render() {
        getFirst = div({ class: "first" });
        getSecond = span({ class: "second" });
      },
    }));

    mount(App);
  });

  it("should return updated element in onUpdateAfter", () => {
    let getDiv: (() => unknown) | undefined;
    let mountCount = 0;
    let updateCount = 0;

    const App = view<void>(({ use }) => {
      const count = use(0);
      return {
        onMount() {
          mountCount++;
          const el = getDiv!() as HTMLElement;
          expect(el).toBeInstanceOf(HTMLElement);
          // Trigger re-render
          count.set(1);
        },
        onUpdateAfter() {
          updateCount++;
          const el = getDiv!() as HTMLElement;
          expect(el).toBeInstanceOf(HTMLElement);
          expect(el.tagName).toBe("DIV");
        },
        render() {
          getDiv = div({ class: "count-" + count.get() });
        },
      };
    });

    const { engine } = mount(App);
    engine.render(); // process the scheduled re-render
    expect(mountCount).toBe(1);
    expect(updateCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Composite view api
// ---------------------------------------------------------------------------

describe("Composite view api", () => {
  it("should expose a custom api function from a view", () => {
    type FocusApi = () => { focus(): void };

    let focusCalled = false;

    const MyInput = view<{ value: string }, FocusApi>(({ props }) => {
      let inputEl: unknown;
      return {
        onMount() {
          inputEl = getInput!();
        },
        render() {
          getInput = input({ value: props().value });
        },
        api: () => ({
          focus() {
            focusCalled = true;
          },
        }),
      };
    });

    let getInput: (() => unknown) | undefined;
    let myInputApi: FocusApi | undefined;

    const App = view<void>(({}) => ({
      onMount() {
        const api = myInputApi!();
        api.focus();
      },
      render() {
        myInputApi = MyInput({ value: "hello" });
      },
    }));

    mount(App);
    expect(focusCalled).toBe(true);
  });

  it("should return api that accesses state captured in closure", () => {
    type CounterApi = () => { getCount(): number };

    const Counter = view<{ initial: number }, CounterApi>(({ use, props }) => {
      const count = use(props().initial);
      return {
        render() {
          div({}, () => {
            text(count.get());
          });
        },
        api: () => ({
          getCount() {
            return count.get();
          },
        }),
      };
    });

    let counterApi: CounterApi | undefined;

    const App = view<void>(({}) => ({
      onMount() {
        const api = counterApi!();
        expect(api.getCount()).toBe(42);
      },
      render() {
        counterApi = Counter({ initial: 42 });
      },
    }));

    mount(App);
  });

  it("should work with api that returns a scalar", () => {
    type ValueApi = () => string;

    const Label = view<{ text: string }, ValueApi>(({ props }) => ({
      render() {
        span({}, () => {
          text(props().text);
        });
      },
      api: () => props().text,
    }));

    let labelApi: ValueApi | undefined;

    const App = view<void>(({}) => ({
      onMount() {
        expect(labelApi!()).toBe("hello");
      },
      render() {
        labelApi = Label({ text: "hello" });
      },
    }));

    mount(App);
  });
});

// ---------------------------------------------------------------------------
// Api with children (slot)
// ---------------------------------------------------------------------------

describe("Api with slot", () => {
  it("should work on a primitive that has children", () => {
    let getWrapper: (() => unknown) | undefined;

    const App = view<void>(({}) => ({
      onMount() {
        const el = getWrapper!() as HTMLElement;
        expect(el.tagName).toBe("DIV");
        expect(el.textContent).toBe("child");
      },
      render() {
        getWrapper = div({ class: "wrapper" }, () => {
          text("child");
        });
      },
    }));

    mount(App);
  });
});

// ---------------------------------------------------------------------------
// Api is undefined before mount
// ---------------------------------------------------------------------------

describe("Api before render", () => {
  it("primitive api returns undefined if called before render completes", () => {
    // Simulate: create the view call outside of a render cycle
    // In practice, api() should only be called in onMount/onUpdateAfter.
    // Before render, the renderRef doesn't exist, so api returns undefined.
    let getDiv: (() => unknown) | undefined;
    let apiBeforeMount: unknown = "sentinel";

    const App = view<void>(({}) => ({
      onMount() {
        // By onMount, the element exists
        expect(getDiv!()).toBeInstanceOf(HTMLElement);
      },
      render() {
        getDiv = div({ class: "test" });
        // During render, the element isn't created yet for THIS div
        // (it gets created after reconcile + renderer.render)
        // Calling api here would return undefined
        apiBeforeMount = getDiv();
      },
    }));

    mount(App);
    // On the first render call, the div's renderRef is set after body.render()
    // executes, so calling api during render returns undefined
    expect(apiBeforeMount).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Nested api — child view exposes api to parent
// ---------------------------------------------------------------------------

describe("Nested api", () => {
  it("parent can call child view api from onMount", () => {
    type ScrollApi = () => { scrollTo(pos: number): number };
    let scrolledTo = -1;

    const ScrollBox = view<{ height: number }, ScrollApi>(({ props }) => ({
      render() {
        div({ class: "scroll", style: `height:${props().height}px` });
      },
      api: () => ({
        scrollTo(pos: number) {
          scrolledTo = pos;
          return pos;
        },
      }),
    }));

    let scrollApi: ScrollApi | undefined;

    const Page = view<void>(({}) => ({
      onMount() {
        const result = scrollApi!().scrollTo(100);
        expect(result).toBe(100);
      },
      render() {
        scrollApi = ScrollBox({ height: 500 });
      },
    }));

    mount(Page);
    expect(scrolledTo).toBe(100);
  });
});

import { expect, test } from "bun:test";
import { Component, creo } from "./Component";
import { HtmlLayout } from "../layout-engine/htmlLayout";
import { resetLayoutEngine, setLayoutEngine } from "../layout-engine/layoutEngine";

test("Creo component can be constructed without `new` keyword", () => {

  const htmlLayout = new HtmlLayout();
  setLayoutEngine(htmlLayout);

  @creo
  class MyComponent extends Component {
    foo = "bar";
    ui(): void {}
  }

  // @ts-ignore
  const instance = MyComponent();

  expect(instance.foo).toBe("bar");

  resetLayoutEngine();
});

test("Creo component supports new keyword", () => {

  const htmlLayout = new HtmlLayout(document.createElement('div'));
  setLayoutEngine(htmlLayout);

  @creo
  class MyComponent extends Component {
    foo = "bar";
    ui(): void {}
  }

  const instance = new MyComponent();

  expect(instance.foo).toBe("bar");

  resetLayoutEngine();
});


test("Creo component throws exception when no layout engine provided", () => {
  @creo
  class MyComponent extends Component {
    foo = "bar";
    ui(): void {}
  }
  

  expect(() => MyComponent()).toThrow();
});

import { expect, test } from "bun:test";
import { Component, creo } from "./component";

test("Creo component can be constructed without `new` keyword", () => {
  @creo
  class MyComponent extends Component {
    foo = "bar";
    ui(): void {}
  }

  // @ts-ignore
  const instance = MyComponent();

  expect(instance.foo).toBe("bar");
});

test("Creo component supports new keyword", () => {
  @creo
  class MyComponent extends Component {
    foo = "bar";
    ui(): void {}
  }

  const instance = new MyComponent();

  expect(instance.foo).toBe("bar");
});

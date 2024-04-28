import { expect, test } from "bun:test";
import { $of, onDidUpdate } from "./record";

test("Can define objects", () => {
  const obj = $of({
    hello: "world",
  });

  expect(obj).toEqual({ hello: "world" });
});

test("Notifies on object updates", async () => {
  const obj = $of({
    hello: "world",
  });

  await expect(
    new Promise((resolve) => {
      onDidUpdate(obj, (updated) => resolve(updated));

      obj.hello = "new world";
    })
  ).resolves.toEqual({
    hello: "new world",
  });
});

test("Notifies on object updates even if the listener was set after the change", async () => {
  const obj = $of({
    hello: "world",
  });

  obj.hello = "new world";

  await expect(
    new Promise((resolve) => {
      onDidUpdate(obj, (updated) => resolve(updated));
    })
  ).resolves.toEqual({
    hello: "new world",
  });
});

test("Implies updates immediately", async () => {
  const obj = $of({
    hello: {
      world: "foo",
    },
  });

  expect(obj).toEqual({
    hello: {
      world: "foo",
    },
  });

  obj.hello.world = "new";

  expect(obj).toEqual({
    hello: {
      world: "new",
    },
  });
});

test("Handles nested object updates", async () => {
  const obj = $of({
    hello: {
      world: "foo",
    },
  });

  obj.hello.world = "new";

  await expect(
    new Promise((resolve) => {
      onDidUpdate(obj, (updated) => resolve(updated));
    })
  ).resolves.toEqual({
    hello: {
      world: "new",
    },
  });
});

test("Can unsubscribe from updates", async () => {
  const obj = $of({
    hello: {
      world: "foo",
    },
  });

  const unsubscribe = onDidUpdate(obj, (_updated) => {
    throw Error("cannot get here");
  });
  // If you delete this line, the test gets broken:
  unsubscribe();

  obj.hello.world = "new";

  await expect(
    new Promise((resolve) => {
      onDidUpdate(obj, (updated) => resolve(updated));
    })
  ).resolves.toEqual({
    hello: {
      world: "new",
    },
  });
});

test("Supports arrays", async () => {
  const obj = $of({
    hello: {
      world: ["this", "is", "array"],
    },
  });

  obj.hello.world.sort();

  await expect(
    new Promise((resolve) => {
      onDidUpdate(obj, (updated) => resolve(JSON.stringify(updated)));
    })
  ).resolves.toEqual('{"hello":{"world":["array","is","this"]}}');

  obj.hello.world.push("123");

  await expect(
    new Promise((resolve) => {
      onDidUpdate(obj, (updated) => resolve(JSON.stringify(updated)));
    })
  ).resolves.toEqual('{"hello":{"world":["array","is","this","123"]}}');
});

test("Supports iterable", async () => {
  const obj = $of(["hello", "world"]);

  function iterate(...args: string[]) {
    const [a, b] = args;
    expect(a).toBe("hello");
    expect(b).toBe("world");
  }

  iterate(...obj);
});

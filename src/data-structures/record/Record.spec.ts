import { expect, test, mock } from "bun:test";
import { record, RecordOf, onDidUpdate, isRecord } from "./Record";

test("Can define objects", () => {
  const obj = record({
    hello: "world",
  });

  expect(obj).toEqual({ hello: "world" });
});

test("Refers to the same objects", () => {
  const test = record({
    foo: {
      bar: "baz",
    },
  });

  expect(test.foo).toBe(test.foo);
});

test("Updates fields correctly", () => {
  const test: RecordOf<any> = record({
    foo: {
      bar: "baz",
    },
  });

  expect(test.foo.bar).toBe("baz");

  test.foo.bar = "123";

  expect(test.foo.bar).toBe("123");

  test.foo = { hello: "world" };
  expect(test.foo.bar).toBe(undefined);
  expect(test.foo.hello).toBe("world");
});

test("Notifies on object updates", async () => {
  const obj = record({
    hello: "world",
  });

  await expect(
    new Promise((resolve) => {
      onDidUpdate(obj, (updated) => resolve(updated));

      obj.hello = "new world";
    }),
  ).resolves.toEqual({
    hello: "new world",
  });
});

test("Notifies on object updates even if the listener was set after the change", async () => {
  const obj = record({
    hello: "world",
  });

  obj.hello = "new world";

  await expect(
    new Promise((resolve) => {
      onDidUpdate(obj, (updated) => resolve(updated));
    }),
  ).resolves.toEqual({
    hello: "new world",
  });
});

test("Implies updates immediately", async () => {
  const obj = record({
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
  const obj = record({
    hello: {
      world: "foo",
    },
  });

  obj.hello.world = "new";

  await expect(
    new Promise((resolve) => {
      onDidUpdate(obj, (updated) => resolve(updated));
    }),
  ).resolves.toEqual({
    hello: {
      world: "new",
    },
  });
});

test("Can unsubscribe from updates", async () => {
  const obj = record({
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
    }),
  ).resolves.toEqual({
    hello: {
      world: "new",
    },
  });
});

test("Supports arrays", async () => {
  const obj = record({
    hello: {
      world: ["this", "is", "array"],
    },
  });

  obj.hello.world.sort();

  await expect(
    new Promise((resolve) => {
      onDidUpdate(obj, (updated) => resolve(JSON.stringify(updated)));
    }),
  ).resolves.toEqual('{"hello":{"world":["array","is","this"]}}');

  obj.hello.world.push("123");

  await expect(
    new Promise((resolve) => {
      onDidUpdate(obj, (updated) => resolve(JSON.stringify(updated)));
    }),
  ).resolves.toEqual('{"hello":{"world":["array","is","this","123"]}}');
});

test("Supports iterable", async () => {
  const obj = record(["hello", "world"]);

  function iterate(...args: string[]) {
    const [a, b] = args;
    expect(a).toBe("hello");
    expect(b).toBe("world");
  }

  iterate(...obj);
});

test("`has` works with records", async () => {
  const originalObject = {
    foo: "bar",
    baz: "test",
    nested: {
      support: "exist",
    },
  };
  const wrapped = record(originalObject);

  expect(isRecord(originalObject)).toBe(false);
  expect(isRecord(wrapped)).toBe(true);
  expect("foo" in wrapped).toBe(true);
  expect("test" in wrapped).toBe(false);
  expect("support" in wrapped.nested).toBe(true);
  expect("foo" in wrapped.nested).toBe(false);
});

test("Double tracked on nested object works correctly", async () => {
  const originalObject = {
    foo: "bar",
    baz: "test",
    nested: {
      support: "exist",
    },
  };

  // This object is not tracked under the same parent, but might be considered in future to allow better objects and record composition.
  // It would require objects to have multiple parents (so essentially many<=>many concept.)
  const additionalObject = {
    nested: originalObject.nested,
    foo: "123",
    hello: "234",
  };

  const originalWrappped = record(originalObject);

  const additionalWrapped = record(additionalObject);

  const recordedNested = record(originalWrappped.nested);

  const mockFn = mock();

  onDidUpdate(originalWrappped, () => {
    mockFn();
    expect(originalObject.nested).toEqual(originalWrappped.nested);
  });
  onDidUpdate(additionalWrapped, () => {
    // We should never hit that path
    expect(1).toBe(0);
    mockFn();
  });
  onDidUpdate(recordedNested, () => {
    mockFn();
    expect(recordedNested).toEqual({ support: "updated" });
  });
  originalWrappped.nested.support = "updated";
  // Updates are propagated in microtick queue, so we wait single tick
  await Promise.resolve();
  expect(mockFn).toHaveBeenCalledTimes(2);
});

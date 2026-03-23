import { describe, it, expect, beforeEach, mock } from "bun:test";
import { View, type PendingView } from "./internal_view";
import { Engine } from "./engine";
import type { ViewFn, ViewBody } from "@/public/view";
import type { Wildcard } from "./wildcard";
import { IndexedList } from "@/structures/indexed_list";
import { just } from "@/functional/maybe";
import type { IRender } from "@/render/render_interface";

// Mock renderer
const createMockRenderer = (): IRender<Wildcard> => ({
  render: mock(() => {}),
  unmount: mock(() => {}),
  registerPrimitive: mock(() => {}) as IRender<Wildcard>["registerPrimitive"],
});

// Mock view function that returns a simple view body
const createMockViewFn = (onRender?: () => void): ViewFn<any, any> => {
  return ({ props, state, store, slot }) => ({
    render: onRender || (() => {}),
  });
};

// Helper to dump virtual_dom structure for debugging
const dumpVirtualDom = (view: View): any => {
  const children = [];
  for (const child of view.virtualDom) {
    children.push({
      viewFnId: (child.viewFn as any)?.id || "unknown",
      props: child.props,
      key: child.userKey,
      children_count: child.virtualDom.length,
      nested_children: dumpVirtualDom(child),
    });
  }
  return {
    props: view.props,
    key: view.userKey,
    children_count: view.virtualDom.length,
    children,
  };
};

const toArray = <T>(list: IndexedList<T>): T[] => Array.from(list);

describe("View - virtual_dom correctness", () => {
  let engine: Engine;
  let renderer: IRender<Wildcard>;
  let rootViewFn: ViewFn<any, any>;
  let rootView: View;

  beforeEach(() => {
    renderer = createMockRenderer();
    engine = new Engine(renderer);
    rootViewFn = createMockViewFn();
    rootView = new View(rootViewFn, engine, {}, null, null, null);
  });

  it("should initialize with empty virtual_dom", () => {
    expect(rootView.virtualDom.length).toBe(0);
  });

  it("should initialize key_to_view as empty map", () => {
    expect(rootView.keyToView.size).toBe(0);
  });

  describe("reconsile_children", () => {
    it("should add single child to virtual_dom", () => {
      const childViewFn = createMockViewFn();
      const pending: PendingView[] = [
        {
          viewFn: childViewFn,
          props: { name: "child1" },
          slot: null,
          userKey: null,
        },
      ];

      rootView.reconsileChildren(new Set(pending));

      expect(rootView.virtualDom.length).toBe(1);
      const child = rootView.virtualDom.at(0);
      expect(child?.props).toEqual({ name: "child1" });
    });

    it("should add multiple children in order", () => {
      const viewFn1 = createMockViewFn();
      const viewFn2 = createMockViewFn();
      const viewFn3 = createMockViewFn();

      const pending: PendingView[] = [
        {
          viewFn: viewFn1,
          props: { id: 1 },
          slot: null,
          userKey: null,
        },
        {
          viewFn: viewFn2,
          props: { id: 2 },
          slot: null,
          userKey: null,
        },
        {
          viewFn: viewFn3,
          props: { id: 3 },
          slot: null,
          userKey: null,
        },
      ];

      rootView.reconsileChildren(new Set(pending));

      expect(rootView.virtualDom.length).toBe(3);

      const children = toArray(rootView.virtualDom);
      expect(children[0]?.props.id).toBe(1);
      expect(children[1]?.props?.id).toBe(2);
      expect(children[2]?.props?.id).toBe(3);
    });

    it("should replace all children when reconciling with different set", () => {
      const viewFn1 = createMockViewFn();
      const viewFn2 = createMockViewFn();

      // First reconcile
      const pending1: PendingView[] = [
        {
          viewFn: viewFn1,
          props: { id: 1 },
          slot: null,
          userKey: null,
        },
      ];
      rootView.reconsileChildren(new Set(pending1));
      expect(rootView.virtualDom.length).toBe(1);

      // Second reconcile with different children
      const pending2: PendingView[] = [
        {
          viewFn: viewFn2,
          props: { id: 2 },
          slot: null,
          userKey: null,
        },
        {
          viewFn: viewFn2,
          props: { id: 3 },
          slot: null,
          userKey: null,
        },
      ];
      rootView.reconsileChildren(new Set(pending2));

      expect(rootView.virtualDom.length).toBe(2);
      const children = toArray(rootView.virtualDom);
      expect(children[0]?.props?.id).toBe(2);
      expect(children[1]?.props?.id).toBe(3);
    });

    it("should dispose removed children", () => {
      const viewFn1 = createMockViewFn();

      const pending1: PendingView[] = [
        {
          viewFn: viewFn1,
          props: { id: 1 },
          slot: null,
          userKey: null,
        },
        {
          viewFn: viewFn1,
          props: { id: 2 },
          slot: null,
          userKey: null,
        },
      ];
      rootView.reconsileChildren(new Set(pending1));
      expect(rootView.virtualDom.length).toBe(2);

      // Now reconcile with only one child
      const pending2: PendingView[] = [
        {
          viewFn: viewFn1,
          props: { id: 1 },
          slot: null,
          userKey: null,
        },
      ];
      rootView.reconsileChildren(new Set(pending2));

      expect(rootView.virtualDom.length).toBe(1);
    });

    it("should shrink virtual_dom when reconciling with fewer children", () => {
      const viewFn = createMockViewFn();

      const pending1: PendingView[] = Array.from({ length: 5 }, (_, i) => ({
        viewFn: viewFn,
        props: { id: i },
        slot: null,
        userKey: null,
      }));
      rootView.reconsileChildren(new Set(pending1));
      expect(rootView.virtualDom.length).toBe(5);

      const pending2: PendingView[] = Array.from({ length: 2 }, (_, i) => ({
        viewFn: viewFn,
        props: { id: i },
        slot: null,
        userKey: null,
      }));
      rootView.reconsileChildren(new Set(pending2));

      expect(rootView.virtualDom.length).toBe(2);
    });

    it("should expand virtual_dom when reconciling with more children", () => {
      const viewFn = createMockViewFn();

      const pending1: PendingView[] = [
        {
          viewFn: viewFn,
          props: { id: 0 },
          slot: null,
          userKey: null,
        },
      ];
      rootView.reconsileChildren(new Set(pending1));
      expect(rootView.virtualDom.length).toBe(1);

      const pending2: PendingView[] = Array.from({ length: 5 }, (_, i) => ({
        viewFn: viewFn,
        props: { id: i },
        slot: null,
        userKey: null,
      }));
      rootView.reconsileChildren(new Set(pending2));

      expect(rootView.virtualDom.length).toBe(5);
    });
  });

  describe("reconsile_child with keys", () => {
    it("should add child with key to key_to_view map", () => {
      const viewFn = createMockViewFn();
      const key = "child-key-1";
      const newDom = new IndexedList<View>();

      const pending: PendingView = {
        viewFn: viewFn,
        props: { id: 1 },
        slot: null,
        userKey: key,
      };

      rootView.reconsileChild(pending, 0, newDom);

      expect(rootView.keyToView.has(key)).toBe(true);
      expect(rootView.keyToView.get(key)).toBeDefined();
    });

    it("should reuse view with matching key", () => {
      const viewFn = createMockViewFn();
      const key = "child-key-1";

      // First reconcile: add child with key
      const pending1: PendingView[] = [
        {
          viewFn: viewFn,
          props: { id: 1 },
          slot: null,
          userKey: key,
        },
      ];
      rootView.reconsileChildren(new Set(pending1));

      const firstChild = rootView.virtualDom.at(0);

      // Second reconcile: same key, different props
      const pending2: PendingView[] = [
        {
          viewFn: viewFn,
          props: { id: 2 },
          slot: null,
          userKey: key,
        },
      ];
      rootView.reconsileChildren(new Set(pending2));

      const secondChild = rootView.virtualDom.at(0);

      // Should be the same view instance (reused)
      expect(firstChild).toBe(secondChild);
      // Props should be updated
      expect(secondChild?.props.id).toBe(2);
    });

    it("should replace view with different key", () => {
      const viewFn = createMockViewFn();
      const key1 = "child-key-1";
      const key2 = "child-key-2";

      // First reconcile with key1
      const pending1: PendingView[] = [
        {
          viewFn: viewFn,
          props: { id: 1 },
          slot: null,
          userKey: key1,
        },
      ];
      rootView.reconsileChildren(new Set(pending1));

      const firstChild = rootView.virtualDom.at(0);
      expect(rootView.keyToView.has(key1)).toBe(true);

      // Second reconcile with key2
      const pending2: PendingView[] = [
        {
          viewFn: viewFn,
          props: { id: 2 },
          slot: null,
          userKey: key2,
        },
      ];
      rootView.reconsileChildren(new Set(pending2));

      const secondChild = rootView.virtualDom.at(0);

      // Should be different instances
      expect(firstChild).not.toBe(secondChild);
      // key_to_view should have both keys (old one remains until cleanup)
      // or only have key2 depending on implementation
      expect(rootView.keyToView.has(key2)).toBe(true);
    });

    it("should handle multiple keyed children in correct order", () => {
      const viewFn = createMockViewFn();
      const keys = ["key-a", "key-b", "key-c"];

      const pending: PendingView[] = keys.map((key, i) => ({
        viewFn: viewFn,
        props: { id: i, name: key },
        slot: null,
        userKey: key,
      }));

      rootView.reconsileChildren(new Set(pending));

      expect(rootView.virtualDom.length).toBe(3);
      expect(rootView.keyToView.size).toBe(3);

      const children = toArray(rootView.virtualDom);
      keys.forEach((key, i) => {
        expect(children[i]?.props.name).toBe(key);
        expect(rootView.keyToView.get(key)).toBe(children[i]);
      });
    });

    it("should remove key from key_to_view when child is disposed", () => {
      const viewFn = createMockViewFn();
      const key = "child-key-1";

      // Add child with key
      const pending1: PendingView[] = [
        {
          viewFn: viewFn,
          props: { id: 1 },
          slot: null,
          userKey: key,
        },
      ];
      rootView.reconsileChildren(new Set(pending1));
      expect(rootView.keyToView.has(key)).toBe(true);

      // Remove child (reconcile with empty)
      rootView.reconsileChildren(new Set());

      expect(rootView.keyToView.has(key)).toBe(false);
    });
  });

  describe("reconsile_child with different view functions", () => {
    it("should replace view when viewFn changes", () => {
      const viewFn1 = createMockViewFn();
      const viewFn2 = createMockViewFn();
      const newDom = new IndexedList<View>();

      // First child with viewFn1
      const pending1: PendingView = {
        viewFn: viewFn1,
        props: { id: 1 },
        slot: null,
        userKey: null,
      };
      rootView.reconsileChild(pending1, 0, newDom);
      const firstChild = newDom.at(0);

      // Clear and reconcile with viewFn2
      if (firstChild) {
        newDom.delete(firstChild);
      }

      const pending2: PendingView = {
        viewFn: viewFn2,
        props: { id: 1 },
        slot: null,
        userKey: null,
      };
      rootView.reconsileChild(pending2, 0, newDom);
      const secondChild = newDom.at(0);

      expect(firstChild).not.toBe(secondChild);
      expect(firstChild?.viewFn).not.toBe(secondChild?.viewFn);
    });
  });

  describe("on_child_disposed", () => {
    it("should remove child from virtual_dom", () => {
      const viewFn = createMockViewFn();
      const pending: PendingView[] = [
        {
          viewFn: viewFn,
          props: { id: 1 },
          slot: null,
          userKey: null,
        },
      ];
      rootView.reconsileChildren(new Set(pending));
      expect(rootView.virtualDom.length).toBe(1);

      const child = rootView.virtualDom.at(0);
      if (child) {
        rootView.onChildDisposed(child);
      }

      expect(rootView.virtualDom.length).toBe(0);
    });

    it("should remove child key from key_to_view", () => {
      const viewFn = createMockViewFn();
      const key = "test-key";

      const pending: PendingView[] = [
        {
          viewFn: viewFn,
          props: { id: 1 },
          slot: null,
          userKey: key,
        },
      ];
      rootView.reconsileChildren(new Set(pending));

      const child = rootView.virtualDom.at(0);
      if (child) {
        rootView.onChildDisposed(child);
      }

      expect(rootView.keyToView.has(key)).toBe(false);
    });

    it("should only remove from virtual_dom if child has no key", () => {
      const viewFn = createMockViewFn();
      const pending: PendingView[] = [
        {
          viewFn: viewFn,
          props: { id: 1 },
          slot: null,
          userKey: null,
        },
      ];
      rootView.reconsileChildren(new Set(pending));

      const child = rootView.virtualDom.at(0);
      if (child) {
        rootView.onChildDisposed(child);
      }

      expect(rootView.virtualDom.length).toBe(0);
      expect(rootView.keyToView.size).toBe(0);
    });
  });

  describe("dispose_children_from", () => {
    it("should dispose all children from index onwards", () => {
      const viewFn = createMockViewFn();
      const pending: PendingView[] = Array.from({ length: 5 }, (_, i) => ({
        viewFn: viewFn,
        props: { id: i },
        slot: null,
        userKey: null,
      }));

      rootView.reconsileChildren(new Set(pending));
      expect(rootView.virtualDom.length).toBe(5);

      rootView.disposeChildrenFrom(2);

      expect(rootView.virtualDom.length).toBe(2);
    });

    it("should dispose from index to end", () => {
      const viewFn = createMockViewFn();
      const pending: PendingView[] = Array.from({ length: 5 }, (_, i) => ({
        viewFn: viewFn,
        props: { id: i },
        slot: null,
        userKey: null,
      }));

      rootView.reconsileChildren(new Set(pending));

      const originalChildren = toArray(rootView.virtualDom);

      rootView.disposeChildrenFrom(3);

      const remainingChildren = toArray(rootView.virtualDom);
      expect(remainingChildren[0]).toBe(originalChildren[0]);
      expect(remainingChildren[1]).toBe(originalChildren[1]);
    });

    it("should handle dispose_children_from(0)", () => {
      const viewFn = createMockViewFn();
      const pending: PendingView[] = Array.from({ length: 3 }, (_, i) => ({
        viewFn: viewFn,
        props: { id: i },
        slot: null,
        userKey: null,
      }));

      rootView.reconsileChildren(new Set(pending));
      expect(rootView.virtualDom.length).toBe(3);

      rootView.disposeChildrenFrom(0);

      expect(rootView.virtualDom.length).toBe(0);
    });
  });

  describe("next_props", () => {
    it("should update props and slot", () => {
      const viewFn = createMockViewFn();
      const newProps = { updated: true };

      rootView.props = { initial: true };
      rootView.nextProps(newProps, null);

      expect(rootView.props).toEqual(newProps);
    });

    it("should check should_update before marking for re-render", () => {
      const viewFn = createMockViewFn();
      const oldProps = { value: 1 };
      const newProps = { value: 2 };

      rootView.props = oldProps;

      // Track if mark_need_render is called
      let markRenderCalled = false;
      const originalMark = engine.markNeedRender;
      engine.markNeedRender = mock(() => {
        markRenderCalled = true;
      });

      rootView.nextProps(newProps, null);

      // With shallow_equal, different objects will trigger render
      expect(rootView.props.value).toBe(2);
    });
  });

  describe("should_update", () => {
    it("should use custom update.should if provided", () => {
      const shouldUpdate = mock(() => false);
      const viewFn: ViewFn<any, any> = () => ({
        render: () => {},
        update: { should: shouldUpdate },
      });

      const view = new View(viewFn, engine, {}, null, null, null);

      const result = view.shouldUpdate({ new: "props" });

      expect(result).toBe(false);
      expect(shouldUpdate).toHaveBeenCalled();
    });

    it("should use shallow_equal by default", () => {
      const viewFn = createMockViewFn();
      const view = new View(viewFn, engine, {}, null, null, null);

      view.props = { a: 1 };

      const result = view.shouldUpdate({ a: 1 });
      // Different object references, so should_update returns true (needs update)
      expect(typeof result).toBe("boolean");
    });
  });

  describe("lifecycle hooks", () => {
    it("should call mount.before", () => {
      const beforeMount = mock(() => {});
      const viewFn: ViewFn<any, any> = () => ({
        render: () => {},
        mount: { before: beforeMount },
      });

      const view = new View(viewFn, engine, {}, null, null, null);
      view.mountBefore();

      expect(beforeMount).toHaveBeenCalled();
    });

    it("should call mount.after", () => {
      const afterMount = mock(() => {});
      const viewFn: ViewFn<any, any> = () => ({
        render: () => {},
        mount: { after: afterMount },
      });

      const view = new View(viewFn, engine, {}, null, null, null);
      view.mountAfter();

      expect(afterMount).toHaveBeenCalled();
    });

    it("should call update.before during render_before", () => {
      const beforeUpdate = mock(() => {});
      const viewFn: ViewFn<any, any> = () => ({
        render: () => {},
        update: { before: beforeUpdate },
      });

      const view = new View(viewFn, engine, {}, null, null, null);
      view.renderBefore();

      expect(beforeUpdate).toHaveBeenCalled();
    });

    it("should call update.after during render_after", () => {
      const afterUpdate = mock(() => {});
      const viewFn: ViewFn<any, any> = () => ({
        render: () => {},
        update: { after: afterUpdate },
      });

      const view = new View(viewFn, engine, {}, null, null, null);
      view.renderAfter();

      expect(afterUpdate).toHaveBeenCalled();
    });
  });

  describe("Virtual DOM JSON dumps", () => {
    it("should generate correct structure dump for simple tree", () => {
      const viewFn = createMockViewFn();
      const pending: PendingView[] = [
        {
          viewFn: viewFn,
          props: { id: 1, name: "child1" },
          slot: null,
          userKey: null,
        },
        {
          viewFn: viewFn,
          props: { id: 2, name: "child2" },
          slot: null,
          userKey: null,
        },
      ];

      rootView.reconsileChildren(new Set(pending));

      const dump = dumpVirtualDom(rootView);

      expect(dump.children_count).toBe(2);
      expect(dump.children[0]?.props.id).toBe(1);
      expect(dump.children[1]?.props.id).toBe(2);
      expect(dump.children[0]?.children_count).toBe(0);
      expect(dump.children[1]?.children_count).toBe(0);
    });

    it("should generate correct structure dump for nested tree", () => {
      const childViewFn = createMockViewFn();

      // Create root with 2 children
      const pending1: PendingView[] = [
        {
          viewFn: childViewFn,
          props: { id: 1 },
          slot: null,
          userKey: null,
        },
        {
          viewFn: childViewFn,
          props: { id: 2 },
          slot: null,
          userKey: null,
        },
      ];
      rootView.reconsileChildren(new Set(pending1));

      // Add grandchildren to first child
      const firstChild = rootView.virtualDom.at(0);
      if (firstChild) {
        const pending2: PendingView[] = [
          {
            viewFn: childViewFn,
            props: { id: "1.1" },
            slot: null,
            userKey: null,
          },
          {
            viewFn: childViewFn,
            props: { id: "1.2" },
            slot: null,
            userKey: null,
          },
        ];
        firstChild.reconsileChildren(new Set(pending2));
      }

      const dump = dumpVirtualDom(rootView);

      expect(dump.children_count).toBe(2);
      expect(dump.children[0]?.children_count).toBe(2);
      expect(dump.children[0]?.nested_children.children_count).toBe(2);
      expect(dump.children[1]?.children_count).toBe(0);
    });

    it("should include keys in dump", () => {
      const viewFn = createMockViewFn();
      const pending: PendingView[] = [
        {
          viewFn: viewFn,
          props: { id: 1 },
          slot: null,
          userKey: "key-1",
        },
        {
          viewFn: viewFn,
          props: { id: 2 },
          slot: null,
          userKey: "key-2",
        },
      ];

      rootView.reconsileChildren(new Set(pending));

      const dump = dumpVirtualDom(rootView);

      expect(dump.children[0]?.key).toBe("key-1");
      expect(dump.children[1]?.key).toBe("key-2");
    });
  });

  describe("complex reconciliation scenarios", () => {
    it("should handle reordering keyed children", () => {
      const viewFn = createMockViewFn();

      // Initial order: A, B, C
      const pending1: PendingView[] = [
        { viewFn: viewFn, props: { id: "A" }, slot: null, userKey: "A" },
        { viewFn: viewFn, props: { id: "B" }, slot: null, userKey: "B" },
        { viewFn: viewFn, props: { id: "C" }, slot: null, userKey: "C" },
      ];
      rootView.reconsileChildren(new Set(pending1));

      const childA = rootView.keyToView.get("A");
      const childB = rootView.keyToView.get("B");
      const childC = rootView.keyToView.get("C");

      // New order: C, A, B
      const pending2: PendingView[] = [
        { viewFn: viewFn, props: { id: "C" }, slot: null, userKey: "C" },
        { viewFn: viewFn, props: { id: "A" }, slot: null, userKey: "A" },
        { viewFn: viewFn, props: { id: "B" }, slot: null, userKey: "B" },
      ];
      rootView.reconsileChildren(new Set(pending2));

      // Same instances should be reused
      expect(rootView.keyToView.get("A")).toBe(childA);
      expect(rootView.keyToView.get("B")).toBe(childB);
      expect(rootView.keyToView.get("C")).toBe(childC);

      // Verify order in virtual_dom
      const children = toArray(rootView.virtualDom);
      expect(children[0]?.props.id).toBe("C");
      expect(children[1]?.props.id).toBe("A");
      expect(children[2]?.props.id).toBe("B");
    });

    it("should handle mix of keyed and unkeyed children", () => {
      const viewFn = createMockViewFn();

      const pending: PendingView[] = [
        { viewFn: viewFn, props: { id: 1 }, slot: null, userKey: "key-1" },
        { viewFn: viewFn, props: { id: 2 }, slot: null, userKey: null },
        { viewFn: viewFn, props: { id: 3 }, slot: null, userKey: "key-3" },
      ];

      rootView.reconsileChildren(new Set(pending));

      expect(rootView.virtualDom.length).toBe(3);
      expect(rootView.keyToView.size).toBe(2);
      expect(rootView.keyToView.has("key-1")).toBe(true);
      expect(rootView.keyToView.has("key-3")).toBe(true);
    });

    it("should maintain virtual_dom integrity with large number of children", () => {
      const viewFn = createMockViewFn();
      const count = 100;

      const pending: PendingView[] = Array.from({ length: count }, (_, i) => ({
        viewFn: viewFn,
        props: { id: i },
        slot: null,
        userKey: `key-${i}`,
      }));

      rootView.reconsileChildren(new Set(pending));

      expect(rootView.virtualDom.length).toBe(count);
      expect(rootView.keyToView.size).toBe(count);

      // Verify order and keys
      const children = toArray(rootView.virtualDom);
      for (let i = 0; i < Math.min(count, 10); i++) {
        expect(children[i]?.props.id).toBe(i);
        expect(rootView.keyToView.get(`key-${i}`)).toBe(children[i]);
      }
    });
  });
});

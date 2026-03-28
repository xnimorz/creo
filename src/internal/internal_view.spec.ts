import { describe, it, expect, beforeEach, mock } from "bun:test";
import { View, type PendingView } from "./internal_view";
import { Engine } from "./engine";
import type { ViewFn, ViewBody } from "@/public/view";
import type { Wildcard } from "./wildcard";
import { IndexedList } from "@/structures/indexed_list";
import type { IRender } from "@/render/render_interface";
import { orchestrator } from "./orchestrator";

// Mock renderer — sets renderRef so engine can distinguish new vs existing
const createMockRenderer = (): IRender<Wildcard> => ({
  render: mock((view: View) => {
    if (!view.renderRef) view.renderRef = {};
  }),
  unmount: mock((view: View) => {
    view.renderRef = undefined;
  }),
});

// Mock view function that returns a simple view body
const createMockViewFn = (onRender?: () => void): ViewFn<any, any> => {
  return ({ props, use }) => ({
    render: onRender || (() => {}),
  });
};

const toArray = <T>(list: IndexedList<T>): T[] => Array.from(list);

// Helper: create a viewFn whose render() produces children by calling child viewFns
function createParentViewFn(
  getChildren: () => { viewFn: ViewFn<any, any>; props: Record<string, unknown>; key?: string | number | null }[],
): ViewFn<any, any> {
  return (ctx) => ({
    render() {
      for (const child of getChildren()) {
        // Call through the public view API which uses engine.pendingView
        orchestrator.currentEngine()!.pendingView({
          viewFn: child.viewFn,
          props: child.props,
          slot: null,
          userKey: child.key ?? null,
        });
      }
    },
  });
}

describe("View - virtual_dom correctness", () => {
  let engine: Engine;
  let renderer: IRender<Wildcard>;

  beforeEach(() => {
    renderer = createMockRenderer();
    engine = new Engine(renderer);
    orchestrator.setCurrentEngine(engine);
  });

  it("should initialize with empty virtual_dom", () => {
    const viewFn = createMockViewFn();
    const rootView = new View(viewFn, {}, null, engine, null, null);
    expect(rootView.virtualDom?.length ?? 0).toBe(0);
  });

  it("should initialize keyToIndex as empty", () => {
    const viewFn = createMockViewFn();
    const rootView = new View(viewFn, {}, null, engine, null, null);
    expect(rootView.keyToIndex?.size ?? 0).toBe(0);
  });

  describe("reconsile", () => {
    it("should add single child to virtual_dom", () => {
      const childViewFn = createMockViewFn();
      let children = [{ viewFn: childViewFn, props: { name: "child1" } }];
      const parentFn = createParentViewFn(() => children);

      const rootView = new View(parentFn, {}, null, engine, null, null);
      engine.render();

      expect(rootView.virtualDom!.length).toBe(1);
      const child = rootView.virtualDom!.at(0);
      expect(child?.props).toEqual({ name: "child1" });
    });

    it("should add multiple children in order", () => {
      const viewFn1 = createMockViewFn();
      const viewFn2 = createMockViewFn();
      const viewFn3 = createMockViewFn();
      let children = [
        { viewFn: viewFn1, props: { id: 1 } },
        { viewFn: viewFn2, props: { id: 2 } },
        { viewFn: viewFn3, props: { id: 3 } },
      ];
      const parentFn = createParentViewFn(() => children);

      const rootView = new View(parentFn, {}, null, engine, null, null);
      engine.render();

      expect(rootView.virtualDom!.length).toBe(3);
      const vdomChildren = toArray(rootView.virtualDom!);
      expect(vdomChildren[0]?.props.id).toBe(1);
      expect(vdomChildren[1]?.props.id).toBe(2);
      expect(vdomChildren[2]?.props.id).toBe(3);
    });

    it("should replace children when reconciling with different viewFn", () => {
      const viewFn1 = createMockViewFn();
      const viewFn2 = createMockViewFn();
      let children: { viewFn: ViewFn<any, any>; props: Record<string, unknown> }[] = [
        { viewFn: viewFn1, props: { id: 1 } },
      ];
      const parentFn = createParentViewFn(() => children);

      const rootView = new View(parentFn, {}, null, engine, null, null);
      engine.render();
      expect(rootView.virtualDom!.length).toBe(1);

      // Second reconcile with different viewFn
      children = [
        { viewFn: viewFn2, props: { id: 2 } },
        { viewFn: viewFn2, props: { id: 3 } },
      ];
      rootView.markDirty();
      engine.render();

      expect(rootView.virtualDom!.length).toBe(2);
      const vdomChildren = toArray(rootView.virtualDom!);
      expect(vdomChildren[0]?.props.id).toBe(2);
      expect(vdomChildren[1]?.props.id).toBe(3);
    });

    it("should shrink virtual_dom when reconciling with fewer children", () => {
      const viewFn = createMockViewFn();
      let children = Array.from({ length: 5 }, (_, i) => ({
        viewFn,
        props: { id: i },
      }));
      const parentFn = createParentViewFn(() => children);

      const rootView = new View(parentFn, {}, null, engine, null, null);
      engine.render();
      expect(rootView.virtualDom!.length).toBe(5);

      children = Array.from({ length: 2 }, (_, i) => ({
        viewFn,
        props: { id: i },
      }));
      rootView.markDirty();
      engine.render();

      expect(rootView.virtualDom!.length).toBe(2);
    });

    it("should expand virtual_dom when reconciling with more children", () => {
      const viewFn = createMockViewFn();
      let children = [{ viewFn, props: { id: 0 } }];
      const parentFn = createParentViewFn(() => children);

      const rootView = new View(parentFn, {}, null, engine, null, null);
      engine.render();
      expect(rootView.virtualDom!.length).toBe(1);

      children = Array.from({ length: 5 }, (_, i) => ({
        viewFn,
        props: { id: i },
      }));
      rootView.markDirty();
      engine.render();

      expect(rootView.virtualDom!.length).toBe(5);
    });
  });

  describe("keyed reconciliation", () => {
    it("should track keyed children in keyToIndex", () => {
      const viewFn = createMockViewFn();
      const key = "child-key-1";
      let children = [{ viewFn, props: { id: 1 }, key }];
      const parentFn = createParentViewFn(() => children);

      const rootView = new View(parentFn, {}, null, engine, null, null);
      engine.render();

      expect(rootView.keyToIndex?.has(key)).toBe(true);
    });

    it("should reuse view with matching key", () => {
      const viewFn = createMockViewFn();
      const key = "child-key-1";
      let children: { viewFn: ViewFn<any, any>; props: Record<string, unknown>; key: string }[] = [
        { viewFn, props: { id: 1 }, key },
      ];
      const parentFn = createParentViewFn(() => children);

      const rootView = new View(parentFn, {}, null, engine, null, null);
      engine.render();

      const firstChild = rootView.virtualDom!.at(0);

      // Same key, different props
      children = [{ viewFn, props: { id: 2 }, key }];
      rootView.markDirty();
      engine.render();

      const secondChild = rootView.virtualDom!.at(0);
      expect(firstChild).toBe(secondChild);
      expect(secondChild?.props.id).toBe(2);
    });

    it("should replace view with different key", () => {
      const viewFn = createMockViewFn();
      let children: { viewFn: ViewFn<any, any>; props: Record<string, unknown>; key: string }[] = [
        { viewFn, props: { id: 1 }, key: "key-1" },
      ];
      const parentFn = createParentViewFn(() => children);

      const rootView = new View(parentFn, {}, null, engine, null, null);
      engine.render();

      const firstChild = rootView.virtualDom!.at(0);

      children = [{ viewFn, props: { id: 2 }, key: "key-2" }];
      rootView.markDirty();
      engine.render();

      const secondChild = rootView.virtualDom!.at(0);
      expect(firstChild).not.toBe(secondChild);
      expect(rootView.keyToIndex?.has("key-2")).toBe(true);
    });

    it("should handle multiple keyed children in correct order", () => {
      const viewFn = createMockViewFn();
      const keys = ["key-a", "key-b", "key-c"];
      let children = keys.map((key, i) => ({
        viewFn,
        props: { id: i, name: key },
        key,
      }));
      const parentFn = createParentViewFn(() => children);

      const rootView = new View(parentFn, {}, null, engine, null, null);
      engine.render();

      expect(rootView.virtualDom!.length).toBe(3);
      expect(rootView.keyToIndex!.size).toBe(3);

      const vdomChildren = toArray(rootView.virtualDom!);
      keys.forEach((key, i) => {
        expect(vdomChildren[i]?.props.name).toBe(key);
      });
    });

    it("should remove key from keyToIndex when child is disposed", () => {
      const viewFn = createMockViewFn();
      const key = "child-key-1";
      let children: { viewFn: ViewFn<any, any>; props: Record<string, unknown>; key: string }[] = [
        { viewFn, props: { id: 1 }, key },
      ];
      const parentFn = createParentViewFn(() => children);

      const rootView = new View(parentFn, {}, null, engine, null, null);
      engine.render();
      expect(rootView.keyToIndex?.has(key)).toBe(true);

      // Remove child (empty render)
      children = [];
      rootView.markDirty();
      engine.render();

      expect(rootView.keyToIndex?.has(key) ?? false).toBe(false);
    });
  });

  describe("viewFn replacement", () => {
    it("should replace view when viewFn changes (non-keyed)", () => {
      const viewFn1 = createMockViewFn();
      const viewFn2 = createMockViewFn();
      let children: { viewFn: ViewFn<any, any>; props: Record<string, unknown> }[] = [
        { viewFn: viewFn1, props: { id: 1 } },
      ];
      const parentFn = createParentViewFn(() => children);

      const rootView = new View(parentFn, {}, null, engine, null, null);
      engine.render();
      const firstChild = rootView.virtualDom!.at(0);

      children = [{ viewFn: viewFn2, props: { id: 1 } }];
      rootView.markDirty();
      engine.render();
      const secondChild = rootView.virtualDom!.at(0);

      expect(firstChild).not.toBe(secondChild);
      expect(firstChild?.viewFn).not.toBe(secondChild?.viewFn);
    });
  });

  describe("next_props", () => {
    it("should update props and mark dirty", () => {
      const viewFn = createMockViewFn();
      const rootView: View<any, any> = new View(viewFn, { initial: true }, null, engine, null, null);
      engine.render();

      const newProps = { updated: true };
      rootView.nextProps(newProps, null);

      expect(rootView.props).toEqual(newProps);
    });
  });

  describe("should_update", () => {
    it("should use custom shouldUpdate if provided", () => {
      const shouldUpdate = mock(() => false);
      const viewFn: ViewFn<any, any> = () => ({
        render: () => {},
        shouldUpdate,
      });

      const view = new View(viewFn, {}, null, engine, null, null);
      const result = view.shouldUpdate({ new: "props" });

      expect(result).toBe(false);
      expect(shouldUpdate).toHaveBeenCalled();
    });

    it("should use shallow_equal by default", () => {
      const viewFn = createMockViewFn();
      const view = new View(viewFn, { a: 1 }, null, engine, null, null);
      const result = view.shouldUpdate({ a: 1 });
      expect(typeof result).toBe("boolean");
    });
  });

  describe("lifecycle hooks", () => {
    it("should call onMount during initial render", () => {
      const onMount = mock(() => {});
      const viewFn: ViewFn<any, any> = () => ({
        render: () => {},
        onMount,
      });

      new View(viewFn, {}, null, engine, null, null);
      engine.render();

      expect(onMount).toHaveBeenCalled();
    });

    it("should call onUpdateBefore during re-render", () => {
      const onUpdateBefore = mock(() => {});
      const viewFn: ViewFn<any, any> = () => ({
        render: () => {},
        onUpdateBefore,
      });

      const view = new View(viewFn, {}, null, engine, null, null);
      engine.render();
      expect(onUpdateBefore).not.toHaveBeenCalled();

      view.props = { changed: true };
      view.markDirty();
      engine.render();

      expect(onUpdateBefore).toHaveBeenCalled();
    });
  });

  describe("complex reconciliation scenarios", () => {
    it("should handle reordering keyed children", () => {
      const viewFn = createMockViewFn();
      let children = [
        { viewFn, props: { id: "A" }, key: "A" },
        { viewFn, props: { id: "B" }, key: "B" },
        { viewFn, props: { id: "C" }, key: "C" },
      ];
      const parentFn = createParentViewFn(() => children);

      const rootView = new View(parentFn, {}, null, engine, null, null);
      engine.render();

      const childA = rootView.virtualDom!.at(0)!;
      const childB = rootView.virtualDom!.at(1)!;
      const childC = rootView.virtualDom!.at(2)!;

      // New order: C, A, B
      children = [
        { viewFn, props: { id: "C" }, key: "C" },
        { viewFn, props: { id: "A" }, key: "A" },
        { viewFn, props: { id: "B" }, key: "B" },
      ];
      rootView.markDirty();
      engine.render();

      // Same instances should be reused
      const vdomChildren = toArray(rootView.virtualDom!);
      expect(vdomChildren[0]).toBe(childC);
      expect(vdomChildren[1]).toBe(childA);
      expect(vdomChildren[2]).toBe(childB);
    });

    it("should handle mix of keyed and unkeyed children", () => {
      const viewFn = createMockViewFn();
      let children = [
        { viewFn, props: { id: 1 }, key: "key-1" as string | null },
        { viewFn, props: { id: 2 }, key: null },
        { viewFn, props: { id: 3 }, key: "key-3" as string | null },
      ];
      const parentFn = createParentViewFn(() => children);

      const rootView = new View(parentFn, {}, null, engine, null, null);
      engine.render();

      expect(rootView.virtualDom!.length).toBe(3);
      expect(rootView.keyToIndex!.size).toBe(2);
      expect(rootView.keyToIndex!.has("key-1")).toBe(true);
      expect(rootView.keyToIndex!.has("key-3")).toBe(true);
    });

    it("should maintain virtual_dom integrity with large number of children", () => {
      const viewFn = createMockViewFn();
      const count = 100;
      let children = Array.from({ length: count }, (_, i) => ({
        viewFn,
        props: { id: i },
        key: `key-${i}`,
      }));
      const parentFn = createParentViewFn(() => children);

      const rootView = new View(parentFn, {}, null, engine, null, null);
      engine.render();

      expect(rootView.virtualDom!.length).toBe(count);
      expect(rootView.keyToIndex!.size).toBe(count);

      const vdomChildren = toArray(rootView.virtualDom!);
      for (let i = 0; i < Math.min(count, 10); i++) {
        expect(vdomChildren[i]?.props.id).toBe(i);
      }
    });
  });
});

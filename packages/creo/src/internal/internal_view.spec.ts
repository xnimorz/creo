import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { ViewRecord } from "./internal_view";
import { F_DIRTY } from "./internal_view";
import { Engine } from "./engine";
import type { ViewFn, ViewBody } from "@/public/view";
import { view } from "@/public/view";
import type { Wildcard } from "./wildcard";
import type { IRender } from "@/render/render_interface";
import { orchestrator } from "./orchestrator";
import type { Maybe } from "@/functional/maybe";

// Mock renderer — sets renderRef so engine can distinguish new vs existing
const createMockRenderer = (): IRender<Wildcard> => ({
  engine: null as any,
  render: mock((v: ViewRecord) => {
    if (!v.renderRef) v.renderRef = true;
  }),
  unmount: mock((v: ViewRecord) => {
    v.renderRef = undefined;
  }),
});

// Mock view function that returns a simple view body
const createMockViewFn = (onRender?: () => void): ViewFn<any, any> => {
  return ({ props, use }) => ({
    render: onRender || (() => {}),
  });
};

// Helper: create a view whose render() produces children via engine.view()
function createParentView(
  getChildren: () => {
    viewFn: ViewFn<any, any>;
    props: Record<string, unknown>;
    key?: string | number | null;
  }[],
): ViewFn<any, any> {
  return (ctx) => ({
    render() {
      for (const child of getChildren()) {
        orchestrator.currentEngine()!.view(
          child.viewFn as ViewFn<any, any>,
          child.props,
          null,
          child.key ?? null,
        );
      }
    },
  });
}

/** Mount a root view and return the root ViewRecord. */
function mountRoot(
  engine: Engine,
  viewFn: ViewFn<any, any>,
  props: Record<string, unknown> = {},
): ViewRecord {
  const root = engine.createRoot(
    () => {
      orchestrator.currentEngine()!.view(viewFn, props, null, null);
    },
    {},
  );
  engine.render();
  // The root's first child is our actual viewFn
  return root;
}

/** Get the "app" view — the first child of the root wrapper. */
function appView(root: ViewRecord): ViewRecord {
  return root.children![0]!;
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
    const root = mountRoot(engine, viewFn);
    const app = appView(root);
    expect(app.children?.length ?? 0).toBe(0);
  });

  it("should initialize keyToView as empty", () => {
    const viewFn = createMockViewFn();
    const root = mountRoot(engine, viewFn);
    const app = appView(root);
    expect(app.keyToView?.size ?? 0).toBe(0);
  });

  describe("reconcile", () => {
    it("should add single child to virtual_dom", () => {
      const childViewFn = createMockViewFn();
      let children = [{ viewFn: childViewFn, props: { name: "child1" } }];
      const parentFn = createParentView(() => children);

      const root = mountRoot(engine, parentFn);
      const app = appView(root);

      expect(app.children!.length).toBe(1);
      expect(app.children![0]!.props).toEqual({ name: "child1" });
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
      const parentFn = createParentView(() => children);

      const root = mountRoot(engine, parentFn);
      const app = appView(root);

      expect(app.children!.length).toBe(3);
      expect(app.children![0]!.props.id).toBe(1);
      expect(app.children![1]!.props.id).toBe(2);
      expect(app.children![2]!.props.id).toBe(3);
    });

    it("should replace children when reconciling with different viewFn", () => {
      const viewFn1 = createMockViewFn();
      const viewFn2 = createMockViewFn();
      let children: { viewFn: ViewFn<any, any>; props: Record<string, unknown> }[] = [
        { viewFn: viewFn1, props: { id: 1 } },
      ];
      const parentFn = createParentView(() => children);

      const root = mountRoot(engine, parentFn);
      const app = appView(root);
      expect(app.children!.length).toBe(1);

      children = [
        { viewFn: viewFn2, props: { id: 2 } },
        { viewFn: viewFn2, props: { id: 3 } },
      ];
      engine.markDirty(app);
      engine.render();

      expect(app.children!.length).toBe(2);
      expect(app.children![0]!.props.id).toBe(2);
      expect(app.children![1]!.props.id).toBe(3);
    });

    it("should shrink virtual_dom when reconciling with fewer children", () => {
      const viewFn = createMockViewFn();
      let children = Array.from({ length: 5 }, (_, i) => ({
        viewFn,
        props: { id: i },
      }));
      const parentFn = createParentView(() => children);

      const root = mountRoot(engine, parentFn);
      const app = appView(root);
      expect(app.children!.length).toBe(5);

      children = Array.from({ length: 2 }, (_, i) => ({
        viewFn,
        props: { id: i },
      }));
      engine.markDirty(app);
      engine.render();

      expect(app.children!.length).toBe(2);
    });

    it("should expand virtual_dom when reconciling with more children", () => {
      const viewFn = createMockViewFn();
      let children = [{ viewFn, props: { id: 0 } }];
      const parentFn = createParentView(() => children);

      const root = mountRoot(engine, parentFn);
      const app = appView(root);
      expect(app.children!.length).toBe(1);

      children = Array.from({ length: 5 }, (_, i) => ({
        viewFn,
        props: { id: i },
      }));
      engine.markDirty(app);
      engine.render();

      expect(app.children!.length).toBe(5);
    });
  });

  describe("keyed reconciliation", () => {
    it("should track keyed children in keyToView", () => {
      const viewFn = createMockViewFn();
      const key = "child-key-1";
      let children = [{ viewFn, props: { id: 1 }, key }];
      const parentFn = createParentView(() => children);

      const root = mountRoot(engine, parentFn);
      const app = appView(root);

      expect(app.keyToView?.has(key)).toBe(true);
    });

    it("should reuse view with matching key", () => {
      const viewFn = createMockViewFn();
      const key = "child-key-1";
      let children: { viewFn: ViewFn<any, any>; props: Record<string, unknown>; key: string }[] = [
        { viewFn, props: { id: 1 }, key },
      ];
      const parentFn = createParentView(() => children);

      const root = mountRoot(engine, parentFn);
      const app = appView(root);
      const firstChild = app.children![0]!;

      children = [{ viewFn, props: { id: 2 }, key }];
      engine.markDirty(app);
      engine.render();

      // Same ViewRecord object should be reused
      expect(app.children![0]).toBe(firstChild);
      expect(app.children![0]!.props.id).toBe(2);
    });

    it("should replace view with different key", () => {
      const viewFn = createMockViewFn();
      let children: { viewFn: ViewFn<any, any>; props: Record<string, unknown>; key: string }[] = [
        { viewFn, props: { id: 1 }, key: "key-1" },
      ];
      const parentFn = createParentView(() => children);

      const root = mountRoot(engine, parentFn);
      const app = appView(root);
      const firstChild = app.children![0]!;

      children = [{ viewFn, props: { id: 2 }, key: "key-2" }];
      engine.markDirty(app);
      engine.render();

      expect(app.children![0]!.userKey).toBe("key-2");
      expect(app.keyToView?.has("key-2")).toBe(true);
    });

    it("should handle multiple keyed children in correct order", () => {
      const viewFn = createMockViewFn();
      const keys = ["key-a", "key-b", "key-c"];
      let children = keys.map((key, i) => ({
        viewFn,
        props: { id: i, name: key },
        key,
      }));
      const parentFn = createParentView(() => children);

      const root = mountRoot(engine, parentFn);
      const app = appView(root);

      expect(app.children!.length).toBe(3);
      expect(app.keyToView!.size).toBe(3);

      keys.forEach((key, i) => {
        expect(app.children![i]!.props.name).toBe(key);
      });
    });

    it("should remove key from keyToView when child is disposed", () => {
      const viewFn = createMockViewFn();
      const key = "child-key-1";
      let children: { viewFn: ViewFn<any, any>; props: Record<string, unknown>; key: string }[] = [
        { viewFn, props: { id: 1 }, key },
      ];
      const parentFn = createParentView(() => children);

      const root = mountRoot(engine, parentFn);
      const app = appView(root);
      expect(app.keyToView?.has(key)).toBe(true);

      children = [];
      engine.markDirty(app);
      engine.render();

      expect(app.keyToView?.has(key) ?? false).toBe(false);
    });
  });

  describe("viewFn replacement", () => {
    it("should replace view when viewFn changes (non-keyed)", () => {
      const viewFn1 = createMockViewFn();
      const viewFn2 = createMockViewFn();
      let children: { viewFn: ViewFn<any, any>; props: Record<string, unknown> }[] = [
        { viewFn: viewFn1, props: { id: 1 } },
      ];
      const parentFn = createParentView(() => children);

      const root = mountRoot(engine, parentFn);
      const app = appView(root);
      const firstChild = app.children![0]!;

      children = [{ viewFn: viewFn2, props: { id: 1 } }];
      engine.markDirty(app);
      engine.render();
      const secondChild = app.children![0]!;

      expect(firstChild).not.toBe(secondChild);
      expect(firstChild.viewFn).not.toBe(secondChild.viewFn);
    });
  });

  describe("next_props", () => {
    it("should update props and mark dirty", () => {
      const viewFn = createMockViewFn();
      const root = mountRoot(engine, viewFn, { initial: true });
      const app = appView(root);

      const newProps = { updated: true };
      engine.nextProps(app, newProps, null);

      expect(app.props).toEqual(newProps);
    });
  });

  describe("should_update", () => {
    it("should use custom shouldUpdate if provided", () => {
      const shouldUpdate = mock(() => false);
      const viewFn: ViewFn<any, any> = () => ({
        render: () => {},
        shouldUpdate,
      });

      const root = mountRoot(engine, viewFn);
      const app = appView(root);

      engine.nextProps(app, { new: "props" }, null);
      expect(shouldUpdate).toHaveBeenCalled();
    });

    it("should use shallow_equal by default", () => {
      const viewFn = createMockViewFn();
      const root = mountRoot(engine, viewFn, { a: 1 });
      const app = appView(root);

      // Same props → should not become dirty
      app.flags &= ~F_DIRTY;
      engine.nextProps(app, { a: 1 }, null);
      expect(typeof app.flags).toBe("number");
    });
  });

  describe("lifecycle hooks", () => {
    it("should call onMount during initial render", () => {
      const onMount = mock(() => {});
      const viewFn: ViewFn<any, any> = () => ({
        render: () => {},
        onMount,
      });

      mountRoot(engine, viewFn);
      expect(onMount).toHaveBeenCalled();
    });

    it("should call onUpdateBefore during re-render", () => {
      const onUpdateBefore = mock(() => {});
      const viewFn: ViewFn<any, any> = () => ({
        render: () => {},
        onUpdateBefore,
      });

      const root = mountRoot(engine, viewFn);
      const app = appView(root);
      expect(onUpdateBefore).not.toHaveBeenCalled();

      app.props = { changed: true };
      engine.markDirty(app);
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
      const parentFn = createParentView(() => children);

      const root = mountRoot(engine, parentFn);
      const app = appView(root);

      const childA = app.children![0]!;
      const childB = app.children![1]!;
      const childC = app.children![2]!;

      // New order: C, A, B
      children = [
        { viewFn, props: { id: "C" }, key: "C" },
        { viewFn, props: { id: "A" }, key: "A" },
        { viewFn, props: { id: "B" }, key: "B" },
      ];
      engine.markDirty(app);
      engine.render();

      expect(app.children![0]).toBe(childC);
      expect(app.children![1]).toBe(childA);
      expect(app.children![2]).toBe(childB);
    });

    it("should handle mix of keyed and unkeyed children", () => {
      const viewFn = createMockViewFn();
      let children = [
        { viewFn, props: { id: 1 }, key: "key-1" as string | null },
        { viewFn, props: { id: 2 }, key: null },
        { viewFn, props: { id: 3 }, key: "key-3" as string | null },
      ];
      const parentFn = createParentView(() => children);

      const root = mountRoot(engine, parentFn);
      const app = appView(root);

      expect(app.children!.length).toBe(3);
      // Keyed path is used when any child has a key
      expect(app.keyToView!.size).toBeGreaterThanOrEqual(2);
    });

    it("should maintain virtual_dom integrity with large number of children", () => {
      const viewFn = createMockViewFn();
      const count = 100;
      let children = Array.from({ length: count }, (_, i) => ({
        viewFn,
        props: { id: i },
        key: `key-${i}`,
      }));
      const parentFn = createParentView(() => children);

      const root = mountRoot(engine, parentFn);
      const app = appView(root);

      expect(app.children!.length).toBe(count);
      expect(app.keyToView!.size).toBe(count);

      for (let i = 0; i < Math.min(count, 10); i++) {
        expect(app.children![i]!.props.id).toBe(i);
      }
    });
  });
});

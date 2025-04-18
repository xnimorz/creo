import { assertJust } from "./data-structures/assert/assert";
import { Maybe } from "./data-structures/maybe/Maybe";
import { Context } from "./engine/Context";
import { getActiveLayoutEngine } from "./engine/GlobalContext";
import { Key } from "./engine/Key";
import { LayoutEngine } from "./engine/LayoutEngine";
import { Node } from "./engine/Node";

export type NodeMethods<P = void, A = void> = {
  render(): void;
  didMount?(): void;
  didUpdate?(): void;
  dispose?(): void;
  // Return true if the component should get updated with new params
  shouldUpdate?(pendingParams: P): boolean;
  extension?: A extends void ? undefined : A;
};

export type NodeBuilder<P = void, A = void> = (
  c: Context<P>,
) => NodeMethods<P, A>;

type NodeBuilderFn<P = void, A = void> = (p?: P, slot?: () => void) => Node<A>;

export function creo<P = void, A = void>(
  ctor: NodeBuilder<P, A>,
): NodeBuilderFn<P, A> {
  return (params?: P, slot?: () => void) => {
    // Get Potential pre-existing instance of the component:
    const maybeLayout = getActiveLayoutEngine();
    assertJust(
      maybeLayout,
      "Component can be initialised only inside creo rendering cycle",
    );
    const layout: LayoutEngine = maybeLayout;

    // 2. Check if there is an existing component
    let userKey: Maybe<Key>;
    // If key is provided separately, use provided key:
    if (
      params != null &&
      typeof params === "object" &&
      "key" in params &&
      params.key != null &&
      (typeof params.key === "string" || typeof params.key === "number")
    ) {
      userKey = params.key;
    }

    // 3. Get component's parent
    const maybeParent = layout.getCurrentlyRenderingNode();
    assertJust(
      maybeParent,
      "There is no rendering context for currently rendering component",
    );
    const parent = maybeParent;
    const node = parent.renderChild(userKey, ctor, params, slot, null);

    // 4. Public component contains all the required methods
    return node.publicNode;
  };
}

// UI renderers
type UINodeBuilderFn<P = void, A = void> = (
  tag: string,
  p?: P,
  slot?: Maybe<() => void>,
) => Node<A>;

function creoUI<P = void, A = void>(
  ctor: NodeBuilder<P, A>,
): UINodeBuilderFn<P, A> {
  return (tag: string, params?: P, slot?: Maybe<() => void>) => {
    // Get Potential pre-existing instance of the component:
    const maybeLayout = getActiveLayoutEngine();
    assertJust(
      maybeLayout,
      "Component can be initialised only inside creo rendering cycle",
    );
    const layout: LayoutEngine = maybeLayout;

    // 2. Check if there is an existing component
    let userKey: Maybe<Key>;
    // If key is provided separately, use provided key:
    if (
      params != null &&
      typeof params === "object" &&
      "key" in params &&
      params.key != null &&
      (typeof params.key === "string" || typeof params.key === "number")
    ) {
      userKey = params.key;
    }

    // 3. Get component's parent
    const maybeParent = layout.getCurrentlyRenderingNode();
    assertJust(
      maybeParent,
      "There is no rendering context for currently rendering component",
    );
    const parent = maybeParent;
    const node = parent.renderChild(userKey, ctor, params, slot, tag);

    // 4. Public component contains all the required methods
    return node.publicNode;
  };
}

const uiCtor = <P>(c: Context<P>) => ({
  render() {
    c.slot?.();
  },
});

export const ui = creoUI(uiCtor);

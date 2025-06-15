import { assertJust } from "./data-structures/assert/assert";
import { Maybe } from "./data-structures/maybe/Maybe";
import { Context } from "./DOM/Context";
import { DomEngine, getActiveEngine } from "./DOM/DomEngine";
import { Key } from "./DOM/Key";

export type NodeMethods<P = void, A = void> = {
  render(): void;
  didMount?(): void;
  didUpdate?(): void;
  dispose?(): void;
  // Return true if the component should get updated with new params
  shouldUpdate?(pendingParams: P): boolean;
  ext?: A extends void ? undefined : A;
};

export type NodeBuilder<P = void, A = void> = (
  c: Context<P>,
) => NodeMethods<P, A>;

type NodeBuilderFn<P = void, A = void> = (p?: P, slot?: () => void) => A;

export function creo<P = void, A = void>(
  ctor: NodeBuilder<P, A>,
): NodeBuilderFn<P, A> {
  return (params?: P, slot?: () => void) => {
    // Get Potential pre-existing instance of the component:
    const maybeLayout = getActiveEngine();
    assertJust(
      maybeLayout,
      "Component can be initialised only inside creo rendering cycle",
    );
    const engine: DomEngine = maybeLayout;

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
    const maybeParent = engine.getParent();
    assertJust(
      maybeParent,
      "There is no rendering context for currently rendering component",
    );
    const parent = maybeParent;
    const node = parent.renderChild(userKey, ctor, params, slot, null);

    // 4. Public component contains all the required methods
    return node.publicApi;
  };
}

// UI renderers
type UINodeBuilderFn<P = void> = (
  tag: string,
  p?: P,
  slot?: Maybe<() => void>,
) => HTMLElement;

function creoUI<P = void>(ctor: NodeBuilder<P, void>): UINodeBuilderFn<P> {
  return (tag: string, params?: P, slot?: Maybe<() => void>) => {
    // Get Potential pre-existing instance of the component:
    const maybeLayout = getActiveEngine();
    assertJust(
      maybeLayout,
      "Component can be initialised only inside creo rendering cycle",
    );
    const engine: DomEngine = maybeLayout;

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
    const maybeParent = engine.getParent();
    assertJust(
      maybeParent,
      "There is no rendering context for currently rendering component",
    );
    const parent = maybeParent;
    const node = parent.renderChild(userKey, ctor, params, slot, tag);

    // 4. Public component contains all the required methods
    return node.publicApi;
  };
}

const uiCtor = <P>(c: Context<P>) => ({
  render() {
    c.slot?.();
  },
});

export const ui = creoUI(uiCtor);

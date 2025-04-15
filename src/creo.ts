import { Component, ComponentMethods } from "./Component";
import { assertJust } from "./data-structures/assert/assert";
import { Maybe } from "./data-structures/maybe/Maybe";
import { Context } from "./engine/Context";
import { getActiveLayoutEngine } from "./engine/GlobalContext";
import { Key } from "./engine/Key";
import { LayoutEngine } from "./engine/LayoutEngine";

export type ComponentBuilder<P = void, A = void> = (
  c: Context<P>,
) => ComponentMethods<P, A>;

type ComponentBuilderFn<P = void, A = void> = (
  p?: P,
  slot?: () => void,
) => Component<A>;

export type UIComponentBuilderFn<P = void, A = void> = (
  tag: string,
  p?: P,
  slot?: Maybe<() => void>,
) => Component<A>;

export function creoNode<P = void, A = void>(
  ctor: ComponentBuilder<P, A>,
): UIComponentBuilderFn<P, A> {
  return (tag: string, params?: P, slot?: Maybe<() => void>) => {
    // Get Potential pre-existing instance of the component:
    const maybeLayout = getActiveLayoutEngine();
    assertJust(
      maybeLayout,
      "Component can be initialised only inside creo rendering cycle",
    );
    const layout: LayoutEngine = maybeLayout;

    // 2. Check if there is an existing component
    let key: Maybe<Key>;
    // If key is provided separately, use provided key:
    if (
      params != null &&
      typeof params === "object" &&
      "key" in params &&
      params.key != null &&
      (typeof params.key === "string" || typeof params.key === "number")
    ) {
      key = params.key;
    }

    // 3. Get component's parent
    const maybeParent = layout.peekComponentRender();
    assertJust(
      maybeParent,
      "There is no rendering context for currently rendering component",
    );
    const parent = maybeParent;
    const ic = parent.reconsileChild(key, ctor, params, slot, tag);

    // 4. Public component contains all the required methods
    return ic.publicComponent;
  };
}

export function creo<P = void, A = void>(
  ctor: ComponentBuilder<P, A>,
): ComponentBuilderFn<P, A> {
  return (params?: P, slot?: () => void) => {
    // Get Potential pre-existing instance of the component:
    const maybeLayout = getActiveLayoutEngine();
    assertJust(
      maybeLayout,
      "Component can be initialised only inside creo rendering cycle",
    );
    const layout: LayoutEngine = maybeLayout;

    // 2. Check if there is an existing component
    let key: Maybe<Key>;
    // If key is provided separately, use provided key:
    if (
      params != null &&
      typeof params === "object" &&
      "key" in params &&
      params.key != null &&
      (typeof params.key === "string" || typeof params.key === "number")
    ) {
      key = params.key;
    }

    // 3. Get component's parent
    const maybeParent = layout.peekComponentRender();
    assertJust(
      maybeParent,
      "There is no rendering context for currently rendering component",
    );
    const parent = maybeParent;
    const ic = parent.reconsileChild(key, ctor, params, slot, null);

    // 4. Public component contains all the required methods
    return ic.publicComponent;
  };
}

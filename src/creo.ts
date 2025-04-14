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

type ComponentBuilderFn<P = void, A = void> = (p: P) => Component<A>;

export function creo<P = void, A = void>(
  ctor: ComponentBuilder<P, A>,
): ComponentBuilderFn<P, A> {
  return (params: P) => {
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
    const ic = parent.reconsileChild(key, ctor, params);

    // 4. Public component contains all the required methods
    return ic.publicComponent;
  };
}

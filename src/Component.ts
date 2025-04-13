import { assertJust } from "./data-structures/assert/assert";
import { Maybe } from "./data-structures/maybe/Maybe";
import { Context } from "./engine/Context";
import { getActiveLayoutEngine } from "./engine/GlobalContext";
import { Key } from "./engine/Key";
import { LayoutEngine } from "./engine/LayoutEngine";

export type ComponentBuilder<P = void, A extends object = {}> = (
  p: P,
  c: Context,
) => ComponentMethods<A>;

type ComponentBuilderFn<P = void, A extends object = {}> = (
  p: P,
) => Component<A>;

export function creo<P = void, A extends object = {}>(
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

    layout.registry.

      if (isNone(key)) {
        this.key = this.layout.generateUniqueKey();
      } else {
        this.key = key;
      }

    return new PublicComponent();
  };
}

export type ComponentMethods<A extends object = {}> = {
  render(): void;
  didMount?(): void;
  didUpdate?(): void;
  dispose?(): void;
  // with?(...slots: Array<() => void>): void; /?? (we can re-use & A for that)
} & A;

export class PublicComponent<P = void, A extends object = {}>
  implements Component<A> {
  ctor: ComponentBuilder<P, A>;

}

// @ts-ignore
export interface Component<A extends object = {}> extends A {}

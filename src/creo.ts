import { assertJust } from "./data-structures/assert/assert";
import { Maybe } from "./data-structures/maybe/Maybe";
import { Wildcard } from "./data-structures/wildcard/wildcard";
import { Context } from "./DOM/Context";
import { DomEngine, getActiveEngine } from "./DOM/DomEngine";
import { Key } from "./DOM/Key";
import { UINode } from "./DOM/Node";

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

type NodeBuilderFn<P = void, A = void> = (
  p?: P,
  slot?: () => void,
) => { ext: A };

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
  p?: P,
  slot?: Maybe<() => void>,
) => () => Maybe<HTMLElement>;

type UITextNodeBuilderFn<P = void> = (
  p?: P,
  slot?: Maybe<() => void>,
) => () => Maybe<Text>;

function creoUI<P = void, Tag extends Maybe<string> = string>(
  tag: Tag,
): Tag extends "Text" ? UITextNodeBuilderFn<P> : UINodeBuilderFn<P> {
  // @ts-ignore
  return (params?: P, slot?: Maybe<() => void>) => {
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
    // TODO: Use separate methods to render Text and UI components
    const node: UINode = parent.renderChild(
      userKey,
      uiCtor,
      params,
      slot,
      tag,
    ) as UINode;
    // 4. Public component contains all the required methods
    return node.publicNode;
  };
}

const uiCtor = <P>(c: Context<P>) => ({
  render() {
    c.slot?.();
  },
});

export const ui = creoUI;
export const Button = ui<Wildcard>("button");
export const Block = ui<Wildcard>("div");
export const Inline = ui<Wildcard>("span");
export const Text = ui<string>("text");

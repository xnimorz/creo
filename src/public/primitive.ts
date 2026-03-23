import { orchestrator } from "@/internal/orchestrator";
import type { Maybe } from "@/functional/maybe";
import type { Key } from "@/functional/key";
import type { ViewFn, Slot } from "./view";
import type { Wildcard } from "@/internal/wildcard";

/**
 * Maps event type { click: (e: X) => void } to
 * handler props { onClick?: (e: X) => void }.
 */
export type EventHandlerProps<Events> = {
  [K in keyof Events as `on${Capitalize<string & K>}`]?: Events[K];
};

/**
 * Props passed when calling a primitive in the render stream.
 * Attrs + on* event handler props + optional key.
 */
export type PrimitiveProps<Attrs, Events> = Attrs &
  EventHandlerProps<Events> & { key?: Key };

export const $primitive = Symbol("primitive");

export interface PrimitiveComponent<Attrs, Events> {
  (props?: PrimitiveProps<Attrs, Events> | undefined, slot?: Slot): void;
  viewFn: ViewFn<PrimitiveProps<Attrs, Events>, void>;
}

/**
 * Creates an engine-agnostic primitive component.
 *
 *   const canvas = primitive<CanvasAttrs, CanvasEvents>();
 *
 *   // In render — event handlers as props:
 *   canvas({ width: 800, onClick: (e) => { ... } });
 */
export function primitive<Attrs = {}, Events = {}>(): PrimitiveComponent<
  Attrs,
  Events
> {
  const viewFn: ViewFn<PrimitiveProps<Attrs, Events>, void> = (ctx) => ({
    render() {
      ctx.slot?.();
    },
  });
  (viewFn as Wildcard)[$primitive] = true;

  const invoke = ((
    props?: PrimitiveProps<Attrs, Events> | undefined,
    slot?: Slot,
  ): void => {
    const userKey: Maybe<Key> = props?.key ?? undefined;
    const engine = orchestrator.currentEngine()!;
    engine.addToPendingViews({
      viewFn: viewFn as ViewFn<Wildcard, Wildcard>,
      props: props ?? {},
      slot,
      userKey,
    });
  }) as PrimitiveComponent<Attrs, Events>;

  invoke.viewFn = viewFn as ViewFn<Wildcard, Wildcard>;
  return invoke;
}

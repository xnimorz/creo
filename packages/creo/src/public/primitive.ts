import type { Key } from "@/functional/key";
import type { Slot, ViewBody } from "./view";

/**
 * Props passed when calling a primitive in the render stream.
 * Attrs + nested `on` event-handler object + optional key.
 *
 * Events are grouped under `on` (e.g. `{ on: { click, input } }`) instead of
 * being mixed into the prop bag as `onClick`, `onInput`, … This keeps the
 * event namespace separate from HTML attrs and lets the renderer skip the
 * per-prop event-detection step on every diff.
 */
export type PrimitiveProps<Attrs, Events> = Attrs & {
  on?: Partial<Events>;
  key?: Key;
};

export const $primitive = Symbol("primitive");

export function primitiveViewFn<Props>({
  slot,
}: {
  slot: Slot;
}): ViewBody<Props> {
  return {
    render() {
      slot();
    },
  };
}

import type { Key } from "@/functional/key";
import type { Slot, ViewBody } from "./view";

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

export function primitiveViewFn<Props>({
  slot,
}: {
  slot: Slot;
}): ViewBody<Props, void> {
  return {
    render() {
      slot();
    },
  };
}

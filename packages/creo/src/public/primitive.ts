import type { Key } from "@/functional/key";
import type { Slot, ViewBody } from "./view";

/** Events live under `on` so the renderer never scans attrs for handlers. */
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

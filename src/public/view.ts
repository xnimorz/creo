import type { Key } from "@/functional/key";
import { just, type Maybe } from "@/functional/maybe";
import { orchestrator } from "@/internal/orchestrator";
import type { Store } from "@/public/store";
import type { StateFactory } from "./state";

export type ViewBody<Props, Api> = Api extends void
  ? {
      render: () => void;
      mount?: {
        before?: () => void;
        after?: () => void;
      };
      update?: {
        should?: (nextProps: Props) => boolean;
        before?: () => void;
        after?: () => void;
      };
    }
  : {
      render: () => void;
      mount?: {
        before?: () => void;
        after?: () => void;
      };
      update?: {
        should?: (nextProps: Props) => boolean;
        before?: () => void;
        after?: () => void;
      };
      api: Api;
    };

export type ViewFn<Props, Api> = (ctx: {
  props: Props;
  state: StateFactory;
  store: Store;
  slot: Slot;
}) => ViewBody<Props, Api>;

export type Slot = () => void;

export function view<Props = void, Api = void>(
  body: (ctx: {
    props: Props;
    state: StateFactory;
    store: Store;
    slot: Slot;
  }) => ViewBody<Props, Api>,
) {
  return (props: Props & { key?: Key }, slot?: Slot) => {
    const userKey: Maybe<Key> = maybeGetUserKey(props);
    const engine = orchestrator.currentEngine()!;    
    engine.addToPendingViews({
      viewFn: body,
      props,
      slot,
      userKey: userKey,
    });
  };
}

// If key is provided separately, use provided key:
function maybeGetUserKey<P>(params: P): Maybe<Key> {
  if (
    params != null &&
    typeof params === "object" &&
    "key" in params &&
    params.key != null &&
    (typeof params.key === "string" || typeof params.key === "number")
  ) {
    return params.key;
  }
}

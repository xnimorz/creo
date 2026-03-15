import { assertNever } from "@/functional/assert";
import type { Key } from "@/functional/key";
import { just, type Maybe } from "@/functional/maybe";
import { orchestrator } from "@/internal/orchestrator";
import type { Store } from "@/public/store";
import type { State } from "./state";

export type ViewBody<Props, Api, Tag> = Tag extends void
  ? Api extends void
    ? {
        render: () => void;
        mount?: {
          before?: () => void;
          after?: () => void;
        };
        update?: {
          should?: (next_props: Props) => boolean;
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
          should?: (next_props: Props) => boolean;
          before?: () => void;
          after?: () => void;
        };
        api: Api;
      }
  : Api extends void
    ? {
        tag: Tag;
        render: () => void;
        mount?: {
          before?: () => void;
          after?: () => void;
        };
        update?: {
          should?: (next_props: Props) => boolean;
          before?: () => void;
          after?: () => void;
        };
      }
    : {
        tag: Tag;
        render: () => void;
        mount?: {
          before?: () => void;
          after?: () => void;
        };
        update?: {
          should?: (next_props: Props) => boolean;
          before?: () => void;
          after?: () => void;
        };
        api: Api;
      };

export type ViewFn<Props, Api, Tag = void> = (ctx: {
  props: Props;
  state: State;
  store: Store;
  slot: Slot;
}) => ViewBody<Props, Api, Tag>;

export type Slot = () => void;

export function view<Props = void, Api = void, Tag = void>(
  body: (ctx: {
    props: Props;
    state: State;
    store: Store;
    slot: Slot;
  }) => ViewBody<Props, Api, Tag>,
) {
  return (props: Props, slot: Slot) => {
    const user_key: Maybe<Key> = maybeGetUserKey(props);
    const engine = orchestrator.current_engine();
    just(engine);
    engine.add_to_pending_views({
      view_fn: body,
      props,
      slot,
      user_key,
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

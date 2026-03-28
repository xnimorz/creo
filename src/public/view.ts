import type { Key } from "@/functional/key";
import type { Maybe } from "@/functional/maybe";
import { orchestrator } from "@/internal/orchestrator";
import type { Use } from "./state";
import type { PendingView } from "@/internal/internal_view";
import type { $primitive } from "./primitive";

export type ViewBody<Props, Api> = Api extends void
  ? {
      render: () => void;
      onMount?: () => void;
      shouldUpdate?: (nextProps: Props) => boolean;
      onUpdateBefore?: () => void;
      onUpdateafter?: () => void;
    }
  : {
      render: () => void;
      onMount?: () => void;
      shouldUpdate?: (nextProps: Props) => boolean;
      onUpdateBefore?: () => void;
      onUpdateafter?: () => void;
      api: Api;
    };

/** Slot callback — passed by the caller at the call site. */
export type Slot = () => void;

/** Children — pre-collected PendingViews available inside the view. */
export type Children = Maybe<PendingView[]>;

export type ViewFn<Props, Api> = {
  (ctx: { props: () => Props; use: Use; slot: Slot }): ViewBody<Props, Api>;
  [$primitive]?: string;
};

export function view<Props = void, Api = void>(
  body: ViewFn<Props, Api>,
): (
  props: Props extends void ? { key?: Key } | void : Props & { key?: Key },
  slot?: Slot,
) => void {
  return (
    props: Props extends void ? { key?: Key } | void : Props & { key?: Key },
    slot?: Slot,
  ) => {
    orchestrator.currentEngine()!.pendingView({
      viewFn: body,
      props,
      slot,
      userKey: maybeGetUserKey(props),
    });
  };
}

export type PublicView<Props, Api> = ReturnType<typeof view<Props, Api>>;

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

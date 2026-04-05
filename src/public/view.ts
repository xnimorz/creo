import type { Key } from "@/functional/key";
import type { Maybe } from "@/functional/maybe";
import { orchestrator } from "@/internal/orchestrator";
import type { Use } from "./state";
import type { $primitive } from "./primitive";
import type { Wildcard } from "@/internal/wildcard";

export type ViewBody<Props, Api> = Api extends void
  ? {
      render: () => void;
      onMount?: () => void;
      shouldUpdate?: (nextProps: Props) => boolean;
      onUpdateBefore?: () => void;
      onUpdateAfter?: () => void;
    }
  : {
      render: () => void;
      onMount?: () => void;
      shouldUpdate?: (nextProps: Props) => boolean;
      onUpdateBefore?: () => void;
      onUpdateAfter?: () => void;
      api: Api;
    };

/** Slot callback — passed by the caller at the call site. */
export type Slot = () => void;

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
    orchestrator
      .currentEngine()!
      .view(
        body as ViewFn<Wildcard, Wildcard>,
        props,
        slot,
        maybeGetUserKey(props),
      );
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

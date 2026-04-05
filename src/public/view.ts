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

/** What callers may pass as a slot: a callback or a plain string (rendered as text). */
export type SlotContent = Slot | string;

export type ViewFn<Props, Api> = {
  (ctx: { props: () => Props; use: Use; slot: Slot }): ViewBody<Props, Api>;
  [$primitive]?: string;
};

/** Resolves to the caller-facing props type. Allows `void` when Props is void or all-optional. */
type ViewProps<Props> = Props extends void
  ? { key?: Key } | void
  : {} extends Props
    ? (Props & { key?: Key }) | void
    : Props & { key?: Key };

export function view<Props = void, Api = void>(
  body: ViewFn<Props, Api>,
): (props: ViewProps<Props>, slot?: SlotContent) => void {
  return (props: ViewProps<Props>, slot?: SlotContent) => {
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

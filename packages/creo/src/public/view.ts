import type { Key } from "@/functional/key";
import type { Maybe } from "@/functional/maybe";
import { orchestrator } from "@/internal/orchestrator";
import type { Use } from "./state";
import type { $primitive } from "./primitive";
import type { Wildcard } from "@/internal/wildcard";

/**
 * Return type of `render`. `void` is the natural shape for imperative
 * primitive calls; a returned thunk (`() => void`) is unwrapped by the engine
 * so that JSX, which compiles to a thunk, can be returned directly.
 */
export type RenderResult = void | (() => void);

export type ViewBody<Props, Api> = Api extends void
  ? {
      render: () => RenderResult;
      onMount?: () => void;
      shouldUpdate?: (nextProps: Props) => boolean;
      onUpdateBefore?: () => void;
      onUpdateAfter?: () => void;
    }
  : {
      render: () => RenderResult;
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

/**
 * Resolves to the caller-facing props type. Allows `void` when Props is void
 * or all-optional. Accepts an optional `children` field so the callable is
 * usable from JSX (the JSX factory strips children before invocation).
 */
type ViewProps<Props> = Props extends void
  ? { key?: Key; children?: unknown } | void
  : {} extends Props
    ? (Props & { key?: Key; children?: unknown }) | void
    : Props & { key?: Key; children?: unknown };

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

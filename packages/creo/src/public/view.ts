import type { Key } from "@/functional/key";
import type { Maybe } from "@/functional/maybe";
import { orchestrator } from "@/internal/orchestrator";
import type { Use } from "./state";
import type { $primitive } from "./primitive";
import type { Wildcard } from "@/internal/wildcard";

// ---------------------------------------------------------------------------
// Refs — used both for primitive elements and for view-exposed APIs.
// ---------------------------------------------------------------------------

export type RefCallback<T> = (value: T | null) => void;
export type RefObject<T> = { current: T | null };
export type Ref<T> = RefCallback<T> | RefObject<T>;

/** Apply a value (or null) to either ref shape. Engine + renderer share this. */
export function applyRef<T>(ref: Maybe<Ref<T>>, value: T | null): void {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else ref.current = value;
}

// ---------------------------------------------------------------------------
// ViewBody
// ---------------------------------------------------------------------------

export type ViewBody<Props> = {
  render: () => void;
  onMount?: () => void;
  shouldUpdate?: (nextProps: Props) => boolean;
  onUpdateBefore?: () => void;
  onUpdateAfter?: () => void;
  dispose?: () => void;
};

/** Slot callback — passed by the caller at the call site. */
export type Slot = () => void;

/** What callers may pass as a slot: a callback or a plain string (rendered as text). */
export type SlotContent = Slot | string;

/**
 * Setter handed to the viewFn for publishing an api into the consumer's `ref`.
 * Typically called once during the body. Subsequent calls overwrite.
 */
export type RefSetter<Api> = (value: Api) => void;

export type ViewFn<Props, Api> = {
  (ctx: {
    props: () => Props;
    use: Use;
    slot: Slot;
    ref: RefSetter<Api>;
  }): ViewBody<Props>;
  [$primitive]?: string;
};

/**
 * Caller-facing props type. Allows `void` when Props is void or all-optional.
 * `ref` is added alongside `key`; its element type is whatever the view
 * publishes via `ctx.ref(...)`.
 */
type ViewProps<Props, Api> = Props extends void
  ? { key?: Key; ref?: Ref<Api> } | void
  : {} extends Props
    ? (Props & { key?: Key; ref?: Ref<Api> }) | void
    : Props & { key?: Key; ref?: Ref<Api> };

export function view<Props = void, Api = void>(
  body: ViewFn<Props, Api>,
): (props: ViewProps<Props, Api>, slot?: SlotContent) => void {
  return (props: ViewProps<Props, Api>, slot?: SlotContent) => {
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

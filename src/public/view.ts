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

type PropsArg<Props> = Props extends void
  ? { key?: Key } | void
  : Props & { key?: Key };

/**
 * When Api = void  → view call returns void
 * When Api ≠ void  → view call returns Api (always a function per convention)
 */
export function view<Props = void, Api = void>(
  viewFn: ViewFn<Props, Api>,
): (props: PropsArg<Props>, slot?: Slot) => Api extends void ? void : Api {
  return ((props: PropsArg<Props>, slot?: Slot) => {
    const record = orchestrator
      .currentEngine()!
      .view(
        viewFn as ViewFn<Wildcard, Wildcard>,
        props,
        slot,
        maybeGetUserKey(props),
      );
    // Return a lazy api proxy that delegates to body.api.
    // Uses a mutable apiRef cell so it stays valid across re-renders:
    // reconciliation transfers the cell from pending → live record.
    // For void-api views this returns undefined (typed as void).
    const apiRef: { current: Maybe<Function> } = {
      current: (record.body as Wildcard)?.api ?? null,
    };
    record.apiRef = apiRef;
    return ((...args: unknown[]) => apiRef.current?.(...args)) as Wildcard;
  }) as Wildcard;
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

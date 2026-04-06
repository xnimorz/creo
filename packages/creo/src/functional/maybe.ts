export type None = null | undefined;
export type Just<T> = T;
export type Maybe<T> = Just<T> | None;

export function just<T>(
  maybe: Maybe<T>,
  errorMessage?: string,
): asserts maybe is Just<T> {
  if (maybe == null) {
    throw new TypeError(
      errorMessage ?? "Expected Just, received None as Maybe",
    );
  }
}

export function isJust<T>(maybe: Maybe<T>): maybe is Just<T> {
  return maybe != null;
}

export function isNone<T>(maybe: Maybe<T>): maybe is None {
  return maybe == null;
}

export function withDefault<T, K>(v: Maybe<T>, alternative: K) {
  if (v != null) {
    return v;
  }
  return alternative;
}

export const _ = undefined;

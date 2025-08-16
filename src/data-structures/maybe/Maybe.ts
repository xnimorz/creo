export type None = null | undefined;
export type Just<T> = T;
export type Maybe<T> = Just<T> | None;

export function nonNull<T>(
  maybe: Maybe<T>,
  errorMessage?: string,
): asserts maybe is Just<T> {
  if (maybe == null) {
    throw new TypeError(
      errorMessage ?? "Expected Just, received None as Maybe",
    );
  }
}

export function withDefault<T, K>(v: Maybe<T>, alternative: K) {
  if (v != null) {
    return v;
  }
  return alternative;
}

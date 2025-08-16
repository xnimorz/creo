export type None = null | undefined;
export type Just<T> = T;
export type Maybe<T> = Just<T> | None;

export function unwrap<T>(v: Maybe<T>): Just<T> {
  if (v != null) {
    return v;
  }
  throw new TypeError("Optional is none");
}

export function withDefault<T, K>(v: Maybe<T>, alternative: K) {
  if (v != null) {
    return v;
  }
  return alternative;
}

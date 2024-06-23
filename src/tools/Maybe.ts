export type None = null | undefined;
export type Just<T> = T;
export type Maybe<T> = Just<T> | None;

export function isJust<T>(v: Maybe<T>): v is Just<T> {
  return v != null;
}

export function isNone<T>(v: Maybe<T>): v is None {
  return v == null;
}

export function unwrap<T>(v: Maybe<T>): Just<T> {
  if (isJust(v)) {
    return v;
  }
  throw new TypeError("Optional is none");
}

export function orDefault<T, K>(v: Maybe<T>, alternative: K) {
  if (isJust(v)) {
    return v;
  }
  return alternative;
}

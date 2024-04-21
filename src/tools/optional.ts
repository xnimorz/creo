export type None = null;
export type Just<T> = T;
export type Optional<T> = Just<T> | None;

export function isJust<T>(v: Optional<T>): v is Just<T> {
  return v != null;
}

export function isNone<T>(v: Optional<T>): v is None {
  return v == null;
}

export function unwrap<T>(v: Optional<T>): Just<T> {
  if (isJust(v)) {
    return v;
  }
  throw new TypeError("Optional is none");
}

export function orDefault<T, K>(v: Optional<T>, alternative: K) {
  if (isJust(v)) {
    return v;
  }
  return alternative;
}

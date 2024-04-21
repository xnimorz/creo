export function isRecordLike<T, K extends object>(value: T | K): value is K {
  return (typeof value === "object" || Array.isArray(value)) && value != null;
}

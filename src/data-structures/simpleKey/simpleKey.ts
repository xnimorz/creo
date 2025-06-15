let i = 0;

export function generateNextKey(childrenSize: number): string {
  if (i === Number.MAX_SAFE_INTEGER) {
    i = 0;
  }
  return `c:${i++}:${childrenSize}`;
}

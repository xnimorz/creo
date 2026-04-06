export type Key = number | string;

let $ = 0;

export function generateNextKey(): string {
  if ($ === Number.MAX_SAFE_INTEGER) {
    $ = 0;
  }
  return `c:${$++}`;
}

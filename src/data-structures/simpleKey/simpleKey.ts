let i = 0;

export function generateNextKey(): number {
  if (i === Number.MAX_SAFE_INTEGER) {
    i = 0;
  }
  return i++;
}

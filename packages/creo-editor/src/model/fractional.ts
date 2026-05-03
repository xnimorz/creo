/**
 * Fractional indexing over a base-62 alphabet.
 *
 * Alphabet ordering (string compare matches numeric order):
 *   '0'..'9' < 'A'..'Z' < 'a'..'z'  →  62 symbols.
 *
 * A key is a non-empty string of alphabet characters; lexicographic comparison
 * yields the same ordering as the rationals they represent. The first symbol's
 * value is the most-significant fractional digit.
 *
 * `generateBetween(a, b)` returns a key strictly between `a` and `b`. `null`
 * means "no bound" — use it for the document's first or last position.
 *
 * `generateN(a, b, n)` produces `n` evenly-spaced keys between `a` and `b` in
 * O(n + log span); used by bulk-paste so we don't pay O(n²) re-midpointing.
 */

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = ALPHABET.length; // 62
const MIN_CHAR = ALPHABET[0]!;
const MAX_CHAR = ALPHABET[BASE - 1]!;

const ORD: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) map[ALPHABET[i]!] = i;
  return map;
})();

function ord(c: string): number {
  const v = ORD[c];
  if (v === undefined) {
    throw new Error(`Invalid fractional-index character: ${JSON.stringify(c)}`);
  }
  return v;
}

function chr(n: number): string {
  if (n < 0 || n >= BASE) {
    throw new Error(`Out-of-range alphabet index: ${n}`);
  }
  return ALPHABET[n]!;
}

/** Random base-62 character — used as a tail to keep keys distinct. */
function randomChar(): string {
  return chr(Math.floor(Math.random() * BASE));
}

/** Strip trailing MIN_CHAR ('0') noise from a key (those bits are zeros). */
function trimZeros(s: string): string {
  let end = s.length;
  while (end > 1 && s[end - 1] === MIN_CHAR) end--;
  return s.slice(0, end);
}

/**
 * Read the i-th character of `s`, treating it as if zero-padded indefinitely
 * (right pad with '0' for `a`-side keys, '~' for `b`-side keys).
 */
function digitAt(s: string | null, i: number, padChar: string): string {
  if (s == null) return padChar;
  return i < s.length ? s[i]! : padChar;
}

/**
 * Generate a key strictly between `a` and `b`.
 *  - If a==null, the new key is < b.
 *  - If b==null, the new key is > a.
 *  - Both null → returns "U" (mid-range).
 */
export function generateBetween(
  a: string | null,
  b: string | null,
): string {
  if (a != null && b != null && a >= b) {
    throw new Error(
      `generateBetween: a (${a}) must be strictly less than b (${b})`,
    );
  }

  if (a == null && b == null) {
    // Mid-alphabet seed.
    return chr(Math.floor(BASE / 2));
  }

  // Walk character by character looking for a usable midpoint.
  const out: string[] = [];
  let i = 0;
  while (true) {
    const ac = ord(digitAt(a, i, MIN_CHAR));
    const bc = ord(digitAt(b, i, MAX_CHAR));

    if (ac === bc) {
      // Equal at this position — emit & descend.
      out.push(chr(ac));
      i++;
      continue;
    }

    if (bc - ac >= 2) {
      // Gap of ≥ 2 — pick the midpoint character.
      out.push(chr(ac + Math.floor((bc - ac) / 2)));
      return out.join("");
    }

    // Gap of exactly 1 — emit ac, then descend on the a side searching for
    // a character > '0'. The new key is strictly > a (because we'll add a
    // non-zero tail digit below) and strictly < b (because its first digit
    // equals ac < bc).
    out.push(chr(ac));
    i++;

    // From here, we're producing the suffix of a new key whose prefix is
    // already > a's prefix (since we matched bc ahead). Walk a's tail until
    // we can append a digit greater than a's; if a runs out, append a random
    // non-zero tail character to avoid collisions and keep the key bounded.
    while (true) {
      const an = ord(digitAt(a, i, MIN_CHAR));
      if (an < BASE - 1) {
        // Pick something strictly > an.
        const offset = 1 + Math.floor(Math.random() * (BASE - 1 - an));
        out.push(chr(an + offset));
        return out.join("");
      }
      // a's character is the alphabet max — must keep walking and emit it.
      out.push(chr(an));
      i++;
    }
  }
}

/**
 * Generate `n` evenly-spaced keys strictly between `a` and `b`.
 * Returns them in ascending order.
 *
 * O(n) total — far cheaper than calling generateBetween repeatedly with
 * a moving cursor (which would degrade by binary descent each step).
 */
export function generateN(
  a: string | null,
  b: string | null,
  n: number,
): string[] {
  if (n <= 0) return [];
  if (n === 1) return [generateBetween(a, b)];
  if (a != null && b != null && a >= b) {
    throw new Error("generateN: a must be strictly less than b");
  }

  // Strategy: recursively split. mid = generateBetween(a, b); then split
  // [a..mid] for n/2 keys and [mid..b] for the remainder. The midpoint goes
  // into the result.
  const half = Math.floor(n / 2);
  const mid = generateBetween(a, b);
  const left = half > 0 ? generateN(a, mid, half) : [];
  const right = n - half - 1 > 0 ? generateN(mid, b, n - half - 1) : [];
  return [...left, mid, ...right];
}

// ---------------------------------------------------------------------------
// Rebalance helpers
// ---------------------------------------------------------------------------

/** Soft cap; once any key exceeds this length, schedule a rebalance. */
export const REBALANCE_THRESHOLD = 32;

/** Returns true if any key in the sorted list exceeds REBALANCE_THRESHOLD. */
export function needsRebalance(keys: string[]): boolean {
  for (const k of keys) {
    if (k.length > REBALANCE_THRESHOLD) return true;
  }
  return false;
}

/**
 * Produce a fresh, evenly-spaced sequence of N keys, replacing an existing
 * sorted sequence. Used by the doc layer when keys grow past threshold.
 */
export function rebalance(count: number): string[] {
  return generateN(null, null, count);
}

// ---------------------------------------------------------------------------
// Internal exports for tests
// ---------------------------------------------------------------------------

export const __internal = {
  ALPHABET,
  BASE,
  MIN_CHAR,
  MAX_CHAR,
  ord,
  chr,
  randomChar,
  trimZeros,
};

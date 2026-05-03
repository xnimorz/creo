/**
 * Word-boundary helpers — compute "next/previous word" offsets within a
 * single string. Used by Cmd/Ctrl+Arrow navigation and double-click word
 * selection.
 *
 * Definition of a word — same as the OS conventions every consumer editor
 * follows:
 *   - A word run is one-or-more "word chars" (Unicode letters + digits +
 *     underscore + apostrophes embedded inside a run).
 *   - Whitespace and punctuation are treated as separators.
 *   - "Next word from here" = scan forward over (separators), then over
 *     (word chars), and land on the first non-word-char.
 *   - "Prev word from here" = scan backward over (separators), then over
 *     (word chars), and land on the first word-char.
 */

const WORD_RE = /[\p{L}\p{N}_]/u;

function isWord(ch: string): boolean {
  return WORD_RE.test(ch);
}

/** Offset of the start of the next word at or after `offset` in `text`. */
export function nextWordOffset(text: string, offset: number): number {
  const len = text.length;
  if (offset >= len) return len;
  let i = offset;
  // 1) Skip non-word chars.
  while (i < len && !isWord(text[i]!)) i++;
  // 2) Skip word chars.
  while (i < len && isWord(text[i]!)) i++;
  return i;
}

/** Offset of the start of the previous word strictly before `offset`. */
export function prevWordOffset(text: string, offset: number): number {
  if (offset <= 0) return 0;
  let i = offset;
  // 1) Skip non-word chars (going backward).
  while (i > 0 && !isWord(text[i - 1]!)) i--;
  // 2) Skip word chars (going backward).
  while (i > 0 && isWord(text[i - 1]!)) i--;
  return i;
}

/**
 * Find the word that contains `offset` in `text`. Returns [start, end).
 * If `offset` is on a non-word char, returns [offset, offset+1) so callers
 * still get a usable selection (single char).
 */
export function wordRangeAt(text: string, offset: number): [number, number] {
  const len = text.length;
  if (len === 0) return [0, 0];
  const at = Math.max(0, Math.min(len, offset));
  const ch = at < len ? text[at]! : "";
  if (!ch || !isWord(ch)) {
    // If we're between two word chars, prefer expanding the LEFT word.
    if (at > 0 && isWord(text[at - 1]!)) {
      let s = at;
      while (s > 0 && isWord(text[s - 1]!)) s--;
      return [s, at];
    }
    return [at, Math.min(len, at + 1)];
  }
  let s = at;
  while (s > 0 && isWord(text[s - 1]!)) s--;
  let e = at;
  while (e < len && isWord(text[e]!)) e++;
  return [s, e];
}

/**
 * Input handler — translates beforeinput event types to editor commands.
 */

import type { EditorState, Step } from "../state/editor-state";
import type { MultiSelection } from "../state/selection";
import { insertText, deleteBackward, deleteForward, splitBlock } from "../state/commands";

export type Dispatch = (steps: readonly Step[], selection: MultiSelection) => void;

/**
 * Handle a beforeinput event's inputType.
 * Returns true if the input was handled.
 */
export function handleInputType(
  inputType: string,
  data: string | null,
  state: EditorState,
  dispatch: Dispatch,
): boolean {
  switch (inputType) {
    // ── Text insertion ───────────────────────────────────────────────
    case "insertText":
      if (data) {
        return insertText(data)(state, dispatch);
      }
      return false;

    case "insertReplacementText":
      if (data) {
        return insertText(data)(state, dispatch);
      }
      return false;

    // ── Paragraph / line breaks ──────────────────────────────────────
    case "insertParagraph":
      return splitBlock(state, dispatch);

    case "insertLineBreak":
      return insertText("\n")(state, dispatch);

    // ── Deletion ─────────────────────────────────────────────────────
    case "deleteContentBackward":
    case "deleteSoftLineBackward":
    case "deleteWordBackward":
      return deleteBackward(state, dispatch);

    case "deleteContentForward":
    case "deleteSoftLineForward":
    case "deleteWordForward":
      return deleteForward(state, dispatch);

    // ── History ──────────────────────────────────────────────────────
    case "historyUndo":
      // TODO: implement undo
      return false;

    case "historyRedo":
      // TODO: implement redo
      return false;

    // ── Formatting (some browsers send these) ────────────────────────
    case "formatBold":
      // Handled via keymap, not here
      return false;

    case "formatItalic":
      return false;

    // ── Paste / Drop ─────────────────────────────────────────────────
    case "insertFromPaste":
    case "insertFromDrop":
      if (data) {
        return insertText(data)(state, dispatch);
      }
      return false;

    // ── Composition ──────────────────────────────────────────────────
    case "insertCompositionText":
    case "insertFromComposition":
      // These are handled by the composition tracking layer
      // and should never reach here (they're not cancelable)
      return false;

    default:
      // Unknown input type — log and ignore
      return false;
  }
}

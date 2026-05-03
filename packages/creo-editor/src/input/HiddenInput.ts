import { textarea, view } from "creo";

/**
 * The hidden, caret-following <textarea> that captures all keyboard input,
 * IME composition, and (later) clipboard events.
 *
 * Why visible-but-tiny rather than `display:none` or `left:-9999px`:
 *   - iOS Safari refuses to show the soft keyboard for invisible elements.
 *   - iOS aggressively scrolls focused inputs into view; an offscreen input
 *     causes a visible page jump on every focus. Positioning the textarea AT
 *     the caret (M9.5 wires the position update) means the scroll-into-view
 *     points at the right place.
 *
 * `font-size: 16px` is mandatory — iOS auto-zooms inputs whose font-size is
 * smaller, and the zoom never reverts.
 *
 * Caret-color transparent + opacity 0 hide the native caret (we draw our own
 * in M4) without removing the focusable element.
 */

export const INPUT_STYLE = [
  "position:absolute",
  "top:0",
  "left:0",
  "width:1px",
  "height:1px",
  "opacity:0",
  "border:0",
  "padding:0",
  "margin:0",
  "font-size:16px",
  "caret-color:transparent",
  "background:transparent",
  "outline:none",
  "z-index:1",
  "resize:none",
  "overflow:hidden",
  "white-space:pre",
].join(";");

export const HiddenInput = view<{ editorId: string }>(({ props }) => ({
  render() {
    const id = props().editorId;
    textarea({
      class: "creo-editor-input",
      "data-creo-input": id,
      style: INPUT_STYLE,
      autocomplete: "off",
      autocorrect: "off",
      autocapitalize: "off",
      // Enumerated attribute — must be the string "false", not a JS boolean
      // (the renderer drops `false` booleans entirely).
      spellcheck: "false",
      "aria-multiline": "true",
      inputmode: "text",
      enterkeyhint: "enter",
      rows: 1,
      cols: 1,
    });
  },
}));

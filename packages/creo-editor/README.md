# creo-editor

Row-based, no-`contentEditable` rich-text editor for the [Creo](https://github.com/xnim/creo) UI framework.

## Highlights

- **Cursor lives outside the document state** — typing into a block doesn't dirty selection subscribers, and vice versa.
- **CRDT-friendly row ordering** via base-62 fractional indexing — insert-between is O(log n), no renumber.
- **No `contentEditable`** — a hidden `<textarea>` captures keystrokes, IME composition, mobile soft keyboards, and clipboard.
- **Per-keystroke render cost is O(1) blocks** — block immutability + `shouldUpdate` identity checks make the keyed reconciler skip every untouched block.
- **Optional virtualization** — only blocks intersecting the viewport are mounted; documents with hundreds of thousands of blocks remain responsive.
- **First-class mobile UX** — caret-following hidden input, visual-viewport tracking, tap/scroll/long-press classifier, custom selection handles, and a floating mobile toolbar.

## Install

```bash
bun add creo creo-editor
```

## Quick start

```ts
import { createApp, HtmlRender } from "creo";
import { createEditor } from "creo-editor";

const editor = createEditor({
  initial: {
    blocks: [
      { type: "h1", runs: [{ text: "Hello" }] },
      { type: "p", runs: [{ text: "Type here." }] },
    ],
  },
});

createApp(
  () => editor.EditorView(),
  new HtmlRender(document.querySelector("#app")!),
).mount();
```

## Editor API

```ts
type Editor = {
  docStore: Store<DocState>;
  selStore: Store<Selection>;
  dispatch(cmd: Command): void;
  undo(): void;
  redo(): void;
  EditorView: PublicView<EditorViewProps, void>;
  setDocFromHTML(html: string): void;
  toJSON(): SerializedDoc;
  focus(): void;
  blur(): void;
};
```

### Commands

- `insertText`, `deleteBackward`, `deleteForward` — text editing
- `splitBlock`, `mergeBackward`, `mergeForward` — structural
- `setBlockType` — promote/demote between paragraph, headings, list items
- `toggleMark` — bold, italic, underline, strikethrough, code
- `toggleList`, `indentList`, `outdentList`
- `insertImage`, `insertTable`
- `tableInsertRow/Col`, `tableRemoveRow/Col`
- `moveCursor`

### Default keybindings

| Chord | Action |
|---|---|
| `Cmd/Ctrl+B` / `+I` / `+U` | Toggle bold / italic / underline |
| `Cmd/Ctrl+Shift+S` | Strikethrough |
| `Cmd/Ctrl+Z` / `+Shift+Z` | Undo / redo |
| `Cmd/Ctrl+Alt+1..6` | Heading levels |
| `Cmd/Ctrl+Alt+0` | Paragraph |
| `Tab` / `Shift+Tab` | List indent / outdent (or table cell nav) |
| `Enter` / `Backspace` / `Delete` | Split / merge blocks |
| Arrows / `Home` / `End` | Caret navigation (extend with `Shift`) |

### Virtualization (large documents)

```ts
const editor = createEditor({
  initial: { blocks: [...] },
  virtualized: true,
  virtualEstimatedHeight: 32,
});
```

Only blocks intersecting `[scrollTop − overscan, scrollTop + viewport + overscan]` are mounted, with measured per-block heights stored in a Fenwick tree for O(log n) viewport resolution.

### Image upload

```ts
const editor = createEditor({
  uploadImage: async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/upload", { method: "POST", body: fd });
    return (await res.json()).url;
  },
});
```

Without `uploadImage`, dropped/pasted images use `URL.createObjectURL`.

### Mobile

`creo-editor` is mobile-first. The hidden textarea is positioned at the caret (so iOS scroll-into-view targets the right place), `font-size:16px` guards against iOS auto-zoom, the `visualViewport` API keeps the caret visible when the soft keyboard opens, and a custom toolbar replaces the action menu lost by not being `contentEditable`.

## Architecture

See `AGENTS.md` in the repo root for engine-level notes. The editor is a pure consumer of Creo's public API — `view`, `use`, `store`, primitive functions — and uses raw DOM listeners only for events Creo's event map doesn't expose (composition, drag/drop, clipboard, visualViewport).

## License

MIT

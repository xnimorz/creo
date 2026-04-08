import { view } from "@/public/view";
import { div, h1, span, text, pre, button } from "@/public/primitives/primitives";
import { _ } from "@/functional/maybe";
import {
  CreoEditor,
  createEditorStore,
} from "creo-editor";

const sampleMarkdown = `# Welcome to Creo Editor

This is a **rich text** editor built with the *Creo* UI framework.

## Features

- Full **Markdown** support with GFM extensions
- WYSIWYG editing with a 4-layer mutation defense
- Source mode toggle for raw markdown editing
- Undo/redo with \`Ctrl+Z\` / \`Ctrl+Shift+Z\`
- Inline formatting: **bold**, *italic*, \`code\`, ~~strikethrough~~
- [Links](https://github.com) are supported too

## Code Example

\`\`\`ts
const editor = createEditorStore({
  initialContent: "# Hello World",
  onChange: (md) => console.log(md),
});
\`\`\`

## Table

| Feature | Status |
| --- | --- |
| Markdown parsing | Done |
| WYSIWYG surface | Done |
| Extensions | Done |

---

> This editor is pluggable — it works on any page, even without Creo.

<div style="padding: 12px; background: #e8f4e8; border-radius: 6px;">
  This is an <strong>HTML block</strong> embedded in markdown.
</div>
`;

// ── Editor store (global, reactive) ────────────────────────────

const editorStore = createEditorStore({
  initialContent: sampleMarkdown,
  onChange: (_md) => {
    // Trigger re-render of the output panel via store subscription
  },
});

// ── App view ───────────────────────────────────────────────────

export const App = view(() => {
  return {
    render() {
      div({ class: "app" }, () => {
        // Header
        h1(_, "Creo Editor");
        div({ class: "subtitle" }, "A rich text / markdown editor built with Creo");

        // Editor
        CreoEditor({ editor: editorStore });

        // Output panel — shows serialized markdown
        OutputPanel();
      });
    },
  };
});

// ── Output panel ───────────────────────────────────────────────

const OutputPanel = view(({ use }) => {
  const editor = use(editorStore);
  const expanded = use(false);

  const handleToggle = () => expanded.update(v => !v);

  return {
    render() {
      div({ class: "output-panel", "data-testid": "output-panel" } as Record<string, unknown>, () => {
        div({ class: "output-header" }, () => {
          span(_, "Markdown Output");
          div(_, () => {
            span({ class: "badge" }, "live");
            button(
              { class: "creo-editor-btn", onClick: handleToggle, style: "margin-left: 8px" },
              expanded.get() ? "Collapse" : "Expand",
            );
          });
        });

        if (expanded.get()) {
          pre(
            { class: "output-body", "data-testid": "markdown-output" } as Record<string, unknown>,
            editor.get().getContent(),
          );
        }
      });
    },
  };
});

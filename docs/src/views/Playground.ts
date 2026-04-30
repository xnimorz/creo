import { view, div, aside, h2, h3, p, button, iframe, span, _ } from "creo";
import { EditorView, basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { transform } from "sucrase";
import { recipes, findRecipe } from "../recipes";
import type { Recipe } from "../recipes";
// The playground iframe loads the workspace build that ships with the docs
// site — same code in dev and on gh-pages, no esm.sh / publish dependency.
import creoUrl from "../../../packages/creo/dist/index.js?url";
import creoRouterUrl from "../../../packages/creo-router/dist/index.js?url";

function importMap(): { creo: string; router: string } {
  return {
    creo: new URL(creoUrl, window.location.href).href,
    router: new URL(creoRouterUrl, window.location.href).href,
  };
}

function buildIframeSrcDoc(compiledJs: string, css: string): string {
  const escaped = compiledJs.replace(/<\/script>/gi, "<\\/script>");
  const map = importMap();
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
html, body { margin: 0; padding: 0; }
.__pg-error { color: #c33; padding: 20px; white-space: pre-wrap; font: 12px ui-monospace, Menlo, monospace; }
${css}
</style>
<script type="importmap">
{
  "imports": {
    "creo": "${map.creo}",
    "creo-router": "${map.router}"
  }
}
</script>
<script>
  function __pgShowError(msg) {
    var pre = document.createElement('pre');
    pre.className = '__pg-error';
    pre.textContent = 'Error:\\n' + msg;
    (document.body || document.documentElement).appendChild(pre);
  }
  window.addEventListener('error', function (ev) {
    __pgShowError((ev.error && ev.error.stack) || ev.message || String(ev));
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason;
    __pgShowError((r && r.stack) || String(r));
  });
</script>
</head>
<body>
<div id="app"></div>
<script type="module">
${escaped}
</script>
</body>
</html>`;
}

function compile(
  source: string,
): { ok: true; code: string } | { ok: false; error: string } {
  try {
    const out = transform(source, {
      transforms: ["typescript"],
      disableESTransforms: true,
      keepUnusedImports: false,
    });
    return { ok: true, code: out.code };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

let editorUidCounter = 0;

export const Playground = view(({ use }) => {
  const selectedId = use<string>(recipes[0].id);
  const editorUid = `cm-${++editorUidCounter}`;
  const iframeUid = `pg-iframe-${editorUidCounter}`;
  const compileError = use<string | null>(null);

  let editor: EditorView | null = null;
  let debounceTimer: number | null = null;
  let currentRecipe: Recipe = recipes[0];

  const run = () => {
    if (!editor) return;
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    const source = editor.state.doc.toString();
    const result = compile(source);
    if (!result.ok) {
      compileError.set(result.error);
      return;
    }
    compileError.set(null);

    const iframeEl = document.getElementById(
      iframeUid,
    ) as HTMLIFrameElement | null;
    if (!iframeEl) return;
    iframeEl.srcdoc = buildIframeSrcDoc(result.code, currentRecipe.css ?? "");
  };

  const scheduleRun = () => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(run, 600);
  };

  const loadRecipe = (recipe: Recipe) => {
    currentRecipe = recipe;
    selectedId.set(recipe.id);
    if (!editor) return;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: recipe.source },
    });
    run();
  };

  const initEditor = () => {
    const host = document.getElementById(editorUid);
    if (!host || editor) return;
    editor = new EditorView({
      parent: host,
      doc: currentRecipe.source,
      extensions: [
        basicSetup,
        javascript({ typescript: true }),
        oneDark,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) scheduleRun();
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "13px" },
          ".cm-scroller": {
            fontFamily: "'Fira Code', ui-monospace, Menlo, monospace",
          },
        }),
      ],
    });
    run();
  };

  return {
    onMount: initEditor,
    render() {
      div({ class: "playground" }, () => {
        aside({ class: "recipes" }, () => {
          h2({ class: "recipes-title" }, "Recipes");
          p(
            { class: "recipes-intro" },
            "Live editor — edits run in the iframe as you type.",
          );

          div({ class: "recipe-list" }, () => {
            for (const r of recipes) {
              const active = selectedId.get() === r.id;
              div(
                {
                  key: r.id,
                  class: "recipe" + (active ? " active" : ""),
                  onClick: () => loadRecipe(r),
                },
                () => {
                  div({ class: "recipe-title" }, r.title);
                  div({ class: "recipe-desc" }, r.description);
                },
              );
            }
          });
        });

        div({ class: "pg-main" }, () => {
          div({ class: "pg-toolbar" }, () => {
            span({ class: "pg-filename" }, currentRecipe.title + ".ts");
            button({ class: "pg-run", onClick: run }, "Run");
          });

          div({ class: "pg-split" }, () => {
            div({ class: "pg-editor-wrap" }, () => {
              div({ id: editorUid, class: "pg-editor" });
              if (compileError.get()) {
                div({ class: "pg-compile-error" }, compileError.get()!);
              }
            });

            div({ class: "pg-preview-wrap" }, () => {
              iframe({
                id: iframeUid,
                class: "pg-preview",
                sandbox: "allow-scripts allow-same-origin",
                title: "Preview",
              });
            });
          });
        });
      });
    },
  };
});

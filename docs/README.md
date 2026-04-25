# Creo Docs Site

Static documentation site for the Creo UI framework, built with Creo itself + `creo-router` and Vite.

## Scripts

```bash
bun install
bun run dev       # dev server on :5173 (or pick a port via --port)
bun run build     # production build to dist/
bun run preview   # serve dist/ locally
```

## Structure

```
docs/
  content/           Markdown source — each .md is a page
    how-to/          Subdir for how-to guides (nested slugs work)
  recipes/           Playground recipe sources (.ts files)
  public/            Static assets + llms.txt
  src/
    main.ts          App entry
    router.ts        Routes (derived from content/ + nav.ts)
    nav.ts           Sidebar nav config
    recipes.ts       Playground recipe manifest (imports recipes/*.ts?raw)
    markdown/
      plugin.ts      Vite plugin: .md?doc → { html, headings, meta }
    views/
      Layout.ts      Header + sidebar + content shell
      Landing.ts     Home page
      DocPage.ts     Renders a compiled doc + TOC + prev/next
      Playground.ts  CodeMirror editor + iframe preview
      RawHtml.ts     Injects compiled markdown HTML via onMount/onUpdateAfter
      NotFound.ts    404
    styles.css
```

## Adding a page

1. Drop a new `.md` file under `content/` (or `content/how-to/`). Heading levels 1–3 are picked up into the right-side TOC automatically.
2. Add a line to `src/nav.ts` with the slug (the filename without `.md`; nested dirs use `how-to/router` style).
3. The router picks it up on reload.

## Adding a playground recipe

1. Drop a `.ts` file under `recipes/`.
2. Import it as `?raw` and add an entry in `src/recipes.ts` with title, description, and per-recipe CSS.

## Deployment

Hash-based routing means no server config is needed. The build outputs a single-page app — point any static host at `dist/`. For GitHub Pages:

```yaml
# .github/workflows/docs.yml
- run: cd docs && bun install && bun run build
- uses: peaceiris/actions-gh-pages@v4
  with:
    publish_dir: docs/dist
```

The Vite config uses `base: "./"` so the build works at any path.

## Playground internals

- Editor: CodeMirror 6 with TypeScript highlighting + the one-dark theme.
- Compile: `sucrase` strips TypeScript types in the browser.
- Runtime: the compiled JS runs inside a sandboxed iframe (srcdoc) with an import map that resolves `creo` and `creo-router` from `esm.sh`. Errors from module loading or execution are caught via `error` / `unhandledrejection` listeners.
- The playground always targets the published version of Creo (see `CREO_VERSION` in `src/views/Playground.ts`), not the workspace source, so recipes keep working when deployed.

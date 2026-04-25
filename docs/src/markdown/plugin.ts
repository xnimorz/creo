import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import json from "highlight.js/lib/languages/json";
import plaintext from "highlight.js/lib/languages/plaintext";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("json", json);
hljs.registerLanguage("plaintext", plaintext);

export type DocMeta = {
  title: string;
  slug: string;
};

export type DocHeading = {
  level: number;
  text: string;
  slug: string;
};

export type CompiledDoc = {
  meta: DocMeta;
  html: string;
  headings: DocHeading[];
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function parseFrontmatter(src: string): { body: string; data: Record<string, string> } {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return { body: src, data: {} };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    data[key] = val;
  }
  return { body: src.slice(m[0].length), data };
}

function compile(src: string, slug: string): CompiledDoc {
  const { body, data } = parseFrontmatter(src);
  const headings: DocHeading[] = [];

  const marked = new Marked(
    markedHighlight({
      langPrefix: "hljs language-",
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : "plaintext";
        return hljs.highlight(code, { language }).value;
      },
    }),
  );

  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const plain = tokens.map((t: any) => t.text ?? "").join("");
        const hslug = slugify(plain);
        headings.push({ level: depth, text: plain, slug: hslug });
        return `<h${depth} id="${hslug}"><a class="h-anchor" href="#${hslug}">#</a>${text}</h${depth}>\n`;
      },
    },
  });

  const html = marked.parse(body) as string;

  let title = data.title ?? "";
  if (!title) {
    const firstH1 = headings.find((h) => h.level === 1);
    title = firstH1?.text ?? slug;
  }

  return {
    meta: { title, slug },
    html,
    headings,
  };
}

const VIRTUAL_INDEX = "virtual:docs-index";
const RESOLVED_VIRTUAL_INDEX = "\0" + VIRTUAL_INDEX;

export function markdownPlugin(): Plugin {
  let contentDir: string;

  return {
    name: "creo-docs-markdown",
    enforce: "pre",
    configResolved(cfg) {
      contentDir = path.resolve(cfg.root, "content");
    },

    resolveId(id, importer) {
      if (id === VIRTUAL_INDEX) return RESOLVED_VIRTUAL_INDEX;
      if (id.endsWith(".md?doc")) {
        const clean = id.slice(0, -"?doc".length);
        if (path.isAbsolute(clean)) return id;
        if (importer) {
          const abs = path.resolve(path.dirname(importer), clean);
          return abs + "?doc";
        }
      }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_INDEX) {
        const entries: { slug: string; file: string }[] = [];
        const walk = (dir: string, prefix: string) => {
          for (const name of fs.readdirSync(dir)) {
            const full = path.join(dir, name);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) {
              walk(full, prefix + name + "/");
            } else if (name.endsWith(".md")) {
              const base = name.replace(/\.md$/, "");
              const slug = prefix === "" && base === "index" ? "" : prefix + base;
              entries.push({ slug, file: full });
            }
          }
        };
        walk(contentDir, "");

        const imports = entries
          .map((e, i) => `import d${i} from ${JSON.stringify(e.file + "?doc")};`)
          .join("\n");

        const map = entries
          .map((e, i) => `  ${JSON.stringify(e.slug)}: d${i}`)
          .join(",\n");

        return `${imports}\nexport const docs = {\n${map}\n};\n`;
      }

      if (id.endsWith(".md?doc")) {
        const file = id.slice(0, -"?doc".length);
        const src = fs.readFileSync(file, "utf8");
        const rel = path.relative(contentDir, file).replace(/\\/g, "/");
        const withoutExt = rel.replace(/\.md$/, "");
        const slug = withoutExt === "index" ? "" : withoutExt;
        const compiled = compile(src, slug);
        return `export default ${JSON.stringify(compiled)};`;
      }
    },

    handleHotUpdate(ctx) {
      if (ctx.file.endsWith(".md") && ctx.file.startsWith(contentDir)) {
        const mod = ctx.server.moduleGraph.getModuleById(ctx.file + "?doc");
        if (mod) ctx.server.moduleGraph.invalidateModule(mod);
        return [
          ...(mod ? [mod] : []),
          ...(ctx.server.moduleGraph.getModulesByFile(ctx.file) ?? []),
        ];
      }
    },
  };
}

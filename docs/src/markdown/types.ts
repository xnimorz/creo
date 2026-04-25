export type DocMeta = { title: string; slug: string };
export type DocHeading = { level: number; text: string; slug: string };
export type CompiledDoc = { meta: DocMeta; html: string; headings: DocHeading[] };

declare module "virtual:docs-index" {
  export const docs: Record<string, CompiledDoc>;
}

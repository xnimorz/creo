import { createSchema } from "./schema";
import type { Schema, NodeSpec, MarkSpec } from "./schema";

const nodes: Record<string, NodeSpec> = {
  doc: {
    content: "block+",
  },

  paragraph: {
    content: "inline*",
    group: "block",
    marks: "_",
  },

  heading: {
    content: "inline*",
    group: "block",
    marks: "_",
    attrs: {
      level: { default: 1 },
    },
  },

  blockquote: {
    content: "block+",
    group: "block",
  },

  bullet_list: {
    content: "list_item+",
    group: "block",
  },

  ordered_list: {
    content: "list_item+",
    group: "block",
    attrs: {
      start: { default: 1 },
    },
  },

  list_item: {
    content: "block+",
  },

  code_block: {
    content: "text*",
    group: "block",
    marks: "",
    attrs: {
      language: { default: undefined },
    },
  },

  horizontal_rule: {
    content: "",
    group: "block",
    atom: true,
  },

  image: {
    content: "",
    group: "block",
    atom: true,
    inline: false,
    attrs: {
      src: {},
      alt: { default: undefined },
      title: { default: undefined },
    },
  },

  html_block: {
    content: "",
    group: "block",
    atom: true,
    attrs: {
      html: {},
    },
  },

  atomic_block: {
    content: "",
    group: "block",
    atom: true,
    attrs: {
      blockType: {},
      data: { default: undefined },
    },
  },

  text: {
    content: "",
    group: "inline",
  },
};

const marks: Record<string, MarkSpec> = {
  bold: {
    inclusive: true,
  },

  italic: {
    inclusive: true,
  },

  strikethrough: {
    inclusive: true,
  },

  code: {
    inclusive: false,
  },

  link: {
    inclusive: false,
    attrs: {
      href: {},
      title: { default: undefined },
    },
  },
};

export const defaultSchema: Schema = createSchema(nodes, marks);

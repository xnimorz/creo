import type { EditorNode, BlockNode, TextNode, Mark } from "../model/types";
import { isBlockNode, isTextNode } from "../model/types";

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Serialize an EditorNode document tree back to a markdown string.
 */
export function serializeMarkdown(doc: BlockNode): string {
  if (doc.type !== "doc") {
    throw new Error(`Expected doc node, got ${doc.type}`);
  }

  const parts: string[] = [];
  for (let i = 0; i < doc.content.length; i++) {
    const child = doc.content[i]!;
    parts.push(serializeBlock(child, ""));
    // Add blank line between blocks (except the last)
    if (i < doc.content.length - 1) {
      parts.push("");
    }
  }

  return parts.join("\n") + "\n";
}

// ── Block serialization ────────────────────────────────────────────────

function serializeBlock(node: EditorNode, indent: string): string {
  if (isTextNode(node)) {
    return serializeInline(node);
  }

  if (!isBlockNode(node)) return "";

  switch (node.type) {
    case "paragraph":
      return indent + serializeInlineContent(node);

    case "heading": {
      const level = (node.attrs as { level?: number }).level ?? 1;
      const prefix = "#".repeat(level);
      return `${indent}${prefix} ${serializeInlineContent(node)}`;
    }

    case "blockquote": {
      const inner = node.content
        .map(child => serializeBlock(child, ""))
        .join("\n\n");
      return inner
        .split("\n")
        .map(line => `${indent}> ${line}`)
        .join("\n");
    }

    case "bullet_list":
      return node.content
        .map(item => serializeListItem(item as BlockNode, indent, "- "))
        .join("\n");

    case "ordered_list": {
      const start = ((node.attrs as { start?: number }).start ?? 1);
      return node.content
        .map((item, i) => serializeListItem(item as BlockNode, indent, `${start + i}. `))
        .join("\n");
    }

    case "code_block": {
      const lang = (node.attrs as { language?: string }).language ?? "";
      const code = node.content
        .map(c => isTextNode(c) ? c.text : "")
        .join("");
      return `${indent}\`\`\`${lang}\n${code}\n${indent}\`\`\``;
    }

    case "horizontal_rule":
      return `${indent}---`;

    case "image": {
      const attrs = node.attrs as { src: string; alt?: string; title?: string };
      const alt = attrs.alt ?? "";
      const title = attrs.title ? ` "${attrs.title}"` : "";
      return `${indent}![${alt}](${attrs.src}${title})`;
    }

    case "html_block":
      return `${indent}${(node.attrs as { html: string }).html}`;

    case "table":
      return serializeTable(node, indent);

    default:
      // Unknown block type — try inline serialization
      return indent + serializeInlineContent(node);
  }
}

function serializeListItem(node: BlockNode, indent: string, bullet: string): string {
  if (node.content.length === 0) {
    return `${indent}${bullet}`;
  }

  const lines: string[] = [];
  for (let i = 0; i < node.content.length; i++) {
    const child = node.content[i]!;
    const prefix = i === 0 ? bullet : " ".repeat(bullet.length);
    const text = serializeBlock(child, "");

    if (i === 0) {
      lines.push(`${indent}${prefix}${text}`);
    } else {
      // Subsequent blocks in the list item get continuation indent
      const continued = text
        .split("\n")
        .map(line => `${indent}${" ".repeat(bullet.length)}${line}`)
        .join("\n");
      lines.push("");
      lines.push(continued);
    }
  }

  return lines.join("\n");
}

function serializeTable(node: BlockNode, indent: string): string {
  const rows: string[][] = [];
  const colWidths: number[] = [];

  for (const row of node.content) {
    if (!isBlockNode(row)) continue;
    const cells: string[] = [];
    for (let c = 0; c < row.content.length; c++) {
      const cell = row.content[c]!;
      const text = isBlockNode(cell)
        ? cell.content.map(p => isBlockNode(p) ? serializeInlineContent(p) : isTextNode(p) ? serializeInline(p) : "").join("")
        : "";
      cells.push(text);
      colWidths[c] = Math.max(colWidths[c] ?? 3, text.length);
    }
    rows.push(cells);
  }

  if (rows.length === 0) return "";

  const lines: string[] = [];

  // Header row
  const headerRow = rows[0]!;
  lines.push(indent + "| " + headerRow.map((cell, i) => cell.padEnd(colWidths[i] ?? 3)).join(" | ") + " |");

  // Separator
  lines.push(indent + "| " + colWidths.map(w => "-".repeat(w)).join(" | ") + " |");

  // Data rows
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    lines.push(indent + "| " + row.map((cell, i) => cell.padEnd(colWidths[i] ?? 3)).join(" | ") + " |");
  }

  return lines.join("\n");
}

// ── Inline serialization ───────────────────────────────────────────────

function serializeInlineContent(block: BlockNode): string {
  return block.content
    .map(child => {
      if (isTextNode(child)) return serializeInline(child);
      return "";
    })
    .join("");
}

function serializeInline(node: TextNode): string {
  let text = node.text;

  // Apply marks from innermost to outermost
  // Reverse so that the first mark wraps outermost
  const marks = [...node.marks].reverse();
  for (const mark of marks) {
    text = wrapWithMark(text, mark);
  }

  return text;
}

function wrapWithMark(text: string, mark: Mark): string {
  switch (mark.type) {
    case "bold":
      return `**${text}**`;
    case "italic":
      return `*${text}*`;
    case "strikethrough":
      return `~~${text}~~`;
    case "code":
      return `\`${text}\``;
    case "link": {
      const href = (mark.attrs as { href: string }).href;
      const title = (mark.attrs as { title?: string }).title;
      if (title) {
        return `[${text}](${href} "${title}")`;
      }
      return `[${text}](${href})`;
    }
    default:
      return text;
  }
}

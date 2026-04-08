import { describe, test, expect } from "bun:test";
import { parseMarkdown } from "./parse";
import { serializeMarkdown } from "./serialize";

/**
 * Round-trip test: parse markdown, serialize back, verify output matches
 * (or is semantically equivalent).
 */
function roundtrip(input: string, expected?: string) {
  const doc = parseMarkdown(input);
  const output = serializeMarkdown(doc);
  const target = expected ?? input;
  // Normalize trailing newlines for comparison
  const normalizedOutput = output.trimEnd();
  const normalizedTarget = target.trimEnd();
  return { output: normalizedOutput, expected: normalizedTarget };
}

describe("markdown round-trip", () => {
  test("plain paragraph", () => {
    const { output, expected } = roundtrip("Hello world");
    expect(output).toBe(expected);
  });

  test("multiple paragraphs", () => {
    const { output, expected } = roundtrip("First\n\nSecond");
    expect(output).toBe(expected);
  });

  test("heading levels", () => {
    for (let i = 1; i <= 6; i++) {
      const md = `${"#".repeat(i)} Heading ${i}`;
      const { output, expected } = roundtrip(md);
      expect(output).toBe(expected);
    }
  });

  test("bold text", () => {
    const { output, expected } = roundtrip("**bold text**");
    expect(output).toBe(expected);
  });

  test("italic text", () => {
    const { output, expected } = roundtrip("*italic text*");
    expect(output).toBe(expected);
  });

  test("inline code", () => {
    const { output, expected } = roundtrip("`inline code`");
    expect(output).toBe(expected);
  });

  test("strikethrough", () => {
    const { output, expected } = roundtrip("~~deleted~~");
    expect(output).toBe(expected);
  });

  test("link", () => {
    const { output, expected } = roundtrip("[click](https://example.com)");
    expect(output).toBe(expected);
  });

  test("blockquote", () => {
    const { output, expected } = roundtrip("> quoted text");
    expect(output).toBe(expected);
  });

  test("unordered list", () => {
    const { output, expected } = roundtrip("- one\n- two\n- three");
    expect(output).toBe(expected);
  });

  test("ordered list", () => {
    const { output, expected } = roundtrip("1. first\n2. second\n3. third");
    expect(output).toBe(expected);
  });

  test("code block", () => {
    const { output, expected } = roundtrip("```js\nconsole.log('hi')\n```");
    expect(output).toBe(expected);
  });

  test("horizontal rule", () => {
    const { output, expected } = roundtrip("---");
    expect(output).toBe(expected);
  });

  test("mixed content", () => {
    const md = `# Title

Hello **bold** and *italic* text.

> A blockquote

- List item 1
- List item 2

\`\`\`js
code()
\`\`\`

---`;
    const { output, expected } = roundtrip(md);
    expect(output).toBe(expected);
  });

  test("HTML block preserved", () => {
    const md = '<div class="custom">content</div>';
    const doc = parseMarkdown(md);
    const output = serializeMarkdown(doc).trimEnd();
    expect(output).toContain("<div");
    expect(output).toContain("content");
  });
});

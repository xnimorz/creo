import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

let rl: readline.Interface | null = null;

function getRL(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({ input: stdin, output: stdout });
  }
  return rl;
}

export function closePrompt(): void {
  rl?.close();
  rl = null;
}

export async function askText(question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  const answer = await getRL().question(`${question}${suffix}: `);
  return answer.trim() || defaultValue || "";
}

export async function askMultiSelect(
  question: string,
  options: { label: string; value: string; default?: boolean }[],
): Promise<string[]> {
  console.log(`\n${question}\n`);
  for (let i = 0; i < options.length; i++) {
    const opt = options[i]!;
    const marker = opt.default ? "*" : " ";
    console.log(`  [${marker}] ${i + 1}. ${opt.label}`);
  }

  const defaults = options
    .filter((o) => o.default)
    .map((_, i) => i + 1)
    .join(",");

  const answer = await getRL().question(
    `\nEnter numbers separated by commas (${defaults}): `,
  );

  const input = answer.trim() || defaults;
  const indices = input
    .split(",")
    .map((s) => parseInt(s.trim(), 10) - 1)
    .filter((i) => i >= 0 && i < options.length);

  if (indices.length === 0) {
    return options.filter((o) => o.default).map((o) => o.value);
  }

  return indices.map((i) => options[i]!.value);
}

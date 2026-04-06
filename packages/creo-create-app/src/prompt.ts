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

export async function askYesNo(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? "Y/n" : "y/N";
  const answer = await getRL().question(`${question} [${hint}]: `);
  const normalized = answer.trim().toLowerCase();
  if (normalized === "") return defaultYes;
  return normalized === "y" || normalized === "yes";
}

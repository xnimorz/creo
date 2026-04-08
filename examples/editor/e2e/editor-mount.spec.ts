import { test, expect } from "@playwright/test";

test.describe("Editor mounting", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders the editor", async ({ page }) => {
    const editor = page.locator(".creo-editor");
    await expect(editor).toBeVisible();
  });

  test("renders toolbar with formatting buttons", async ({ page }) => {
    const toolbar = page.locator(".creo-editor-toolbar");
    await expect(toolbar).toBeVisible();

    // Bold button
    const boldBtn = toolbar.locator("button", { hasText: "B" }).first();
    await expect(boldBtn).toBeVisible();

    // Italic button
    const italicBtn = toolbar.locator("button", { hasText: "I" });
    await expect(italicBtn).toBeVisible();

    // Source toggle button
    const sourceBtn = toolbar.locator("button", { hasText: "Source" });
    await expect(sourceBtn).toBeVisible();
  });

  test("renders contenteditable surface with initial content", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");
    await expect(surface).toBeVisible();
    await expect(surface).toHaveAttribute("contenteditable", "true");

    // Initial content should contain the welcome heading
    await expect(surface.locator("h1")).toContainText("Welcome to Creo Editor");
  });

  test("renders markdown content correctly", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    // Check various markdown elements rendered as HTML
    await expect(surface.locator("h1")).toContainText("Welcome to Creo Editor");
    await expect(surface.locator("h2").first()).toContainText("Features");
    await expect(surface.locator("strong").first()).toBeVisible();
    await expect(surface.locator("em").first()).toBeVisible();
    await expect(surface.locator("ul")).toBeVisible();
    await expect(surface.locator("pre")).toBeVisible();
    await expect(surface.locator("table")).toBeVisible();
    await expect(surface.locator("hr")).toBeVisible();
    await expect(surface.locator("blockquote")).toBeVisible();
  });

  test("renders HTML blocks from markdown", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");
    const htmlBlock = surface.locator("[data-node-type='html_block']");
    await expect(htmlBlock).toBeVisible();
    await expect(htmlBlock).toContainText("HTML block");
  });

  test("renders output panel", async ({ page }) => {
    const panel = page.locator("[data-testid='output-panel']");
    await expect(panel).toBeVisible();

    // Click expand
    const expandBtn = panel.locator("button", { hasText: "Expand" });
    await expandBtn.click();

    const output = page.locator("[data-testid='markdown-output']");
    await expect(output).toBeVisible();
    await expect(output).toContainText("Welcome to Creo Editor");
  });
});

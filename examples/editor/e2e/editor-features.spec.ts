import { test, expect } from "@playwright/test";

test.describe("Output panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("expand button reveals markdown output", async ({ page }) => {
    const panel = page.locator("[data-testid='output-panel']");
    const expandBtn = panel.locator("button", { hasText: "Expand" });

    await expandBtn.click();

    const output = page.locator("[data-testid='markdown-output']");
    await expect(output).toBeVisible();
    await expect(output).toContainText("# Welcome to Creo Editor");
  });

  test("collapse button hides markdown output", async ({ page }) => {
    const panel = page.locator("[data-testid='output-panel']");

    // Expand first
    const btn = panel.locator(".creo-editor-btn").last();
    await btn.click();
    await expect(page.locator("[data-testid='markdown-output']")).toBeVisible();

    // Collapse — same button, now shows "Collapse"
    await btn.click();
    await expect(page.locator("[data-testid='markdown-output']")).not.toBeVisible();
  });

  test("output contains serialized markdown with formatting", async ({ page }) => {
    const panel = page.locator("[data-testid='output-panel']");
    await panel.locator("button", { hasText: "Expand" }).click();

    const output = page.locator("[data-testid='markdown-output']");
    const text = await output.textContent();

    // Verify markdown syntax is present
    expect(text).toContain("**bold**");
    expect(text).toContain("*Creo*");
    expect(text).toContain("## Features");
    expect(text).toContain("```ts");
    expect(text).toContain("---");
    expect(text).toContain("> This editor");
    expect(text).toContain("| Feature");
  });
});

test.describe("Source mode editing → output sync", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("editing in source mode updates output panel", async ({ page }) => {
    // Switch to source mode
    await page.locator(".creo-editor-toolbar button", { hasText: "Source" }).click();

    // Edit content
    const textarea = page.locator(".creo-editor-source-textarea");
    await textarea.fill("# Test Output\n\nHello from source mode.");

    // Check output panel
    const panel = page.locator("[data-testid='output-panel']");
    await panel.locator("button", { hasText: "Expand" }).click();

    const output = page.locator("[data-testid='markdown-output']");
    await expect(output).toContainText("# Test Output");
    await expect(output).toContainText("Hello from source mode");
  });
});

test.describe("Toolbar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("all formatting buttons are present", async ({ page }) => {
    const toolbar = page.locator(".creo-editor-toolbar");

    // Bold (B), Italic (I), Code (<>), Strikethrough (S)
    await expect(toolbar.locator("button", { hasText: "B" }).first()).toBeVisible();
    await expect(toolbar.locator("button", { hasText: "I" })).toBeVisible();
    await expect(toolbar.locator("button", { hasText: "<>" })).toBeVisible();
    await expect(toolbar.locator("button", { hasText: "S" }).last()).toBeVisible();
  });

  test("source toggle button is present", async ({ page }) => {
    const toolbar = page.locator(".creo-editor-toolbar");
    await expect(toolbar.locator("button", { hasText: "Source" })).toBeVisible();
  });
});

test.describe("Initial render accuracy", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("headings render with correct tags", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    const h1 = surface.locator("h1");
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText("Welcome to Creo Editor");

    const h2s = surface.locator("h2");
    const h2Count = await h2s.count();
    expect(h2Count).toBeGreaterThanOrEqual(3); // Features, Code Example, Table
  });

  test("lists render correctly", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    const ul = surface.locator("ul").first();
    await expect(ul).toBeVisible();

    const items = ul.locator("li");
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("code blocks render with pre/code tags", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    const pre = surface.locator("pre");
    await expect(pre.first()).toBeVisible();

    const code = pre.first().locator("code");
    await expect(code).toBeVisible();
  });

  test("table renders with correct structure", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    const table = surface.locator("table");
    await expect(table).toBeVisible();

    // Header row
    const headers = table.locator("th");
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThanOrEqual(2);

    // Data cells
    const cells = table.locator("td");
    const cellCount = await cells.count();
    expect(cellCount).toBeGreaterThanOrEqual(2);
  });

  test("blockquote renders correctly", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");
    const bq = surface.locator("blockquote");
    await expect(bq).toBeVisible();
    await expect(bq).toContainText("pluggable");
  });

  test("horizontal rule renders", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");
    const hr = surface.locator("hr");
    await expect(hr).toBeVisible();
  });

  test("inline formatting renders correctly", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    // Bold text
    const strong = surface.locator("strong").first();
    await expect(strong).toBeVisible();

    // Italic text
    const em = surface.locator("em").first();
    await expect(em).toBeVisible();

    // Inline code
    const code = surface.locator("p code").first();
    await expect(code).toBeVisible();
  });

  test("links render as anchor tags", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");
    const link = surface.locator("a[href]").first();
    await expect(link).toBeVisible();
  });
});

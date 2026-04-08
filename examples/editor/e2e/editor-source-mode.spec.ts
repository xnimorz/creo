import { test, expect } from "@playwright/test";

test.describe("Source mode toggle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // Helper: the toggle button is the last button in the toolbar
  function toggleBtn(page: import("@playwright/test").Page) {
    return page.locator('.creo-editor-toolbar button[title="Toggle source/WYSIWYG"]');
  }

  test("switches to source mode", async ({ page }) => {
    await toggleBtn(page).click();

    // WYSIWYG surface should be hidden, textarea visible
    const textarea = page.locator(".creo-editor-source-textarea");
    await expect(textarea).toBeVisible();

    const surface = page.locator(".creo-editor-surface");
    await expect(surface).not.toBeVisible();
  });

  test("source mode shows markdown content", async ({ page }) => {
    await toggleBtn(page).click();

    const textarea = page.locator(".creo-editor-source-textarea");
    const value = await textarea.inputValue();
    expect(value).toContain("# Welcome to Creo Editor");
    expect(value).toContain("**bold**");
  });

  test("switches back to WYSIWYG mode", async ({ page }) => {
    // Switch to source
    await toggleBtn(page).click();
    await expect(page.locator(".creo-editor-source-textarea")).toBeVisible();

    // Switch back
    await toggleBtn(page).click();

    // Surface should be visible again
    const surface = page.locator(".creo-editor-surface");
    await expect(surface).toBeVisible();
  });

  test("edits in source mode update the document", async ({ page }) => {
    // Switch to source
    await toggleBtn(page).click();

    const textarea = page.locator(".creo-editor-source-textarea");
    await textarea.fill("# New Title\n\nNew paragraph content.");

    // Switch back to WYSIWYG
    await toggleBtn(page).click();

    // Verify the new content is rendered
    const surface = page.locator(".creo-editor-surface");
    await expect(surface.locator("h1")).toContainText("New Title");
    await expect(surface.locator("p")).toContainText("New paragraph content");
  });

  test("round-trip: WYSIWYG → source → WYSIWYG preserves content", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");
    const initialHeading = await surface.locator("h1").textContent();

    // Switch to source and back
    await toggleBtn(page).click();
    await toggleBtn(page).click();

    // Heading should still be the same
    await expect(surface.locator("h1")).toContainText(initialHeading ?? "");
  });
});

import { test, expect } from "@playwright/test";

test("Enter key creates a new line/paragraph", async ({ page }) => {
  await page.goto("/");
  const surface = page.locator(".creo-editor-surface");

  // Clear and start fresh: use source mode to set empty content
  const toggleBtn = page.locator('.creo-editor-toolbar button[title="Toggle source/WYSIWYG"]');
  await toggleBtn.click();
  const textarea = page.locator(".creo-editor-source-textarea");
  await textarea.fill("");
  await toggleBtn.click();
  await page.waitForTimeout(100);

  // Focus the surface
  await surface.click();

  // Type some text, press Enter, type more
  await page.keyboard.type("line one", { delay: 30 });
  await page.keyboard.press("Enter");
  await page.keyboard.type("line two", { delay: 30 });

  // Both lines should be visible
  const text = await surface.textContent();
  expect(text).toContain("line one");
  expect(text).toContain("line two");

  // They should be in separate block elements (not joined with a \n char)
  const blocks = await surface.locator("p").count();
  expect(blocks).toBeGreaterThanOrEqual(2);
});

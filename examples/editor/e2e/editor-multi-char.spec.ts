import { test, expect } from "@playwright/test";

test.describe("Multi-character typing in bold text", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("typing multiple characters in bold text inserts all of them", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    // The first paragraph has "**rich text**" which renders as <strong>rich text</strong>
    // Click in the middle of "rich text"
    const strongEl = surface.locator("strong").first();
    await strongEl.click();

    // Type multiple characters
    await page.keyboard.type("HELLO", { delay: 50 });

    // ALL characters should be present in the surface
    const text = await surface.textContent();
    expect(text).toContain("HELLO");
  });
});

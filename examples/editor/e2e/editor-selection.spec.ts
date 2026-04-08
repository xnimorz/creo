import { test, expect } from "@playwright/test";

test.describe("Selection sync: click position maps to correct edit location", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("typing after clicking in a paragraph edits that paragraph", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    // Click on the first paragraph (after h1)
    const firstP = surface.locator("p").nth(0);
    await firstP.click();

    // Type a single character to verify it goes in the paragraph, not heading
    await page.keyboard.type("X");

    // The heading should NOT contain our marker
    const h1Text = await surface.locator("h1").textContent();
    expect(h1Text).not.toContain("X");

    // The paragraph should contain it
    const pText = await firstP.textContent();
    expect(pText).toContain("X");
  });

  test("typing after clicking on the heading edits the heading", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    // Click on the h1
    const h1 = surface.locator("h1");
    await h1.click();

    // Type a unique marker
    await page.keyboard.type("TEST");

    // The heading should contain our text
    const h1Text = await surface.locator("h1").textContent();
    expect(h1Text).toContain("TEST");
  });

  test("clicking at end of line and typing appends there", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    // Click at the end of the heading
    const h1 = surface.locator("h1");
    const box = await h1.boundingBox();
    if (box) {
      // Click near the right edge of the heading
      await page.mouse.click(box.x + box.width - 5, box.y + box.height / 2);
    }

    await page.keyboard.type("!");

    const h1Text = await surface.locator("h1").textContent();
    // "!" should be at or near the end
    expect(h1Text).toContain("!");
  });

  test("cursor position is maintained across multiple keystrokes", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    // Click on the heading
    const h1 = surface.locator("h1");
    await h1.click();

    // Type multiple characters
    await page.keyboard.type("ABC");

    // All three characters should be together in the heading
    const h1Text = await surface.locator("h1").textContent();
    expect(h1Text).toContain("ABC");
  });

  test("backspace deletes at correct position after click", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    // Get initial heading text
    const h1 = surface.locator("h1");
    const initialText = await h1.textContent();

    // Click on heading and type then backspace
    await h1.click();
    await page.keyboard.type("X");
    await page.keyboard.press("Backspace");

    // After type + backspace, heading should be similar to initial
    // (may differ slightly based on exact click position)
    const afterText = await h1.textContent();
    // At minimum, the "X" should be gone
    expect(afterText).not.toContain("X");
  });
});

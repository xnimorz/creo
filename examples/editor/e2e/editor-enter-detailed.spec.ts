import { test, expect } from "@playwright/test";

test("Enter key: type, press Enter, type more — all text visible and in separate blocks", async ({ page }) => {
  await page.goto("/");
  const surface = page.locator(".creo-editor-surface");

  // Use source mode to set clean content
  const toggleBtn = page.locator('.creo-editor-toolbar button[title="Toggle source/WYSIWYG"]');
  await toggleBtn.click();
  await page.locator(".creo-editor-source-textarea").fill("hello");
  await toggleBtn.click();
  await page.waitForTimeout(100);

  // Focus at end of "hello"
  const p = surface.locator("p").first();
  await p.click();

  // Place cursor at end
  await page.keyboard.press("End");
  await page.waitForTimeout(50);

  // Press Enter
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);

  // Type on new line
  await page.keyboard.type("world", { delay: 30 });
  await page.waitForTimeout(100);

  // Verify
  const text = await surface.textContent();
  console.log("Surface text:", JSON.stringify(text));
  expect(text).toContain("hello");
  expect(text).toContain("world");

  // Should be in separate <p> elements
  const pCount = await surface.locator("p").count();
  console.log("Paragraph count:", pCount);
  expect(pCount).toBeGreaterThanOrEqual(2);

  // Verify order: hello before world
  const pTexts = await surface.locator("p").allTextContents();
  console.log("Paragraph texts:", pTexts);
  const helloIdx = pTexts.findIndex(t => t.includes("hello"));
  const worldIdx = pTexts.findIndex(t => t.includes("world"));
  expect(helloIdx).toBeLessThan(worldIdx);
});

test("Enter key at start of text creates empty paragraph before", async ({ page }) => {
  await page.goto("/");
  const surface = page.locator(".creo-editor-surface");

  // Set clean content
  const toggleBtn = page.locator('.creo-editor-toolbar button[title="Toggle source/WYSIWYG"]');
  await toggleBtn.click();
  await page.locator(".creo-editor-source-textarea").fill("hello");
  await toggleBtn.click();
  await page.waitForTimeout(100);

  // Focus and go to start
  await surface.locator("p").first().click();
  await page.keyboard.press("Home");
  await page.waitForTimeout(50);

  // Press Enter
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);

  // "hello" should still exist, with an empty paragraph before it
  const text = await surface.textContent();
  console.log("After Enter at start:", JSON.stringify(text));
  expect(text).toContain("hello");

  const pCount = await surface.locator("p").count();
  expect(pCount).toBeGreaterThanOrEqual(2);
});

test("Enter key in middle of text splits it", async ({ page }) => {
  await page.goto("/");
  const surface = page.locator(".creo-editor-surface");

  // Set clean content
  const toggleBtn = page.locator('.creo-editor-toolbar button[title="Toggle source/WYSIWYG"]');
  await toggleBtn.click();
  await page.locator(".creo-editor-source-textarea").fill("helloworld");
  await toggleBtn.click();
  await page.waitForTimeout(100);

  // Place cursor between "hello" and "world" — at offset 5
  await page.evaluate(() => {
    const surface = document.querySelector(".creo-editor-surface")!;
    const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
    const textNode = walker.nextNode() as Text;
    if (textNode) {
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      const range = document.createRange();
      range.setStart(textNode, 5);
      range.collapse(true);
      sel.addRange(range);
    }
  });
  await page.waitForTimeout(50);

  // Press Enter
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);

  // Should have "hello" in one paragraph and "world" in another
  const pTexts = await surface.locator("p").allTextContents();
  console.log("Split paragraphs:", pTexts);

  expect(pTexts.some(t => t === "hello")).toBe(true);
  expect(pTexts.some(t => t === "world")).toBe(true);
});

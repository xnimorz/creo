import { test, expect } from "@playwright/test";

test("typing in the bold 'Markdown' word inserts text there, not in 'rich text'", async ({ page }) => {
  await page.goto("/");

  const surface = page.locator(".creo-editor-surface");

  // The first list item contains "Full **Markdown** support..."
  const markdownStrong = surface.locator("strong", { hasText: "Markdown" });
  await expect(markdownStrong).toBeVisible();

  // Click in the middle of "Markdown"
  await markdownStrong.click();

  // Type
  await page.keyboard.type("ZZZ", { delay: 50 });

  // Find the <li> containing the original Markdown text — it should now have ZZZ
  const listItem = surface.locator("li", { hasText: "ZZZ" });
  await expect(listItem).toBeVisible();
  const liText = await listItem.textContent();
  expect(liText).toContain("ZZZ");

  // The ZZZ should be inside a <strong> (inherits bold mark)
  const boldWithZ = listItem.locator("strong", { hasText: "ZZZ" });
  await expect(boldWithZ).toBeVisible();

  // "rich text" strong must be untouched
  const richStrong = surface.locator("strong", { hasText: "rich text" });
  const richText = await richStrong.textContent();
  expect(richText).not.toContain("ZZZ");
});

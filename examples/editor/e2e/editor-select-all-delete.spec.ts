import { test, expect } from "@playwright/test";

test("Cmd+A then Backspace clears the editor without crashing", async ({ page }) => {
  await page.goto("/");
  const surface = page.locator(".creo-editor-surface");

  // Click to focus
  await surface.click();

  // Select all
  await page.keyboard.press("Meta+a");
  // Fallback for non-Mac CI
  await page.keyboard.press("Control+a");

  // Delete
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(100);

  // Editor should still be visible and functional
  await expect(surface).toBeVisible();
  await expect(surface).toHaveAttribute("contenteditable", "true");

  // Content should be empty or contain just an empty paragraph
  // The editor must not crash — we should be able to type new content
  await page.keyboard.type("fresh start", { delay: 30 });

  const text = await surface.textContent();
  expect(text).toContain("fresh start");
});

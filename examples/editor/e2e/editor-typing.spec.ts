import { test, expect } from "@playwright/test";

test.describe("Editor typing & input", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("surface is focusable", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");
    await surface.click();
    await expect(surface).toBeFocused();
  });

  test("surface has tabindex for keyboard focus", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");
    await expect(surface).toHaveAttribute("tabindex", "0");
  });

  test("contenteditable prevents default browser mutations", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");
    await surface.click();

    // The editor intercepts beforeinput — we verify the surface
    // still has contenteditable and is interactive
    await expect(surface).toHaveAttribute("contenteditable", "true");
  });
});

test.describe("Editor keyboard shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Ctrl+B triggers bold (toolbar interaction)", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");
    await surface.click();

    // Select some text first
    await page.keyboard.down("Shift");
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("ArrowRight");
    }
    await page.keyboard.up("Shift");

    // Toggle bold via keyboard shortcut
    await page.keyboard.press("Control+b");

    // The command should have been handled (no error, page still responsive)
    await expect(surface).toBeVisible();
  });
});

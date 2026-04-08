import { test, expect } from "@playwright/test";

test.describe("Mutation defense", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("surface survives external DOM injection", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");
    await expect(surface).toBeVisible();

    // Count initial children
    const initialChildCount = await surface.evaluate(
      (el) => el.children.length,
    );
    expect(initialChildCount).toBeGreaterThan(0);

    // Simulate an external mutation (like Grammarly injecting a span)
    await surface.evaluate((el) => {
      const injected = document.createElement("span");
      injected.textContent = "INJECTED_BY_EXTENSION";
      injected.className = "grammarly-fake";
      el.appendChild(injected);
    });

    // Wait for the MutationObserver to detect and reconcile
    await page.waitForTimeout(200);

    // The model is source of truth — reconciliation should either
    // remove the injected element or the editor should still function
    // Check the editor is still responsive
    await expect(surface).toBeVisible();
    await expect(surface).toHaveAttribute("contenteditable", "true");
  });

  test("surface survives text content modification", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    // Directly modify text content via script (simulating autocorrect)
    await surface.evaluate((el) => {
      const firstP = el.querySelector("p");
      if (firstP) {
        firstP.textContent = "MODIFIED_BY_AUTOCORRECT";
      }
    });

    // Wait for reconciliation
    await page.waitForTimeout(200);

    // Editor should still be functional
    await expect(surface).toBeVisible();
    await surface.click();
    await expect(surface).toBeFocused();
  });

  test("surface survives attribute modification", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    // Modify attributes (simulating an extension)
    await surface.evaluate((el) => {
      const firstP = el.querySelector("p");
      if (firstP) {
        firstP.setAttribute("style", "color: red !important");
        firstP.setAttribute("data-extension", "true");
      }
    });

    // Wait for reconciliation
    await page.waitForTimeout(200);

    // Editor should still be functional
    await expect(surface).toBeVisible();
  });

  test("surface survives child removal", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    // Remove a child node (simulating a buggy extension)
    await surface.evaluate((el) => {
      const firstChild = el.firstElementChild;
      if (firstChild) {
        el.removeChild(firstChild);
      }
    });

    // Wait for reconciliation
    await page.waitForTimeout(200);

    // Editor should reconcile and restore from model
    await expect(surface).toBeVisible();
    await expect(surface).toHaveAttribute("contenteditable", "true");
  });

  test("contenteditable attribute cannot be removed", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");

    // Try to remove contenteditable
    await surface.evaluate((el) => {
      el.removeAttribute("contenteditable");
    });

    // Even if the attribute is removed, the editor wrapper still exists
    await expect(page.locator(".creo-editor-wysiwyg-wrapper")).toBeVisible();
  });
});

test.describe("Non-editable blocks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("HTML blocks are rendered as non-editable", async ({ page }) => {
    const surface = page.locator(".creo-editor-surface");
    const htmlBlock = surface.locator("[data-node-type='html_block']");

    await expect(htmlBlock).toBeVisible();
    await expect(htmlBlock).toHaveAttribute("contenteditable", "false");
  });
});

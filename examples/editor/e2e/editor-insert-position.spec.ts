import { test, expect } from "@playwright/test";

test("inserting between n and g in 'editing' produces 'editinog' not 'edition'", async ({ page }) => {
  await page.goto("/");
  const surface = page.locator(".creo-editor-surface");

  // Find the list item containing "WYSIWYG editing"
  const li = surface.locator("li", { hasText: "WYSIWYG editing" });
  await expect(li).toBeVisible();

  // Click at the end of "editin" — we need to place cursor between n and g
  // Use evaluate to set precise cursor position
  await page.evaluate(() => {
    const surface = document.querySelector(".creo-editor-surface")!;
    // Find the text node containing "WYSIWYG editing"
    const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if ((node as Text).data.includes("WYSIWYG editing")) {
        // Place cursor between 'n' and 'g' in "editing"
        // "WYSIWYG editing" — 'n' is at index 13, 'g' at 14
        // Offset 14 = after 'n', before 'g'
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        const range = document.createRange();
        range.setStart(node, 14); // after "WYSIWYG editin", before "g"
        range.collapse(true);
        sel.addRange(range);
        break;
      }
      node = walker.nextNode();
    }
  });

  // Verify cursor is placed correctly
  const selInfo = await page.evaluate(() => {
    const s = window.getSelection()!;
    const n = s.anchorNode as Text;
    return { text: n.data, offset: s.anchorOffset };
  });
  console.log("Cursor at:", selInfo);
  expect(selInfo.text).toContain("WYSIWYG editing");
  expect(selInfo.offset).toBe(14);

  // Type 'o'
  await page.keyboard.press("o");
  await page.waitForTimeout(100);

  // The text should now be "WYSIWYG editinog" NOT "WYSIWYG edition"
  // Re-find since text changed
  await page.waitForTimeout(50);
  const allText = await surface.textContent();
  console.log("Surface contains editinog:", allText?.includes("editinog"));
  console.log("Surface contains edition:", allText?.includes("edition"));

  // Find the fragment
  const match = allText?.match(/editi\w*g/);
  console.log("Match:", match?.[0]);

  expect(allText).toContain("editinog");
  expect(allText).not.toContain("edition");
});

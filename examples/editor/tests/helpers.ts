import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Editor handle — wraps a Page with editor-specific helpers so tests don't
 * have to know about `data-creo-input` / `.creo-editor` selectors.
 */
export class EditorHarness {
  /** Set after open() — true when the page's `navigator.platform` looks Mac-ish. */
  isMacEmulated = false;

  constructor(public readonly page: Page) {}

  static async open(page: Page): Promise<EditorHarness> {
    await page.goto("/");
    const h = new EditorHarness(page);
    await h.editor.waitFor();
    h.isMacEmulated = await page.evaluate(() => {
      const p = navigator.platform || "";
      const ua = navigator.userAgent || "";
      return /Mac|iPhone|iPod|iPad/i.test(p) || /Mac|iPhone|iPod|iPad/i.test(ua);
    });
    await h.reset();
    return h;
  }

  get editor(): Locator {
    return this.page.locator(".creo-editor");
  }

  get textarea(): Locator {
    return this.page.locator("textarea[data-creo-input]");
  }

  /**
   * Click into the editor to focus the hidden textarea AND place the caret
   * at the click point (mirrors a real user tap).
   */
  async focus(): Promise<void> {
    await this.editor.click();
    await expect(this.textarea).toBeFocused();
  }

  /**
   * Focus the textarea WITHOUT moving the caret. Use when the test set up a
   * specific selection programmatically and just needs the textarea to be
   * the active element so subsequent keystrokes flow into the editor.
   */
  async focusKeepingSelection(): Promise<void> {
    await this.page.evaluate(() => {
      const ta = document.querySelector(
        "textarea[data-creo-input]",
      ) as HTMLTextAreaElement;
      ta.focus();
    });
    await expect(this.textarea).toBeFocused();
  }

  /** Replace the current document with a single empty paragraph. */
  async reset(): Promise<void> {
    await this.page.evaluate(() => {
      const e = (window as unknown as {
        __editor?: {
          docStore: { set: (d: unknown) => void };
          selStore: { set: (s: unknown) => void };
        };
      }).__editor;
      if (!e) return;
      // Build a single-empty-paragraph DocState directly. Going through
      // setDocFromHTML('<p></p>') is wrong: the parser drops empty
      // structural tags by design (so they don't pollute pasted content).
      const id = `t_${Math.random().toString(36).slice(2, 9)}`;
      const block = { id, index: "U", type: "p", runs: [] };
      const byId = new Map([[id, block]]);
      e.docStore.set({ byId, order: [id] });
      e.selStore.set({ kind: "caret", at: { blockId: id, path: [0], offset: 0 } });
    });
  }

  /** Read the current document as serialized JSON. */
  async toJSON(): Promise<{ blocks: { type: string; runs?: { text: string; marks?: string[] }[] }[] }> {
    return await this.page.evaluate(() => {
      const e = (window as unknown as {
        __editor?: { toJSON: () => unknown };
      }).__editor;
      return e?.toJSON() as never;
    });
  }

  /** All paragraph DOM nodes inside the editor. */
  paragraphs(): Locator {
    return this.editor.locator("p[data-block-id]");
  }

  /** Type a string into the focused textarea (assumes focus()). */
  async type(text: string): Promise<void> {
    await this.page.keyboard.type(text);
  }

  /** Press a chord like "Meta+B" / "Control+B". `mod` is the platform mod key. */
  async chord(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /**
   * The mod key name to send via `keyboard.press("Meta+b")`. Mirrors the
   * editor's own `isMac()` heuristic by reading the page's navigator —
   * Playwright's "Desktop Chrome" profile emulates Windows by default, so
   * the host OS isn't a reliable signal.
   */
  get mod(): "Meta" | "Control" {
    return this.isMacEmulated ? "Meta" : "Control";
  }

  /** Synthesize a paste event with the given content types. */
  async pasteHTML(html: string, plain = ""): Promise<void> {
    await this.page.evaluate(
      ({ html, plain }) => {
        const ta = document.querySelector(
          "textarea[data-creo-input]",
        ) as HTMLTextAreaElement | null;
        if (!ta) throw new Error("no editor textarea");
        const dt = new DataTransfer();
        if (html) dt.setData("text/html", html);
        if (plain) dt.setData("text/plain", plain);
        const ev = new Event("paste", { bubbles: true, cancelable: true });
        Object.defineProperty(ev, "clipboardData", {
          value: dt,
          configurable: true,
        });
        ta.dispatchEvent(ev);
      },
      { html, plain },
    );
  }

  async pastePlain(plain: string, withShift = false): Promise<void> {
    if (withShift) {
      // Send a Shift keydown first so the clipboard handler's shift-tracker
      // sees Shift as held when the paste event fires.
      await this.page.evaluate((plain) => {
        const ta = document.querySelector(
          "textarea[data-creo-input]",
        ) as HTMLTextAreaElement | null;
        if (!ta) throw new Error("no editor textarea");
        ta.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Shift",
            shiftKey: true,
            bubbles: true,
          }),
        );
        const dt = new DataTransfer();
        dt.setData("text/html", "<h1>SHOULD-NOT-APPEAR</h1>");
        dt.setData("text/plain", plain);
        const ev = new Event("paste", { bubbles: true, cancelable: true });
        Object.defineProperty(ev, "clipboardData", {
          value: dt,
          configurable: true,
        });
        ta.dispatchEvent(ev);
      }, plain);
      return;
    }
    await this.pasteHTML("", plain);
  }

  /** Synthesize a composition session (compositionstart → updates → end). */
  async composition(updates: string[], commit?: string): Promise<void> {
    await this.page.evaluate(
      ({ updates, commit }) => {
        const ta = document.querySelector(
          "textarea[data-creo-input]",
        ) as HTMLTextAreaElement | null;
        if (!ta) throw new Error("no editor textarea");
        const fire = (
          type: "compositionstart" | "compositionupdate" | "compositionend",
          data?: string,
        ) => {
          const ev = new Event(type, { bubbles: true });
          if (data !== undefined) {
            Object.defineProperty(ev, "data", { value: data });
          }
          ta.dispatchEvent(ev);
        };
        fire("compositionstart");
        for (const u of updates) fire("compositionupdate", u);
        if (commit !== undefined) {
          ta.value = commit;
          fire("compositionend", commit);
        } else {
          fire("compositionend", updates[updates.length - 1] ?? "");
        }
      },
      { updates, commit },
    );
  }

  /** Issue a typed editor command via the exposed handle. */
  async dispatch(cmd: unknown): Promise<void> {
    await this.page.evaluate((cmd) => {
      const e = (window as unknown as {
        __editor?: { dispatch: (c: unknown) => void };
      }).__editor;
      e?.dispatch(cmd);
    }, cmd);
  }

  async undo(): Promise<void> {
    await this.page.evaluate(() => {
      const e = (window as unknown as { __editor?: { undo: () => void } }).__editor;
      e?.undo();
    });
  }

  async redo(): Promise<void> {
    await this.page.evaluate(() => {
      const e = (window as unknown as { __editor?: { redo: () => void } }).__editor;
      e?.redo();
    });
  }
}

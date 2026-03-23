import type { View } from "@/internal/internal_view";
import type { IRender, PrimitiveRenderHandler } from "./render_interface";
import { PrimitiveRegistry } from "./primitive_registry";
import type { PrimitiveComponent } from "@/public/primitive";
import { div, span, text, button, img } from "@/public/primitives/primitives";
import type { Maybe } from "@/functional/maybe";

/**
 * Stateless string renderer — pull-based.
 * mount/unmount/update are no-ops. Call renderToString() to
 * get the current HTML string from the VDOM.
 */
export class StringRender implements IRender<string> {
  private primitives = new PrimitiveRegistry<string>();
  private rootView: Maybe<View>;

  constructor() {
    this.registerBuiltins();
  }

  // -- IRender ----------------------------------------------------------------

  render(view: View): void {
    if (!view.parent) {
      this.rootView = view;
    }
  }

  unmount(_view: View): void {}

  registerPrimitive(
    entries: [PrimitiveComponent<any, any>, PrimitiveRenderHandler<string>][],
  ): void {
    this.primitives.register(entries);
  }

  // -- Public -----------------------------------------------------------------

  /** Build and return the current HTML string from the VDOM. */
  renderToString(): string {
    if (!this.rootView) return "";
    return this.buildString(this.rootView);
  }

  // -- Internal ---------------------------------------------------------------

  private buildString(view: View): string {
    const handler = this.primitives.getHandler(view.viewFn);
    if (handler) {
      return handler.render(view);
    }
    return this.buildChildren(view);
  }

  private buildChildren(view: View): string {
    let result = "";
    for (const child of view.virtualDom) {
      result += this.buildString(child);
    }
    return result;
  }

  private registerBuiltins() {
    this.registerPrimitive([
      [div, { render: (view) => `<div>${this.buildChildren(view)}</div>` }],
      [span, { render: (view) => `<span>${this.buildChildren(view)}</span>` }],
      [text, { render: (view) => `${view.props.content}` }],
      [button, { render: (view) => `<button>${this.buildChildren(view)}</button>` }],
      [img, { render: (view) => `<img src="${view.props.src}"${view.props.alt ? ` alt="${view.props.alt}"` : ""} />` }],
    ]);
  }
}

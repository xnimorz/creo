import { StyledComponent, creo } from "../Component";

import type * as CSS from "csstype";

@creo
export class UIBlock extends StyledComponent {
  ui() {
    // Push to CSS layout tree
  }
  with(ui: () => void) {
    // TODO -- use ui function during render stage only
    ui();
    return this;
  }
  style(_styles: CSS.Properties | (() => CSS.Properties)) {
    return this;
  }
}

export function Block() {
  return new UIBlock();
}

export const Block = creo(() => {});

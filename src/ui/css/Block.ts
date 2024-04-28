import { StyledComponent, creo } from "../Component";

@creo
export class UIBlock extends StyledComponent {
  ui() {
    // Push to CSS layout tree
  }
  with(ui: () => void) {}
}

export function Block() {
  return new UIBlock();
}

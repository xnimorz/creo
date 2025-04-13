import { StyledComponent, creo } from "../Component";

@creo
export class CSSVStack extends StyledComponent {
  ui() {
    // Push to CSS layout tree
  }
  with(ui: () => void) {
    ui();
  }
}

export function VStack() {
  return new CSSVStack();
}

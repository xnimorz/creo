import { StyledComponent, creo } from "../Component";

@creo
class CSSText extends StyledComponent {
  private text: string;
  constructor(text: string) {
    super();
    this.text = text;
  }
  ui() {
    // Push to CSS layout tree
    this.text;
  }
  with() {}
}

export function Text(text: string) {
  return new CSSText(text);
}

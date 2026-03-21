import type { View } from "@/internal/internal_view";

export interface IRender<T> {
  render(view: View): T;
}

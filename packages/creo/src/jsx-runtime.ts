import type { Key } from "@/functional/key";
import type {
  HtmlAttrs,
  ContainerEvents,
  FormEvents,
} from "@/public/primitives/primitives";
import type { EventHandlerProps } from "@/public/primitive";

export { jsx, jsxs, Fragment } from "@/public/jsx";
export type { JsxNode, JsxChildren } from "@/public/jsx";

// ---------------------------------------------------------------------------
// JSX namespace — resolved by the TypeScript `react-jsx` transform when
// `jsxImportSource` points at "creo". Declared here (rather than re-exported
// as a type) because TS looks for a concrete `JSX` namespace at this path.
// ---------------------------------------------------------------------------

type AllHtmlProps = HtmlAttrs &
  EventHandlerProps<ContainerEvents & FormEvents> & {
    key?: Key;
    children?: unknown;
  };

export namespace JSX {
  // A Creo JSX expression evaluates to either `void` (the return type of a
  // view call) or a lazy `() => void` thunk (the return type of `jsx()`).
  // Unioning both lets Creo views and JSX factory output be interchangeable
  // as JSX children and component return values.
  export type Element = void | (() => void);
  export interface ElementChildrenAttribute {
    children: Record<string, never>;
  }
  export interface IntrinsicElements {
    [elemName: string]: AllHtmlProps;
  }
}

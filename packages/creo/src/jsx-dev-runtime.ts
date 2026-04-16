import type { Key } from "@/functional/key";
import type {
  HtmlAttrs,
  ContainerEvents,
  FormEvents,
} from "@/public/primitives/primitives";
import type { EventHandlerProps } from "@/public/primitive";

export { jsxDEV, Fragment } from "@/public/jsx";
export type { JsxNode, JsxChildren } from "@/public/jsx";

// See jsx-runtime.ts for why the JSX namespace is declared here.

type AllHtmlProps = HtmlAttrs &
  EventHandlerProps<ContainerEvents & FormEvents> & {
    key?: Key;
    children?: unknown;
  };

export namespace JSX {
  // See jsx-runtime.ts for why Element is a union.
  export type Element = void | (() => void);
  export interface ElementChildrenAttribute {
    children: Record<string, never>;
  }
  export interface IntrinsicElements {
    [elemName: string]: AllHtmlProps;
  }
}

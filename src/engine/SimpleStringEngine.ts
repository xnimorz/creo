import { isJust, Maybe } from "../data-structures/maybe/Maybe";
import { InternalComponent } from "./InternalComponent";
import { Node } from "./Node";
import { LayoutEngine } from "./LayoutEngine";

export class SimpleStringEngine extends LayoutEngine {
  representaion: Array<StringRecord> = [];

  renderUI<P>(
    ic: InternalComponent,
    parentCursor: LayoutCursor,
    previousLayoutCursor: Maybe<LayoutCursor>,
    params: P,
  ): LayoutCursor {
    const stringParentCursor = parentCursor as StringLayoutCursor;
    const stringPreviousLayoutCursor =
      previousLayoutCursor as Maybe<StringLayoutCursor>;

    if (isNone(stringPreviousLayoutCursor)) {
    }
  }
}

class StringRecord {
  tag: string;
  params: Maybe<{ [key: string]: string }>;
  depth: number;

  constructor(
    tag: string,
    params: Maybe<{ [key: string]: string }>,
    depth: number,
  ) {
    this.tag = tag;
    this.params = params;
    this.depth = depth;
  }

  toString(): string {
    return `${Array.from({ length: this.depth })
      .map((_) => " ")
      .join(
        "",
      )}${this.tag}: ${isJust(this.params) ? JSON.stringify(this.params) : "<empty>"}`;
  }
}

export class StringLayoutCursor extends LayoutCursor {
  path: Array<number>;
}

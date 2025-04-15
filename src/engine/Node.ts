/**
 *  Represents physical node for UI rendering engine
 *  In charge of:
 *  1. UI changes
 *  2. Animations
 *  3. GC when gets destroyed
 */

import { Maybe } from "../data-structures/maybe/Maybe";
import { InternalComponent } from "./InternalComponent";

export abstract class Node {
  constructor(
    public tag: string,
    public text: Maybe<string>,
    public p: { [key: string]: string },
    public ic: InternalComponent,
    public parentNode: Node,
  ) {}

  abstract dispose(): void;
}

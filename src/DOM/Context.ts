import { Maybe } from "../data-structures/maybe/Maybe";
import {
  onDidUpdate,
  record,
  RecordOf,
} from "../data-structures/record/Record";
import { Node } from "./Node";

export class Context<P> {
  private subscribers: Array<() => void> = [];
  private node: Node;
  tracked = <T extends {}>(t: T): RecordOf<T> => {
    const rec = record(t);
    this.subscribers.push(
      onDidUpdate(rec, () => {
        this.node.invalidate();
      }),
    );
    return rec;
  };
  p: P;
  slot: Maybe<() => void>;

  constructor(node: Node, initialParams: P, slot: Maybe<() => void>) {
    this.node = node;
    this.p = initialParams;
    this.slot = slot;
  }
  dispose() {
    this.subscribers.forEach((unsubscribe) => unsubscribe());
  }

  setSlot(slot: () => void): void {
    this.slot = slot;
  }
}

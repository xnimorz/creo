import { Maybe } from "../data-structures/maybe/Maybe";
import {
  onDidUpdate,
  record,
  RecordOf,
} from "../data-structures/record/Record";
import { InternalNode } from "./Node";

export class CreoContext<P> implements Context<P> {
  private subscribers: Array<() => void> = [];
  private node: InternalNode;
  tracked = <T extends {}>(t: T): RecordOf<T> => {
    const rec = record(t);
    this.subscribers.push(
      onDidUpdate(rec, () => {
        console.log("invalidate", this.node.internalKey);
        this.node.invalidate();
      }),
    );
    return rec;
  };
  p: P;
  slot: Maybe<() => void>;

  constructor(node: InternalNode, initialParams: P, slot: Maybe<() => void>) {
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

export interface Context<P> {
  tracked: <T extends {}>(t: T) => RecordOf<T>;
  p: P;
  slot: Maybe<() => void>;
}

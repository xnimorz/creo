import { Maybe } from "../data-structures/maybe/Maybe";
import {
  onDidUpdate,
  record,
  RecordOf,
} from "../data-structures/record/Record";
import { InternalComponent } from "./InternalComponent";

export class CreoContext<P> implements Context<P> {
  private subscribers: Array<() => void> = [];
  private ic: InternalComponent;
  tracked = <T extends {}>(t: T): RecordOf<T> => {
    const rec = record(t);
    this.subscribers.push(onDidUpdate(rec, () => this.ic.setDirty(true)));
    return rec;
  };
  p: P;
  slot: Maybe<() => void>;

  constructor(
    ic: InternalComponent,
    initialParams: P,
    slot: Maybe<() => void>,
  ) {
    this.ic = ic;
    this.p = initialParams;
    this.slot = slot;
  }

  newParams(p: P) {
    this.p = p;
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

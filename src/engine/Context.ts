import {
  onDidUpdate,
  record,
  RecordOf,
} from "../data-structures/record/Record";
import { InternalComponent } from "./InternalComponent";

export class CreoContext<P> {
  private subscribers: Array<() => void> = [];
  private ic: InternalComponent;
  tracked = <T extends {}>(t: T): RecordOf<T> => {
    const rec = record(t);
    this.subscribers.push(onDidUpdate(rec, () => this.ic.setDirty(true)));
    return rec;
  };
  lowLevel = (): void => {
    throw new Error("Not implemented");
  };
  p: P;
  slot: () => void;

  constructor(ic: InternalComponent, initialParams: P) {
    this.ic = ic;
    this.p = initialParams;
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
  e: <P>(tag: string, params: P) => void;
  p: P;
  setSlot: (slot: () => void) => void;
  slot: () => void;
}

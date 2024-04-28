import { LayoutEngine } from "../layout-engine/layoutEngine";
import { Root } from "./env/Root";

export function tick() {}

type ExecutionContext = {};

export function putToExecutionContext() {}

export function popFromExecutionContext() {}

export class EventLoop {
  private executionContext: Array<ExecutionContext> = [];
  private layoutEngine: LayoutEngine;
  private root: Root;
  constructor(layoutEngine: LayoutEngine, root: Root) {
    this.layoutEngine = layoutEngine;
    this.root = root;
  }

  tick() {}
}

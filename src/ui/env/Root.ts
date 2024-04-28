import { LayoutEngine } from "../../layout-engine/layoutEngine";
import { Component } from "../Component";
import { EventLoop, tick } from "../EventLoop";

export class Root extends Component {
  private _ui: () => void;
  private _layoutEngine: LayoutEngine;
  private _eventLoop: EventLoop;
  constructor(ui: () => void, layoutEngine: LayoutEngine) {
    super();
    this._ui = ui;
    this._layoutEngine = layoutEngine;
    this._eventLoop = new EventLoop(layoutEngine, this);
  }

  tick() {
    this._eventLoop.tick();
  }

  scheduleTick() {}

  ui() {
    this.ui();
  }
}

export function root(ui: () => void, layoutEngine: LayoutEngine): Root {
  const renderingContext = new Root(ui, layoutEngine);
  return renderingContext;
}

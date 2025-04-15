import { ComponentBuilder } from "./creo";
import { shallowEqual } from "./data-structures/shalllowEqual/shallowEqual";
import { Context } from "./engine/Context";

export type ComponentMethods<P = void, A = void> = {
  render(): void;
  didMount?(): void;
  didUpdate?(): void;
  dispose?(): void;
  // Return true if the component should get updated with new params
  shouldUpdate?(pendingParams: P): boolean;
  extension?: A extends void ? undefined : A;
  with?(slot: () => void): ComponentMethods<P, A>;
};

export class PublicComponent<P, A extends object = {}>
  implements Component<P, A>
{
  ctor: ComponentBuilder<P, A>;
  componentMethods: ComponentMethods<P, A>;
  c: Context<P>;

  constructor(ctor: ComponentBuilder<P, A>, c: Context<P>) {
    this.ctor = ctor;
    this.c = c;
    this.componentMethods = ctor(c);
  }

  get extension(): A extends void ? undefined : A {
    return this.componentMethods.extension as A extends void ? undefined : A;
  }

  didMount(): void {
    this.componentMethods.didMount?.();
  }

  didUpdate(): void {
    this.componentMethods.didUpdate?.();
  }

  shouldUpdate(pendingParams: P): boolean {
    if (this.componentMethods.shouldUpdate != null) {
      return this.componentMethods.shouldUpdate(pendingParams);
    }
    return !shallowEqual(this.c.p, pendingParams);
  }

  dispose(): void {
    this.componentMethods.dispose?.();
  }

  render() {
    this.componentMethods.render();
  }
}

// @ts-ignore
export interface Component<P, A = void> {
  shouldUpdate(pendingParams: P): boolean;
  render(): void;
  didMount(): void;
  didUpdate(): void;
  dispose(): void;
  extension: A extends void ? undefined : A;
}

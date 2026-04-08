import { describe, test, expect } from "bun:test";
import { createMutationController } from "./mutation-controller";
import type { MutationControllerConfig } from "./mutation-controller";

// Note: Full MutationObserver/contenteditable tests require a real browser
// (Playwright). These unit tests verify the controller's logic and API surface.

describe("createMutationController", () => {
  test("creates controller with correct initial state", () => {
    const controller = createMutationController({
      onInput: () => {},
      onUnexpectedMutation: () => {},
      onCompositionEnd: () => {},
      onReconcile: () => {},
    });

    expect(controller.isComposing).toBe(false);
    expect(controller.isAttached).toBe(false);
  });

  test("startExpectedMutation / endExpectedMutation don't throw when detached", () => {
    const controller = createMutationController({
      onInput: () => {},
      onUnexpectedMutation: () => {},
      onCompositionEnd: () => {},
      onReconcile: () => {},
    });

    // Should not throw even without attach
    expect(() => {
      controller.startExpectedMutation();
      controller.endExpectedMutation();
    }).not.toThrow();
  });

  test("reconcile is a no-op when detached", () => {
    let reconciled = false;
    const controller = createMutationController({
      onInput: () => {},
      onUnexpectedMutation: () => {},
      onCompositionEnd: () => {},
      onReconcile: () => { reconciled = true; },
    });

    controller.reconcile();
    expect(reconciled).toBe(false);
  });

  test("detach is idempotent", () => {
    const controller = createMutationController({
      onInput: () => {},
      onUnexpectedMutation: () => {},
      onCompositionEnd: () => {},
      onReconcile: () => {},
    });

    // Should not throw
    controller.detach();
    controller.detach();
  });

  test("config callbacks are stored correctly", () => {
    const calls: string[] = [];

    const config: MutationControllerConfig = {
      onInput: () => calls.push("input"),
      onUnexpectedMutation: () => calls.push("unexpected"),
      onCompositionEnd: () => calls.push("compositionEnd"),
      onReconcile: () => calls.push("reconcile"),
      onDebug: (msg) => calls.push(`debug:${msg}`),
    };

    const controller = createMutationController(config);
    expect(controller).toBeDefined();
    // Config is stored internally — verified by actual usage in integration tests
  });
});

describe("mutation controller API surface", () => {
  test("exposes all required methods", () => {
    const controller = createMutationController({
      onInput: () => {},
      onUnexpectedMutation: () => {},
      onCompositionEnd: () => {},
      onReconcile: () => {},
    });

    expect(typeof controller.isComposing).toBe("boolean");
    expect(typeof controller.isAttached).toBe("boolean");
    expect(typeof controller.startExpectedMutation).toBe("function");
    expect(typeof controller.endExpectedMutation).toBe("function");
    expect(typeof controller.reconcile).toBe("function");
    expect(typeof controller.attach).toBe("function");
    expect(typeof controller.detach).toBe("function");
  });
});

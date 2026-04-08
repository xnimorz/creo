/**
 * 4-Layer Mutation Defense System
 *
 * Ensures NO DOM mutation inside the contenteditable surface happens
 * without the editor being aware. The document model is always the
 * source of truth — the DOM is a derived projection.
 *
 * Layer 1: beforeinput — preventDefault() on all cancellable inputTypes
 * Layer 2: Composition tracking — allow IME, reconcile on compositionend
 * Layer 3: MutationObserver — catch leaks from extensions, a11y, autocorrect
 * Layer 4: State reconciliation — compare DOM vs model, model always wins
 */

export interface MutationControllerConfig {
  /** Called when a beforeinput event is intercepted and prevented. */
  onInput: (inputType: string, data: string | null, event: InputEvent) => void;

  /** Called when an unexpected DOM mutation is detected (Layer 3). */
  onUnexpectedMutation: (mutations: MutationRecord[]) => void;

  /** Called when composition ends (Layer 2). */
  onCompositionEnd: (data: string) => void;

  /** Called to trigger full DOM ↔ model reconciliation (Layer 4). */
  onReconcile: () => void;

  /** Optional: called for each beforeinput event for logging/debugging. */
  onDebug?: (message: string, detail?: unknown) => void;
}

export interface MutationController {
  /** Whether an IME composition is currently active. */
  readonly isComposing: boolean;

  /**
   * Call before programmatic DOM mutations (our own rendering).
   * Suppresses MutationObserver reactions during expected updates.
   */
  startExpectedMutation(): void;

  /**
   * Call after programmatic DOM mutations complete.
   * Re-enables MutationObserver classification.
   */
  endExpectedMutation(): void;

  /** Force a reconciliation cycle (DOM → model comparison, model wins). */
  reconcile(): void;

  /** Attach to a contenteditable element. */
  attach(element: HTMLElement): void;

  /** Detach from the element, removing all listeners. */
  detach(): void;

  /** Whether currently attached. */
  readonly isAttached: boolean;
}

// ── Input types that are NOT cancelable by spec ────────────────────────

const NON_CANCELABLE_INPUT_TYPES = new Set([
  "insertCompositionText",
]);

// ── Implementation ─────────────────────────────────────────────────────

export function createMutationController(config: MutationControllerConfig): MutationController {
  let element: HTMLElement | null = null;
  let observer: MutationObserver | null = null;
  let composing = false;
  let expectingMutation = false;
  let pendingReconcile = false;
  let attached = false;

  // Track unexpected mutations for batching
  let unexpectedMutations: MutationRecord[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const debug = config.onDebug ?? (() => {});

  // ── Layer 1: beforeinput handler ───────────────────────────────────

  function handleBeforeInput(e: InputEvent) {
    debug("beforeinput", { inputType: e.inputType, data: e.data, cancelable: e.cancelable });

    // Never prevent composition text — it's not cancelable by spec
    // and preventing it breaks IME
    if (NON_CANCELABLE_INPUT_TYPES.has(e.inputType)) {
      // Let it through, Layer 2 handles it
      return;
    }

    // Prevent the browser's default DOM mutation
    e.preventDefault();

    // Translate the intent to the editor's model
    config.onInput(e.inputType, e.data, e);
  }

  // ── Layer 2: Composition tracking ──────────────────────────────────

  function handleCompositionStart() {
    debug("compositionstart");
    composing = true;
  }

  function handleCompositionUpdate(e: CompositionEvent) {
    debug("compositionupdate", { data: e.data });
    // Don't interfere — let the browser manage the composition UI
  }

  function handleCompositionEnd(e: CompositionEvent) {
    debug("compositionend", { data: e.data });
    composing = false;

    // Now that composition is complete, reconcile the DOM with our model
    config.onCompositionEnd(e.data);

    // Schedule reconciliation to ensure DOM matches model
    scheduleReconcile();
  }

  // ── Layer 3: MutationObserver ──────────────────────────────────────

  function handleMutations(mutations: MutationRecord[]) {
    if (expectingMutation) {
      // These mutations are from our own rendering — ignore
      debug("expected mutations", { count: mutations.length });
      return;
    }

    if (composing) {
      // During composition, DOM may diverge from model — that's OK
      // We'll reconcile when compositionend fires
      debug("mutations during composition (deferred)", { count: mutations.length });
      return;
    }

    // Unexpected mutations! From extensions, spell checkers, a11y tools, etc.
    debug("UNEXPECTED mutations", {
      count: mutations.length,
      types: mutations.map(m => m.type),
    });

    unexpectedMutations.push(...mutations);
    scheduleFlushUnexpected();
  }

  function scheduleFlushUnexpected() {
    if (flushTimer !== null) return;
    // Batch unexpected mutations — they often come in rapid succession
    flushTimer = setTimeout(() => {
      flushTimer = null;
      if (unexpectedMutations.length > 0) {
        const batch = unexpectedMutations;
        unexpectedMutations = [];
        config.onUnexpectedMutation(batch);
        // After notifying, reconcile
        scheduleReconcile();
      }
    }, 0);
  }

  // ── Layer 4: Reconciliation ────────────────────────────────────────

  function scheduleReconcile() {
    if (pendingReconcile) return;
    pendingReconcile = true;
    // Use microtask so it runs after any pending DOM updates
    queueMicrotask(() => {
      pendingReconcile = false;
      if (!composing && attached) {
        config.onReconcile();
      }
    });
  }

  // ── Additional event handlers ──────────────────────────────────────

  function handleDrop(e: DragEvent) {
    // Prevent default drop behavior — we handle it through our model
    e.preventDefault();
    debug("drop prevented");

    // Extract drop data and notify
    const data = e.dataTransfer?.getData("text/plain") ?? null;
    if (data) {
      config.onInput("insertFromDrop", data, e as unknown as InputEvent);
    }
  }

  function handlePaste(e: ClipboardEvent) {
    // Some browsers fire paste before beforeinput
    // We prevent it here as a safety net
    e.preventDefault();
    debug("paste prevented (safety net)");
  }

  // ── Public API ─────────────────────────────────────────────────────

  const controller: MutationController = {
    get isComposing() {
      return composing;
    },

    get isAttached() {
      return attached;
    },

    startExpectedMutation() {
      expectingMutation = true;
      // Flush any pending observer records before our mutation
      observer?.takeRecords();
    },

    endExpectedMutation() {
      // Flush records from our mutation so they don't trigger handleMutations
      observer?.takeRecords();
      expectingMutation = false;
    },

    reconcile() {
      if (!composing && attached) {
        config.onReconcile();
      }
    },

    attach(el: HTMLElement) {
      if (attached) {
        controller.detach();
      }

      element = el;
      attached = true;

      // Layer 1: beforeinput
      element.addEventListener("beforeinput", handleBeforeInput);

      // Layer 2: Composition events
      element.addEventListener("compositionstart", handleCompositionStart);
      element.addEventListener("compositionupdate", handleCompositionUpdate);
      element.addEventListener("compositionend", handleCompositionEnd);

      // Safety net for drop and paste
      element.addEventListener("drop", handleDrop);
      element.addEventListener("paste", handlePaste);

      // Layer 3: MutationObserver
      observer = new MutationObserver(handleMutations);
      observer.observe(element, {
        childList: true,
        subtree: true,
        characterData: true,
        characterDataOldValue: true,
        attributes: true,
        attributeOldValue: true,
      });

      debug("mutation controller attached");
    },

    detach() {
      if (!attached || !element) return;

      // Remove event listeners
      element.removeEventListener("beforeinput", handleBeforeInput);
      element.removeEventListener("compositionstart", handleCompositionStart);
      element.removeEventListener("compositionupdate", handleCompositionUpdate);
      element.removeEventListener("compositionend", handleCompositionEnd);
      element.removeEventListener("drop", handleDrop);
      element.removeEventListener("paste", handlePaste);

      // Disconnect observer
      observer?.disconnect();
      observer = null;

      // Clear pending timers
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }

      element = null;
      attached = false;
      composing = false;
      expectingMutation = false;
      pendingReconcile = false;
      unexpectedMutations = [];

      debug("mutation controller detached");
    },
  };

  return controller;
}

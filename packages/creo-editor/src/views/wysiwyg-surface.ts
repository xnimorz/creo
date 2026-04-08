/**
 * WYSIWYG Surface — contenteditable div managed outside Creo's reconciler.
 *
 * Key responsibilities:
 * 1. Render document model to DOM via dom-renderer
 * 2. Intercept all input via 4-layer mutation controller
 * 3. Sync browser selection ↔ model selection bidirectionally
 * 4. Handle keyboard shortcuts via keymap
 */

import { view, div } from "creo";
import type { Store } from "creo";
import type { EditorInstance } from "../state/store";
import { createMutationController } from "./mutation-controller";
import type { MutationController } from "./mutation-controller";
import { renderToDOM, patchDOM } from "./dom-renderer";
import { handleInputType } from "../input/input-handler";
import { domSelectionToModel, modelSelectionToDOM } from "./selection-sync";
import type { BlockNode } from "../model/types";
import type { Step } from "../state/editor-state";
import type { MultiSelection } from "../state/selection";

export interface WysiwygSurfaceProps {
  readonly editor: Store<EditorInstance>;
}

export const WysiwygSurface = view<WysiwygSurfaceProps>(({ props, use }) => {
  const editor = use(props().editor);
  let surfaceEl: HTMLElement | null = null;
  let controller: MutationController | null = null;
  let lastRenderedDoc: BlockNode | null = null;
  let unsubscribe: (() => void) | null = null;

  /**
   * Whether we're currently dispatching a model change.
   * Prevents selectionchange from feeding back into the model while
   * we're updating it.
   */
  let isDispatching = false;

  /**
   * Suppresses selectionchange handling for a period after we
   * programmatically set the DOM selection.
   */
  let suppressSelectionChange = false;
  let suppressTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Read browser selection → update model ───────────────────────

  function syncSelectionFromDOM() {
    if (isDispatching) return;
    if (!surfaceEl) return;

    const domSel = window.getSelection();
    if (!domSel || domSel.rangeCount === 0) return;

    // Only process if the selection is within our surface
    const anchor = domSel.anchorNode;
    if (!anchor || !surfaceEl.contains(anchor)) return;

    const doc = editor.get().state.doc;
    const modelSel = domSelectionToModel(domSel, surfaceEl, doc);
    if (!modelSel) return;

    // Check if it actually changed
    const current = editor.get().state.selection;
    if (selectionsEqual(current, modelSel)) return;

    // Update the model selection without triggering a re-render
    // (the DOM already has the correct selection)
    isDispatching = true;
    try {
      editor.get().dispatch([], modelSel);
    } finally {
      isDispatching = false;
    }
  }

  // ── Set browser selection from model ────────────────────────────

  function syncSelectionToDOM() {
    if (!surfaceEl) return;
    const inst = editor.get();

    // Suppress selectionchange feedback for a window after we set the selection.
    // selectionchange fires asynchronously, so a simple synchronous flag won't work.
    suppressSelectionChange = true;
    if (suppressTimer !== null) clearTimeout(suppressTimer);
    suppressTimer = setTimeout(() => {
      suppressSelectionChange = false;
      suppressTimer = null;
    }, 50);

    modelSelectionToDOM(inst.state.selection, surfaceEl, inst.state.doc);
  }

  // ── Dispatch: applies steps AND updates model selection ─────────

  function dispatch(steps: readonly Step[], selection: MultiSelection) {
    isDispatching = true;
    try {
      editor.get().dispatch(steps, selection);

      // Synchronously re-render and restore selection WITHIN the dispatch
      // This prevents the async subscriber from doing a second render
      if (steps.length > 0) {
        renderSurface();
      }
    } finally {
      isDispatching = false;
    }
  }

  // Extended dispatch that supports splitBlock's tree replacement
  function extendedDispatch(steps: readonly Step[], selection: MultiSelection) {
    dispatch(steps, selection);
  }
  // Attach the __splitBlock handler for the splitBlock command
  (extendedDispatch as unknown as Record<string, unknown>).__splitBlock = (
    newDoc: import("../model/types").BlockNode,
    sel: MultiSelection,
  ) => {
    isDispatching = true;
    try {
      editor.get().replaceState(newDoc, sel);
      renderSurface();
    } finally {
      isDispatching = false;
    }
  };

  // ── DOM rendering ───────────────────────────────────────────────

  function renderSurface() {
    if (!surfaceEl || !controller) return;

    const doc = editor.get().state.doc;

    controller.startExpectedMutation();
    try {
      if (!lastRenderedDoc) {
        renderToDOM(doc, surfaceEl);
      } else {
        patchDOM(lastRenderedDoc, doc, surfaceEl);
      }
      lastRenderedDoc = doc;
    } finally {
      controller.endExpectedMutation();
    }

    // After rendering, restore the model selection in the DOM
    syncSelectionToDOM();
  }

  // ── Mutation controller setup ───────────────────────────────────

  function setupController() {
    if (!surfaceEl) return;

    controller = createMutationController({
      onInput(inputType, data, _event) {
        // Read the CURRENT browser selection right before handling input
        // This ensures we use the position where the user actually clicked/typed
        syncSelectionFromDOM();

        const state = editor.get().state;
        handleInputType(inputType, data, state, extendedDispatch);
      },

      onUnexpectedMutation(mutations) {
        if (typeof console !== "undefined") {
          console.warn(
            `[creo-editor] ${mutations.length} unexpected DOM mutation(s) detected. Reconciling.`,
          );
        }
      },

      onCompositionEnd(data) {
        if (data) {
          syncSelectionFromDOM();
          const state = editor.get().state;
          handleInputType("insertText", data, state, extendedDispatch);
        }
      },

      onReconcile() {
        renderSurface();
      },
    });

    controller.attach(surfaceEl);
  }

  // ── Keyboard handler ────────────────────────────────────────────

  function handleKeyDown(event: KeyboardEvent) {
    // Sync selection before processing the key
    syncSelectionFromDOM();

    const inst = editor.get();
    const handled = inst.keymap.handleKeyDown(event, inst.state, extendedDispatch);
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // ── Selection change handler ────────────────────────────────────

  function handleSelectionChange() {
    if (suppressSelectionChange) return;
    syncSelectionFromDOM();
  }

  return {
    onMount() {
      const wrapper = document.querySelector(".creo-editor-wysiwyg-wrapper");
      if (wrapper) {
        surfaceEl = wrapper.querySelector(".creo-editor-surface") as HTMLElement | null;
      }

      if (surfaceEl) {
        // Keyboard shortcuts
        surfaceEl.addEventListener("keydown", handleKeyDown);

        // Selection sync — listen on document, not on the element
        document.addEventListener("selectionchange", handleSelectionChange);

        setupController();
        renderSurface();

        // Re-render on store changes (from external edits, source mode, etc.)
        unsubscribe = props().editor.subscribe(() => {
          if (isDispatching) return; // We caused this change, DOM is already up to date
          const newDoc = editor.get().state.doc;
          if (newDoc !== lastRenderedDoc) {
            renderSurface();
          }
        });
      }
    },

    onUpdateAfter() {
      const newDoc = editor.get().state.doc;
      if (surfaceEl && newDoc !== lastRenderedDoc) {
        renderSurface();
      }
    },

    render() {
      div({ class: "creo-editor-wysiwyg-wrapper" }, () => {
        div({
          class: "creo-editor-surface",
          contenteditable: "true",
          tabindex: 0,
        } as Record<string, unknown>);
      });
    },
  };
});

// ── Helpers ────────────────────────────────────────────────────────────

function selectionsEqual(a: MultiSelection, b: MultiSelection): boolean {
  if (a.ranges.length !== b.ranges.length) return false;
  for (let i = 0; i < a.ranges.length; i++) {
    const ar = a.ranges[i]!;
    const br = b.ranges[i]!;
    if ((ar.anchor as number) !== (br.anchor as number)) return false;
    if ((ar.head as number) !== (br.head as number)) return false;
  }
  return true;
}

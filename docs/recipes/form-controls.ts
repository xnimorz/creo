import {
  createApp,
  view,
  div,
  h2,
  p,
  span,
  button,
  input,
  audio,
  video,
  HtmlRender,
  _,
} from "creo";
import type { InputEventData } from "creo";

const VIDEO_SRC =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
const AUDIO_SRC =
  "https://upload.wikimedia.org/wikipedia/en/4/45/ACDC_-_Back_In_Black-sample.ogg";

// 1. Checkbox — onChange exposes e.checked; state drives the live property.
const CheckboxDemo = view(({ use }) => {
  const accepted = use(false);
  const onChange = (e: InputEventData) => accepted.set(e.checked);
  const force = () => accepted.update((v) => !v);

  return {
    render() {
      div({ class: "card" }, () => {
        h2(_, "Checkbox");
        div({ class: "row" }, () => {
          input({ type: "checkbox", checked: accepted.get(), onChange });
          span({ class: "label" }, "I accept the terms");
          span(
            { class: accepted.get() ? "tag on" : "tag" },
            `checked: ${accepted.get()}`,
          );
        });
        div({ class: "row" }, () => {
          button({ onClick: force }, "Toggle from state");
        });
        p({ class: "note" }, "Click the box, then the button — both routes keep state and DOM in sync.");
      });
    },
  };
});

// 2. Video / audio muted — prop hits el.muted, not the inert defaultMuted attribute.
const MediaDemo = view(({ use }) => {
  const videoMuted = use(true);
  const audioMuted = use(true);
  const toggleVideo = () => videoMuted.update((v) => !v);
  const toggleAudio = () => audioMuted.update((v) => !v);

  return {
    render() {
      div({ class: "card" }, () => {
        h2(_, "Video / audio muted");
        video({ src: VIDEO_SRC, controls: true, autoplay: true, muted: videoMuted.get(), width: 320 });
        div({ class: "row" }, () => {
          button({ onClick: toggleVideo }, "Toggle video mute");
          span({ class: videoMuted.get() ? "tag" : "tag on" }, `muted: ${videoMuted.get()}`);
        });
        audio({ src: AUDIO_SRC, controls: true, muted: audioMuted.get() });
        div({ class: "row" }, () => {
          button({ onClick: toggleAudio }, "Toggle audio mute");
          span({ class: audioMuted.get() ? "tag" : "tag on" }, `muted: ${audioMuted.get()}`);
        });
        p({ class: "note" }, "Re-rendering writes el.muted (the live property), not the inert defaultMuted attribute.");
      });
    },
  };
});

// 3. Focus / blur — capture-phase delegation makes onFocus/onBlur fire.
const FocusDemo = view(({ use }) => {
  const focused = use<string | null>(null);
  const log = use<string[]>([]);
  const append = (msg: string) => log.update((l) => [msg, ...l].slice(0, 5));

  const onFocusA = () => { focused.set("A"); append("focus → A"); };
  const onBlurA = () => { if (focused.get() === "A") focused.set(null); append("blur ← A"); };
  const onFocusB = () => { focused.set("B"); append("focus → B"); };
  const onBlurB = () => { if (focused.get() === "B") focused.set(null); append("blur ← B"); };

  return {
    render() {
      const which = focused.get();
      div({ class: "card" }, () => {
        h2(_, "Focus / blur");
        div({ class: "row" }, () => {
          div({ class: which === "A" ? "ring focused" : "ring" }, () => {
            input({ class: "txt", placeholder: "field A", onFocus: onFocusA, onBlur: onBlurA });
          });
          div({ class: which === "B" ? "ring focused" : "ring" }, () => {
            input({ class: "txt", placeholder: "field B", onFocus: onFocusB, onBlur: onBlurB });
          });
        });
        div({ class: "row" }, () => {
          span({ class: which ? "tag on" : "tag" }, which ? `focused: ${which}` : "focused: none");
        });
        div(_, () => {
          for (const entry of log.get()) div({ class: "note" }, entry);
        });
        p({ class: "note" }, "Tab between inputs. focus and blur don't bubble — Creo registers them in the capture phase so delegation still works.");
      });
    },
  };
});

// 4. Controlled input — re-asserting state restores DOM after live drift.
const ControlledDemo = view(({ use }) => {
  const value = use("hello");
  const onInput = (e: InputEventData) => value.set(e.value);
  const reassert = () => value.set(value.get());

  return {
    render() {
      div({ class: "card" }, () => {
        h2(_, "Controlled input drift");
        div({ class: "row" }, () => {
          input({ class: "txt", type: "text", value: value.get(), onInput });
          span({ class: "tag" }, `state: ${value.get()}`);
        });
        div({ class: "row" }, () => {
          button({ onClick: reassert }, "Re-assert state value");
        });
        p({ class: "note" }, "Type extra characters, then click Re-assert. The input snaps back to the state value even though state.set was called with the same string.");
      });
    },
  };
});

const App = view(() => ({
  render() {
    div({ class: "form-controls" }, () => {
      CheckboxDemo();
      MediaDemo();
      FocusDemo();
      ControlledDemo();
    });
  },
}));

createApp(() => App(), new HtmlRender(document.getElementById("app")!)).mount();

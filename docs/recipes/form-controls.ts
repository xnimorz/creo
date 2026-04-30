import {
  createApp,
  view,
  div,
  h2,
  p,
  span,
  label,
  button,
  input,
  audio,
  video,
  HtmlRender,
  _,
} from "creo";
import type { InputEventData } from "creo";

// Public CC0 sample assets (CORS-enabled, small).
const VIDEO_SRC = "https://samplelib.com/mp4/sample-5s.mp4";
const AUDIO_SRC = "https://samplelib.com/mp3/sample-3s.mp3";

// 1. Checkbox — `e.checked` carries the live state; <label for> clicks the box.
const CheckboxDemo = view(({ use }) => {
  const accepted = use(false);
  const onChange = (e: InputEventData) => accepted.set(e.checked);
  const force = () => accepted.update((v) => !v);

  return {
    render() {
      div({ class: "card" }, () => {
        h2(_, "Checkbox");
        div({ class: "row" }, () => {
          input({ id: "tos", type: "checkbox", checked: accepted.get(), onChange });
          label({ for: "tos", class: "label" }, "I accept the terms");
          span(
            { class: accepted.get() ? "tag on" : "tag" },
            `checked: ${accepted.get()}`,
          );
        });
        div({ class: "row" }, () => {
          button({ onClick: force }, "Toggle from state");
        });
        p({ class: "note" }, "Click the label or the box — the <label for=tos> association forwards the click to the input.");
      });
    },
  };
});

// 2. Radio group — `e.checked` is true on the newly selected option;
// state.set drives the `checked` property on every radio so the unselected
// ones get their live state cleared on the next render.
type Plan = "free" | "pro" | "team";
const PLANS: { id: Plan; label: string }[] = [
  { id: "free", label: "Free" },
  { id: "pro", label: "Pro — $9/mo" },
  { id: "team", label: "Team — $29/mo" },
];

const RadioDemo = view(({ use }) => {
  const plan = use<Plan>("free");
  const onChange = (id: Plan) => (e: InputEventData) => {
    if (e.checked) plan.set(id);
  };

  return {
    render() {
      div({ class: "card" }, () => {
        h2(_, "Radio group");
        for (const opt of PLANS) {
          div({ class: "row" }, () => {
            input({
              id: `plan-${opt.id}`,
              type: "radio",
              name: "plan",
              checked: plan.get() === opt.id,
              onChange: onChange(opt.id),
            });
            label({ for: `plan-${opt.id}`, class: "label" }, opt.label);
          });
        }
        div({ class: "row" }, () => {
          span({ class: "tag on" }, `selected: ${plan.get()}`);
        });
        p({ class: "note" }, "Selecting a radio fires onChange with e.checked === true on the new choice. The next render writes el.checked = false on the others, even though the prop didn't change for this view.");
      });
    },
  };
});

// 3. Video / audio muted — prop hits el.muted, not the inert defaultMuted attribute.
const MediaDemo = view(({ use }) => {
  const videoMuted = use(true);
  const audioMuted = use(true);
  const toggleVideo = () => videoMuted.update((v) => !v);
  const toggleAudio = () => audioMuted.update((v) => !v);

  return {
    render() {
      div({ class: "card" }, () => {
        h2(_, "Video / audio muted");
        video({ src: VIDEO_SRC, controls: true, muted: videoMuted.get(), width: 320 });
        div({ class: "row" }, () => {
          button({ onClick: toggleVideo }, "Toggle video mute");
          span({ class: videoMuted.get() ? "tag" : "tag on" }, `muted: ${videoMuted.get()}`);
        });
        audio({ src: AUDIO_SRC, controls: true, muted: audioMuted.get() });
        div({ class: "row" }, () => {
          button({ onClick: toggleAudio }, "Toggle audio mute");
          span({ class: audioMuted.get() ? "tag" : "tag on" }, `muted: ${audioMuted.get()}`);
        });
        p({ class: "note" }, "Press play, then toggle mute — re-rendering writes el.muted (live property), not the inert defaultMuted attribute.");
      });
    },
  };
});

// 4. Focus / blur — capture-phase delegation makes onFocus/onBlur fire.
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

// 5. Controlled input — re-asserting state restores DOM after live drift.
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
      RadioDemo();
      MediaDemo();
      FocusDemo();
      ControlledDemo();
    });
  },
}));

createApp(() => App(), new HtmlRender(document.getElementById("app")!)).mount();

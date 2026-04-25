import { view, div, _ } from "creo";

let uidCounter = 0;

export const RawHtml = view<{ html: string; class?: string }>(({ props }) => {
  const uid = `raw-${++uidCounter}`;
  let lastHtml = "";

  const inject = () => {
    const el = document.getElementById(uid);
    if (!el) return;
    const next = props().html;
    if (next !== lastHtml) {
      el.innerHTML = next;
      lastHtml = next;
    }
  };

  return {
    onMount: inject,
    onUpdateAfter: inject,
    render() {
      div({ id: uid, class: props().class ?? "" });
    },
  };
});

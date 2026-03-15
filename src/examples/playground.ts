import { _ } from "@/functional/maybe";
import type { Lifecycle } from "./ui/api/lifecycle";
import { view } from "@/public/view";

const Button = view<string>(({ props }) => ({
  render() {
    props;
  },
}));

const Text = view<string>((node, lc) => {
  lc.render(() => {});
});

const Block = view((node, lc) => {
  lc.render(() => {});
});

const Test = view<void, { foo: string }>(() => {
  return { foo: "bar" };
});

const List = view<{ list: string[] }>((node, lc) => {
  let testApi: { foo: string };

  lc.render(() => {
    Block(_, () => {
      testApi = Test();
      node.p.list.forEach((str) => {
        Block(_, () => {
          Text(str);
          Button("Submit");
        });
      });
    });
  });

  lc.didMount(() => {
    console.log(testApi);
  });
});

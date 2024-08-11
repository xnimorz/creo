type TTree<Node> = {
  root: Tree<Node>;
  nodes: Array<Tree<Node>>;
  node: Node;
};

class Tree<Node> {
  #root: Tree<Node>;
  #nodes: Array<Tree<Node>>;
  #node: Node;

  constructor(node: Node, existingRoot?: Tree<Node>) {
    this.#node = node;
    if (existingRoot) {
      this.#root = existingRoot;
    } else {
      this.#root = this;
    }
    this.#nodes = [];
  }

  add(node: Node) {
    const newNode = new Tree<Node>(node, this.#root);
    this.#nodes.push(newNode);
  }

  isLeaf() {
    return this.#nodes.length === 0;
  }
}

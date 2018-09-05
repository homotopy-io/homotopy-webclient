export class Graph {

  constructor(key = x => x.toString()) {
    this._key = key;
    this._in = new Map();
    this._out = new Map();
    this._nodes = new Map();
  }

  addEdge(source, target, value) {
    this.addNode(source);
    this.addNode(target);

    let sourceKey = this._key(source);
    let targetKey = this._key(target);

    this._out.get(sourceKey).set(targetKey, value);
    this._in.get(targetKey).set(sourceKey, value);
  }

  addNode(node) {
    let key = this._key(node);
    if (!this._nodes.has(key)) {
      this._nodes.set(key, node);
      this._out.set(key, new Map());
      this._in.set(key, new Map());
    }
  }

  getEdge(source, target) {
    let sourceKey = this._key(source);
    let targetKey = this._key(target);

    if (this._out.has(sourceKey)) {
      return this._out.get(sourceKey).get(targetKey);
    }
  }

  *edgesFrom(source) {
    let sourceKey = this._key(source);
    if (this._out.get(sourceKey)) {
      for (let [targetKey, value] of this._out.get(sourceKey)) {
        let target = this._nodes.get(targetKey);
        yield [target, value];
      }
    }
  }

  *edgesTo(target) {
    let targetKey = this._key(target);
    if (this._in.get(targetKey)) {
      for (let [sourceKey, value] of this._in.get(targetKey)) {
        let source = this._nodes.get(sourceKey);
        yield [source, value];
      }
    }
  }

  *edges() {
    for (let [sourceKey, edges] of this._out) {
      for (let [targetKey, value] of edges) {
        let source = this._nodes.get(sourceKey);
        let target = this._nodes.get(targetKey);
        yield [source, target, value];
      }
    }
  }

}

export default Graph;
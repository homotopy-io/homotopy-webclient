import { _assert, _debug, isNatural } from "~/util/debug";
import { Diagram } from "~/diagram";
import { Content } from "~/limit";

function getType(id) {
  return store.getState().signature.generators[id];
}

export class Generator {

  constructor(args) {
    if (args.bare) return this;
    if (_debug) {
      _assert(args.id !== undefined);
      _assert(args.source == null || args.source instanceof Diagram);
      _assert(args.target == null || args.target instanceof Diagram);
    }

    this.n = args.source == null ? 0 : args.source.n + 1;
    this.source = args.source;
    this.target = args.target;
    this.id = args.id;
    this._t = 'Generator';

    if (_debug) {
      if (this.n > 1) {
        _assert(this.source.source.equals(this.target.source));
        _assert(this.source.getTarget().equals(this.target.getTarget()));
      }
    }

    // Build content
    if (this.n > 0) {
      let first_limit = this.source.contractForwardLimit(this.id, null, null);
      let singular_height = first_limit.rewrite_forward(this.source);
      let second_limit_forwards = this.target.contractForwardLimit(this.id, null, null);
      this.content = new Content({ n: this.n - 1, forward_limit: first_limit, backward_limit: second_limit_forwards });
    }

    // Build diagram
    if (this.n == 0) {
      this.diagram = new Diagram({ n: 0, id: this.id });
    } else {
      this.diagram = new Diagram({ n: this.n, source: this.source, data: [this.content] });
    }

    Object.freeze(this);
  }

  /*
  static postRehydrate(generator, generators) {
    if (generator.n == 0) {
      return new Generator(generator.id, null, null);
    } else {
      let source = Diagram.postRehydrate(generator.source, generators);
      let target = Diagram.postRehydrate(generator.target, generators);
      return new Diagram(id, source, target);
    }
  }
  */

  toJSON() {
    return {
      id: this.id,
      source: this.source ? this.source.toJSON() : null,
      target: this.target ? this.target.toJSON() : null,
      n: this.n,
      _t: 'MinimalGenerator'
    };
  }

  static fromMinimal(args) {
    let id = args.id;
    if (args.n > 0 && _debug) {
      _assert(args.source instanceof Diagram);
      _assert(args.target instanceof Diagram);
    }
    let source = args.source;
    let target = args.target;
    let n = this.n;
    return new Generator({ n, id, source, target });
  }

  validate() {
    if (_debug) _assert(this.n == 0 || this.source);
  }

  // Mirror a generator
  mirror(n) {
    if (n == 0) {
      var temp = this.source;
      this.source = this.target;
      this.target = temp;
    } else if (n == 1) {
      this.source = this.source.mirror(0);
      this.target = this.target.mirror(0);
    }
    return this;
  }

  getType() {
    return "Generator";
  }

  getBoundingBox() {
    var box = {
      min: Array(Math.max(0, this.n - 1)).fill(0),
      max: this.source == null ? [] : this.source.getLengthsAtSource()
    };
    return box;
  }

  usesCell(generator) {
    if (this.id == generator.id) {
      return true;
    }

    // Generators can only use cells which have a lower dimension
    if (generator.n >= this.n) {
      return false;
    }

    // The generator uses the specified cell iff the source or target uses it
    if (this.source != null) {
      if (this.source.usesCell(generator)) {
        return true;
      }

      if (this.target.usesCell(generator)) {
        return true;
      }
    }

    return false;
  }

}
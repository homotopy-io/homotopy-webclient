import { _validate, _assert } from "~/util/debug";
import { Diagram } from "~/diagram";
import { Content } from "~/limit";

export class Generator {

  constructor(id, source, target) {
    _assert(id !== undefined);
    _assert(source == null || source instanceof Diagram);
    _assert(target == null || target instanceof Diagram);

    this.n = source == null ? 0 : source.n + 1;
    this.source = source == null ? null : source.copy();
    this.target = target == null ? null : target.copy();
    this.id = id;
  }

  validate() {
    _assert(this.n == 0 || this.source);
  }

  getDiagram() {
    if (this.n == 0) {
      return new Diagram(0, {
        t: 0,
        type: this
      });
    }

    let source = this.source.copy();
    let first_limit = source.contractForwardLimit(this, null, null, true);
    let singular_height = first_limit.rewrite(this.source.copy());
    let second_limit_forwards = this.target.contractForwardLimit(this, null, null, false);
    let second_limit_backwards = second_limit_forwards.getBackwardLimit(this.target, singular_height);
    let content = new Content(this.n - 1, first_limit, second_limit_backwards);
    return new Diagram(source.n + 1, {
      source,
      data: [content]
    });
  }

  getSource() {
    return (this.source == null ? null : this.source.copy());
  }

  getTarget() {
    return (this.target == null ? null : this.target.copy());
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

  copy() {
    let source = this.source == null ? null : this.source.copy();
    let target = this.target == null ? null : this.target.copy();
    return new Generator(this.id, source, target);
  }

  getBoundingBox() {
    var box = {
      min: Array(Math.max(0, this.n - 1)).fill(0),
      max: this.source == null ? [] : this.source.getLengthsAtSource()
    };
    return box;
  }

  usesCell(generator) {
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
import { _validate, _assert, _debug, isNatural, _propertylist } from "~/util/debug";
import { Generator } from "~/generator";
import { Diagram } from "~/diagram";
import { Monotone } from "~/monotone";
import * as ArrayUtil from "~/util/array";

/*
- Diagram(n) comprises:
    - t :: Number, the dimension of the signature over which it is defined
    - n > 0:
        - source :: Diagram(n-1)
        - data :: Array(Content(n-1))
    - n == 0:
        - type :: String // Makes no sense to have an array here
- Content(n) comprises:
    - for all n:
        - forward_limit :: Limit(n)
        - backward_limit :: Limit(n)
- Limit(n) extends Array comprises: (this is a limit between n-diagrams)
    - for all n:
        - source_size :: N, the height of the source of the limit (only for n>0 and array.length>0)
        - Array(LimitComponent(n))
- LimitComponent(n) comprises: (this is a component of a limit between n-diagrams)
    - for n > 0:
        - source_data :: Array(Content(n-1))
        - target_data :: Content(n-1)
        - sublimits :: Array(Limit(n-1))
        - first :: Natural, the first regular position that this affects
    - for n == 0:
        - type :: Generator
*/

export class Content {

  constructor(n, forward_limit, backward_limit) {
    this.n = n;
    this.forward_limit = forward_limit;
    this.backward_limit = backward_limit;
    if (_debug) _assert(isNatural(this.n));
    if (_debug) _assert(this.n >= 0);
    if (_debug) _assert(this.forward_limit instanceof Limit);
    if (_debug) _assert(this.backward_limit instanceof Limit);
    if (_debug) _assert(this.forward_limit.n == this.n);
    if (_debug) _assert(this.backward_limit.n == this.n);
    Object.freeze(this);
    _validate(this);
  }

  toJSON() {
    return {
      forward_limit: this.forward_limit.toJSON(),
      backward_limit: this.backward_limit.toJSON()
    };
  }

  validate() {
    _propertylist(this, ["n", "forward_limit", "backward_limit"]);
    _validate(this.forward_limit, this.backward_limit);
  }

  getLastPoint() {
    if (_debug) _assert(false);
  }

  copy({forward_limit = this.forward_limit, backward_limit = this.backward_limit, n = this.n} = this) {
    return new Content(n, forward_limit, backward_limit);
  }

  rewrite(source) {
    let singular = this.forward_limit.rewrite_forward(source);
    let target = this.backward_limit.rewrite_backward(singular);
    return target;
  }

  usesCell(generator) {
    return (this.forward_limit.usesCell(generator) || this.backward_limit.usesCell(generator)
    );
  }

  pad(depth, source_boundary) {
    let forward_limit = this.forward_limit.pad(depth, source_boundary);
    let backward_limit = this.backward_limit.pad(depth, source_boundary);
    return new Content(this.n, forward_limit, backward_limit);
  }

  // Pad the content so that the origin moves to the specified position
  deepPad(position, width_deltas) {
    let forward_limit = this.forward_limit.deepPad(position, width_deltas);
    let backward_limit = this.backward_limit.deepPad(position, width_deltas);
    return new Content(this.n, forward_limit, backward_limit);
  }

  equals(content) {
    return (
      this.forward_limit.equals(content.forward_limit) &&
      this.backward_limit.equals(content.backward_limit)
    );
  }

  getMonotones(height) {
    return {
      forward_monotone: this.forward_limit.getMonotone(height),
      backward_monotone: this.backward_limit.getMonotone(height)
    };
  }

  // Reverse the content, exchanging fowrward and backward limits
  reverse(source) {
    if (_debug) _assert(source === undefined);
    return new Content(this.n, this.backward_limit, this.forward_limit);
  }

  /*
  typecheck() {
    if (!this.forward_limit.typecheck(true)) return false;
    if (!this.backward_limit.typecheck(false)) return false;
    return true;
  }
  */

  typecheck(source) {
    if (_debug) _assert(source instanceof Diagram);

    // Find the nontrivial neighbourhoods
    let neighbourhoods = Limit.getNontrivialNeighbourhoodsFamily([this.forward_limit, this.backward_limit]);

    // Explode the neighbourhoods
    let exploded = Limit.explodeSubset(neighbourhoods);

    // Typecheck each neighbourhood
    for (let i=0; i<exploded.length; i++) {
      let forward_limit = this.forward_limit.restrictToPreimage(exploded[i]);
      let backward_limit = this.backward_limit.restrictToPreimage(exploded[i]);
      let restricted_content = new Content(this.n, forward_limit, backward_limit);
      let source_subset = this.forward_limit.pullbackSubset(exploded[i]);
      let restricted_source = source.restrictToSubset(source_subset);
      if (!restricted_content.typecheckBaseCase(restricted_source)) {
        return false;
      }
    }

    // The content typechecks
    return true;
  }

  // Typecheck this content, assuming the source is already typechecked
  typecheckBaseCase(source) {

    let f = this.forward_limit;
    let b = this.backward_limit;

    // If this content is the identity, it type checks
    if (f.length == 0 && b.length == 0) return true;

    // We are promised that 'this' represents a content object with unique central nontrivial singular data
    if (_debug) _assert(f.length <= 1 && b.length <= 1);
    if (_debug) _assert(f.length > 0 || b.length > 0);

    // Turn it into a diagram object
    //let source = f.reconstructSource();
    let diagram = new Diagram(this.n + 1, {source, data: [this]});

    // Typecheck the target of this diagram
    if (!diagram.getTarget().typecheck()) return false;

    // Normalize the diagram along with its boundary
    let normalized = diagram.normalizeWithBoundaries();

    // Type check it as a diagram
    return normalized.typecheckBaseCase();

  }

/*
  composeAtBoundary({ type, limit }) {
    let forward_limit = this.forward_limit.composeAtBoundary({ type, limit });
    let backward_limit = this.backward_limit.composeAtBoundary({ type, limit });
    return new Content(this.n, forward_limit, backward_limit);
  }
*/

  composeAtRegularLevel({ height, limit }) {
    let forward_limit = this.forward_limit.composeAtRegularLevel({ height, limit });
    let backward_limit = this.backward_limit.composeAtRegularLevel({ height, limit });
    return new Content(this.n, forward_limit, backward_limit);
  }

  // Get data that describes an expansion of this Content object (2018-ANC-1-55)
  getExpansionData(index, r1, r2, s) {
    _validate(this, r1, r2, s);

    let f = this.forward_limit;
    let b = this.backward_limit;

    //let source_preimage = forward_monotone.preimage(location[1].height);
    let f_analysis = f.getComponentTargets();
    let f_index = f_analysis.indexOf(index);
    let b_analysis = b.getComponentTargets();
    let b_index = b_analysis.indexOf(index);

    let f_old = f_index < 0 ? null : f[f_index];
    let b_old = b_index < 0 ? null : b[b_index];
    if (_debug) _assert(f_old || b_old);
    if (_debug) _assert(f.length > 0 || b.length > 0);

    // The only failure case is if there is only a single component
    if (f.length == 0 && b.length == 1) throw "can't expand a single component";
    if (f.length == 1 && b.length == 0) throw "can't expand a single component";
    if (f.length == 1 && b.length == 1 && f_old && b_old) throw "can't expand a single component";

    // E - Prepare the first new forward limit by deleting the chosen component
    let f_new_1 = f;
    if (f_index >= 0) {
      let components = [...f_new_1];
      components.splice(f_index, 1);
      f_new_1 = f_new_1.copy({ components });
    }

    // Compute delta offset
    let f_delta = 0;
    for (let i = 0; i < f.length; i++) {
      if (f_analysis[i] >= index) break;
      f_delta -= f[i].getLast() - f[i].first - 1;
    }
    let b_delta = 0;
    for (let i = 0; i < b.length; i++) {
      if (b_analysis[i] >= index) break;
      b_delta += b[i].getLast() - b[i].first - 1;
    }

    // G - Prepare the second new forward limit by selecting only the chosen component, and adjusting first/last
    let middle_regular_size = r2.data.length
      - (b_old ? b_old.source_data.length - 1 : 0)
      + (f_old ? f_old.source_data.length - 1 : 0);
    let f_new_2;
    if (f_old) {
      f_new_2 = new Limit(this.n, [f_old.copy({first: f_old.first + f_delta + b_delta})], middle_regular_size);
    } else {
      f_new_2 = new Limit(this.n, [], middle_regular_size);
    }

    // F - Prepare the first new backward limit
    let b_new_1 = b;
    if (b_old) {
      let f_old_delta = f_old ? f_old.getLast() - f_old.first - 1 : 0;
      let b_old_delta = b_old ? b_old.getLast() - b_old.first - 1 : 0;

      let components = [...b_new_1];
      components.splice(b_index, 1);
      components = components.map((component, i) => {
        if (i >= b_index) {
          return component.copy({first: component.first + f_old_delta - b_old_delta});
        } else return component;
      });

      b_new_1 = b_new_1.copy({ components, source_size: middle_regular_size }); 
    } else {
      b_new_1 = b_new_1.copy({source_size: middle_regular_size});
    }

    // H - Prepare the second new backward limit
    let b_new_2 = b_old ? new Limit(this.n, [b_old], r2.data.length) : new Limit(this.n, [], r2.data.length);

    // C - Prepare the first sublimit - tricky as we need the reversed version of f_old
    // OPTIMIZATION: we don't really need to reverse all of f, just f_old
    let sublimit_1;
    let first_singular_size = s.data.length + (f_old ? f_old.source_data.length - 1 : 0);
    if (f_old) {
      sublimit_1 = new Limit(this.n, [f[f_index].copy({ first: f[f_index].first + f_delta })], first_singular_size);
    } else {
      sublimit_1 = new Limit(this.n, [], first_singular_size);
    }
    _validate(sublimit_1);

    // D - Prepare the second sublimit
    let second_singular_size = r2.data.length - (b_old ? b_old.source_data.length - 1 : 0);
    let sublimit_2 = b;
    if (b_old) {
      let local_delta = b_old.getLast() - b_old.first - 1;
      let components = [...sublimit_2];
      components.splice(b_index, 1);
      components = components.map((component, index) => {
        if (index > b_index - 1) {
          return component.copy({ first: component.first - local_delta });
        } else {
          return component;
        }
      });
      sublimit_2 = sublimit_2.copy({ components, source_size: second_singular_size });
    }
    _validate(sublimit_2);

    _validate(f_new_1, b_new_1, f_new_2, b_new_2);

    if (b_new_1.length > 0 && f_new_2.length > 0) {
      if (_debug) _assert(b_new_1.source_size == f_new_2.source_size);
    }
    // Return the data of the expansion, an array of Content of length 2,
    // and the corresponding sublimits, an array of Limit of length 2.
    return {
      data: [new Content(this.n, f_new_1, b_new_1), new Content(this.n, f_new_2, b_new_2)],
      sublimits: [sublimit_1, sublimit_2]
    };
  }

  getSingularNeighbourhoods() {
    let forward = this.forward_limit.analyzeSingularNeighbourhoods();
    let backward = this.backward_limit.analyzeSingularNeighbourhoods();
    let total = [];
    let length = Math.max(forward.length, backward.length);
    for (let i = 0; i < length; i++) {
      total[i] = (forward[i] || backward[i]);
    }
    return total;
  }

  getFirstSingularNeighbourhood() {
    let forward = this.forward_limit.analyzeSingularNeighbourhoods();
    let backward = this.backward_limit.analyzeSingularNeighbourhoods();
    let total = [];
    let length = Math.max(forward.length, backward.length);
    for (let i = 0; i < length; i++) {
      if (forward[i] || backward[i]) return i;
    }
    return null;
  }

  static copyData(data) {
    if (_debug) _assert(data instanceof Array);
    if ((typeof data) === "string") return data;
    if (!data) return data;
    let new_data = [];
    for (let i = 0; i < data.length; i++) {
      if (_debug) _assert(data[i] instanceof Content);
      new_data.push(data[i].copy());
    }
    return new_data;
  }

  static deepPadData(data, position, width_deltas) {
    return data.map(content => content.deepPad(position, width_deltas));
  }

  // Update the viewer position under a rewrite of this content
  updateSlice(slice) {
    let slice_singular = this.forward_limit.updateSliceForward(slice);
    let slice_regular = this.backward_limit.updateSliceBackward(slice_singular);
    return slice_regular;
  }
}

export class LimitComponent {

  constructor(n, args) {
    this.n = n;
    if (_debug) _assert(isNatural(this.n));
    if (_debug) _assert(this.n >= 0);
    if (n == 0) {
      this.source_type = args.source_type;
      this.target_type = args.target_type;
      if (_debug) _assert(this.source_type instanceof Generator);
      if (_debug) _assert(this.target_type instanceof Generator);
      return this;
    }
    this.source_data = args.source_data;
    this.target_data = args.target_data;
    this.first = args.first;
    //_assert(args.last === undefined);
    if (_debug) _assert(isNatural(this.first));
    this.sublimits = args.sublimits;
    Object.freeze(this);
    _validate(this);
  }

  validate() {
    if (!_debug) return;
    if (_debug) _assert(isNatural(this.n));
    if (this.n == 0) {
      _propertylist(this, ["n", "source_type", "target_type"]);
      if (_debug) _assert(this.source_type instanceof Generator);
      if (_debug) _assert(this.target_type instanceof Generator);
      _validate(this.source_type);
      _validate(this.target_type);
    } else {
      _propertylist(this, ["n", "source_data", "target_data", "first", "sublimits"]);
      if (_debug) _assert(isNatural(this.first));
      if (_debug) _assert(this.target_data instanceof Content);
      if (_debug) _assert(this.source_data instanceof Array);
      if (_debug) _assert(this.sublimits instanceof Array);
      if (_debug) _assert(this.sublimits.length == this.source_data.length);
      for (let i = 0; i < this.sublimits.length; i++) {
        if (_debug) _assert(this.sublimits[i] instanceof Limit);
        if (_debug) _assert(this.sublimits[i].n == this.n - 1);
        _validate(this.sublimits[i]);
        if (_debug) _assert(this.source_data[i] instanceof Content);
        if (_debug) _assert(this.source_data[i].n == this.n - 1);
        _validate(this.source_data[i]);
      }
      if (_debug) _assert(this.target_data instanceof Content);
      if (_debug) _assert(this.target_data.n == this.n - 1);
      _validate(this.target_data);
    }
  }

  toJSON() {
    if (this.n == 0) {
      return {
        n: 0,
        source_type: this.source_type.id,
        target_type: this.target_type.id
      }
    } else {
      return {
        first: this.first,
        sublimits: this.sublimits.map(x => x.toJSON()),
        source_data: this.source_data.map(x => x.toJSON()),
        target_data: this.target_data.toJSON()
      }
    }
  }

  equals(b) {
    let a = this;
    if (a.n != b.n) return false;
    if (a.n == 0) {
      if (a.source_type.id != b.source_type.id) return false;
      if (a.target_type.id != b.target_type.id) return false;
      return true;
    }
    if (a.first != b.first) return false;
    if (!a.target_data.equals(b.target_data)) return false;
    if (a.source_data.length != b.source_data.length) return false;
    for (let i=0; i<a.source_data.length; i++) {
      if (!a.source_data[i].equals(b.source_data[i])) return false;
    }
    if (a.sublimits.length != b.sublimits.length) return false;
    for (let i = 0; i < a.sublimits.length; i++) {
      if (!a.sublimits[i].equals(b.sublimits[i])) return false;
    }
    return true;
  }

  // Gets the effective value of the old 'last' property
  getLast() {
    if (_debug) _assert(this.source_data !== undefined);
    return this.first + this.source_data.length;
  }

  getSize() {
    return this.source_data.length;
  }

  getLastPoint() {
    if (_debug) _assert(false);
    if (this.n == 0) return new Diagram(0, { type: this.type });
    //return this.data.last().getLastPoint();
    return this.target_data.getLastPoint();
    if (_debug) _assert(false); // ... to write ...
  }

  copy({first = this.first, sublimits = this.sublimits, source_data = this.source_data,
    target_data = this.target_data, source_type = this.source_type, target_type = this.target_type} = this) {
    _validate(this);
    if (this.n == 0) {
      return new LimitComponent(0, { source_type, target_type });
    }
    return new LimitComponent(this.n, { source_data, target_data, sublimits, first });
  }

  usesCell(generator) {
    if (this.n == 0) {
      let type = this.type;
      if (this.source_type.id == generator.id) return true;
      if (this.target_type.id == generator.id) return true;
      return false;
    }

    for (let content of this.source_data) {
      if (content.usesCell(generator)) return true;
    }
    if (this.target_data.usesCell(generator)) return true;

    for (let sublimit of this.sublimits) {
      if (sublimit.usesCell(generator)) return true;
    }

    return false;
  }

  pad(depth, source_boundary) {
    if (depth == 1) {
      if (!source_boundary) return this;
      return this.copy({ first: this.first + 1});
    } else if (depth > 1) {
      let target_data = this.target_data.pad(depth - 1, source_boundary);
      let source_data = this.source_data.map(content => content.pad(depth - 1, source_boundary));
      let sublimits = this.sublimits.map(sublimit => sublimit.pad(depth - 1, source_boundary));
      return new LimitComponent(this.n, { source_data, target_data, sublimits, first: this.first });
    }
  }

  // Deep pad this component so that the origin moves to the given position
  deepPad(position, width_deltas) {
    if (_debug) _assert(this.n == position.length);
    if (this.n == 0) return this;
    let [height, ...rest] = position;
    let [width_now, ...width_rest] = width_deltas;
    let source_data = this.source_data.map(content => content.deepPad(rest, width_rest));
    //let target_data = this.target_data.map(content => content.deepPad(rest));
    let target_data = this.target_data.deepPad(rest, width_rest);
    let sublimits = this.sublimits.map(limit => limit.deepPad(rest, width_rest));
    return new LimitComponent(this.n, { source_data, target_data, sublimits, first: this.first + height });
  }

  composeAtBoundary({type, limit}) {
    if (_debug) _assert(limit.n <= this.n - 2);
    let source_data = this.source_data.slice();
    for (let i=0; i<source_data.length; i++) {
      source_data[i] = source_data[i].composeAtBoundary({type, limit});
    }
    let target_data = this.target_data.composeAtBoundary({type, limit});
    let first = this.first;
    let sublimits = this.sublimits;
    return new LimitComponent(this.n, {source_data, target_data, sublimits, first});
  }
}

export class Limit extends Array {

  constructor(n, components, source_size) {
    super(...components);
    this.n = n;
    if (n > 0 && components.length > 0) this.source_size = source_size;
    this.validate();
  }

  validate() {
    if (!_debug) return;
    if (_debug) _assert(isNatural(this.n));
    if (this.n == 0) {
      if (_debug) _assert(this.source_size === undefined);
      if (_debug) _assert(this.length <= 1);
      if (this.length == 1) _assert(this[0].source_type.id != this[0].target_type.id);
    } else {
      if (this.length > 0) {
        if (_debug) _assert(isNatural(this.source_size));
      } else {
        if (_debug) _assert(this.source_size === undefined);
      }
    }
    for (let i = 0; i < this.length; i++) {
      if (_debug) _assert(this[i] instanceof LimitComponent);
      if (_debug) _assert(this[i].n == this.n);
      if (i != 0) _assert(this[i].first >= this[i - 1].getLast());
      if (this.n > 0) _assert(this[i].getLast() <= this.source_size);
      this[i].validate();
    }
    if (this.n == 0) _propertylist(this, ["n"]);
    else _propertylist(this, ["n"]);
    if (this.n == 0 && this.length > 0) {
      if (_debug) _assert(this.length == 1);
      if (_debug) _assert(this[0].source_type.id != this[0].target_type.id);
    }
  }

  toJSON() {
    return {
      components: [...this].map(x => x.toJSON())
    };
  }

  usesCell(generator) {
    for (let component of this) {
      if (component.usesCell(generator)) return true;
    }

    return false;
  }

  equals(limit) {
    if (this.length != limit.length) return false;
    for (let i = 0; i < this.length; i++) {
      if (!this[i].equals(limit[i])) return false;
    }
    if (this.length > 0) {
      if (this.source_size != limit.source_size) return false;
    }
    return true;
  }

  getMaxSourceHeight() {
    if (this.length == 0) return 0;
    let component = ArrayUtil.last(this);
    return component.first + component.sublimits.length;
  }

  getMaxTargetHeight() {
    if (this.length == 0) return 0;
    let target = this.getComponentTargets();
    return target[target.length - 1] + 1;
  }

  getMonotone(source_height, target_height) {
    _validate(this);
    if (source_height instanceof Diagram) source_height = source_height.data.length;
    if (target_height instanceof Diagram) target_height = target_height.data.length;
    if (this.length == 0) {
      if (_debug) _assert(isNatural(source_height));
      if (_debug) _assert(isNatural(target_height));
    } else {
      if (source_height !== undefined || target_height !== undefined) {
        if (_debug) _assert(this.source_size === source_height);
        if (_debug) _assert(this.getTargetSize() === target_height);
      }
      source_height = this.source_size;
      target_height = this.getTargetSize();
    }
    if (_debug) _assert(isNatural(source_height));
    if (_debug) _assert(isNatural(target_height));
    let monotone = new Monotone(target_height, []);
    let singular_height = 0;
    for (let i = 0; i < this.length; i++) {
      let component = this[i];
      while (monotone.length < component.first) {
        monotone.push(singular_height);
        singular_height++;
      }
      for (let j = component.first; j < component.getLast(); j++) {
        monotone[j] = singular_height;
      }
      singular_height++;
    }
    while (monotone.length < source_height) {
      monotone.push(singular_height);
      singular_height++;
    }
    return monotone;
  }

  // For each singular height, computes whether its neighbourhood is nontrivial
  analyzeSingularNeighbourhoods() {
    var singular_classification = [];
    let offset = 0;
    for (let i = 0; i < this.length; i++) {
      let component = this[i];
      singular_classification[component.first - offset] = true;
      offset += component.getLast() - component.first - 1;
    }
    return singular_classification;
  }

  // For each component, find its target index in the codomain diagram
  getComponentTargets() {
    let component_targets = [];
    let offset = 0;

    for (let component of this) {
      component_targets.push(component.first - offset);
      offset += component.getLast() - component.first - 1;
    }

    return component_targets;
  }

  getTargetComponentIndex(target) {
    let offset = 0;
    for (let i = 0; i < this.length; i++) {
      let component_target = this[i].first - offset;
      if (component_target == target) return i;
      offset += this[i].getSize() - 1;
    }
    return null;
  }

  getTargetHeightPreimage(target) {
    let offset = 0;
    let component_target = null;
    for (let i = 0; i < this.length; i++) {
      component_target = this[i].first - offset;
      if (component_target > target) {
        // Trivial neighbourhood
        let h = this[i].first - component_target + target;
        return {
          first: h,
          last: h + 1
        };
      }
      if (component_target == target) return { first: this[i].first, last: this[i].getLast() };
      offset += this[i].getSize() - 1;
    }
    return {
      first: target + offset,
      last: target + offset + 1
    };
  }
  /*
  getSublimitsToTarget(target) {
      let offset = 0;
      for (let i = 0; i < this.length; i++) {
          let component_target = this[i].first - offset;
          if (component_target == target) return this[i].sublimits;
          offset += this[i].getSize() - 1;
      }
      return [];
  }
  */
  // Get a sublimit with respect to the indicated range in the target diagram.
  preimage(range) {
    _propertylist(range, ["first", "last"]);

    // Restricted identities are still identities
    if (this.length == 0) return this;
    
    let component_targets = this.getComponentTargets();
    let components = [];
    let offset = null;

    for (let i = 0; i < this.length; i++) {
      let component = this[i];
      let target = component_targets[i];

      if (target < range.first) continue;
      if (target >= range.last) continue;

      if (offset == null) offset = component.first - (component_targets[i] - range.first);

      let shifted = component.copy({ first: component.first - offset });

      if (_debug) _assert(shifted.first >= 0 && shifted.getLast() >= 0);
      _validate(shifted);

      components.push(shifted);
    }

    let monotone = this.getMonotone();
    let preimage = monotone.preimage(range);

    return new Limit(this.n, components, preimage.last - preimage.first);
  }

  subLimit(n) {
    for (let i = 0; i < this.length; i++) {
      let component = this[i];
      if (n < component.first) return new Limit(this.n - 1, []);
      if (n < component.getLast()) return component.sublimits[n - component.first];
    }
    return new Limit(this.n - 1, []);
  }

  compose(L1) {

    let L2 = this;
    if (_debug) _assert(L1 instanceof Limit && L2 instanceof Limit);
    _validate(L1, L2);
    if (_debug) _assert(L1.n == L2.n);

    if (L1.length == 0) return L2;
    if (L2.length == 0) return L1;
    if (L1.n == 0) {
      let source_type = L1[0].source_type;
      let target_type = L2[0].target_type;
      if (source_type.id == target_type.id) return new Limit(0, []);
      return new Limit(0, [ new LimitComponent(0, { source_type, target_type }) ]);
    }

    let L1_targets = L1.getComponentTargets();
    let L2_targets = L2.getComponentTargets();

    // Compose them as monotone functions
    //let D1_size = L1.source_size;
    //let D2_size = L2.source_size;
    if (_debug) _assert(L2.source_size == L1.getTargetSize());
    let D3_size = L2.getTargetSize();
    let M1 = L1.getMonotone();
    let M2 = L2.getMonotone();
    let MC = M2.compose(M1);

    // Compile the known diagram data for D1, D2 and D3
    let D1_data = [];
    let D2_data = [];
    let D3_data = [];
    let L1_sublimits = [];
    let L2_sublimits = [];
    for (let i=0; i<L1.length; i++) {
      let component = L1[i];
      for (let j=0; j<component.sublimits.length; j++) {
        D1_data[component.first + j] = component.source_data[j];
        L1_sublimits[component.first + j] = component.sublimits[j];
      }
      D2_data[L1_targets[i]] = component.target_data;
    }
    for (let i=0; i<L2.length; i++) {
      let component = L2[i];
      for (let j=0; j<component.sublimits.length; j++) {
        D2_data[component.first + j] = component.source_data[j];
        L2_sublimits[component.first + j] = component.sublimits[j];
      }
      D3_data[L2_targets[i]] = component.target_data;
    }

    // For each target element, build its component
    let new_components = [];
    for (let D3_level=0; D3_level<D3_size; D3_level++) {

      // This target level is potentially nontrivial, so find its preimage in D1
      let D1_preimage = MC.preimage(D3_level);

      // Build the data for the possible new component
      let sublimits = [];
      let source_data = [];
      let trivial_component = false;
      for (let D1_level=D1_preimage.first; D1_level<D1_preimage.last; D1_level++) {
        let D2_level = M1[D1_level];
        let new_source_data = D1_data[D1_level] || D2_data[D2_level];
        if (!new_source_data) {
          trivial_component = true;
          break;
        }
        if (_debug) _assert(new_source_data);
        let new_sublimit;
        let L1_sublimit = L1_sublimits[D1_level];
        let L2_sublimit = L2_sublimits[D2_level];
        if (L1_sublimit && L2_sublimit) {
          new_sublimit = L2_sublimit.compose(L1_sublimit);
        } else {
          new_sublimit = L1_sublimit || L2_sublimit;
          if (_debug) _assert(new_sublimit);
        }
        sublimits.push(new_sublimit);
        source_data.push(new_source_data);
      }

      // If this component is trivial, go to the next target level
      if (trivial_component) continue;
      if (sublimits.length == 1 && sublimits[0].length == 0) continue;

      // Build the component
      let target_data = D3_data[D3_level];
      if (!target_data) {
        let D2_preimage = M2.preimage(D3_level);
        if (_debug) _assert(D2_preimage.first + 1 == D2_preimage.last);
        target_data = D2_data[D2_preimage.first];
      }
      if (_debug) _assert(target_data);

      let first = D1_preimage.first;
      let component = new LimitComponent(this.n, {first, source_data, target_data, sublimits});
      new_components.push(component);
    }

    let composed = new Limit(this.n, new_components, L1.source_size);
    return composed;
  }

  // Remove an element of the target diagram not in the image of this limit
  removeTargetLevel(height) {
    let component_targets = this.getComponentTargets();
    for (let i = 0; i < component_targets.length; i++) {
      if (component_targets[i] == height) {
        let new_components = [];
        let source_delta = 1;
        for (let j=0; j<this.length; j++) {
          if (j == i) {
            if (_debug) _assert(this[i].sublimits.length == 0); // must be height-zero component
            source_delta = 0; // we're skipping a component
            continue; 
          }
          new_components.push(this[j]);
        }
        let source_size = new_components.length > 0 ? this.source_size - source_delta : null;
        return new Limit(this.n, new_components, source_size);
      }
    }
    if (this.length == 0) return this;
    return this.copy({source_size: this.source_size - 1});
    if (_debug) _assert(false); // We didn't find the correct component to remove
  }

  pad(depth, source_boundary) {
    let components = [...this].map(component => component.pad(depth, source_boundary));
    return new Limit(this.n, components, this.source_size + (depth == 1 ? 1 : 0));
  }

  deepPad(position, width_deltas) {
    let components = [...this].map(component => component.deepPad(position, width_deltas));
    return new Limit(this.n, components, this.source_size + width_deltas[0]);
  }

  rewrite_forward(diagram) {
    if (this.n == 0) {
      return new Diagram(0, { type: this[0].target_type });
    }

    let data = diagram.data.slice();
    for (let i = this.length - 1; i >= 0; i--) {
      let c = this[i];
      data.splice(c.first, c.source_data.length, c.target_data);
    }

    return new Diagram(diagram.n, { source: diagram.source, data });
  }

  rewrite_backward(diagram) {
    if (_debug) _assert(diagram instanceof Diagram);
    _validate(this, diagram);
    if (diagram.n == 0) return new Diagram(0, { type: this[0].source_type });

    //let offset = 0;
    let new_data = diagram.data.slice();
    for (let i = 0; i < this.length; i++) {
      let c = this[i];
      let before = new_data.slice(0, c.first);
      let middle = c.source_data;
      let after = new_data.slice(c.first + 1, diagram.data.length);
      new_data = [...before, ...middle, ...after];
      //diagram.data = diagram.data.slice(0, c.first + offset).concat(c.data.concat(diagram.data.slice(c.first + offset + 1, diagram.data.length)));
      //offset += c.last - c.first - 1;
    }
    return new Diagram(diagram.n, { source: diagram.source, data: new_data });
  }

  copy({ components = [...this], n = this.n, source_size = this.source_size } = this) {
    return new Limit(n, components, source_size);
  }

  getNontrivialNeighbourhoods() {
    return Limit.getNontrivialNeighbourhoodsFamily([this]);
  }

  // Get the neighbourhoods which are nontrivial in the common target diagram of all the provided limits
  static getNontrivialNeighbourhoodsFamily(...limits) {

    if (_debug) _assert(limits instanceof Array);

    // If there are no incoming limits, there are no nontrivial neighbourhoods
    if (limits.length == 0) return undefined;

    // Trick to clear duplicates, won't catch everything but maybe worthwhile . . .
    limits = [...new Set(...limits)];

    /* Idea: what if every limit carried a hash value? Would make it easier to remove duplicates */

    // Log size of input to keep track of load
    //console.log('getNontrivialNeighbourhoodsFamily, n=' + limits[0].n + ', ' + limits.length + ' limits of dimension ' + limits[0].n);

    // Base case
    if (limits[0].n == 0) {
      for (let i=0; i<limits.length; i++) {
        let limit = limits[i];
        if (limit.length == 0) continue;
        if (_debug) _assert(limit.length == 1);
        if (limit[0].source_type != limit[0].target_type) return null;
      }
      return undefined;
    }

    // Store the incoming limits by level
    let level_limits = [];
    for (let i=0; i<limits.length; i++) {
      let limit = limits[i];
      let targets = limit.getComponentTargets();
      for (let j=0; j<limit.length; j++) {
        let component = limit[j];
        let target = targets[j];
        if (!level_limits[target]) level_limits[target] = [];
        level_limits[target] = [
          ...level_limits[target],
          ...component.sublimits,
          component.target_data.forward_limit,
          component.target_data.backward_limit
        ];
      }
    }

    // Call recursively to build the return value
    let neighbourhoods = [];
    for (let i=0; i<level_limits.length; i++) {
      if (level_limits[i] === undefined) continue;
      neighbourhoods[i] = Limit.getNontrivialNeighbourhoodsFamily(level_limits[i]);
    }

    return neighbourhoods;
  }

  // Return list of subsets each containing one element
  static explodeSubset(subset) {
    if (subset === null) return [null];
    let subsets = [];
    for (let i=0; i<subset.length; i++) {
      if (subset[i] === undefined) {
        continue;
      } else if (subsets[i] === null) {
        let arr = [];
        arr[i] = null;
        subsets.push(arr);
      } else {
        let subsubsets = Limit.explodeSubset(subset[i]);
        for (let j=0; j<subsubsets.length; j++) {
          let arr = [];
          arr[i] = subsubsets[j];
          subsets.push(arr);
        }
      }
    }
    return subsets;
  }

  /* Given a subset of the target, convert it into a subset of the source */
  pullbackSubset(subset) {

    // Pullback of nothing is nothing
    if (subset === undefined) return undefined; //{ /*source, target, limit };

    // Pullback of everything is everything
    if (subset === null) return null;

    if (_debug) _assert(subset instanceof Array);

    // If this is an identity limit the subset is unchanged
    if (this.length == 0) return subset;

    // Identify first and last heights referenced by the subset
    let last_subset_height = null;
    let first_subset_height = null;
    for (let i=0; i<subset.length; i++) {
      if (subset[i] === undefined) continue;
      if (first_subset_height == null) first_subset_height = i;
      last_subset_height = i;
    }

    // If it's a regular subset only the height will change
    let m = this.getMonotone();
    if (subset.regular) {
      let p = m.preimage({first: last_subset_height, last: last_subset_height});
      if (_debug) _assert(p.first == p.last);
      let r = [];
      r[p.first] = subset[last_subset_height];
      r.regular = true;
      return r;
    }

    // Handle the case that the preimage is regular
    let p = m.preimage({first: first_subset_height, last: last_subset_height + 1});
    if (p.first == p.last) {
      let targets = this.getComponentTargets();
      let index = targets.indexOf(first_subset_height);
      if (_debug) _assert(index >= 0);
      let component = this[index];
      if (_debug) _assert(component.sublimits.length == 0);
      let forward_limit = component.target_data.forward_limit;
      let regular_subset = forward_limit.pullbackSubset(subset[first_subset_height]);
      let arr = [];
      arr[p.first] = regular_subset;
      arr.regular = true;
      return arr;
    }

    let preimage = [];
    let target_height = 0;
    for (let i = 0; i < this.length; i++) {
      let component = this[i];
      while (preimage.length < component.first) {
        preimage.push(subset[target_height]);
        target_height++;
      }
      for (let j = component.first; j < component.getLast(); j++) {
        preimage[j] = component.sublimits[j - component.first].pullbackSubset(subset[target_height]);
      }
      target_height++;
    }
    while (target_height <= last_subset_height) {
      preimage.push(subset[target_height]);
      target_height++;
    }
    return preimage;
  }

  // For an atomic limit, reconstruct its source
  reconstructSource() {
    if (this.n == 0) return new Diagram(0, { type: this[0].source_type });
    if (_debug) _assert(this[0]);
    let data = this[0].source_data;
    let source = this[0].target_data.forward_limit.reconstructSource();
    return new Diagram(this.n, {data, source});
  }

  // For an atomic limit, find its unique target type
  getUniqueTargetType() {
    if (this.n == 0) return this[0].target_type;
    if (_debug) _assert(this[0]);
    return this[0].target_data.forward_limit.getUniqueTargetType();
  }

  typecheckBaseCase({forward, source}) {
    if (_debug) _assert(source instanceof Diagram);

    // Identities typecheck
    if (this.length == 0) return true;

    // We are promised that 'this' represents a limit with atomic target
    if (_debug) _assert(this.length == 1);

    // In this case we can construct the entire source and target diagrams.

    /*
    let source = this.reconstructSource();
    let target;
    if (this.n == 0) {
      target = new Diagram(0, {type: this[0].target_type});
    } else {
      target = new Diagram(this.n, {data: [this[0].target_data], source: source.source});
    }
    */
    let target = this.rewrite_forward(source);

    // If the source has zero height, we must be inserting a homotopy and its inverse
    // (Surely for n-groupoids we would relax this condition.)
    if (this.n > 0 && source.data.length == 0) {

      let forward = target.data[0].forward_limit;
      let backward = target.data[0].backward_limit;

      // These have to be inverse to each other
      if (!forward.equals(backward)) {
        console.log('Typecheck failed: improper homotopy insertion')
        return false;
      }

      // They have to type check as a homotopy.
      // We can go straight to the base case as the target is atomic.
      // Passing 'null' means it has to be a homotopy.
      return forward.typecheckBaseCase({forward:null, source:source.source});
    }

    // If we haven't been given a forward/backward distinction, then fail
    if (forward === null) return false;
    if (_debug) _assert(typeof forward === 'boolean');

    // It must be a source or target
    let type = this.getUniqueTargetType();
    if (type.n != this.n + 1) {
      console.log("Typecheck failed: singular point has the wrong dimension");
      return false;
    }
    let match_diagram = forward ? type.source : type.target;
    if (!source.equals(match_diagram)) {
      console.log("Typecheck failed: singular point has improper neighbourhood");
      return false;
    }
    return true;
  }

  typecheck(forward) {

    // Get the nontrivial neighbourhoods in the target of this limit
    let neighbourhoods = this.getNontrivialNeighbourhoods();

    // Explode the neighbourhoods
    let exploded = Limit.explodeSubset(neighbourhoods);

    //console.log('n=' + this.n + ', ' + (forward ? 'forward' : 'backward') + ' limit, analyzing ' + exploded.length + ' singular neighbourhoods');

    // Typecheck each neighbourhood
    for (let i=0; i<exploded.length; i++) {
      let limit = this.restrictToPreimage(exploded[i]);
      if (!limit.typecheckBaseCase(forward)) {
        return false;
      }
    }

    // The limit typechecks
    return true;
  }

  // Chop the limit into pieces according to the given subset of the target
  chop(subset) { // UNUSED

    // If the subset is empty, return nothing
    if (subset === undefined) return [];

    // If the subset is everything, return the whole limit
    if (subset === null) return [this];

    // Otherwise, chop into pieces
    let pieces = [];
    for (let i=0; i<subset.length; i++) {

      // If an index is not in the subset, skip it
      if (subset[i] === undefined) continue;

      // Recursively find the subset
      // INCORRECT RECURSION STRUCTURE HERE
      let arr = [];
      arr[i] = null;
      let restricted = this.restrictToPreimage(arr);
      let chopped = restricted.chop(subset[i]);
      pieces = [...pieces, ...chopped];
    }

    return pieces;
  }

  /* Restrict the limit, and its source and target, to the preimage of a given
     subset of singular data.
     
     Returns the restricted limit. */

  /* A subset is defined by an array, whose entry at position n gives the subset
     at singular height n.
     If this is 'undefined', we take the empty subset at height n.
     If this is 'null', we take the full subset at height n. */

  restrictToPreimage(subset /*{source, target, limit, subset}*/) {

    // Return everything
    if (subset === null) return this; //{ /*source, target, limit };

    // Return nothing
    if (subset === undefined) return null; //{ source: null, target: null, limit: null };

    if (_debug) _assert(subset instanceof Array);

    // Handle the preimage of a thin subset
    if (subset.regular) {
      return new Limit(this.n, []);
    }

    if (_debug) _assert(!subset.regular);

    // Check top-level range of the subset of the target
    let range = {first: null, last: null};
    for (let i=0; i<subset.length; i++) {
      if (subset[i] === undefined) continue;
      if (range.first === null) range.first = i;
      range.last = i + 1;
    }

    // If there are some components, we must work out the size of the source
    let preimage;
    if (this.length > 0) {
      let monotone = this.getMonotone();
      preimage = monotone.preimage(range);
    } else {
      preimage = range;
    }

    // Choose which components to use
    let targets = this.getComponentTargets();
    let components = [];
    for (let i=0; i<targets.length; i++) {
      let target_height = targets[i];

      // If this height is not in the subset, skip it
      if (subset[target_height] === undefined) continue;

      // We're including this component, so restrict it appropriately
      let component = this[i];

      // Build the new sublimits and source_data
      let sublimits = [];
      let source_data = [];
      let trivial = false;
      for (let j=0; j<component.source_data.length; j++) {
        //let source_height = component.first + j;

        let restrict_component = component.sublimits[j].restrictToPreimage(subset[target_height]);
        sublimits.push(restrict_component);

        // If the new component will be the identity, we don't need to do anything
        if (j == 0 && component.source_data.length == 1 && restrict_component.length == 0) {
          trivial = true;
          break;
        }

        let pullback_subset = component.sublimits[j].pullbackSubset(subset[target_height]);
        let restrict_forward = component.source_data[j].forward_limit.restrictToPreimage(pullback_subset);
        let restrict_backward = component.source_data[j].backward_limit.restrictToPreimage(pullback_subset);
        source_data.push(new Content(this.n - 1, restrict_forward, restrict_backward));
      }

      // If the pulled-back component will be trivial, we can forget it
      if (trivial) continue;

      // Build the new target_data
      let restrict_forward = component.target_data.forward_limit.restrictToPreimage(subset[target_height]);
      let restrict_backward = component.target_data.backward_limit.restrictToPreimage(subset[target_height]);
      let target_data = new Content(this.n - 1, restrict_forward, restrict_backward);
      //let first = component.first - range.first;
      let first = component.first - preimage.first;

      // Build the new LimitComponent
      let limit_component = new LimitComponent(component.n, { first, source_data, target_data, sublimits });
      components.push(limit_component);
    }

    // If there are no components, we can return straight away
    if (components.length == 0) return new Limit(this.n, []);

    return new Limit(this.n, components, preimage.last - preimage.first);

  }

  /* Take the pullback with a second limit.
     If the pullback exists, return projections { left, right }.
     Otherwise, return null.
  */
  pullback(R) {
    let L = this;
    if (_debug) _assert(R instanceof Limit);
    if (_debug) _assert(L.n == R.n);

    // Trivial cases
    //if (L.length + R.length == 0) return { left: R, right: L};
    if (L.length == 0 || R.length == 0) return { left: R, right: L};

    if (L.n == 0) {
      let left, right;
      let id = new Limit(0, []);
      if (L[0].source_type.n < R[0].source_type.n) {
        left = id;
        right = new Limit(0, [new LimitComponent(0, {
          source_type: L[0].source_type,
          target_type: R[0].source_type
        })]);
      } else if (L[0].source_type.n > R[0].source_type.n) {
        left = new Limit(0, [new LimitComponent(0, {
          source_type: R[0].source_type,
          target_type: L[0].source_type
        })]);
        right = id;
      } else { // L and R source point dimensions match
        if (L[0].source_type.id == R[0].source_type.id) {
          left = id;
          right = id;
        } else {
          throw "Pullback base case has inconsistent source types";        
        }
      }
      if (_debug) _assert(left instanceof Limit);
      if (_debug) _assert(right instanceof Limit);
      return { left, right };
    }

    let L_targets = L.getComponentTargets();
    let R_targets = R.getComponentTargets();
    let max_target = Math.max(L_targets[L_targets.length - 1], R_targets[R_targets.length - 1]);

    let PL_components = [];
    let PR_components = [];
    let source_height = 0;

    let left_components = [];
    let right_components = [];

    for (let i=0; i<=max_target; i++) {

      // Restrict the left and right limits so they have a single target component
      let L_sublimit = L.preimage({first: i, last: i+1});
      let R_sublimit = R.preimage({first: i, last: i+1});

      // Perform the pullback on these restricted limits
      let pullback = L_sublimit.pullbackComponent(R_sublimit);
      if (!pullback) {
        return null;
      }

      // Boost their height
      let left_boosted = Limit.boostComponents(pullback.left, source_height);
      let right_boosted = Limit.boostComponents(pullback.right, source_height);

      // Add to the list of components
      left_components = [...left_components, ...left_boosted];
      right_components = [...right_components, ...right_boosted];

      // Update the height of the source
      if (_debug) _assert(!isNaN(pullback.height));
      source_height += pullback.height;
    }

    // Adjust source height
    let L_mon = L.getMonotone();
    let target_height = L_mon.target_size;
    let delta = target_height - max_target - 1;
    source_height += delta;

    let left = new Limit(this.n, left_components, source_height);
    let right = new Limit(this.n, right_components, source_height);

    if (_debug) _assert(left instanceof Limit);
    if (_debug) _assert(right instanceof Limit);
    return { left, right };
  }

  static boostComponents(components, height) {
    let new_components = [];
    for (let i=0; i<components.length; i++) {
      let component = components[i];
      new_components.push(component.copy({first: component.first + height}));
    }
    return new_components;
  }

  // Pullback two limits guaranteed to have a common height-1 target
  // See 2018-10-homotopy.io-70
  // Returns { left, right, height }, where height is the height of the pullback object
  pullbackComponent(right_limit) {
    let left_limit = this;

    // If either L or R is the identity, the pullback is easy to calculate
    if (left_limit.length == 0 || right_limit.length == 0) {
      let left = right_limit;
      let right = left_limit;
      let height;
      if (left_limit.length == 0 && right_limit.length == 0) {
        height = 1;
      } else {
        height = left_limit.length > 0 ? left_limit.source_size : right_limit.source_size;
      }
      if (_debug) _assert(isNatural(height));
      return { left, right, height };
    }

    if (_debug) _assert(left_limit.length == 1);
    if (_debug) _assert(right_limit.length == 1);

    let L = left_limit[0];
    let R = right_limit[0];
    let L_size = L.source_data.length;
    let R_size = R.source_data.length;

    // We don't do nontrivial pullbacks with empty preimage
    if (L_size == 0 && R_size == 0) {
      let id = new Limit(left_limit.n, []);
      return { left: id, right: id, height: 0 };
    } else if (L_size == 0 || R_size == 0) {
      return null;
    }

    // Build matrices of pullbacks in a variety of ways.
    // If any of these fail to exist, then we return null.
    let sr_pullbacks = []; // singular-regular pullbacks
    let rs_pullbacks = []; // regular-singular pullbacks
    let ss_pullbacks = []; // singular-singular pullbacks
    for (let i=0; i<L_size; i++) {
      sr_pullbacks[i] = [];
      rs_pullbacks[i] = [];
      ss_pullbacks[i] = [];
      for (let j=0; j<R_size; j++) {

        // sr
        if (j > 0) {
          let left = L.sublimits[i];
          let right = R.sublimits[j].compose(R.source_data[j].forward_limit);
          if (!(sr_pullbacks[i][j] = left.pullback(right))) {
            return null;
          }
        }

        // rs
        if (i > 0) {
          let left = L.sublimits[i].compose(L.source_data[i].forward_limit);
          let right = R.sublimits[j];
          if (!(rs_pullbacks[i][j] = left.pullback(right))) {
            return null;
          }
        }

        // ss
        let left = L.sublimits[i];
        let right = R.sublimits[j];
        if (!(ss_pullbacks[i][j] = left.pullback(right))) {
          return null;
        }
      }
    }

    // Identify which singular pullbacks have nontrivial 'mass'.
    // Do this by examining their incoming limits from adjacent regular pullbacks.
    // Each singular pullback will in the generic case have 4 such, 2 above and 2 below;
    // edge cases may only have 1 above and/or below.
    let incoming = [];
    for (let i=0; i<L_size; i++) {
      incoming[i] = [];
      for (let j=0; j<R_size; j++) {
        incoming[i][j] = { trivial: true };
        let a = incoming[i][j];
        let ss = ss_pullbacks[i][j];

        // Lower-right regular-singular inclusion
        if (i > 0) {
          let rs = rs_pullbacks[i][j];
          let cone_left = L.source_data[i].forward_limit.compose(rs.left);
          let cone_right = rs.right;
          let factorization = Limit.pullbackFactorize(ss, cone_left, cone_right);
          if (!factorization) {
            return null;
          }
          a.lower_right = factorization;
          if (factorization.length > 0) a.trivial = false;
        }

        // Upper-left regular-singular inclusion
        if (i < L_size - 1) {
          let rs = rs_pullbacks[i + 1][j];
          let cone_left = L.source_data[i].backward_limit.compose(rs.left);
          let cone_right = rs.right;
          let factorization = Limit.pullbackFactorize(ss, cone_left, cone_right);
          if (!factorization) {
            return null;
          }
          a.upper_left = factorization;
          if (factorization.length > 0) a.trivial = false;
        }

        // Lower-left singular-regular inclusion
        if (j > 0) {
          let sr = sr_pullbacks[i][j];
          let cone_left = sr.left;
          let cone_right = R.source_data[j].forward_limit.compose(sr.right);
          let factorization = Limit.pullbackFactorize(ss, cone_left, cone_right);
          if (!factorization) {
            return null;
          }
          a.lower_left = factorization;
          if (factorization.length > 0) a.trivial = false;
        }

        // Upper-right singular-regular inclusion
        if (j < R_size - 1) {
          let sr = sr_pullbacks[i][j + 1];
          let cone_left = sr.left;
          let cone_right = R.source_data[j].backward_limit.compose(sr.right);
          let factorization = Limit.pullbackFactorize(ss, cone_left, cone_right);
          if (!factorization) {
            return null;
          }
          a.upper_right = factorization;
          if (factorization.length > 0) a.trivial = false;
        }
      }
    }

    // Check for a unique full-mass node at each height
    let nontrivial = [];
    nontrivial[0] = 0;
    nontrivial[L_size + R_size - 2] = L_size - 1;
    for (let h=1; h<L_size + R_size - 2; h++) {
      nontrivial[h] = -1;
    }
    for (let i=0; i<L_size; i++) {
      for (let j=0; j<R_size; j++) {
        let height = i + j;
        if (height == 0) continue;
        if (height == L_size + R_size - 2) continue;
        if (_debug) _assert(incoming[i][j]);
        if (!incoming[i][j].trivial) {
          if (nontrivial[height] >= 0) {
            console.log("Can't linearize pullback, distinct nontrivial masses at height " + height);
            return null;  
          }
          nontrivial[height] = i;
        }
      }
    }

    // Build the actual path
    let step_i = [0];
    let step_j = [0];
    let directions = [];
    let [dir_left, dir_neutral, dir_right] = [-1, 0, +1];
    for (let height=1; height<L_size + R_size - 1; height++) {
      if (nontrivial[height] < 0) continue;

      let last_i = step_i[step_i.length - 1];
      let last_j = step_j[step_j.length - 1];
      let i = nontrivial[height];
      let j = height - i;

      if (i < last_i || j < last_j) {
        console.log("Can't linearize pullback, mass too far away at height " + height);
        return null;
      }

      step_i.push(i);
      step_j.push(j);

      // Set direction of path at this step
      let l = step_i.length;
      if(step_i[l - 1] == step_i[l - 2]) {
        directions.push(dir_right);
      } else if (step_j[l - 1] == step_j[l - 2]) {
        directions.push(dir_left);
      } else {
        directions.push(dir_neutral);
      }
    }
    let pl_mon = new Monotone(L_size, /*pl_pre_mon*/ step_i);
    let pr_mon = new Monotone(R_size, /*pr_pre_mon*/ step_j);

    // Compute bottom and top limits for pullback diagram
    let bottom_limit = Limit.pullbackFactorize
      (ss_pullbacks[0][0], L.source_data[0].forward_limit, R.source_data[0].forward_limit);
    if (!bottom_limit) {
      console.log("Can't build pullback, bottom factorization does not exist");
      return null;
    }
    let top_limit = Limit.pullbackFactorize
      (ss_pullbacks[L_size - 1][R_size - 1], L.source_data[L_size - 1].backward_limit, R.source_data[R_size - 1].backward_limit);
    if (!top_limit) {
      console.log("Can't build pullback, top factorization does not exist");
      return null;
    }

    // Build pullback diagram data
    let P_size = pl_mon.length;
    let P_data = [];
    let ignore_level = [];
    let count_ignore = 0;
    for (let step=0; step<P_size; step++) {

      let i = step_i[step];
      let j = step_j[step];

      // Get the forward limit
      let forward_limit;
      if (step == 0) {
        forward_limit = bottom_limit;
      } else {
        let d = directions[step - 1];
        if (d == -1) { // rs
          forward_limit = incoming[i][j].lower_right;
        } else if (d == +1 || d == 0) {
          forward_limit = incoming[i][j].lower_left;
        }
      }

      // Get the backward limit
      let backward_limit;
      if (step == P_size - 1) {
        backward_limit = top_limit;
      } else {
        let d = directions[step];
        if (d == -1) {
          backward_limit = incoming[i][j].upper_left;
        } else {
          backward_limit = incoming[i][j].upper_right;
        }
      }

      // If nothing is happening here, remember that, so we can omit this level later
      if (forward_limit.length == 0 && backward_limit.length == 0) {
        ignore_level[step] = true;
        count_ignore ++;
      }

      // Push this data onto the list for p
      P_data.push(new Content(this.n - 1, forward_limit, backward_limit));
    }

    /*
    // Modify pl_mon, pr_mon to avoid trivial levels
    let new_pl_mon = [];
    let new_pr_mon = [];
    for (let i=0; i<pl_mon.length; i++) {
      if (ignore_level[i]) continue;
      new_pl_mon.push(pl_mon[i]);
      new_pr_mon.push(pr_mon[i]);
    }
    pl_mon = new Monotone(pl_mon.target_size, new_pl_mon);
    pr_mon = new Monotone(pr_mon.target_size, new_pr_mon);

    // Modify P_data, step_i, step_j, P_size to avoid trivial levels
    for (let i=P_size - 1; i>=0; i--) {
      if (!ignore_level[i]) continue;
      P_size --;
      step_i = step_i.splice(i);
      step_j = step_j.splice(i);
      P_data = P_data.splice(i);
    }
    */


    // Build the left projection
    let left_components = [];
    for (let a=0; a<L_size; a++) {
      let preimage = pl_mon.preimage(a);

      let source_data = [];
      let sublimits = [];
      for (let b=preimage.first; b<preimage.last; b++) {
        source_data.push(P_data[b]);
        let i = step_i[b];
        let j = step_j[b];
        sublimits.push(ss_pullbacks[i][j].left);
      }

      // Ignore trivial components
      if (sublimits.length == 1 && sublimits[0].length == 0) {
        continue;
      }

      let target_data = L.source_data[a];
      let first = preimage.first;
      left_components.push(new LimitComponent(this.n, { first, source_data, target_data, sublimits }));
    }
    let left = new Limit(this.n, left_components, P_size);

    // Build the right projection
    let right_components = [];
    for (let a=0; a<R_size; a++) {
      let preimage = pr_mon.preimage(a);
      let source_data = []; 
      let sublimits = [];
      for (let b=preimage.first; b<preimage.last; b++) {
        source_data.push(P_data[b]);
        let i = step_i[b];
        let j = step_j[b];
        sublimits.push(ss_pullbacks[i][j].right);
      }

      // Ignore trivial components
      if (sublimits.length == 1 && sublimits[0].length == 0) {
        continue;
      }

      let target_data = R.source_data[a];
      let first = preimage.first;
      right_components.push(new LimitComponent(this.n, { first, source_data, target_data, sublimits }));
    }
    let right = new Limit(this.n, right_components, P_size);

    // Return the projections
    let height = P_size;
    if (_debug) _assert(isNatural(height));
    return {left, right, height };
  }

  // Get a partial list of data of the limit's source
  getSourceData() {
    let arr = [];
    for (let i=0; i<this.length; i++) {
      let component = this[i];
      for (let j=0; j<component.source_data.length; j++) {
        arr[component.first + j] = component.source_data[j];
      }
    }
    return arr;
  }

  // The cone is formed from f and g
  static pullbackFactorize(pullback, f, g) {

    if (_debug) _assert(pullback.left instanceof Limit);
    if (_debug) _assert(pullback.right instanceof Limit);

    // Don't allow the cone maps to be identities
    // (this simplifies some things, if it turns out to be too strong we can deal with it later)
    if (f.length == 0) {
      if (pullback.left.length != 0) return null;
      if (!g.equals(pullback.right)) return null;
      return new Limit(f.n, []);
    }

    if (g.length == 0) {
      if (pullback.right.length != 0) return null;
      if (!f.equals(pullback.left)) return null;
      return new Limit(f.n, []);
    }

    if (_debug) _assert(f.source_size === g.source_size);

    // Base case
    if (f.n == 0) {
      if (pullback.left.length == 0 && pullback.right.length == 0) {
        if (f.equals(g)) {
          return new Limit(0, []);
        } else {
          throw "Pullback doesn't factorize in dimension 0";
        }
      }
      let P_type;
      if (pullback.left.length > 0) {
        P_type = pullback.left[0].source_type;
      } else {
        P_type = pullback.right[0].source_type;
      }
      let X_type;
      if (f.length > 0) {
        X_type = f[0].source_type;
      } else if (g.length > 0) {
        X_type = g[0].source_type;
      } else {
        throw "Pullback base case, can't determine type of cone object";
      }
      if (X_type.n > P_type.n) {
        throw "Pullback base case, cone dimension is too high";
      }
      if (X_type.n == P_type.n && X_type.id != P_type.id) {
        throw "Pullback base case, cone has inconsistent type";
      }
      if (X_type.id == P_type.id) {
        return new Limit(0, []);
      }
      return new Limit(0, [new LimitComponent(0, {source_type : X_type, target_type: P_type})]);
    }

    if (pullback.left.length == 0 && pullback.right.length == 0) {
      if (!f.equals(g)) {
        return null;
      }
      return f;
    }

    if (pullback.left.length == 0) {
      if (!pullback.right.compose(f).equals(g)) return null;
      return f;
    }

    if (pullback.right.length == 0) {
      if (!pullback.left.compose(g).equals(f)) return null;
      return g;
    }

    if (_debug) _assert(f.source_size === g.source_size);



    // Work level by level on the common source of f and g

    // Get associated monotone data
    let f_targets = f.getComponentTargets();
    let g_targets = g.getComponentTargets();
    let pl_targets = pullback.left.getComponentTargets();
    let pr_targets = pullback.right.getComponentTargets();

    /*
    let X_height = Math.max(f_targets.length, g_targets.length);
    let P_height = Math.max(pl_targets.length, pr_targets.length);
    let A_height = Math.max(...[...pl_targets, ...f_targets]);
    let B_height = Math.max(...[...pr_targets, ...g_targets]);
    let f_mon = f.getMonotone(X_height, A_height);
    let g_mon = g.getMonotone(X_height, B_height);
    let pl_mon = pullback.left.getMonotone(P_height, A_height);
    let pr_mon = pullback.right.getMonotone(P_height, B_height);
    */

    let X_height = f.source_size;
    let P_height = pullback.left.source_size || pullback.right.source_size;
    let A_height = f.getTargetSize();
    let B_height = g.getTargetSize();
    let f_mon = f.getMonotone(X_height, A_height);
    let g_mon = g.getMonotone(X_height, B_height);
    let pl_mon = pullback.left.length == 0 ? Monotone.getIdentity(P_height) : pullback.left.getMonotone(P_height, A_height);
    let pr_mon = pullback.right.length == 0 ? Monotone.getIdentity(P_height) : pullback.right.getMonotone(P_height, B_height);


    // NEED TO HANDLE THE CASE WHERE PULLBACK ARM IS THE IDENTITY //


    // Factorize at the level of the monotones
    let fac_mon = Monotone.pullbackFactorize({left: pl_mon, right: pr_mon}, f_mon, g_mon);
    if (!fac_mon) {
      return null;
    }

    // Collect some data about X
    let f_source_data = f.getSourceData();
    let g_source_data = g.getSourceData();
    let X_data = [];
    for (let i=0; i<X_height; i++) {
      X_data[i] = f_source_data[i] || g_source_data[i];
    }
    
    // Collect some data about P
    let pl_source_data = pullback.left.getSourceData();
    let pr_source_data = pullback.right.getSourceData();
    let P_data = [];
    for (let i=0; i<P_height; i++) {
      P_data[i] = pl_source_data[i] || pr_source_data[i];
    }
    
    // Build up the components of the factorizing limit.

    /* THIS RELIES ON A CONJECTURE THAT ANY NECESSARY DIAGRAM DATA IS ALREADY
       ENCODED IN THE PROVIDED LIMITS! IF THIS ISN'T TRUE WE'LL HAVE TO
       RECONSIDER THE ALGORITHM STRUCTURE AND MAYBE PASS IN ADDITIONAL
       DIAGRAM DATA. THIS CONJECTURE IS PROTECTED BY ASSERTS.
       See 2018-10-homotopy.io-72 */

    let components = [];
    for (let i=0; i<P_height; i++) {
      let pl_sub = pullback.left.subLimit(i);
      let pr_sub = pullback.right.subLimit(i);
      let pullback_sub = {left: pl_sub, right: pr_sub};
      let preimage = fac_mon.preimage(i);
      let sublimits = [];
      for (let j=preimage.first; j<preimage.last; j++) {
        let range = { first: j}
        let f_sub = f.subLimit(j);
        let g_sub = g.subLimit (j);
        let fac_sub = Limit.pullbackFactorize(pullback_sub, f_sub, g_sub); // Recursive step
        if (!fac_sub) {
          return null;
        }
        sublimits.push(fac_sub);
      }

      // Skip out if the component is trivial
      if (sublimits.length == 1 && sublimits[0].length == 0) continue;

      // Build the list of source data
      let source_data = [];
      for (let j=preimage.first; j<preimage.last; j++) {
        let data = X_data[j];
        if (_debug) _assert(data);
        source_data.push(data);
      }

      // Get the target data
      let target_data = P_data[i];

      // A few sanity checks
      if (_debug) _assert(target_data);
      if (_debug) _assert(sublimits.length == source_data.length);

      // Add the component
      components.push(new LimitComponent(f.n, {first: preimage.first, sublimits, source_data, target_data}));
    }

    return new Limit(f.n, components, X_height);
  }

  composeAtRegularLevel({height, limit}) {

    // Nothing to do for identity limits
    if (this.length == 0) return this;

    // Make a shallow copy of the limit components ready for modification
    let components = [...this];

    // Base case is to pad with initial and final components where appropriate
    if (this.n == limit.n + 1) {

      // Correct the source_data
      if (height > 0) {

      }

      // Pad leftmost component if appropriate
      let first_component = components[0];
      if (type == 's' && first_component.first == 0) {

        // Correct the source data
        let source_data = first_component.source_data.slice();
        if (source_data.length > 0) {
          //source_data[0].forward_limit = source_data[0].forward_limit.compose(limit);
          let forward_limit = source_data[0].forward_limit.compose(limit);
          let backward_limit = source_data[0].backward_limit;
          source_data[0] = new Content(source_data[0].n, forward_limit, backward_limit);
        }

        // Correct the target data
        let forward_limit = first_component.target_data.forward_limit.compose(limit);
        let backward_limit = first_component.target_data.backward_limit;
        let target_data = new Content(forward_limit.n, forward_limit, backward_limit);

        // Store the result
        let first = first_component.first;
        let sublimits = first_component.sublimits;
        components[0] = new LimitComponent(this.n, { source_data, target_data, sublimits, first })
      }

      // Pad rightmove component if appropriate
      let last_component = components[components.length - 1];
      if (type == 't' && last_component.first + last_component.source_data.length == this.source_size) {

        // Correct the source data
        let source_data = last_component.source_data.slice();
        if (source_data.length > 0) {
          //source_data[source_data.length - 1].forward_limit = source_data[source_data.length - 1].backward_limit.compose(limit);
          let forward_limit = source_data[source_data.length - 1].forward_limit;
          let backward_limit = source_data[source_data.length - 1].backward_limit.compose(limit);
          source_data[source_data.length - 1] = new Content(source_data[0].n, forward_limit, backward_limit);
        }

        // Correct the target data
        //target_data = last_component.target_data.copy();
        let forward_limit = last_component.target_data.forward_limit;
        let backward_limit = last_component.target_data.backward_limit.compose(limit);
        let target_data = new Content(forward_limit.n, forward_limit, backward_limit);

        // Store the result
        let first = last_component.first;
        let sublimits = last_component.sublimits;
        components[components.length - 1] = new LimitComponent(this.n, { source_data, target_data, sublimits, first })
      }

      // Return the adjusted limit
      return new Limit(this.n, components, this.source_size);
    }

    // Otherwise, the provided limit is too low-dimensional, so recurse
    for (let i=0; i<components.length; i++) {
      components[i] = components[i].composeAtBoundary({type, limit});
    }

    return new Limit(this.n, components, this.source_size);
  }

  getTargetSize() {
    if (this.n == 0) return 1;
    if (this.length == 0) return null; // we don't store source or target size for identity limits
    let target_size = this.source_size;
    for (let i=0; i<this.length; i++) {
      target_size -= this[i].sublimits.length - 1;
    }
    return target_size;
  }

  // Normalize the regular levels of the provided limits, both in the source and target.
  // They all have the common source provided.
  // Return value is the normalized limits with source and target regular levels normalized.
  static normalizeRegular({source, limits}) {
    if (_debug) _assert(source instanceof Diagram);
    if (_debug) _assert(limits instanceof Array);

    // In the base case, do nothing
    if (source.n <= 1) return {source, limits};

    for (let i=0; i<limits.length; i++) {
      let limit = limits[i];
      if (_debug) _assert(limit.n == source.n);
      if (_debug) _assert(limit.n >= 2);
      if (_debug) _assert(limit instanceof Limit);
      if (limit.length == 0) continue;
      if (_debug) _assert(limit.source_size == source.data.length);
    }

    // Arrange the source limits by their regular source level
    let level_limits = [];
    for (let i=0; i<=source.data.length; i++) {
      let l = [];
      if (i > 0) l.push(source.data[i - 1].backward_limit);
      if (i < source.data.length) l.push(source.data[i].forward_limit);
      level_limits.push(l);
    }
    
    // Add any further limits required by the limits argument
    for (let i=0; i<limits.length; i++) {
      let limit = limits[i];
      for (let j=0; j<limit.length; j++) {
        let component = limit[j];
        let last = component.getLast();
        if (_debug) _assert(level_limits[component.first] instanceof Array);
        if (_debug) _assert(level_limits[last] instanceof Array);
        level_limits[component.first].push(component.target_data.forward_limit);
        level_limits[component.getLast()].push(component.target_data.backward_limit);
      }
    }

    // Recursively normalize them
    let source_limits = [];
    let target_limits = [];
    let source_source;
    for (let i=0; i<=source.data.length; i++) {
      let slice = source.getSlice({height: i, regular: true});
      let n = Limit.normalizeRegular({source: slice, limits: level_limits[i]});
      if (i == 0) source_source = n.source;
      if (i > 0) {
        source_limits.push(n.limits.shift());
      }
      if (i < source.data.length) {
        source_limits.push(n.limits.shift());
      }
      target_limits.push(n.limits);
    }

    // Build the new source diagram
    let data = [];
    if (_debug) _assert(source_limits.length % 2 == 0);
    for (let i=0; i<source_limits.length / 2; i++) {
      let forward_limit = source_limits[2 * i];
      let backward_limit = source_limits[2 * i + 1];
      let content = new Content(source.n - 1, forward_limit, backward_limit);
      data.push(content);
    }
    
    // Update the limits
    let new_limits = [];
    for (let i=0; i<limits.length; i++) {
      let limit = limits[i];
      let new_components = [];
      for (let j=0; j<limit.length; j++) {
        let component = limit[j];
        let source_data = data.slice(component.first, component.first + component.sublimits.length);
        let forward_limit = target_limits[component.first].shift();
        let backward_limit = target_limits[component.getLast()].shift();
        let target_data = new Content(source.n - 1, forward_limit, backward_limit);
        let first = component.first;
        let sublimits = component.sublimits;
        let new_component = new LimitComponent(source.n, {source_data, target_data, first, sublimits});
        new_components.push(new_component);
      }
      let new_limit = new Limit(source.n, new_components, limit.source_size);
      new_limits.push(new_limit);
    }

    // Create the new source
    let new_source = new Diagram(source.n, {source: source_source, data});

    // Verify the outgoing limits are compatible with the new source diagram
    for (let i=0; i<new_limits.length; i++) {
      new_limits[i].verifySource(new_source);
    }
    
    // Get its embedding into its singular normalization
    let source_normalized = new_source.normalize();

    // Compose with the new limits to get the limits we'll be returning
    let new_new_limits = [];
    for (let i=0; i<new_limits.length; i++) {
      let new_limit = new_limits[i];
      let new_new_limit = new_limit.compose(source_normalized.embedding);
      new_new_limits.push(new_new_limit);
    }

    // Verify the outgoing limits are compatible with the new source diagram
    for (let i=0; i<new_new_limits.length; i++) {
      new_new_limits[i].verifySource(source_normalized.diagram);
    }
    
    // Return the normalized source along with the composed limits
    return { source: source_normalized.diagram, limits: new_new_limits };

  }

  // Verify that the limit can act on the specified diagram
  verifySource(diagram) {

    if (_debug) _assert(this.n == diagram.n);
    if (this.length == 0) return;
    if (_debug) _assert(this.source_size == diagram.data.length);
    for (let i=0; i<this.length; i++) {
      let component = this[i];
      for (let j=0; j<component.source_data.length; j++) {
        if (_debug) _assert(component.source_data[j].equals(diagram.data[component.first + j]));
      }
    }

  }

  updateSliceForward(slice) {
    if (_debug) _assert(slice instanceof Array);
    if (this.length == 0) return slice;
    if (slice.length == 0) return slice;
    let [first, ...rest] = slice;
    let singular_monotone = this.getMonotone();

    // Singular level
    if (first % 2 == 1) {
      let singular_height = (first - 1) / 2;
      let sublimit = this.subLimit(singular_height);
      let updated = sublimit.updateSliceForward(rest);
      return [2 * singular_monotone[singular_height] + 1, ...updated];
    }

    // Regular level
    let regular_height = first / 2;
    let regular_monotone = singular_monotone.getAdjoint();
    //let s_below = regular_height - 1;
    //let s_above = regular_height;
    let regular_inverse_image = [];
    for (let i=0; i<regular_monotone.length; i++) {
      if (regular_monotone[i] == regular_height) {
        regular_inverse_image.push(i);
      }
    }

    // Identity locally
    if (regular_inverse_image.length == 1) {
      return [2 * regular_inverse_image[0], ...rest];      
    }

    let targets = this.getComponentTargets();

    // Locally expansive on singular slices
    if (regular_inverse_image.length > 1) {
      let s_target = regular_inverse_image[0];
      let index = targets.indexOf(s_target);
      if (_debug) _assert(index >= 0);
      let component = this[index];
      let updated = component.target_data.forward_limit.updateSliceForward(rest);
      return [2 * s_target + 1, ...updated];
    }

    // Locally contractive on singular slices
    if (_debug) _assert(regular_inverse_image.length == 0);
    let s_target = singular_monotone[regular_height];
    let index = targets.indexOf(s_target);
    if (_debug) _assert(index >= 0);
    let component = this[index];
    if (_debug) _assert(component.source_data.length > 0);

    let first_limit = component.source_data[regular_height - component.first].forward_limit;

    //let first_limit = this.data[regular_height].forward_limit;
    let second_limit = this.subLimit(regular_height);
    let composed_limit = second_limit.compose(first_limit);
    let updated = composed_limit.updateSliceForward(rest);
    return [2 * s_target + 1, ...updated];
    /*

    let first_limit = component.source_data[0].backward_limit;
    let second_limit = this.subLimit(s_below);
    let composed_limit = second_limit.compose(first_limit);
    let updated = composed_limit.updateSliceForward(rest);
    return [2 * s_target + 1, ...updated];
    */

    /*
    // Identity locally
    if ((s_below < 0 || regular_monotone[singular_monotone[s_below] + 1] == s_below + 1)
      &&
      (s_above == this.source_size || regular_monotone[singular_monotone[s_above]] == s_above)) {
      if (!(s_below < 0 && s_above == this.source_size)) {
        return [2 * singular_monotone[s_above], ...rest];
      }
    }
    */

    /*

    // Zero source size case
    if (s_below < 0 && s_above == this.source_size) {
      let component = this[0];
      let updated = component.target_data.forward_limit.updateSliceForward(rest);
      return [1, ...updated];
    }

    if (_debug) _assert(s_below >= 0);
    if (_debug) _assert(s_above < this.source_size);
    let targets = this.getComponentTargets();

    // Contractive locally on singular slices, expansive on regular
    if (singular_monotone[s_above] == singular_monotone[s_below]) {
      let s_target = singular_monotone[s_above];
      let index = targets.indexOf(s_target);
      if (_debug) _assert(index >= 0);
      let component = this[index];
      if (_debug) _assert(component.source_data.length > 0);
      let first_limit = component.source_data[0].backward_limit;
      let second_limit = this.subLimit(s_below);
      let composed_limit = second_limit.compose(first_limit);
      let updated = composed_limit.updateSliceForward(rest);
      return [2 * s_target + 1, ...updated];
    }

    // Expansive locally on singular slices, contractive on regular
    let s_target = singular_monotone[s_below] + 1;
    let index = targets.indexOf(s_target);
    if (_debug) _assert(index >= 0);
    let component = this[index];
    let updated = component.target_data.forward_limit.updateSliceForward(rest);
    return [2 * s_target + 1, ...updated];
    */
  }

  updateSliceBackward(slice) {
    if (_debug) _assert(slice instanceof Array);
    if (this.length == 0) return slice;
    if (slice.length == 0) return slice;
    let singular_monotone = this.getMonotone();
    let regular_monotone = singular_monotone.getAdjoint();
    let [first, ...rest] = slice;

    // Regular level
    if (first % 2 == 0) {
      let new_first = 2 * regular_monotone[first / 2];
      return [new_first, ...rest];
    }

    // Singular level
    let singular_height = (first - 1) / 2;
    let regular_height_below = singular_height;
    let regular_height_above = singular_height + 1;

    // Identity like
    if (regular_monotone[regular_height_above] == regular_monotone[regular_height_below] + 1) {
      let new_singular = regular_monotone[regular_height_below];
      let sublimit = this.subLimit(singular_height);
      return [1 + new_singular * 2, ...sublimit.updateSliceBackward(rest)];
    }

    let targets = this.getComponentTargets();
    let index = targets.indexOf(singular_height);
    if (_debug) _assert(index >= 0);
    let component = this[index];
    if (_debug) _assert(component);

    // Expansive on singular heights, contractive on regular heights
    if (regular_monotone[regular_height_below] == regular_monotone[regular_height_above]) {
      return [2 * regular_monotone[regular_height_below],
        ...component.target_data.forward_limit.updateSliceBackward(rest)];
    }

    // Contractive on singular heights, expansive on regular heights
    let source_first_singular = regular_monotone[regular_height_below];
    let component_subindex = source_first_singular - component.first;
    if (_debug) _assert(component_subindex >= 0);
    if (_debug) _assert(component_subindex < component.source_data.length);
    let first_limit = component.source_data[component_subindex].forward_limit;
    let second_limit = this.subLimit(source_first_singular);
    let composed_limit = second_limit.compose(first_limit);
    return [2 * (source_first_singular + 1), ...composed_limit.updateSliceBackward(rest)];
  }

}


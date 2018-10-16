import { _validate, _assert, isNatural, _propertylist } from "~/util/debug";
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
    _assert(isNatural(this.n));
    _assert(this.n >= 0);
    _assert(this.forward_limit instanceof Limit);
    _assert(this.backward_limit instanceof Limit);
    _assert(this.forward_limit.n == this.n);
    _assert(this.backward_limit.n == this.n);
    Object.freeze(this);
    _validate(this);
  }

  validate() {
    _propertylist(this, ["n", "forward_limit", "backward_limit"]);
    _validate(this.forward_limit, this.backward_limit);
  }

  getLastPoint() {
    _assert(false);
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

  pad(depth) {
    let forward_limit = this.forward_limit.pad(depth);
    let backward_limit = this.backward_limit.pad(depth);
    return new Content(this.n, forward_limit, backward_limit);
  }

  // Pad the content so that the origin moves to the specified position
  deepPad(position) {
    let forward_limit = this.forward_limit.deepPad(position);
    let backward_limit = this.backward_limit.deepPad(position);
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
    _assert(source === undefined);
    return new Content(this.n, this.backward_limit, this.forward_limit);
  }

  typecheck() {
    if (!this.forward_limit.typecheck(true)) return false;
    if (!this.backward_limit.typecheck(false)) return false;
  }

  // Get data that describes an expansion of this Content object (2018-ANC-1-55)
  getExpansionData(index, r1, r2, s) {
    _validate(this, r1, r2, s);

    let f = this.forward_limit;
    let b = this.backward_limit;

    let forward_monotone = f.getMonotone(r1.data.length, s.data.length);
    let backward_monotone = b.getMonotone(r2.data.length, s.data.length);
    //let source_preimage = forward_monotone.preimage(location[1].height);
    let f_analysis = f.getComponentTargets();
    let f_index = f_analysis.indexOf(index);
    let b_analysis = b.getComponentTargets();
    let b_index = b_analysis.indexOf(index);

    let f_old = f_index < 0 ? null : f[f_index];
    let b_old = b_index < 0 ? null : b[b_index];
    _assert(f_old || b_old);
    _assert(f.length > 0 || b.length > 0);

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
    let f_new_2;
    if (f_old) {
      f_new_2 = new Limit(this.n, [f_old.copy({
        first: f_old.first + f_delta + b_delta
      })], null);
    } else {
      f_new_2 = new Limit(this.n, [], null);
    }

    // F - Prepare the first new backward limit
    let b_new_1 = b;
    if (b_old) {
      let f_old_delta = f_old ? f_old.getLast() - f_old.first - 1 : 0; // weird f/b mixing here!
      let b_old_delta = b_old ? b_old.getLast() - b_old.first - 1 : 0;

      let components = [...b_new_1];
      components.splice(b_index, 1);
      components = components.map((component, i) => {
        if (i >= b_index) {
          return component.copy({
            first: component.first + f_old_delta - b_old_delta
          });
        } else return component;
      });

      b_new_1 = b_new_1.copy({ components }); 
    }

    // H - Prepare the second new backward limit

    let b_new_2 = b_old ? new Limit(this.n, [b_old], null) : new Limit(this.n, [], null);

    // C - Prepare the first sublimit - tricky as we need the reversed version of f_old
    // OPTIMIZATION: we don't really need to reverse all of f, just f_old
    let sublimit_1;
    if (f_old) {
      sublimit_1 = new Limit(this.n, [f[f_index].copy(
          { first: f[f_index].first + f_delta }
        )], null);
    } else {
      new Limit(this.n, [], null);
    }
    _validate(sublimit_1);

    // D - Prepare the second sublimit
    let sublimit_2 = b;
    if (b_old) {
      let local_delta = b_old.getLast() - b_old.first - 1;
      let components = [...sublimit_2];
      components.splice(b_index, 1);
      components = components.map((component, index) => {
        if (index > b_index) {
          return component.copy({ first: component.first - local_delta });
        } else {
          return component;
        }
      });
      sublimit_2 = sublimit_2.copy({ components });
    }
    _validate(sublimit_2);

    _validate(f_new_1, b_new_1, f_new_2, b_new_2);

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
    _assert(data instanceof Array);
    if ((typeof data) === "string") return data;
    if (!data) return data;
    let new_data = [];
    for (let i = 0; i < data.length; i++) {
      _assert(data[i] instanceof Content);
      new_data.push(data[i].copy());
    }
    return new_data;
  }

  static deepPadData(data, position) {
    return data.map(content => content.deepPad(position));
  }
}

export class LimitComponent {

  constructor(n, args) {
    this.n = n;
    _assert(isNatural(this.n));
    _assert(this.n >= 0);
    if (n == 0) {
      this.source_type = args.source_type;
      this.target_type = args.target_type;
      _assert(this.source_type instanceof Generator);
      _assert(this.target_type instanceof Generator);
      return this;
    }
    this.source_data = args.source_data;
    this.target_data = args.target_data;
    this.first = args.first;
    //_assert(args.last === undefined);
    _assert(isNatural(this.first));
    this.sublimits = args.sublimits;
    Object.freeze(this);
    _validate(this);
  }

  validate() {
    _assert(isNatural(this.n));
    if (this.n == 0) {
      _propertylist(this, ["n", "source_type", "target_type"]);
      _assert(this.source_type instanceof Generator);
      _assert(this.target_type instanceof Generator);
      _validate(this.source_type);
      _validate(this.target_type);
    } else {
      _propertylist(this, ["n", "source_data", "target_data", "first", "sublimits"]);
      _assert(isNatural(this.first));
      _assert(this.target_data instanceof Content);
      _assert(this.source_data instanceof Array);
      _assert(this.sublimits instanceof Array);
      _assert(this.sublimits.length == this.source_data.length);
      for (let i = 0; i < this.sublimits.length; i++) {
        _assert(this.sublimits[i] instanceof Limit);
        _assert(this.sublimits[i].n == this.n - 1);
        _validate(this.sublimits[i]);
        _assert(this.source_data[i] instanceof Content);
        _assert(this.source_data[i].n == this.n - 1);
        _validate(this.source_data[i]);
      }
      _assert(this.target_data instanceof Content);
      _assert(this.target_data.n == this.n - 1);
      _validate(this.target_data);
    }
  }

  equals(b) {
    let a = this;
    if (a.first != b.first) return false;
    if (!a.data && b.data) return false;
    if (a.data && !b.data) return false;
    if (a.data) {
      if (a.data.length != b.data.length) return false;
      for (let i = 0; i < a.data.length; i++) {
        if (!a.data[i].equals(b.data[i])) return false;
      }
    }
    if (!a.sublimits && b.sublimits) return false;
    if (a.sublimits && !b.sublimits) return false;
    if (a.sublimits) {
      if (a.sublimits.length != b.sublimits.length) return false;
      for (let i = 0; i < a.sublimits.length; i++) {
        if (!a.sublimits[i].equals(b.sublimits[i])) return false;
      }
    }
    return true;
  }

  // Gets the effective value of the old 'last' property
  getLast() {
    return this.first + this.source_data.length;
  }

  getSize() {
    return this.source_data.length;
  }

  getLastPoint() {
    _assert(false);
    if (this.n == 0) return new Diagram(0, { type: this.type });
    //return this.data.last().getLastPoint();
    return this.target_data.getLastPoint();
    _assert(false); // ... to write ...
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
    if (this.n == 0) return this.type.id == generator.id;

    for (let content of this.data) {
      if (content.usesCell(generator)) return true;
    }

    for (let sublimit of this.sublimits) {
      if (sublimit.usesCell(generator)) return true;
    }

    return false;
  }

  pad(depth) {
    if (depth == 1) {
      return new LimitComponent(this.n, { source_data: this.source_data, target_data: this.target_data, sublimits: this.sublimits, first: this.first + 1 });
    } else if (depth > 1) {
      let target_data = this.target_data.map(content => content.pad(depth - 1));
      let source_data = this.source_data.map(content => content.pad(depth - 1));
      let sublimits = this.sublimits.map(sublimit => sublimit.pad(depth - 1));
      return new LimitComponent(this.n, { source_data, target_data, sublimits, first: this.first });
    }
  }

  // Deep pad this component so that the origin moves to the given position
  deepPad(position) {
    _assert(this.n == position.length);
    if (this.n == 0) return this;
    let [height, ...rest] = position;
    let source_data = this.source_data.map(content => content.deepPad(rest));
    let target_data = this.target_data.map(content => content.deepPad(rest));
    let sublimits = this.sublimits.map(limit => limit.deepPad(rest));
    return new LimitComponent(this.n, { source_data, target_data, sublimits, first: this.first + height });
  }
}

export class Limit extends Array {

  constructor(n, components) {
    super(...components);
    this.n = n;
    this.validate();
  }

  validate() {
    _assert(isNatural(this.n));
    for (let i = 0; i < this.length; i++) {
      _assert(this[i] instanceof LimitComponent);
      _assert(this[i].n == this.n);
      if (i != 0) _assert(this[i].first >= this[i - 1].getLast());
      this[i].validate();
    }
    if (this.n == 0) _propertylist(this, ["n"]);
    else _propertylist(this, ["n"]);
    if (this.n == 0 && this.length > 0) {
      _assert(this.length == 1);
      _assert(this[0].source_type.id != this[0].target_type.id);
    }
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
    _assert(isNatural(source_height));
    _assert(isNatural(target_height));
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

      _assert(shifted.first >= 0 && shifted.getLast() >= 0);
      _validate(shifted);

      components.push(shifted);
    }

    return new Limit(this.n, components);
  }

  subLimit(n, forward) {
    for (let i = 0; i < this.length; i++) {
      let component = this[i];
      if (n < component.first) return new Limit(this.n - 1, []);
      if (n < component.getLast()) return component.sublimits[n - component.first];
    }
    return new Limit(this.n - 1, []);
  }

  compose(L1) {

    let L2 = this;
    _assert(L1 instanceof Limit && L2 instanceof Limit);
    _validate(L1, L2);
    _assert(L1.n == L2.n);

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
    let L1_max_source = L1.getMaxSourceHeight();
    let L1_max_target = L1.getMaxTargetHeight();
    let L2_max_source = L2.getMaxSourceHeight();
    let L2_max_target = L2.getMaxTargetHeight();
    let D1_size = L1_max_source;
    if (L2_max_source > L1_max_target) D1_size += L2_max_source - L1_max_target;
    let D2_size = Math.max(L1_max_target, L2_max_source);
    let D3_size = L2_max_target;
    let M1 = L1.getMonotone(D1_size, D2_size);
    let M2 = L2.getMonotone(D2_size, D3_size);
    D3_size = Math.max(D3_size, M2[M2.length - 1] + 1);
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
        _assert(new_source_data);
        let new_sublimit;
        let L1_sublimit = L1_sublimits[D1_level];
        let L2_sublimit = L2_sublimits[D2_level];
        if (L1_sublimit && L2_sublimit) {
          new_sublimit = L2_sublimit.compose(L1_sublimit);
        } else {
          new_sublimit = L1_sublimit || L2_sublimit;
          _assert(new_sublimit);
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
        _assert(D2_preimage.first + 1 == D2_preimage.last);
        target_data = D2_data[D2_preimage.first];
      }
      _assert(target_data);

      let first = D1_preimage.first;
      let component = new LimitComponent(this.n, {first, source_data, target_data, sublimits});
      new_components.push(component);
    }

    let composed = new Limit(this.n, new_components);
    return composed;
  }

  // Remove an element of the target diagram not in the image of this limit
  removeTargetLevel(height) {
    let component_targets = this.getComponentTargets();
    for (let i = 0; i < component_targets.length; i++) {
      if (component_targets[i] == height) {
        let new_components = [...this.splice(0, i), ...this.splice(i+1)];
        return new Limit(this.n, new_components);
      }
    }
    _assert(false); // We didn't find the correct component to remove
  }

  pad(depth) {
    let components = [...this].map(component => component.pad(depth));
    return new Limit(this.n, components);
  }

  deepPad(position) {
    let components = [...this].map(component => component.deepPad(position));
    return new Limit(this.n, components);
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
    _assert(diagram instanceof Diagram);
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

  copy({ components = [...this], n = this.n } = this) {
    return new Limit(n, components);
  }

  getNontrivialNeighbourhoods() {
    return Limit.getNontrivialNeighbourhoodsFamily([this]);
  }

  // Get the neighbourhoods which are nontrivial in the common target diagram of all the provided limits
  static getNontrivialNeighbourhoodsFamily(...limits) {

    _assert(limits instanceof Array);

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
        _assert(limit.length == 1);
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

    _assert(subset instanceof Array);

    // If this is an identity limit the subset is unchanged
    if (this.length == 0) return subset;

    // Identify first and last heights referenced by the subset
    let last_subset_height = null;
    for (let i=0; i<subset.length; i++) {
      if (subset[i] === undefined) continue;
      last_subset_height = i;
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
    let data = this[0].source_data;
    let source = this[0].target_data.forward_limit.reconstructSource();
    return new Diagram(this.n, {data, source});
  }

  // For an atomic limit, find its unique target type
  getUniqueTargetType() {
    if (this.n == 0) return this[0].target_type;
    return this[0].target_data.forward_limit.getUniqueTargetType();
  }

  typecheckBaseCase(forward) {

    // We are promised that 'this' represents a limit with atomic target
    _assert(this.length == 1);

    // In this case we can construct the entire source and target diagrams.

    let source = this.reconstructSource();
    let target;
    if (this.n == 0) {
      target = new Diagram(0, {type: this[0].target_type});
    } else {
      target = new Diagram(this.n, {data: [this[0].target_data], source: source.source});
    }
    let normalization = source.normalize();
    let limit_normalized = this.compose(normalization.embedding);

    // If the normalized limit is an identity, it type checks
    if (limit_normalized.length == 0) return true;

    // If the source has zero height, we must be inserting a homotopy and its inverse
    if (this.n > 0 && source.data.length == 0) {

      let forward = target.data[0].forward_limit;
      let backward = target.data[0].backward_limit;

      // These have to be inverse to each other
      if (!forward.equals(backward)) {
        console.log('Typecheck failed: improper homotopy insertion')
        return false;
      }

      // They have to type check as a homotopy.
      // We can just straight to the base case as the target is atomic.
      return forward.typecheckBaseCase(null);
    }

    // If we haven't been given a forward/backward distinction, then fail
    if (forward === null) return false;
    _assert(typeof forward === 'boolean');

    // It must be a source or target
    let type = this.getUniqueTargetType();
    if (type.n != this.n + 1) {
      console.log("Typecheck failed: singular point has the wrong dimension");
      return false;
    }
    let match_diagram = forward ? type.source : type.target;
    if (!normalization.diagram.equals(match_diagram)) {
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

    _assert(subset instanceof Array);

    // Check top-level range of the subset
    let first_height = null;
    let last_height = null;
    for (let i=0; i<subset.length; i++) {
      if (subset[i] === undefined) continue;
      if (first_height === null) first_height = i;
      last_height = i;
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
      let first = component.first - first_height;

      // Build the new LimitComponent
      let limit_component = new LimitComponent(component.n, { first, source_data, target_data, sublimits });
      components.push(limit_component);
    }

    // Build the new limit
    return new Limit(this.n, components);;
  }

}


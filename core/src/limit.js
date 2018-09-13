import { _validate, _assert, isNatural, _propertylist } from "~/util/debug";
import { Generator } from "~/generator";
import { Diagram } from "~/diagram";
import { Monotone } from "~/monotone";

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
        - forward_limit :: ForwardLimit(n)
        - backward_limit :: BackwardLimit(n)
- ForwardLimit(n) extends Limit(n)
- BackwardLimit(n) extends Limit(n)
- Limit(n) extends Array comprises: (this is a limit between n-diagrams)
    - for all n:
        - Array(LimitComponent(n))
- LimitComponent(n) comprises: (this is a component of a limit between n-diagrams)
    - for n > 0:
        - data :: Array(Content(n-1))
        - first :: Number, the first regular slice affected
        - last :: Number, the last regular slice affected
        - sublimits :: Array(Limit(n-1)) // should be forward/backward?
    - for n == 0:
        - type :: Generator
*/

export class Content {

  constructor(n, forward_limit, backward_limit) {
    this.n = n;
    this.forward_limit = forward_limit;
    this.backward_limit = backward_limit;
    Object.freeze(this);
    _validate(this);
  }

  validate() {
    _assert(!isNaN(this.n));
    _assert(this.forward_limit instanceof ForwardLimit);
    _assert(this.backward_limit instanceof BackwardLimit);
    _assert(this.forward_limit.n == this.n);
    _assert(this.backward_limit.n == this.n);
    _propertylist(this, ["n", "forward_limit", "backward_limit"]);
    _validate(this.forward_limit, this.backward_limit);
  }

  getLastPoint() {
    _assert(false);
  }

  copy({
    forward_limit = this.forward_limit,
    backward_limit = this.backward_limit,
    n = this.n
  } = this) {
    return new Content(n, forward_limit, backward_limit);
  }

  rewrite(source) {
    let singular = this.forward_limit.rewrite(source);
    let target = this.backward_limit.rewrite(singular);
    return target;
  }

  usesCell(generator) {
    return (
      this.forward_limit.usesCell(generator) ||
      this.backward_limit.usesCell(generator)
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

  // Assuming that the content is to act on the specified source, reverse it
  reverse(source) {
    _assert(this.n == source.n);
    let middle = this.forward_limit.rewrite(source);
    let target = this.backward_limit.rewrite(middle);
    let forward_limit = this.backward_limit.getForwardLimit(target, middle);
    let backward_limit = this.forward_limit.getBackwardLimit(source, middle);
    return new Content(this.n, forward_limit, backward_limit);
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
      f_delta -= f[i].last - f[i].first - 1;
    }
    let b_delta = 0;
    for (let i = 0; i < b.length; i++) {
      if (b_analysis[i] >= index) break;
      b_delta += b[i].last - b[i].first - 1;
    }

    // G - Prepare the second new forward limit by selecting only the chosen component, and adjusting first/last
    let f_new_2 = f_old
      ? new ForwardLimit(this.n, [f_old.copy({
        first: f_old.first + f_delta + b_delta,
        last: f_old.last + f_delta + b_delta
      })], null)
      : new ForwardLimit(this.n, [], null);

    // F - Prepare the first new backward limit
    let b_new_1 = b;
    if (b_old) {
      let f_old_delta = f_old ? f_old.last - f_old.first - 1 : 0; // weird f/b mixing here!
      let b_old_delta = b_old ? b_old.last - b_old.first - 1 : 0;

      let components = [...b_new_1];
      components.splice(b_index, 1);
      components = components.map((component, i) => {
        if (i >= b_index) {
          return component.copy({
            first: component.first + f_old_delta - b_old_delta,
            last: component.last + f_old_delta - b_old_delta
          });
        } else {
          return component;
        }
      });

      b_new_1 = b_new_1.copy({ components }); 
    }

    // H - Prepare the second new backward limit

    let b_new_2 = b_old ? new BackwardLimit(this.n, [b_old], null) : new BackwardLimit(this.n, [], null);

    // C - Prepare the first sublimit - tricky as we need the reversed version of f_old
    // OPTIMIZATION: we don't really need to reverse all of f, just f_old
    let f_backward = f.getBackwardLimit(r1, s);
    let sublimit_1 = f_old ? new BackwardLimit(this.n, [f_backward[f_index].copy({
      first: f_backward[f_index].first + f_delta,
      last: f_backward[f_index].last + f_delta
    })], null) : new BackwardLimit(this.n, [], null);
    _validate(sublimit_1);

    // D - Prepare the second sublimit
    let sublimit_2 = b;
    if (b_old) {
      let local_delta = b_old.last - b_old.first - 1;
      let components = [...sublimit_2];
      components.splice(b_index, 1);
      components = components.map((component, index) => {
        if (index > b_index) {
          return component.copy({
            first: component.first - local_delta,
            last: component.last - local_delta
          });
        } else {
          return component;
        }
      });
      sublimit_2 = sublimit_2.copy({ components });
    }
    _validate(sublimit_2);

    _validate(f_new_1, b_new_1, f_new_2, b_new_2);

    // Return the data of the expansion, an array of Content of length 2,
    // and the corresponding sublimits, an array of BackwardLimit of length 2.
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
    if (n == 0) {
      this.type = args.type;
      return this;
    }
    this.data = args.data;
    this.first = args.first;
    this.last = args.last;
    _assert(isNatural(this.first));
    _assert(isNatural(this.last));
    _assert(this.first <= this.last);
    _assert(this.first >= 0 && this.last >= 0);
    this.sublimits = args.sublimits;
    Object.freeze(this);
    _validate(this);
  }

  validate() {
    _assert(isNatural(this.n));
    if (this.n == 0) {
      _propertylist(this, ["n", "type"]);
      _assert(this.type instanceof Generator);
      _validate(this.type);
    } else {
      _propertylist(this, ["n", "data", "first", "last", "sublimits"]);
      _assert(isNatural(this.first));
      _assert(isNatural(this.last));
      _assert(this.first <= this.last);
      _assert(this.data instanceof Array);
      _assert(this.sublimits instanceof Array);
      _assert(this.sublimits.length == this.last - this.first);
      for (let i = 0; i < this.sublimits.length; i++) {
        _assert(this.sublimits[i] instanceof Limit);
        _assert(this.sublimits[i].n == this.n - 1);
        _validate(this.sublimits[i]);
      }
      for (let i = 0; i < this.data.length; i++) {
        _assert(this.data[i] instanceof Content);
        _assert(this.data[i].n == this.n - 1);
        _validate(this.data[i]);
      }
    }
  }

  equals(b) {
    let a = this;
    if (a.first != b.first) return false;
    if (a.last != b.last) return false;
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

  getLastPoint() {
    _assert(false);
    if (this.n == 0) return new Diagram(0, {
      type: this.type
    }); // ???
    return this.data.last().getLastPoint();
    _assert(false); // ... to write ...
  }

  copy({
    first = this.first,
    last = this.last,
    sublimits = this.sublimits,
    data = this.data
  } = {}) {
    _validate(this);

    if (this.n == 0) {
      return new LimitComponent(0, { type: this.type });
    }

    return new LimitComponent(this.n, { data, sublimits, first, last });
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
      let data = this.data;
      let sublimits = this.sublimits;
      let first = this.first + 1;
      let last = this.last + 1;
      return new LimitComponent(this.n, { data, sublimits, first, last });
    } else if (depth > 1) {
      let data = this.data.map(content => content.pad(depth - 1));
      let sublimits = this.sublimits.map(sublimit => sublimit.pad(depth - 1));
      let first = this.first;
      let last = this.last;
      return new LimitComponent(this.n, { data, sublimits, first, last });
    }
  }

  // Pad this component so that the origin moves to the given position
  deepPad(position) {
    _assert(this.n == position.length);
    if (this.n == 0) {
      return this;
    }

    let [height, ...rest] = position;

    let first = this.first + height;
    let last = this.last + height;
    let data = this.data.map(content => content.deepPad(rest));
    let sublimits = this.sublimits.map(limit => limit.deepPad(rest));
    return new LimitComponent(this.n, { data, sublimits, first, last });
  }

  /**
   * This is where the real meat of type checking happens
   */
  typecheck(subdata, target_slice) {
    _assert(this.sublimits.length == subdata.length);
    _assert(this.n == target_slice.n + 1);
    for (let i = 0; i < target_slice.data.length; i++) {
      // Find the preimage of this height
      let sublimit = this.sublimits[i];
      let preimage = sublimit.getTargetHeightPreimage(i);
      // ... unfinished ...
    }
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
      if (i != 0) _assert(this[i].first >= this[i - 1].last);
      this[i].validate();
    }
    if (this.n == 0) _propertylist(this, ["n"]);
    else _propertylist(this, ["n"]);
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
      for (let j = component.first; j < component.last; j++) {
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
      offset += component.last - component.first - 1;
    }
    return singular_classification;
  }

  // For each component, find its target index in the codomain diagram
  getComponentTargets() {
    let component_targets = [];
    let offset = 0;

    for (let component of this) {
      component_targets.push(component.first - offset);
      offset += component.last - component.first - 1;
    }

    return component_targets;
  }

  getTargetComponentIndex(target) {
    let offset = 0;
    for (let i = 0; i < this.length; i++) {
      let component_target = this[i].first - offset;
      if (component_target == target) return i;
      offset += this[i].last - this[i].first - 1;
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
      if (component_target == target) return {
        first: this[i].first,
        last: this[i].last
      };
      offset += this[i].last - this[i].first - 1;
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
          offset += this[i].last - this[i].first - 1;
      }
      return [];
  }
  */
  // Get a sublimit with respect to the indicated range in the target diagram.
  preimage(range, forward) {
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

      let shifted = component.copy({
        first: component.first - offset,
        last: component.last - offset
      });

      _assert(shifted.first >= 0 && shifted.last >= 0);
      _validate(shifted);

      components.push(shifted);
    }

    return forward ? new ForwardLimit(this.n, components) : new BackwardLimit(this.n, components);
  }

  subLimit(n, forward) {
    for (let i = 0; i < this.length; i++) {
      let component = this[i];
      if (n < component.first) return forward ? new ForwardLimit(this.n - 1, [], null) : new BackwardLimit(this.n - 1, [], null);
      if (n < component.last) return component.sublimits[n - component.first];
    }
    return forward ? new ForwardLimit(this.n - 1, [], null) : new BackwardLimit(this.n - 1, [], null);
  }

  compose(first, forward) { // See 2017-ANC-19
    let second = this;
    _assert((typeof forward) === "boolean");
    if (forward) _assert(second instanceof ForwardLimit && first instanceof ForwardLimit);
    if (!forward) _assert(second instanceof BackwardLimit && first instanceof BackwardLimit);
    _validate(first, second);
    _assert(first.n == second.n);

    if (first.length == 0) return second.copy();
    if (second.length == 0) return first.copy();
    if (first.n == 0) return forward ? second.copy() : first.copy();

    let analysis1 = first.getComponentTargets();
    let c1 = 0;
    let c2 = 0;
    let new_components = [];
    let c2_component = { sublimits: [], data: [], first: null, last: null };

    while (c1 < first.length) {
      let target1 = analysis1[c1];

      // If the target of c1 comes before c2, the image of c1 is unaffected by
      // the second limit and hence passes through to the composed limit
      // unchanged.
      // NOTE: For backwards limits the condition should probably take into
      // account the amount of content in the image of c1.
      if (c2 == second.length || target1 < second[c2].first) {
        new_components.push(first[c1]);
        c1++;
        continue;
      }

      // Set the start of the component correctly
      if (c2_component.first == null) {
        c2_component.first = first[c1].first - (target1 - second[c2].first);
        c2_component.last = c2_component.first + (second[c2].last - second[c2].first);
      }

      // Ensure any identity levels that we have skipped are correctly handled
      let height_target = Math.min(first[c1].first, c2_component.last) - c2_component.first;
      while (c2_component.sublimits.length < height_target) {
        let index = c2_component.sublimits.length;
        let second_sublimit = second[c2].sublimits[index];
        c2_component.sublimits.push(second_sublimit);
        if (!forward) {
          let second_data = second[c2].data[index];
          c2_component.data.push(second_data);
        }
      }

      if (target1 < second[c2].last) { // c1 is in the support of c2
        // Add the overlapping levels
        let second_sublimit = second[c2].sublimits[target1 - second[c2].first];
        for (let i = 0; i < first[c1].last - first[c1].first; i++) {
          // For every overlapping level except the first, the new component is getting bigger
          if (i > 0) c2_component.last++;
          let first_sublimit = first[c1].sublimits[i];
          let composed_sublimit = second_sublimit.compose(first_sublimit);
          c2_component.sublimits.push(composed_sublimit);
          //if (!forward) c2_component.data.push(Content.copyData(first[c1].data[i]));
          if (!forward) c2_component.data.push(first[c1].data[i]);
          // DO WE NEED TO UPDATE C2??
        }
        c1++;

        // If this exhausts c2, then finalize it
        //if (target1 == second[c2].last - 1) {
        //if (c1 == first.length || first[c1].first >= second[c2].last) {
        if (c1 == first.length || analysis1[c1] >= second[c2].last) {
          if (forward) c2_component.data = second[c2].data.slice();
          while (c2_component.sublimits.length < c2_component.last - c2_component.first) {
            let index = second[c2].sublimits.length - c2_component.last
              + c2_component.first + c2_component.sublimits.length;
            let second_sublimit = second[c2].sublimits[index];
            c2_component.sublimits.push(second_sublimit);
            if (!forward) c2_component.data.push(second[c2].data[index]);
          }
          new_components.push(new LimitComponent(this.n, c2_component));
          c2_component = { sublimits: [], data: [] };
          c2++;
        }
      } else if (target1 >= second[c2].last) {
        //c2_component.last = c2_component.first + c2_component.sublimits.length;
        if (forward) c2_component.data = second[c2].data.slice();
        new_components.push(new LimitComponent(this.n, c2_component));
        c2_component = { sublimits: [], data: [] };
        c2++;

      } else _assert(false);
    }
    _assert(c1 == first.length);

    // Finish off any unpropagated uppermost components of the second limit
    for (; c2 < second.length; c2++) {
      if (c2_component.first == null) {
        c2_component.first = first[first.length - 1].last + second[c2].first - analysis1[analysis1.length - 1] - 1;
        c2_component.last = c2_component.first + second[c2].last - second[c2].first;
      }
      if (forward) c2_component.data = second[c2].data.slice();
      while (c2_component.sublimits.length < c2_component.last - c2_component.first) {
        let index = c2_component.sublimits.length;
        let second_sublimit = second[c2].sublimits[index];
        c2_component.sublimits.push(second_sublimit);
      }
      if (!forward) c2_component.data = second[c2].data.slice();
      new_components.push(new LimitComponent(this.n, c2_component));
      c2_component = {
        sublimits: []
      };
    }
    if (forward) return new ForwardLimit(this.n, new_components, null);
    else return new BackwardLimit(this.n, new_components, null);
  }

  // Remove a particular level from the source of the limit, assumed to be acted on by a unique component
  removeSourceLevel(height) {
    _assert(isNatural(height));
    for (let i = 0; i < this.length; i++) {
      let component = this[i];
      if (component.first != height || component.last != height + 1) continue;
      // We've found the component
      this.splice(i, 1);
      for (let j = i; j < this.length; j++) {
        this[j].first--;
        this[j].last--;
      }
      return;
    }
    _assert(false); // We didn't match this to any component
  }

  // Remove an element of the target diagram not in the image of this limit
  removeTargetLevel(height) {
    let component_targets = this.getComponentTargets();
    for (let i = 0; i < component_targets.length; i++) {
      if (component_targets[i] == height) {
        this.splice(i, 1);
        return;
      }
    }
    _assert(false); // We didn't find the correct component to remove
  }

  // Typecheck this limit
  typecheck() {
    let component_targets = this.getComponentTargets();
    for (let i = 0; i < this.length; i++) {
      if (!this[i].typecheck()) return false;
    }
    return true;
  }

}

export class ForwardLimit extends Limit {

  constructor(n, components) {
    super(n, components);
    if (n == 0) {
      _assert(this.length <= 1);
    }
    Object.freeze(this);
    _validate(this);
  }
  /*
      splice(...args) {
          return super.splice(...args);
      }
      */

  pad(depth) {
    let components = [...this].map(component => component.pad(depth));
    return new ForwardLimit(this.n, components);
  }

  deepPad(position) {
    let components = [...this].map(component => component.deepPad(position));
    return new ForwardLimit(this.n, components);
  }

  validate() {
    super.validate();
    for (let i = 0; i < this.length; i++) {
      _assert(this.n == 0 || this[i].data.length == 1);
    }
  }

  rewrite(diagram) {
    if (this.n == 0) {
      return new Diagram(0, { type: this[0].type });
    }

    let data = diagram.data.slice();
    for (let i = this.length - 1; i >= 0; i--) {
      let c = this[i];
      data.splice(c.first, c.last - c.first, c.data[0]);
    }
    return new Diagram(diagram.n, { source: diagram.source, data });
  }

  copy({
    components = [...this],
    n = this.n,
  } = this) {
    return new ForwardLimit(n, components);
  }

  compose(second) {
    return super.compose(second, true);
  }

  subLimit(n) {
    return super.subLimit(n, true);
  }

  preimage(range) {
    return super.preimage(range, true);
  }

  // Supposing this limit goes from source to target, construct the equivalent backward limit.
  getBackwardLimit(source, target) {
    _assert(source instanceof Diagram && target instanceof Diagram);
    _validate(source, target);
    _assert(source.n == this.n);
    _assert(target.n == this.n);
    if (this.n == 0) {
      if (this.length == 0) return new BackwardLimit(0, []);
      else return new BackwardLimit(0, [new LimitComponent(0, { type: source.type })]);
    }
    let new_components = [];
    let monotone = this.getMonotone(source.data.length, target.data.length);
    for (let i = 0; i < this.length; i++) {
      let component = this[i];
      let sublimits = [];

      let data = [];
      if (component.first < component.last) {
        let slice_target = target.getSlice({
          height: monotone[component.first],
          regular: false
        });
        for (let j = component.first; j < component.last; j++) {
          let slice_source = source.getSlice({
            height: j,
            regular: false
          });
          sublimits.push(component.sublimits[j - component.first].getBackwardLimit(slice_source, slice_target));
          data.push(source.data[j].copy());
        }
      }
      let first = component.first;
      let last = component.last;
      new_components.push(new LimitComponent(this.n, {
        first,
        last,
        data,
        sublimits
      }));
    }
    return new BackwardLimit(this.n, new_components, null);
  }
}

export class BackwardLimit extends Limit {
  constructor(n, components) {
    if (components === undefined) return super(n);
    super(n, components);
    _validate(this);
    Object.freeze(this);
    //return super(n, components); // call the Limit constructor
  }

  validate() {
    super.validate();
    for (let i = 0; i < this.length; i++) {
      if (this.n > 0) _assert(this[i].sublimits.length == this[i].data.length);
    }
  }

  rewrite(diagram) {
    _assert(diagram instanceof Diagram);
    _validate(this, diagram);
    if (diagram.n == 0) {
      return new Diagram(0, { type: this[0].type });
    }

    let offset = 0;
    let data = diagram.data.slice();
    for (let i = 0; i < this.length; i++) {
      let c = this[i];
      let before = data.slice(0, c.first);
      let after = data.slice(c.first + 1, diagram.data.length);
      data = [...before, ...c.data, ...after];
      //diagram.data = diagram.data.slice(0, c.first + offset).concat(c.data.concat(diagram.data.slice(c.first + offset + 1, diagram.data.length)));
      //offset += c.last - c.first - 1;
    }
    return new Diagram(diagram.n, { source: diagram.source, data });
  }

  copy({ n = this.n, components = [...this] } = this) {
    return new BackwardLimit(n, components);
  }

  compose(second) {
    return super.compose(second, false);
  }

  subLimit(n) {
    return super.subLimit(n, false);
  }

  preimage(range) {
    return super.preimage(range, false);
  }

  pad(depth) {
    let components = [...this].map(component => component.pad(depth));
    return new BackwardLimit(this.n, components);
  }

  deepPad(position) {
    let components = [...this].map(component => component.deepPad(position));
    return new BackwardLimit(this.n, components);
  }

  // Supposing this limit goes from source to target, construct the equivalent backward limit.
  getForwardLimit(source, target) {
    _assert(source instanceof Diagram && target instanceof Diagram);
    _validate(this, source, target);
    _assert(source.n == this.n);
    _assert(target.n == this.n);
    if (this.n == 0) {
      if (this.length == 0) {
        return new ForwardLimit(0, []);
      } else {
        return new ForwardLimit(0, [new LimitComponent(0, { type: target.type })]);
      }
    }
    let new_components = [];
    let monotone = this.getMonotone(source.data.length, target.data.length);
    let offset = 0;
    for (let i = 0; i < this.length; i++) {
      let component = this[i];
      let sublimits = [];
      let target_slice_index = component.first - offset; //monotone[component.first];
      offset += component.last - component.first - 1;
      let slice_target = target.getSlice({ height: target_slice_index, regular: false });
      for (let j = component.first; j < component.last; j++) {
        let slice_source = source.getSlice({ height: j, regular: false });
        sublimits.push(component.sublimits[j - component.first].getForwardLimit(slice_source, slice_target));
      }
      let data = [target.data[target_slice_index].copy()];
      let first = component.first;
      let last = component.last;
      new_components.push(new LimitComponent(this.n, { first, last, data, sublimits }));
    }
    return new ForwardLimit(this.n, new_components, null);
  }
}
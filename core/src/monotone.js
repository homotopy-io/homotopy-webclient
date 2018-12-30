import { _assert, _debug, _validate, isNatural, _propertylist } from "~/util/debug";
import { DirectedQuotientGraph } from "~/directed_graph";

export class Monotone extends Array {

  constructor(target_size, values) {
    super();
    for (let i = 0; i < values.length; i++) {
      this[i] = values[i];
    }
    this.target_size = target_size;
    _validate(this);
  }

  validate() {
    if (!_debug) return;
    if (_debug) _assert(isNatural(this.target_size));
    for (let i = 0; i < this.length; i++) {
      if (_debug) _assert(isNatural(this[i]));
      if (i > 0) _assert(this[i - 1] <= this[i]);
    }
    if (this.length > 0) _assert(this.target_size > this[this.length - 1]);
  }

  static test() {
    Monotone.multiUnify_test();
  }

  static getIdentity(n) {
    let m = new Monotone(0, []);
    for (let i = 0; i < n; i++) {
      m.grow();
    }
    return m;
  }

  grow() {
    this.push(this.target_size);
    this.target_size++;
  }

  append(value) {
    this.push(value);
    this.target_size = value + 1;
  }

  compose(second) {
    if (_debug) _assert(second instanceof Monotone);
    let copy_second = second.copy();
    copy_second.target_size = this.target_size;
    for (let i = 0; i < second.length; i++) {
      copy_second[i] = this[second[i]];
    }
    return copy_second;
  }

  equals(second, n) {
    if (n == null) n = this.length;
    let first = this;
    if (first.length != second.length) return false;
    if (first.target_size != second.target_size) return false;
    for (let i = 0; i < n; i++) {
      if (first[i] != second[i]) return false;
    }
    return true;
  }

  imageComplement() {
    let n = 0;
    let complement = [];
    for (let i = 0; i < this.target_size; i++) {
      if (n == this.length || this[n] > i) complement.push(i);
      else n++;
    }
    return complement;
  }

  static union(first, second, swap) {
    let i1_array = [];
    for (let i = 0; i < first; i++) i1_array.push(i);
    let i2_array = [];
    for (let i = 0; i < second; i++) i2_array.push(first + i);
    let data = {
      first: new Monotone(first + second, i1_array),
      second: new Monotone(first + second, i2_array)
    };
    if (swap) return {
      first: data.second,
      second: data.first
    };
    return data;
  }

  // Unify with a second monotone, with the indicated tendency to the right if specified. Throws exception on failure.
  unify({ second, right }, n) {
    let first = this;
    if (_debug) _assert(second instanceof Monotone);
    if (_debug) _assert(first.length == second.length);
    if (_debug) _assert(typeof(right) == "number" && right >= -1 && right <= 1);
    if (_debug) _assert(n == null || isNatural(n));
    if (n == null) {
      /*
      if (first.length == 0) {
          if (first.target_size > 0 && second.target_size > 0) {
              if (right == null) throw "no monotone unification";
              else if (right == false) return Monotone.union(first.target_size, second.target_size);
              else return Monotone.union(second.target_size, first.target_size, true);
          }
          else if (first.target_size == 0) return { first: second.copy(), second: Monotone.getIdentity(second.target_size) };
          else if (second.target_size == 0) return { first: Monotone.getIdentity(first.target_size), second: first.copy() };
          else _assert(false); // Above cases should be exclusive
      }
      */
      //return this.unify({ second, right, depth: first.length }); // begin the induction
      n = first.length + 1; // add an extra element for a 'tidying up' pass
    }

    // Base case
    if (n == 0) return {
      first: new Monotone(0, []),
      second: new Monotone(0, [])
    }; // base case

    // Recursive case
    let injections = this.unify({ second, right }, n - 1);
    if (_debug) _assert(injections.first instanceof Monotone);
    if (_debug) _assert(injections.second instanceof Monotone);
    if (_debug) _assert(injections.first.target_size == injections.second.target_size);
    let left_delta = (n > first.length ? first.target_size : first[n - 1]) + (n == 1 ? 1 : -first[n - 2]);
    let right_delta = (n > first.length ? second.target_size : second[n - 1]) + (n == 1 ? 1 : -second[n - 2]);
    /*
    let left_delta = first[n-1] + (n == 1 ? 1 : -first[n - 2]);
    let right_delta = second[n - 1] + (n == 1 ? 1 : -second[n - 2]);
    */
    if (left_delta > 1 && right_delta > 1) {

      // Iterate through the elements to be ordered
      let left_start = (n == 1) ? 0 : (first[n - 2] + 1);
      let right_start = (n == 1) ? 0 : (first[n - 2] + 1);
      let left_done = 0;
      let right_done = 0;
      while (left_done < left_delta - 1 || right_done < right_delta - 1) {
        let preference; // negative for left, zero for both, positive for right
        let left_pos = left_start + left_done;
        let right_pos = right_start + right_done;
        if (right != 0) {
          if (left_done == left_delta - 1) preference = +1;
          else if (right_done == right_delta - 1) preference = -1;
          else preference = right;// ? 1 : -1;
        } else return { error: "no monotone unification at depth " + n + ", cannot unify head-to-head monotones without a bias" };

        if (preference < 0) {
          injections.first.grow();
          injections.second.target_size++;
          left_done++;
        } else if (preference == 0) {} else { // preference > 0
          injections.second.grow();
          injections.first.target_size++;
          right_done++;
        }
      }

      if (n <= first.length) {
        let t = injections.first.target_size;
        injections.first.append(t);
        injections.second.append(t);
      }

      /*
      // If we haven't been given a tendency, fail
      if (right == null) throw "no monotone unification at depth " + depth + ", cannot unify head-to-head monotones without a bias";
      let major = right ? { monotone: injections.second, delta: right_delta } : { monotone: injections.first, delta: left_delta };
      let minor = right ? { monotone: injections.first, delta: left_delta } : { monotone: injections.second, delta: right_delta };
      for (let i = 0; i < major.delta - 1; i++) major.monotone.grow();
      minor.monotone.target_size += major.delta - 1;
      for (let i = 0; i < minor.delta - 1; i++) minor.monotone.grow();
      major.monotone.target_size = minor.monotone.target_size;
      let t = injections.first.target_size;
      injections.first.append(t);
      injections.second.append(t);
      */

    } else if (left_delta == 0 || right_delta == 0) {

      let t = injections.first.target_size;
      while (injections.first.length <= first[n - 1]) injections.first.push(t - 1);
      while (injections.second.length <= second[n - 1]) injections.second.push(t - 1);

    } else { // deltas (1,>1) or (>1,1)

      // fibre analysis at 2018-2-ANC-30
      for (let i = 0; i < left_delta - 1; i++) {
        injections.first.grow();
      }
      for (let i = 0; i < right_delta - 1; i++) {
        injections.second.grow();
      }
      let t = (left_delta > 1 ? injections.first.target_size : injections.second.target_size);
      if (n <= first.length) {
        injections.first.append(t);
        injections.second.append(t);
      } else {
        injections.first.target_size = t;
        injections.second.target_size = t;
      }

    }

    if (_debug) {

      if (n == first.length + 1) {

        // Perform final consistency checks
        _assert(injections.first.length == first.target_size);
        _assert(injections.second.length == second.target_size);
        _assert(injections.first.target_size == injections.second.target_size);
        _assert(injections.first.compose(first).equals(injections.second.compose(second)));

      }

    }

    return injections;
  }

  copy() {
    let m = new Monotone(this.target_size, []);
    for (let i = 0; i < this.length; i++) m[i] = this[i];
    return m;
  }

  getFirstPreimage(value) {
    for (let i = 0; i < this.length; i++) {
      if (this[i] == value) return i;
    }
    return null;
  }

  getLastPreimage(value) {
    for (let i = this.length - 1; i >= 0; i--) {
      if (this[i] == value) return i;
    }
    return null;
  }

  preimage(value) {
    if (!isNatural(value)) {
      _propertylist(value, ["first", "last"]);
    }
    let min, max;
    if (isNatural(value)) {
      min = value;
      max = value + 1;
    } else {
      min = value.first;
      max = value.last;
    }
    let first = null;
    let last = null;
    let pos = 0;
    while (this[pos] < min) pos++;
    first = pos;
    while (pos < this.length && this[pos] < max) pos++;
    last = pos;
    return { first, last };
  }

  static identity(n) {
    if (_debug) _assert(isNatural(n));
    let arr = [];
    for (let i = 0; i < n; i++) {
      arr.push(i);
    }
    return new Monotone(n, arr);
  }

  // Coequalize two monotones, cannot fail. NOT USED.
  static coequalize(M1, M2, n) { // n is recursive parameter
    if (_debug) _assert(M1 instanceof Monotone && M2 instanceof Monotone);
    if (_debug) _assert(M1.target_size == M2.target_size);
    if (_debug) _assert(M1.length == M2.length);
    if (n == null) n = M1.length;

    // Base case
    if (n == 0) return Monotone.identity(M1.target_size);

    // Recursive case
    let c = Monotone.coequalize(M1, M2, n - 1);

    let v1 = M1[n - 1];
    let v2 = M2[n - 1];
    let min = Math.min(v1, v2);
    let max = Math.max(v1, v2);

    // In c, contract everything in this range
    let delta = c[max] - c[min];
    for (let i = c[min] + 1; i < c[max]; i++) {
      c[i] = c[min];
    }
    for (let i = c[max]; i < c.length; i++) {
      c[i] -= delta;
    }
    c.target_size -= delta;

    if (_debug) _assert(c.compose(M1).equals(c.compose(M2), n));
    return c;
  }

  static multiUnify_test() {
    let result = Monotone.multiUnify({
      lower: [{
        left: {
          target: 0,
          monotone: new Monotone(3, [0, 2])
        },
        right: {
          target: 1,
          monotone: new Monotone(4, [0, 1])
        }
      }],
      upper: [3, 4]
    });
    if (_debug) _assert(result[0].equals(new Monotone(5, [0, 1, 2])) && result[1].equals(new Monotone(5, [0, 2, 3, 4])));

    let result2 = Monotone.multiUnify({
      lower: [{
        left: {
          target: 0,
          monotone: new Monotone(2, [0])
        },
        right: {
          target: 1,
          monotone: new Monotone(2, [1])
        }
      }, {
        left: {
          target: 0,
          monotone: new Monotone(2, [1])
        },
        right: {
          target: 1,
          monotone: new Monotone(2, [0])
        }
      }],
      upper: [2, 2]
    });
    if (_debug) _assert(result2[0].equals(new Monotone(1, [0, 0])) && result2[1].equals(new Monotone(1, [0, 0])));
  }

  static multiUnify_singlePass({ lower_included, upper_included, lower, upper, cocone }) {

    let changed = false;
    for (let i = 0; i < lower.length; i++) {

      // If this part has already been included, skip it
      if (lower_included[i]) continue;

      let lower_length = lower[i].left.monotone.length;

      let left_inc = upper_included[lower[i].left.target];
      let right_inc = upper_included[lower[i].right.target];

      // If we're unbiased and neither upper target is included, handle this component later, as it's disconnected
      if (!left_inc && !right_inc) continue;

      // If the source monotone is empty, handle later unless both targets are included
      if ((lower[i].bias == 0) && lower_length == 0 && (!left_inc || !right_inc)) continue;

      if (left_inc && right_inc) { // If both upper targets are included, then glue in the lower object
        Monotone.multiUnify_glueLower({ i, lower_included, upper_included, lower, upper, cocone });
      } else { // Only one upper target is included, so glue the other one in with respect to the base.
        if (left_inc) {
          //let bias_new = (lower[i].bias == null ? null : (lower[i].bias ? true : false)); // can be simplified
          let bias_new = lower[i].bias == 0 ? 1 : lower[i].bias; // bias is helpful as it lets us temporarily resolve local conflicts
          //if (bias_new != null) debugger;
          Monotone.multiUnify_glueBoth({ lower, upper, cocone, new_data: lower[i].right, old_data: lower[i].left, bias_new });
        } else {
          //let bias_new = (lower[i].bias == null ? null : (lower[i].bias ? false : true)); // can be simplified
          let bias_new = lower[i].bias == 0 ? -1 : -lower[i].bias;
          //if (bias_new != null) debugger;
          Monotone.multiUnify_glueBoth({ lower, upper, cocone, new_data: lower[i].left, old_data: lower[i].right, bias_new });
        }
      }
      lower_included[i] = true;
      upper_included[lower[i].left.target] = true;
      upper_included[lower[i].right.target] = true;
      changed = true;
    }

    return changed;
  }

  // Glue in new_data with respect to old_data
  static multiUnify_glueBoth({ lower, upper, cocone, new_data, old_data, bias_new }) {

    // Get the pushout of the old data with the new data
    let leg_1 = cocone[old_data.target].compose(old_data.monotone);
    let leg_2 = new_data.monotone;
    let pushout = leg_1.unify({ second: leg_2, right: bias_new });

    // Compose this pushout with existing cocone data
    for (let k = 0; k < upper.length; k++) {
      if (cocone[k] == null) continue;
      cocone[k] = pushout.first.compose(cocone[k]);
    }

    // Add new cocone
    cocone[new_data.target] = pushout.second;
  }

  static multiUnify_glueLower({ i, lower_included, upper_included, lower, upper, cocone }) {
    let base = lower[i];
    for (let j = 0; j < base.left.monotone.length; j++) {
      let left_element = cocone[base.left.target][base.left.monotone[j]];
      let right_element = cocone[base.right.target][base.right.monotone[j]];
      if (left_element == right_element) continue;
      let collapse = Monotone.getCollapseMonotone(cocone[base.left.target].target_size, left_element, right_element);
      for (let k = 0; k < upper.length; k++) {
        if (cocone[k] == null) continue;
        cocone[k] = collapse.compose(cocone[k]);
      }
      if (_debug) _assert(cocone[base.left.target][base.left.monotone[j]] == cocone[base.right.target][base.right.monotone[j]]);
    }
  }

  // Buid a collapsing monotone that identifies the elements first and last
  static getCollapseMonotone(target_size, a, b) {
    if (a == b) return Monotone.getIdentity(target_size);
    let first = Math.min(a, b);
    let last = Math.max(a, b);
    let arr = [];
    for (let i = 0; i < first; i++) {
      arr.push(i);
    }
    for (let i = first; i <= last; i++) {
      arr.push(first);
    }
    for (let i = last + 1; i < target_size; i++) {
      arr.push(i - last + first);
    }
    return new Monotone(target_size - last + first, arr);
  }

  static pullbackFactorize(pullback, f, g) {
    if (_debug) _assert(f.length == g.length);
    if (_debug) _assert(pullback);
    if (_debug) _assert(pullback.left);
    if (_debug) _assert(pullback.right);
    if (_debug) _assert(pullback.left.length == pullback.right.length);
    let factorization = [];
    let p = 0;
    for (let i=0; i<f.length; i++) {
      while (pullback.left[p] != f[i] || pullback.right[p] != g[i]) {
        p ++;
        if (p >= pullback.left.length) return null;
        if (pullback.left[p] > f[i]) return null;
        if (pullback.right[p] > g[i]) return null;
      }
      factorization.push(p);
    }
    return new Monotone(pullback.left.length, factorization);
  }

  // If this monotone represents the forward function of singular levels,
  // build the adjoint, which represents the backward function of regular levels
  getAdjoint() {
    let regular = [];
    let level = 0;
    for (let i=0; i<=this.target_size; i++) {
      while (level < this.length && this[level] < i) {
        level ++;
      }
      regular.push(level);
    }
    return new Monotone(this.length + 1, regular);
  }

  static multiUnify({ lower, upper }) {

    // Build a graph from unions of the upper monotones
    let g = new DirectedQuotientGraph();
    let upper_elements = [];
    let x = 0;
    for (let i=0; i<upper.length; i++) {
      let upper_list = [];
      for (let j=0; j<upper[i].size; j++) {
        upper_list.push(x);
        x++;
      }
      upper_elements.push(upper_list);
      g.addLinearGraph(upper_list, upper[i].bias_left);
    }

    // Quotient by the data of the lower monotones
    for (let i=0; i<lower.length; i++) {
      let left = lower[i].left;
      let right = lower[i].right;
      if (_debug) _assert(left.monotone.length == right.monotone.length);
      for (let j=0; j<left.monotone.length; j++) {
        let left_label = upper_elements[left.target][left.monotone[j]];
        let right_label = upper_elements[right.target][right.monotone[j]];
        g.quotient(left_label, right_label);
      }
    }

    // Transitively close it
    g.transitiveClosure();

    // Skeletalize it
    g.acyclicQuotient();

    // Get the resulting linear order
    let order = g.getLinearOrder();

    // If it wasn't linearly orderable, fail
    //if (!order) return null;

    // Build the cocones, which should be monotones
    let size = g.getNumNodes();
    let monotones = [];
    for (let i=0; i<upper.length; i++) {
      let arr = [];
      for (let j=0; j<upper[i].size; j++) {
        arr.push(order.get(upper_elements[i][j]));
      }
      monotones.push(new Monotone(size, arr));
    }

    // Return the cocone maps
    return monotones;
  }

}

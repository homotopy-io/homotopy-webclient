import { _validate, _assert, _debug, isNatural, isInteger, _propertylist } from "~/util/debug";
import { Generator } from "~/generator";
import { Diagram } from "~/diagram";
import { Monotone } from "~/monotone";
import { Simplex } from "~/simplices"
import * as ArrayUtil from "~/util/array";

/*
  _t codes: D  Diagram
                C  Content
                L  Limit
                I  LimitComponent
                G  Generator
*/

/*
- Diagram(n) comprises:
    - t :: Number, the dimension of the signature over which it is defined
    - n > 0:
        - source :: Diagram(n-1)
        - data :: Array(Content(n-1))
    - n == 0:
        - id :: String // Makes no sense to have an array here
- Content(n) comprises:
    - for all n:
        - forward_limit :: Limit(n)
        - backward_limit :: Limit(n)
- Limit(n) comprises: (this is a limit between n-diagrams)
    - for all n:
        - components :: Array(LimitComponent(n)), the list of nontrivial components
        - source_size :: N, the height of the source of the limit (only for n>0 and array.length>0)
- LimitComponent(n) comprises: (this is a component of a limit between n-diagrams)
    - for n > 0:
        - source_data :: Array(Content(n-1))
        - target_data :: Content(n-1)
        - sublimits :: Array(Limit(n-1))
        - first :: Natural, the first regular position that this affects
    - for n == 0:
        - source_id
        - target_id
*/

export class Content {

  constructor(args) {
    if (args.bare) return this;
    this.n = args.n;
    this.forward_limit = args.forward_limit;
    this.backward_limit = args.backward_limit;
    this._t = 'C';
    if (_debug) _assert(isNatural(this.n));
    if (_debug) _assert(this.n >= 0);
    if (_debug) _assert(this.forward_limit instanceof Limit);
    if (_debug) _assert(this.backward_limit instanceof Limit);
    if (_debug) _assert(this.forward_limit.n == this.n);
    if (_debug) _assert(this.backward_limit.n == this.n);
    //Object.freeze(this);
    _validate(this);
  }

  static makeContentArray(array, n) {
    if (_debug) {
      _assert(Array.isArray(array));
      _assert(isNatural(n));
    }
    if (array._t) {
      if (_debug) {
        _assert(array._t === 'C');
        _assert(array.n === n);
      }
      return array;
    }
    let new_array = array.slice();
    new_array._t = 'C';
    new_array.n = n;
    return new_array;
  }

  /*
  static postRehydrate(content, generators) {
    let forward_limit = Limit.rehypostRehydratedrate(content.forward_limit, generators);
    let backward_limit = Limit.postRehydrate(content.backward_limit, generators);
    return new Content({ n: content.n, forward_limit, backward_limit });
  }
  */

 lexicographicSort(b, positions, substitutions) {
    
  let a = this;
  //_assert(b instanceof Content);
  //_assert(a.n == b.n);

  // Sort by dimension
  //if (a.n != b.n) return a.n - b.n;

  // Sort by forward_limit
  let a_f_index = positions.get(substitutions.get(a.forward_limit));
  let b_f_index = positions.get(substitutions.get(b.forward_limit));
  //_assert(isNatural(a_f_index) && isNatural(b_f_index));
  if (a_f_index != b_f_index) return a_f_index - b_f_index;

  // Sort by backward_limit
  let a_b_index = positions.get(substitutions.get(a.backward_limit));
  let b_b_index = positions.get(substitutions.get(b.backward_limit));
  //_assert(isNatural(a_b_index) && isNatural(b_b_index));
  if (a_b_index != b_b_index) return a_b_index - b_b_index;

  // They are equal
  return 0;

}

toJSON() {
    return {
      forward_limit: this.forward_limit.toJSON(),
      backward_limit: this.backward_limit.toJSON(),
      n: this.n,
      _t: 'Content'
    };
  }

  toMinimalJSON() {
    return {
      forward_limit: this.forward_limit.toMinimalJSON(true),
      backward_limit: this.backward_limit.toMinimalJSON(false),
      n: this.n,
      _t: 'MinimalContent'
    };
  }

  static fromMinimal(args, minimal_level) {
    if (_debug) {      
      _assert(args.forward_limit);
      _assert(args.backward_limit);
      _assert(isNatural(args.n));
      _assert(minimal_level instanceof Diagram);
    }

    let forward_limit = Limit.fromMinimal(args.forward_limit, true, minimal_level);
    let singular_level = forward_limit.rewrite_forward(minimal_level);
    let backward_limit = Limit.fromMinimal(args.backward_limit, false, singular_level)
    let n = args.n;

    return new Content({ n, forward_limit, backward_limit });
  }

  validate() {
    _propertylist(this, ["n", "forward_limit", "backward_limit"], ["_t"]);
    _validate(this.forward_limit, this.backward_limit);
  }

  getLastPoint() {
    if (_debug) _assert(false);
  }

  copy({forward_limit = this.forward_limit, backward_limit = this.backward_limit, n = this.n} = this) {
    return new Content({ n, forward_limit, backward_limit });
  }

  rewrite(source) {
    let singular = this.forward_limit.rewrite_forward(source);
    let target = this.backward_limit.rewrite_backward(singular);
    return target;
  }

  usesId(id) {
    return (this.forward_limit.usesId(id) || this.backward_limit.usesId(id));
  }

  pad(depth, source_boundary) {
    let forward_limit = this.forward_limit.pad(depth, source_boundary);
    let backward_limit = this.backward_limit.pad(depth, source_boundary);
    return new Content({ n: this.n, forward_limit, backward_limit });
  }

  // Pad the content so that the origin moves to the specified position
  deepPad(position, width_deltas) {
    let forward_limit = this.forward_limit.deepPad(position, width_deltas);
    let backward_limit = this.backward_limit.deepPad(position, width_deltas);
    return new Content({ n: this.n, forward_limit, backward_limit });
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
    return new Content({ n: this.n, forward_limit: this.backward_limit, backward_limit: this.forward_limit });
  }

  typecheck(generators, source) {
    if (_debug) {
      _assert(source instanceof Diagram);
      _assert(generators);
    }

    // Find the nontrivial neighbourhoods
    let neighbourhoods = Limit.getNontrivialNeighbourhoodsFamily([this.forward_limit, this.backward_limit]);

    // Explode the neighbourhoods
    let exploded = Limit.explodeSubset(neighbourhoods);

    // Typecheck each neighbourhood
    for (let i=0; i<exploded.length; i++) {
      let forward_limit = this.forward_limit.restrictToPreimage(exploded[i]);
      let backward_limit = this.backward_limit.restrictToPreimage(exploded[i]);
      let restricted_content = new Content({ n: this.n, forward_limit, backward_limit });
      let source_subset = this.forward_limit.pullbackSubset(exploded[i]);
      let restricted_source = source.restrictToSubset(source_subset);
      if (!restricted_content.typecheckBaseCase(generators, restricted_source)) {
        return false;
      }
    }

    // The content typechecks
    return true;
  }

  // Typecheck this content, assuming the source is already typechecked
  typecheckBaseCase(generators, source) {

    let f = this.forward_limit;
    let b = this.backward_limit;

    // If this content is the identity, it type checks
    if (f.components.length == 0 && b.components.length == 0) return true;

    // We are promised that 'this' represents a content object with unique central nontrivial singular data
    if (_debug) _assert(f.components.length <= 1 && b.components.length <= 1);
    if (_debug) _assert(f.components.length > 0 || b.components.length > 0);

    // Turn it into a diagram object
    //let source = f.reconstructSource();
    let diagram = new Diagram({ n: this.n + 1, source, data: [this] });

    // Typecheck the target of this diagram
    if (!diagram.getTarget().typecheck(generators)) {
      return false;
    }

    // Normalize the diagram at its regular levels
    //let normalized = diagram.normalizeWithBoundaries();
    let regular_normalized = diagram.normalizeRegular();

    // *** singular normalization ***
    let singular_normalized = regular_normalized.normalizeSingular();

    return singular_normalized.diagram.typecheckBaseCase(generators);
  }

/*
  composeAtBoundary({ type, limit }) {
    let forward_limit = this.forward_limit.composeAtBoundary({ type, limit });
    let backward_limit = this.backward_limit.composeAtBoundary({ type, limit });
    return new Content({ n: this.n, forward_limit, backward_limit });
  }
*/

  composeAtRegularLevel({ height, limit }) {
    let forward_limit = this.forward_limit.composeAtRegularLevel({ height, limit });
    let backward_limit = this.backward_limit.composeAtRegularLevel({ height, limit });
    return new Content({ n: this.n, forward_limit, backward_limit });
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

    let f_old = f_index < 0 ? null : f.components[f_index];
    let b_old = b_index < 0 ? null : b.components[b_index];
    if (_debug) _assert(f_old || b_old);
    if (_debug) _assert(f.components.length > 0 || b.components.length > 0);

    // The only failure case is if there is only a single component
    if (f.components.length == 0 && b.components.length == 1) return { error: "Can't expand a single component" };
    if (f.components.length == 1 && b.components.length == 0) return { error: "Can't expand a single component" };
    if (f.components.length == 1 && b.components.length == 1 && f_old && b_old) return { error: "can't expand a single component" };

    // E - Prepare the first new forward limit by deleting the chosen component
    let f_new_1 = f;
    if (f_index >= 0) {
      let components = [...f_new_1.components];
      components.splice(f_index, 1);
      f_new_1 = f_new_1.copy({ components });
    }

    // Compute delta offset
    let f_delta = 0;
    for (let i = 0; i < f.components.length; i++) {
      if (f_analysis[i] >= index) break;
      f_delta -= f.components[i].getLast() - f.components[i].first - 1;
    }
    let b_delta = 0;
    for (let i = 0; i < b.components.length; i++) {
      if (b_analysis[i] >= index) break;
      b_delta += b.components[i].getLast() - b.components[i].first - 1;
    }

    // G - Prepare the second new forward limit by selecting only the chosen component, and adjusting first/last
    let middle_regular_size = r2.data.length
      - (b_old ? b_old.source_data.length - 1 : 0)
      + (f_old ? f_old.source_data.length - 1 : 0);
    let f_new_2;
    if (f_old) {
      f_new_2 = new Limit({ n: this.n, components: [f_old.copy({first: f_old.first + f_delta + b_delta})], source_size: middle_regular_size });
    } else {
      f_new_2 = new Limit({ n: this.n, components: [], source_size: middle_regular_size });
    }

    // F - Prepare the first new backward limit
    let b_new_1 = b;
    /*if (b_old)*/ {
      let f_old_delta = f_old ? f_old.getLast() - f_old.first - 1 : 0;
      let b_old_delta = b_old ? b_old.getLast() - b_old.first - 1 : 0;

      let components = [...b_new_1.components];
      for (let k=0; k<components.length; k++) {
        if (b_analysis[k] > index) {
          components[k] = components[k].copy({first: components[k].first + f_old_delta - b_old_delta});
        }
      }


/*
      components = components.map((component, i) => {
        //if (i >= b_index) {
        if (b_analysis[i] > index) {
          return component.copy({first: component.first + f_old_delta - b_old_delta});
        } else return component;
      });
      */
      if (b_index >= 0) components.splice(b_index, 1);

      b_new_1 = b_new_1.copy({ components, source_size: middle_regular_size }); 
    }
    /* else {
      b_new_1 = b_new_1.copy({source_size: middle_regular_size});
    }*/

    // H - Prepare the second new backward limit
    let b_new_2 = b_old
      ? new Limit({ n: this.n, components: [b_old], source_size: r2.data.length })
      : new Limit({ n: this.n, components: [], source_size: r2.data.length });

    // C - Prepare the first sublimit - tricky as we need the reversed version of f_old
    // OPTIMIZATION? we don't really need to reverse all of f, just f_old
    let sublimit_1;
    let first_singular_size = s.data.length + (f_old ? f_old.source_data.length - 1 : 0);
    if (f_old) {
      sublimit_1 = new Limit({ n: this.n, components: [f.components[f_index].copy({ first: f.components[f_index].first + f_delta })], source_size: first_singular_size });
    } else {
      sublimit_1 = new Limit({ n: this.n, components: [], source_size: first_singular_size });
    }
    _validate(sublimit_1);

    // D - Prepare the second sublimit
    let second_singular_size = r2.data.length - (b_old ? b_old.source_data.length - 1 : 0);
    let sublimit_2 = b;
    if (b_old) {
      let local_delta = b_old.getLast() - b_old.first - 1;
      let components = [...sublimit_2.components];
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

    if (b_new_1.components.length > 0 && f_new_2.components.length > 0) {
      if (_debug) _assert(b_new_1.source_size == f_new_2.source_size);
    }
    // Return the data of the expansion, an array of Content of length 2,
    // and the corresponding sublimits, an array of Limit of length 2.
    return {
      data: [
        new Content({ n: this.n, forward_limit: f_new_1, backward_limit: b_new_1 }),
        new Content({ n: this.n, forward_limit: f_new_2, backward_limit: b_new_2 })],
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

  constructor(args) {
    if (args.bare) return this;
    this.n = args.n;
    this._t = 'I';
    if (_debug) _assert(isNatural(this.n));
    if (_debug) _assert(this.n >= 0);
    if (this.n == 0) {
      this.source_id = args.source_id;
      this.target_id = args.target_id;
      if (_debug) {
        _assert(typeof this.source_id === 'string');
        _assert(typeof this.target_id === 'string');
        _assert(this.source_id != this.target_id);
        // Should also have a dimension check
      }
      return this;
    }
    this.source_data = Content.makeContentArray(args.source_data, this.n);
    this.target_data = args.target_data;
    this.first = args.first;
    //_assert(args.last === undefined);
    if (_debug) _assert(isNatural(this.first));
    this.sublimits = Limit.makeLimitArray(args.sublimits, this.n);

    // Reconstitute target data if necessary
    if (args.target_data == null) {
      _assert(args.sublimits.length > 0);
      let forward_limit = this.sublimits[0].compose(this.source_data[0].forward_limit);
      let l = this.sublimits.length;
      let backward_limit = this.sublimits[l - 1].compose(this.source_data[l - 1].backward_limit);
      this.target_data = new Content({ n: this.n - 1, forward_limit, backward_limit });
    }

    //Object.freeze(this);
    _validate(this);
  }

  static makeLimitComponentArray(array, n) {
    if (_debug) {
      _assert(Array.isArray(array));
      _assert(isNatural(n));
    }
    if (array._t) {
      if (_debug) {
        _assert(array._t === 'I');
        _assert(array.n === n);
      }
      return array;
    }
    let new_array = array.slice();
    new_array._t = 'I';
    new_array.n = n;
    return new_array;
  }

  validate() {
    if (!_debug) return;
    if (_debug) _assert(isNatural(this.n));
    if (this.n == 0) {
      _propertylist(this, ["n", "source_id", "target_id"], ["_t"]);
      _assert(typeof this.source_id === 'string');
      _assert(typeof this.source_id === 'string');
      _assert(this.source_id != this.target_id); // must be nonidentity
      //let source_id = getType(source_id);
      //let target_id = 
      // check that dimension is increasing?
      return;
    }
    _propertylist(this, ["n", "source_data", "target_data", "first", "sublimits"], ["_t"]);
    _assert(isNatural(this.first));
    _assert(this.target_data instanceof Content);
    _assert(this.source_data instanceof Array);
    _assert(this.sublimits instanceof Array);
    _assert(this.sublimits.length == this.source_data.length);
    if (this.sublimits.length == 1) _assert(this.sublimits[0].components.length > 0);
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

    _assert(LimitComponent.testViable({ n: this.n, source_data: this.source_data, target_data: this.target_data, sublimits: this.sublimits, first: this.first }));

    /* Check mutual consistency of source_data */
    if (this.n < 2) return;

    // Find a limit of the source_data which is not the identity
    let source_widths = [];
    let i;
    let trivial = true;
    for (i=0; i<this.source_data.length; i++) {
      let data = this.source_data[i];
      if (data.forward_limit.components.length > 0) {
        source_widths[2 * i] = data.forward_limit.source_size;
        trivial = false;
        break;
      }
      if (data.backward_limit.components.length > 0) {
        source_widths[2 * (i + 1)] = data.backward_limit.source_size;
        trivial = false;
        i++;
        break;
      }
    }
    if (trivial) return;

    // We found a width so we can verify the source sizes
    for (let j=i; j<this.source_data.length; j++) {
      let f = this.source_data[j].forward_limit;
      let b = this.source_data[j].backward_limit;
      if (f.components.length == 0) {
        source_widths[2 * j + 1] = source_widths[2 * j];
      } else {
        _assert(f.source_size == source_widths[2 * j]);
        source_widths[2 * j + 1] = f.getMonotone().target_size;
      }

      if (b.components.length == 0) {
        source_widths[2 * j + 2] = source_widths[2 * j + 1];
      } else {
        source_widths[2 * j + 2] = b.source_size;
        _assert(source_widths[2 * j + 1] == b.getMonotone().target_size);
      }
    }

    // Verify the target_data sizes
    let tf = this.target_data.forward_limit;
    let tb = this.target_data.backward_limit;
    let target_widths = [];
    target_widths[2] = source_widths[this.source_data.length * 2];
    if (tb.components.length == 0) {
      target_widths[1] = target_widths[2];
    } else {
      _assert(target_widths[2] == tb.source_size);
      target_widths[1] = tb.getMonotone().target_size;
    }
    if (tf.components.length == 0) {
      target_widths[0] = target_widths[1];
    } else {
      target_widths[0] = tf.source_size;
      _assert(tf.getMonotone().target_size == target_widths[1]);
    }

    if (source_widths[0] === undefined) {
      source_widths[0] = target_widths[0];
    } else {
      _assert(source_widths[0] === target_widths[0]);
    }

    // Verify the source_data sizes in full
    for (let j=0; j<this.source_data.length; j++) {
      let f = this.source_data[j].forward_limit;
      let b = this.source_data[j].backward_limit;
      if (f.components.length == 0) {
        source_widths[2 * j + 1] = source_widths[2 * j];
      } else {
        _assert(f.source_size == source_widths[2 * j]);
        source_widths[2 * j + 1] = f.getMonotone().target_size;
      }

      if (b.components.length == 0) {
        source_widths[2 * j + 2] = source_widths[2 * j + 1];
      } else {
        source_widths[2 * j + 2] = b.source_size;
        _assert(source_widths[2 * j + 1] == b.getMonotone().target_size);
      }
    }

    _assert(source_widths[2 * this.source_data.length] == target_widths[2]);
  }

  // Test whether this limit component satisfies the necessary commutativity conditions
  static testViable({ n, source_data, target_data, first, sublimits }) {

    if (n == 0) return;

    // Expansive case
    if (_debug) _assert(sublimits);
    if (sublimits.length == 0) return target_data.forward_limit.equals(target_data.backward_limit);

    // Contractive or 1-to-1 case
    let sublimit_first = sublimits[0];
    let source_forward = source_data[0].forward_limit;
    let target_forward = target_data.forward_limit;
    if (!sublimit_first.compose(source_forward).equals(target_forward)) return false;

    let sublimit_last = sublimits[sublimits.length - 1];
    let source_backward = source_data[source_data.length - 1].backward_limit;
    let target_backward = target_data.backward_limit;
    if (!sublimit_last.compose(source_backward).equals(target_backward)) return false;

    // All tests have been passed
    return true;
  }

  lexicographicSort(b, positions, substitutions) {
      
    let a = this;
    //_assert(b instanceof LimitComponent);
    //_assert(a.n == b.n);

    // Sort by dimension
    //if (a.n != b.n) return a.n - b.n;

    // Handle base case
    if (a.n == 0) {
      if (a.source_id != b.source_id) return a.source_id < b.source_id ? -1 : +1;
      if (a.target_id != b.target_id) return a.target_id < b.target_id ? -1 : +1;
      return 0;
    }

    // Sort by first
    if (a.first != b.first) return a.first - b.first;

    // Sort by size of source
    if (a.sublimits.length != b.sublimits.length) return a.sublimits.length - b.sublimits.length;

    // Sort recursively
    for (let i=0; i<a.sublimits.length; i++) {

      // Sublimit
      let a_sublimit_index = positions.get(substitutions.get(a.sublimits[i]));
      let b_sublimit_index = positions.get(substitutions.get(b.sublimits[i]));
      //_assert(isNatural(a_sublimit_index) && isNatural(b_sublimit_index));
      if (a_sublimit_index != b_sublimit_index) return a_sublimit_index - b_sublimit_index;

      // Source data
      let a_source_data_index = positions.get(substitutions.get(a.source_data[i]));
      let b_source_data_index = positions.get(substitutions.get(b.source_data[i]));
      //_assert(isNatural(a_source_data_index) && isNatural(b_source_data_index));
      if (a_source_data_index != b_source_data_index) return a_source_data_index - b_source_data_index;

    }

    // Sort by target data, but this is only necessary if source size is zero
    if (a.sublimits.length == 0) {

      let a_target_data_index = positions.get(substitutions.get(a.target_data));
      let b_target_data_index = positions.get(substitutions.get(b.target_data));
      //_assert(isNatural(a_target_data_index) && isNatural(b_target_data_index));
      if (a_target_data_index != b_target_data_index) return a_target_data_index - b_target_data_index;

    }

    // They are equal
    return 0;

  }

  toJSON() {

    if (this.n == 0) {
      return {
        n: 0,
        source_id: this.source_id,
        target_id: this.target_id,
        _t: 'LimitComponent'
      }
    }

    return {
      first: this.first,
      sublimits: this.sublimits.map(x => x.toJSON()),
      source_data: this.source_data.map(x => x.toJSON()),
      target_data: this.sublimits.length == 0 ? this.target_data.toJSON() : null, // If sublimits exist we can reconstruct the target data
      //target_data: this.target_data.toJSON(),
      n: this.n,
      _t: 'LimitComponent'
    }

  }

  toMinimalJSON(forward) {

    if (this.n == 0) return this.toJSON();
    
    return {
      first: this.first,
      sublimits: this.sublimits.map(x => x.toJSON()),
      source_data: forward ? null : this.source_data.map(x => x.toJSON()),
      target_data: forward ? (this.sublimits.length == 0 ? this.target_data.toJSON() : null) : null, // If sublimits exist we can reconstruct the target data
      //target_data: this.target_data.toJSON(),
      n: this.n,
      _t: 'MinimalLimitComponent'
    }

  }

  static fromMinimal(args, minimal_forward, minimal_target, minimal_level) {

    if (_debug) {
      _assert(minimal_level instanceof Diagram);
      _assert(typeof minimal_forward === 'boolean');
    }

    let source_data;
    let target_data;
    if (minimal_forward) {
      source_data = minimal_level.data.slice(args.first, args.first + args.sublimits.length);
      target_data = args.target_data;
    } else {
      if (_debug) _assert(typeof minimal_target === 'number');
      target_data = minimal_level.data[minimal_target];
      source_data = args.source_data;
    }
    let first = args.first;
    let sublimits = args.sublimits;
    let n = args.n;

    return new LimitComponent({ n, first, sublimits, source_data, target_data });
  }

  equals(b) {
    let a = this;
    if (a.n != b.n) return false;
    if (a.n == 0) {
      if (a.source_id != b.source_id) return false;
      if (a.target_id != b.target_id) return false;
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
    if (this.n == 0) return new Diagram({ n: 0, type: this.type });
    //return this.data.last().getLastPoint();
    return this.target_data.getLastPoint();
    if (_debug) _assert(false); // ... to write ...
  }

  copy({first = this.first, sublimits = this.sublimits, source_data = this.source_data,
    target_data = this.target_data, source_id = this.source_id, target_id = this.target_id} = this) {
    _validate(this);
    if (this.n == 0) {
      return new LimitComponent({ n: 0, source_id, target_id });
    }
    return new LimitComponent({ n: this.n, source_data, target_data, sublimits, first });
  }

  usesId(id) {
    if (this.n == 0) {
      let type = this.type;
      if (this.source_id == id) return true;
      if (this.target_id == id) return true;
      return false;
    }

    for (let content of this.source_data) {
      if (content.usesId(id)) return true;
    }
    if (this.target_data.usesId(id)) return true;

    for (let sublimit of this.sublimits) {
      if (sublimit.usesId(id)) return true;
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
      return new LimitComponent({ n: this.n, source_data, target_data, sublimits, first: this.first });
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
    return new LimitComponent({ n: this.n, source_data, target_data, sublimits, first: this.first + height });
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
    return new LimitComponent({ n: this.n, source_data, target_data, sublimits, first});
  }
}

export class Limit /*extends Array*/ {

  constructor(args) {
    let components = args.components || [];
    //super(...components);
    if (args.bare) return this;
    if (_debug) {
      _assert(isNatural(args.n));
      _propertylist(args, ["n"], ["components"]);
    }
    this.n = args.n;
    this.components = LimitComponent.makeLimitComponentArray(components, this.n);
    this._t = "L";
    if (this.n > 0 && components.length > 0) this.source_size = args.source_size;
    //Object.freeze(this);
    //Object.freeze(this.components);
    this.validate();
  }

  static makeLimitArray(array, n) {
    if (_debug) {
      _assert(Array.isArray(array));
      _assert(isNatural(n));
    }
    if (array._t) {
      if (_debug) {
        _assert(array._t === 'L');
        _assert(array.n === n);
      }
      return array;
    }
    let new_array = array.slice();
    new_array._t = 'L';
    new_array.n = n;
    return new_array;
  }

  validate() {
    if (!_debug) return;
    _assert(isNatural(this.n));
    if (this.n == 0) {
      _assert(this.source_size === undefined);
      _assert(this.components.length <= 1);
      if (this.components.length == 1) _assert(this.components[0].source_id != this.components[0].target_id);
    } else {
      if (this.components.length > 0) {
        _assert(isNatural(this.source_size));
      } else {
        _assert(this.source_size === undefined);
      }
    }
    for (let i = 0; i < this.components.length; i++) {
      _assert(this.components[i] instanceof LimitComponent);
      _assert(this.components[i].n == this.n);
      if (i != 0) _assert(this.components[i].first >= this.components[i - 1].getLast());
      if (this.n > 0) _assert(this.components[i].getLast() <= this.source_size);
      this.components[i].validate();
    }
    _propertylist(this, ["n"], ["_t"]);
    if (this.n == 0 && this.components.length > 0) {
      _assert(this.components.length == 1);
      _assert(this.components[0].source_id != this.components[0].target_id);
    }
  }

  lexicographicSort(b, positions, substitutions) {
    
    let a = this;
    //_assert(b instanceof Limit);
    //_assert(a.n == b.n);

    // Sort by dimension
    //if (a.n != b.n) return a.n - b.n;

    // Sort by number of components
    if (a.components.length != b.components.length) return a.components.length - b.components.length;

    // When there are components, sort by source size
    if (a.components.length > 0) {
      if (a.source_size != b.source_size) return a.source_size - b.source_size;
    }

    // Sort by the components themselves
    for (let i=0; i<a.components.length; i++) {

      let a_component_index = positions.get(substitutions.get(a.components[i]));
      let b_component_index = positions.get(substitutions.get(b.components[i]));
      //_assert(isNatural(a_component_index) && isNatural(b_component_index));
      if (a_component_index != b_component_index) return a_component_index - b_component_index;

    }

    // They are the same
    return 0;
  
  }
  
  toJSON() {
    return {
      components: [...this].map(x => x.toJSON()),
      source_size: this.source_size,
      n: this.n,
      _t: 'Limit'
    };
  }

  toMinimalJSON(forward /* boolean */) {
    return {
      components: [...this].map(x => x.toMinimalJSON(forward)),
      source_size: this.source_size,
      n: this.n,
      _t: 'MinimalLimit'
    };
  }

  static fromMinimal(args, minimal_forward, minimal_level) {

    if (_debug) {
      _assert(args);
      _assert(typeof minimal_forward === 'boolean');
      _assert(minimal_level instanceof Diagram);
    }

    if (args.components.length == 0) {
      return new Limit(args);
    }

    if (args.n == 0) {
      let c = args.components[0];
      let n = 0;
      let source_id = c.source_id;
      let target_id = c.target_id;
      let components = [new LimitComponent({ n, source_id, target_id })];
      return new Limit({ n, components });
    }

    let component_targets = [];
    let offset = 0;

    /*
    for (let component of this) {
      component_targets.push(component.first - offset);
      offset += component.getLast() - component.first - 1;
    }
    */


   let components = [];
   for (let i=0; i<args.components.length; i++) {
      let component = args.components[i];
      let minimal_target = component.first - offset;
      let new_component = LimitComponent.fromMinimal(component, minimal_forward, minimal_target, minimal_level);
      components.push(new_component);
      offset += component.sublimits.length - 1;
    }

    let n = args.n;
    let source_size = args.source_size;
    return new Limit({ n, components, source_size });
  }

  usesId(id) {
    for (let component of this.components) {
      if (component.usesId(id)) return true;
    }

    return false;
  }

  equals(limit) {
    if (this.components.length != limit.components.length) return false;
    for (let i = 0; i < this.components.length; i++) {
      if (!this.components[i].equals(limit.components[i])) return false;
    }
    if (this.components.length > 0) {
      if (this.source_size != limit.source_size) return false;
    }
    return true;
  }

  getMaxSourceHeight() {
    if (this.components.length == 0) return 0;
    let component = ArrayUtil.last(this.components);
    return component.first + component.sublimits.length;
  }

  getMaxTargetHeight() {
    if (this.components.length == 0) return 0;
    let target = this.getComponentTargets();
    return target[target.length - 1] + 1;
  }

  getMonotone(source_height, target_height) {
    _validate(this);
    if (source_height instanceof Diagram) source_height = source_height.data.length;
    if (target_height instanceof Diagram) target_height = target_height.data.length;
    if (this.components.length == 0) {
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
    for (let i = 0; i < this.components.length; i++) {
      let component = this.components[i];
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

  // List singular points in the target with nontrivial neighbourhood under this limit
  getSingularNeighbourhood(dimension) {
    let classification = {};
    let offset = 0;
    for (let i = 0; i < this.components.length; i++) {
      let component = this.components[i];
      singular_classification[component.first - offset] = true;
      offset += component.getLast() - component.first - 1;
    }
    return singular_classification;

  }

  // For each singular height in the target, computes whether its neighbourhood is nontrivial
  analyzeSingularNeighbourhoods() {
    var singular_classification = [];
    let offset = 0;
    for (let i = 0; i < this.components.length; i++) {
      let component = this.components[i];
      singular_classification[component.first - offset] = true;
      offset += component.getLast() - component.first - 1;
    }
    return singular_classification;
  }

  // For each component, find its target index in the codomain diagram
  getComponentTargets() {
    let component_targets = [];
    let offset = 0;

    for (let component of this.components) {
      component_targets.push(component.first - offset);
      offset += component.getLast() - component.first - 1;
    }

    return component_targets;
  }

  getTargetComponentIndex(target) {
    let offset = 0;
    for (let i = 0; i < this.components.length; i++) {
      let component_target = this.components[i].first - offset;
      if (component_target == target) return i;
      offset += this.components[i].getSize() - 1;
    }
    return null;
  }

  getTargetHeightPreimage(target) {
    let offset = 0;
    let component_target = null;
    for (let i = 0; i < this.components.length; i++) {
      component_target = this.components[i].first - offset;
      if (component_target > target) {
        // Trivial neighbourhood
        let h = this.components[i].first - component_target + target;
        return {
          first: h,
          last: h + 1
        };
      }
      if (component_target == target) return { first: this.components[i].first, last: this.components[i].getLast() };
      offset += this.components[i].getSize() - 1;
    }
    return {
      first: target + offset,
      last: target + offset + 1
    };
  }

  // Get a sublimit with respect to the indicated range in the target diagram.
  preimage(range) {
    _propertylist(range, ["first", "last"]);

    // Restricted identities are still identities
    if (this.components.length == 0) return this;
    
    let component_targets = this.getComponentTargets();
    let components = [];
    let offset = null;

    for (let i = 0; i < this.components.length; i++) {
      let component = this.components[i];
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

    return new Limit({ n: this.n, components, source_size: preimage.last - preimage.first });
  }

  subLimit(n) {
    for (let i = 0; i < this.components.length; i++) {
      let component = this.components[i];
      if (n < component.first) return new Limit({ n: this.n - 1 });
      if (n < component.getLast()) return component.sublimits[n - component.first];
    }
    return new Limit({ n: this.n - 1 });
  }

  compose(L1) {

    let L2 = this;
    if (_debug) _assert(L1 instanceof Limit && L2 instanceof Limit);
    _validate(L1, L2);
    if (_debug) _assert(L1.n == L2.n);

    if (L1.components.length == 0) return L2;
    if (L2.components.length == 0) return L1;
    if (L1.n == 0) {
      let source_id = L1.components[0].source_id;
      let target_id = L2.components[0].target_id;
      if (source_id == target_id) return new Limit({ n: 0 });
      return new Limit({ n: 0, components: [ new LimitComponent({ n: 0, source_id, target_id }) ] });
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
    for (let i=0; i<L1.components.length; i++) {
      let component = L1.components[i];
      for (let j=0; j<component.sublimits.length; j++) {
        D1_data[component.first + j] = component.source_data[j];
        L1_sublimits[component.first + j] = component.sublimits[j];
      }
      D2_data[L1_targets[i]] = component.target_data;
    }
    for (let i=0; i<L2.components.length; i++) {
      let component = L2.components[i];
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
      if (sublimits.length == 1 && sublimits[0].components.length == 0) continue;

      // Build the component
      let target_data = D3_data[D3_level];
      if (!target_data) {
        let D2_preimage = M2.preimage(D3_level);
        if (_debug) _assert(D2_preimage.first + 1 == D2_preimage.last);
        target_data = D2_data[D2_preimage.first];
      }
      if (_debug) _assert(target_data);

      let first = D1_preimage.first;
      let component = new LimitComponent({ n: this.n, first, source_data, target_data, sublimits});
      new_components.push(component);
    }

    let composed = new Limit({ n: this.n, components: new_components, source_size: L1.source_size });
    return composed;
  }

  // Remove an element of the target diagram not in the image of this limit
  removeTargetLevel(height) {
    let component_targets = this.getComponentTargets();
    for (let i = 0; i < component_targets.length; i++) {
      if (component_targets[i] == height) {
        let new_components = [];
        let source_delta = 1;
        for (let j=0; j<this.components.length; j++) {
          if (j == i) {
            if (_debug) _assert(this.components[i].sublimits.length == 0); // must be height-zero component
            source_delta = 0; // we're skipping a component
            continue; 
          }
          new_components.push(this.components[j]);
        }
        let source_size = new_components.length > 0 ? this.source_size - source_delta : null;
        return new Limit({ n: this.n, components: new_components, source_size });
      }
    }
    if (this.components.length == 0) return this;
    return this.copy({source_size: this.source_size - 1});
    if (_debug) _assert(false); // We didn't find the correct component to remove
  }

  pad(depth, source_boundary) {
    let components = [...this.components].map(component => component.pad(depth, source_boundary));
    return new Limit({ n: this.n, components, source_size: this.source_size + (depth == 1 ? 1 : 0) });
  }

  deepPad(position, width_deltas) {
    let components = [...this.components].map(component => component.deepPad(position, width_deltas));
    return new Limit({ n: this.n, components, source_size: this.source_size + width_deltas[0] });
  }

  rewrite_forward(diagram) {
    if (this.n == 0) {
      return new Diagram({ n: 0, id: this.components[0].target_id });
    }

    let data = diagram.data.slice();
    for (let i = this.components.length - 1; i >= 0; i--) {
      let c = this.components[i];
      data.splice(c.first, c.source_data.length, c.target_data);
    }

    return new Diagram({ n: diagram.n, source: diagram.source, data });
  }

  rewrite_backward(diagram) {
    if (_debug) _assert(diagram instanceof Diagram);
    _validate(this, diagram);
    if (diagram.n == 0) return new Diagram({ n: 0, id: this.components[0].source_id });

    //let offset = 0;
    let new_data = diagram.data.slice();
    for (let i = 0; i < this.components.length; i++) {
      let c = this.components[i];
      let before = new_data.slice(0, c.first);
      let middle = c.source_data;
      let after = new_data.slice(c.first + 1); //, diagram.data.length);
      new_data = [...before, ...middle, ...after];
      //diagram.data = diagram.data.slice(0, c.first + offset).concat(c.data.concat(diagram.data.slice(c.first + offset + 1, diagram.data.length)));
      //offset += c.last - c.first - 1;
    }
    return new Diagram({ n: diagram.n, source: diagram.source, data: new_data });
  }

  copy({ components = [...this.components], n = this.n, source_size = this.source_size } = this) {
    return new Limit({ n, components, source_size });
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
        if (limit.components.length == 0) continue;
        if (_debug) _assert(limit.components.length == 1);
        if (limit.components[0].source_id != limit.components[0].target_id) return null;
      }
      return undefined;
    }

    // Store the incoming limits by level
    let level_limits = [];
    for (let i=0; i<limits.length; i++) {
      let limit = limits[i];
      let targets = limit.getComponentTargets();
      for (let j=0; j<limit.components.length; j++) {
        let component = limit.components[j];
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
    if (this.components.length == 0) return subset;

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
      let component = this.components[index];
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
    for (let i = 0; i < this.components.length; i++) {
      let component = this.components[i];
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
    if (this.n == 0) return new Diagram({ n: 0, type: this.components[0].source_id });
    if (_debug) _assert(this.components[0]);
    let data = this.components[0].source_data;
    let source = this.components[0].target_data.forward_limit.reconstructSource();
    return new Diagram({ n: this.n, data, source });
  }

  // For an atomic limit, find its unique target type
  getUniqueTargetType() {
    if (this.n == 0) return this.components[0].target_id;
    if (_debug) _assert(this.components[0]);
    return this.components[0].target_data.forward_limit.getUniqueTargetType();
  }

  typecheckBaseCase({generators, forward, source}) {
    if (_debug) _assert(source instanceof Diagram);

    // Identities typecheck
    if (this.components.length == 0) return true;

    // We are promised that 'this' represents a limit with atomic target
    if (_debug) _assert(this.components.length == 1);

    // In this case we can construct the entire source and target diagrams.

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
      return forward.typecheckBaseCase({ forward: null, source: source.source, generators });
    }

    // If we haven't been given a forward/backward distinction, then fail
    if (forward === null) {
      return false;
    }
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

  typecheck(generators, forward) {

    // Get the nontrivial neighbourhoods in the target of this limit
    let neighbourhoods = this.getNontrivialNeighbourhoods();

    // Explode the neighbourhoods
    let exploded = Limit.explodeSubset(neighbourhoods);

    //console.log('n=' + this.n + ', ' + (forward ? 'forward' : 'backward') + ' limit, analyzing ' + exploded.length + ' singular neighbourhoods');

    // Typecheck each neighbourhood
    for (let i=0; i<exploded.length; i++) {
      let limit = this.restrictToPreimage(exploded[i]);
      if (!limit.typecheckBaseCase(generators, forward)) {
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

  restrictToPreimage(subset) {

    // Return everything
    if (subset === null) return this; //{ /*source, target, limit };

    // Return nothing
    if (subset === undefined) return null; //{ source: null, target: null, limit: null };

    if (_debug) _assert(subset instanceof Array);

    // Handle the preimage of a thin subset
    if (subset.regular) {
      return new Limit({ n: this.n });
    }

    if (_debug) _assert(!subset.regular);

    // Check top-level range of the subset of the target
    let range = { first: null, last: null };
    for (let i=0; i<subset.length; i++) {
      if (subset[i] === undefined) continue;
      if (range.first === null) range.first = i;
      range.last = i + 1;
    }

    // If there are some components, we must work out the size of the source
    let preimage;
    if (this.components.length > 0) {
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
      let component = this.components[i];

      // Build the new sublimits and source_data
      let sublimits = [];
      let source_data = [];
      let trivial = false;
      for (let j=0; j<component.source_data.length; j++) {
        //let source_height = component.first + j;

        let restrict_component = component.sublimits[j].restrictToPreimage(subset[target_height]);
        sublimits.push(restrict_component);

        // If the new component will be the identity, we don't need to do anything
        if (j == 0 && component.source_data.length == 1 && restrict_component.components.length == 0) {
          trivial = true;
          break;
        }

        let pullback_subset = component.sublimits[j].pullbackSubset(subset[target_height]);
        let restrict_forward = component.source_data[j].forward_limit.restrictToPreimage(pullback_subset);
        let restrict_backward = component.source_data[j].backward_limit.restrictToPreimage(pullback_subset);
        source_data.push(new Content({ n: this.n - 1, forward_limit: restrict_forward, backward_limit: restrict_backward }));
      }

      // If the pulled-back component will be trivial, we can forget it
      if (trivial) continue;

      // Build the new target_data
      let restrict_forward = component.target_data.forward_limit.restrictToPreimage(subset[target_height]);
      let restrict_backward = component.target_data.backward_limit.restrictToPreimage(subset[target_height]);
      let target_data = new Content({ n: this.n - 1, forward_limit: restrict_forward, backward_limit: restrict_backward });
      //let first = component.first - range.first;
      let first = component.first - preimage.first;

      // Build the new LimitComponent
      let limit_component = new LimitComponent({ n: component.n, first, source_data, target_data, sublimits });
      components.push(limit_component);
    }

    // If there are no components, we can return straight away
    if (components.length == 0) return new Limit({ n: this.n });

    return new Limit({ n: this.n, components, source_size: preimage.last - preimage.first });

  }

  /* Take the pullback with a second limit.
     If the pullback exists, return projections { left, right }.
     Otherwise, return null.
  */
  pullback(R, generators) {
    let L = this;
    if (_debug) _assert(R instanceof Limit);
    if (_debug) _assert(L.n == R.n);

    // Trivial cases
    //if (L.length + R.length == 0) return { left: R, right: L};
    if (L.length == 0 || R.length == 0) return { left: R, right: L};

    if (L.n == 0) {
      let left, right;
      let identity = new Limit({ n: 0 });
      L0_source_type = generators[L[0].source_id];
      R0_source_type = generators[R[0].source_id];
      if (L0_source_type.n < R0_source_type.n) {
        left = identity;
        right = new Limit({ n: 0, components: [new LimitComponent({ n: 0, source_id: L[0].source_id, target_id: R[0].source_id })] });
      } else if (L0_source_type.n > R0_source_type.n) {
        left = new Limit({ n: 0, components: [new LimitComponent({ n: 0, source_id: R[0].source_id, target_id: L[0].source_id })] });
        right = identity;
      } else { // L and R source point dimensions match
        if (L0_source_type.id == R0_source_type.id) {
          left = identity;
          right = identity;
        } else {
          throw new Error("Pullback base case has inconsistent source types");
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

    let left = new Limit({ n: this.n, components: left_components, source_size: source_height });
    let right = new Limit({ n: this.n, components: right_components, source_size: source_height });

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

    let L = left_limit.components[0];
    let R = right_limit.components[0];
    let L_size = L.source_data.length;
    let R_size = R.source_data.length;

    // Handle some limited cases of pullbacks with empty pullback
    if (L_size == 0 && R_size == 0) {
      let id = new Limit({ n: left_limit.n });
      return { left: id, right: id, height: 0 };
    } else if (L_size == 1 && R_size == 0) {
      let right = new Limit({ n: this.n });
      let component = new LimitComponent({ n: this.n, first: 0, source_data: [], sublimits: [], target_data: left_limit.components[0].source_data[0] });
      let left = new Limit({ n: this.n, components: [component], source_size: 0 });
      return { left, right, height: 0 };
    } else if (L_size == 0 && R_size == 1) {
      let left = new Limit({ n: this.n });
      let component = new LimitComponent({ n: this.n, first: 0, source_data: [], sublimits: [], target_data: right_limit.components[0].source_data[0] });
      let right = new Limit({ n: this.n, components: [component], source_size: 0 });
      return { left, right, height: 0 };
    } else if (L_size == 0 || R_size == 0) {
      throw Error("Can't pullback component with empty and large source sizes");
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
            throw Error("Can't build singular-regular pullback at i=" + i + ", j=" + j);
          }
        }

        // rs
        if (i > 0) {
          let left = L.sublimits[i].compose(L.source_data[i].forward_limit);
          let right = R.sublimits[j];
          if (!(rs_pullbacks[i][j] = left.pullback(right))) {
            throw Error("Can't build regular-singular pullback at i=" + i + ", j=" + j);
          }
        }

        // ss
        let left = L.sublimits[i];
        let right = R.sublimits[j];
        if (!(ss_pullbacks[i][j] = left.pullback(right))) {
          throw Error("Can't build singular-singular pullback at i=" + i + ", j=" + j);
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
          if (!factorization) throw Error("Can't factorize lower-right regular-singular inclusion at i=" + i + ", j=" + j);
          a.lower_right = factorization;
          if (factorization.length > 0) a.trivial = false;
        }

        // Upper-left regular-singular inclusion
        if (i < L_size - 1) {
          let rs = rs_pullbacks[i + 1][j];
          let cone_left = L.source_data[i].backward_limit.compose(rs.left);
          let cone_right = rs.right;
          let factorization = Limit.pullbackFactorize(ss, cone_left, cone_right);
          if (!factorization) throw Error("Can't factorize upper-left regular-singular inclusion at i=" + i + ", j=" + j);
          a.upper_left = factorization;
          if (factorization.length > 0) a.trivial = false;
        }

        // Lower-left singular-regular inclusion
        if (j > 0) {
          let sr = sr_pullbacks[i][j];
          let cone_left = sr.left;
          let cone_right = R.source_data[j].forward_limit.compose(sr.right);
          let factorization = Limit.pullbackFactorize(ss, cone_left, cone_right);
          if (!factorization) throw Error("Can't factorize lower-left singular-regular inclusion at i=" + i + ", j=" + j);
          a.lower_left = factorization;
          if (factorization.length > 0) a.trivial = false;
        }

        // Upper-right singular-regular inclusion
        if (j < R_size - 1) {
          let sr = sr_pullbacks[i][j + 1];
          let cone_left = sr.left;
          let cone_right = R.source_data[j].backward_limit.compose(sr.right);
          let factorization = Limit.pullbackFactorize(ss, cone_left, cone_right);
          if (!factorization) throw Error("Can't factorize upper-right singular-regular inclusion at i=" + i + ", j=" + j);
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
            console.log("Warning, can't linearize pullback, distinct nontrivial masses at height " + height);
          } else {
            nontrivial[height] = i;
          }
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
        throw Error("Can't linearize pullback, mass too far away at height " + height);
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
    if (!bottom_limit) throw Error("Can't build pullback, bottom factorization does not exist");
    let top_limit = Limit.pullbackFactorize
      (ss_pullbacks[L_size - 1][R_size - 1], L.source_data[L_size - 1].backward_limit, R.source_data[R_size - 1].backward_limit);
    if (!top_limit) throw Error("Can't build pullback, top factorization does not exist");

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
      P_data.push(new Content({ n: this.n - 1, forward_limit, backward_limit }));
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
      left_components.push(new LimitComponent({ n: this.n, first, source_data, target_data, sublimits }));
    }
    let left = new Limit({ n: this.n, components: left_components, source_size: P_size });

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
      right_components.push(new LimitComponent({ n: this.n, first, source_data, target_data, sublimits }));
    }
    let right = new Limit({ n: this.n, components: right_components, source_size: P_size });

    // Return the projections
    let height = P_size;
    if (_debug) _assert(isNatural(height));
    return {left, right, height };
  }

  static * monotoneWords(length, alphabet) {
    if (_debug) {
      _assert(isNatural(alphabet));
      _assert(isNatural(length));
    }
    if (length == 0) {
      yield [];
    } else if (alphabet == 0) {
      yield [].fill(0, 0, length);
    } else {
      for (let i=0; i<alphabet; i++) {
        for (const val of Limit.monotoneWords(length - 1, alphabet - i)) {
          yield [i, ...val.map(x => x + i)];
        }
      }
    }
  }

  /* 
    Find a limit 'first' which factorizes 'this' as 'second o first'.
    We require that 'first' is either the identity or dimension-
    increasing on types. We do not require that it type-checks.
  */

 factorThrough(second, generators) {
    if (_debug) {
      _assert(generators);
      _assert(second instanceof Limit);
      _assert(this.n == second.n);
    }

    // If the second map is the identity, factorization is trivial
    if (second.components.length == 0) return this;

    // If the limits are equal, factorization is trivial
    if (this.equals(second)) {
      return new Limit({ n: this.n });
    }

    // Handle the base case
    if (this.n == 0) {

      // Can't factor identity types unless second is identity, which is already ruled out
      if (this.components.length == 0) return { error: "Can't factor 0-dimensional identity through a nonidentity limit" };

      // Can't factorize if dimensions aren't increasing
      let this_source_id = this.components[0].source_id;
      let second_source_id = second.components[0].source_id;
      let this_source_type = generators[this_source_id];
      let second_source_type = generators[second_source_id];
      if (this_source_type.generator.n > second_source_type.generator.n) return { error: "Can't factorize if dimensions are increasing" };

      // Construct the factorization
      let source_id = this_source_id;
      let target_id = second_source_id;
      if (_debug) _assert(source_id != target_id);
      let component = new LimitComponent({ n: 0, source_id, target_id });
      let limit = new Limit({ n: 0, components: [component] });
      return limit;
    }

    let target_size = second.getTargetSize();
    let first_components = [];
    let this_source_size = this.components.length == 0 ? target_size : this.source_size;
    let this_monotone = this.getMonotone(this_source_size, target_size);
    let second_monotone = second.getMonotone();

    // Collect the components for the final factorizing limit
    let components = [];

    for (let i=0; i<target_size; i++) {

      let range = { first: i, last: i+1 };
      let this_preimage = this_monotone.preimage(range);
      let second_preimage = second_monotone.preimage(range);
      let this_preimage_size = this_preimage.last - this_preimage.first;
      let second_preimage_size = second_preimage.last - second_preimage.first;

      // Consider the case that i is not in the image of 'second'
      if (second_preimage_size == 0) {

        // If it's also not in the image of 'first', there's nothing to do
        if (this_preimage_size == 0) continue;

        // If it is in the image of 'this', we're done for
        return { error: "Limit doesn't factorize, image not covered by factorizing map" };
      }

      // Restrict the limits to this single target point
      let this_restricted = this.preimage(range);
      let second_restricted = second.preimage(range);

      // Factorize these restricted limits
      let factor_component = this_restricted.factorThroughComponent(second_restricted, generators);

      // If we couldn't factor the component, then fail
      if (factor_component.error) {
        return { error: "Couldn't factor at target index " + i
          + "\n" + factor_component.error };
      }

      // Extract the components and boost their start height
      for (let i=0; i<factor_component.components.length; i++) {
        let component = factor_component.components[i];
        let boosted = component.copy({ first: component.first + this_preimage.first });
        components.push(boosted);
      }
    }

    // Build the final factorizing limit
    let factorization = new Limit({ n: this.n, components, source_size: this_source_size });
    return factorization;

  }

  // Factor 'this' through 'second' where both limits are guaranteed to have a height-1 limit
  factorThroughComponent(second, generators) {

    if (_debug) {
      _assert(second instanceof Limit);
      _assert(this.n == second.n);
    }

    // If the second map is the identity, factorization is trivial
    if (second.components.length == 0) return this;

    if (_debug) {
  	  _assert(second.components.length == 1);
	    _assert(this.components.length <= 1);
    }

    // If the limits are equal, factorization is trivial
    if (this.equals(second)) {
      return new Limit({ n: this.n });
    }

    // Handle the base case
    if (this.n == 0) {

      // Can't factor identity types unless second is identity, which is already ruled out
      if (this.components.length == 0) return null;

      // Can't factorize if dimensions aren't increasing
      let this_source_type = generators[this.source_id];
      let second_source_type = generators[second.source_id];
      if (this_source_type.n > second_source_type.n) return null;

      // Construct the factorization
      let source_id = this.source_id;
      let target_id = second.source_id;
      let component = new LimitComponent({ n: 0, source_id, target_id });
      let limit = new Limit({ n: 0, components: component });
      return limit;
    }

    // Work out some information
    let target_size = second.getTargetSize();
    let this_source_size = this.components.length == 0 ? target_size : this.source_size;
    let second_source_size = second.source_size;
    let this_source_data = this.components.length > 0 ? this.components[0].source_data : second.target_data;
    let this_sublimits = this.components.length == 0 ? [new Limit({ n: this.n - 1 })] : this.components[0].sublimits;
    let second_sublimits = second.components[0].sublimits;

    // Can't factorize nonempty monotone through the empty set
    if (this_source_size > 0 && second_source_size == 0) return null;

    // Work out if certain target levels can be omitted
    let second_level_omissible = [];
    for (let i=0; i<second_source_size; i++) {
      let data = second.components[0].source_data[i];
      second_level_omissible.push(data.forward_limit.equals(data.backward_limit)) ;
    }

    // Get all the sublimits

    // Remember factorizations of singular levels - this, second
    let level_factorization = new Array(this_source_size);
    for (let i=0; i<level_factorization.length; i++) {
      level_factorization[i] = new Array(second_source_size);
    }

    // Iterate through all possible monotone factorizations
    for (const monotone_generator of Limit.monotoneWords(this_source_size, second_source_size)) {

      let monotone = new Monotone(second_source_size, monotone_generator);

      // Ensure we only omit omissible levels
      let viable = true;
      for (let i=0; i<second_source_size; i++) {
        if (monotone.indexOf(i) >= 0) continue;

        // We omit level i, so if it isn't omissible, go to the next monotone
        if (!second_level_omissible[i]) {
          viable = false;
          break;
        }
      }
      if (!viable) continue;

      // Attempt to factorize all the sublimits
      for (let i=0; i<this_source_size; i++) {
        if (level_factorization[i][monotone[i]] === undefined) {
          level_factorization[i][monotone[i]] = this_sublimits[i].factorThrough(second_sublimits[monotone[i]], generators);
        }

        // If the level can't be factorized, go on to the next monotone
        if (level_factorization[i][monotone[i]].error) {
          viable = false;
          break;
        }
      }
      if (!viable) continue;

      // All the sublimits have been factorized and we can now build the factorizing limit.
      // Work level-by-level on the source of 'second'
      let components = [];
      for (let i=0; i<second_source_size; i++) {
        let preimage = monotone.preimage(i);
        let sublimits = [];
        let source_data = [];
        for (let j=preimage.first; j<preimage.last; j++) {
          sublimits.push(level_factorization[j][i]);
          source_data.push(this_source_data[j]);
        }
        let target_data = second.components[0].source_data[i];
        let first = preimage.first;

        // If the component is trivial, ignore it
        if (sublimits.length == 1 && sublimits[0].components.length == 0) continue;

        // Test if this data would be viable
        if (!LimitComponent.testViable({ n: this.n, sublimits, source_data, target_data, first })) {
          viable = false;
          break;
        }

        // Create the component
        let component = new LimitComponent({ n: this.n, sublimits, source_data, target_data, first });

        // Remember the component
        components.push(component);
      }

      // If there was a non-viable component, go on to the next monotone
      if (!viable) continue;

      // We've completed the factorization
      let limit = new Limit({ n: this.n, components, source_size: this_source_size });

      // Test that this is a correct factorization
      if (_debug) {
        let composed = second.compose(limit);
        _assert(this.equals(composed));
      }

      return limit;
    }

    // If we fall through to here, none of the monotones gave a valid factorization
    return { error: "Every monotone gives an invalid factorization" };
  }

  static boostComponents(components, height) {
    let new_components = [];
    for (let i=0; i<components.length; i++) {
      let component = components[i];
      new_components.push(component.copy({first: component.first + height}));
    }
    return new_components;
  }

  // Get a partial list of data of the limit's source
  getSourceData() {
    let arr = [];
    for (let i=0; i<this.components.length; i++) {
      let component = this.components[i];
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
      return new Limit({ n: f.n });
    }

    if (g.length == 0) {
      if (pullback.right.length != 0) return null;
      if (!f.equals(pullback.left)) return null;
      return new Limit({ n: f.n });
    }

    if (_debug) _assert(f.source_size === g.source_size);

    // Base case
    if (f.n == 0) {
      if (pullback.left.length == 0 && pullback.right.length == 0) {
        if (f.equals(g)) {
          return new Limit({ n: 0 });
        } else {
          throw "Pullback doesn't factorize in dimension 0";
        }
      }
      let P_id;
      if (pullback.left.length > 0) {
        P_id = pullback.left[0].source_id;
      } else {
        P_id = pullback.right[0].source_id;
      }
      let P_type = generators[P_id];
      let X_id;
      if (f.length > 0) {
        X_id = f[0].source_id;
      } else if (g.length > 0) {
        X_id = g[0].source_id;
      } else {
        throw "Pullback base case, can't determine type of cone object";
      }
      let X_type = generators[X_id];
      if (X_type.n > P_type.n) {
        throw "Pullback base case, cone dimension is too high";
      }
      if (X_type.n == P_type.n && X_type.id != P_type.id) {
        throw "Pullback base case, cone has inconsistent type";
      }
      if (X_type.id == P_type.id) {
        return new Limit({ n: 0 });
      }
      return new Limit({ n: 0, components: [new LimitComponent({ n: 0, source_id: X_id, target_id: P_id})] });
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
      components.push(new LimitComponent({ n: f.n, first: preimage.first, sublimits, source_data, target_data}));
    }

    return new Limit({ n: f.n, components, source_size: X_height });
  }

  composeAtRegularLevel({height, limit}) {

    // Nothing to do for identity limits
    if (this.components.length == 0) return this;

    // Make a shallow copy of the limit components ready for modification
    let components = [...this.components];

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
          source_data[0] = new Content({ n: source_data[0].n, forward_limit, backward_limit });
        }

        // Correct the target data
        let forward_limit = first_component.target_data.forward_limit.compose(limit);
        let backward_limit = first_component.target_data.backward_limit;
        let target_data = new Content({ n: forward_limit.n, forward_limit, backward_limit });

        // Store the result
        let first = first_component.first;
        let sublimits = first_component.sublimits;
        components[0] = new LimitComponent({ n: this.n, source_data, target_data, sublimits, first })
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
          source_data[source_data.length - 1] = new Content({ n: source_data[0].n, forward_limit, backward_limit });
        }

        // Correct the target data
        //target_data = last_component.target_data.copy();
        let forward_limit = last_component.target_data.forward_limit;
        let backward_limit = last_component.target_data.backward_limit.compose(limit);
        let target_data = new Content({ n: forward_limit.n, forward_limit, backward_limit });

        // Store the result
        let first = last_component.first;
        let sublimits = last_component.sublimits;
        components[components.length - 1] = new LimitComponent({ n: this.n, source_data, target_data, sublimits, first })
      }

      // Return the adjusted limit
      return new Limit({ n: this.n, components, source_size: this.source_size });
    }

    // Otherwise, the provided limit is too low-dimensional, so recurse
    for (let i=0; i<components.length; i++) {
      components[i] = components[i].composeAtBoundary({type, limit});
    }

    return new Limit({ n: this.n, components, source_size: this.source_size });
  }

  getTargetSize() {
    if (this.n == 0) return 1;
    if (this.components.length == 0) return null; // we don't store source or target size for identity limits
    let target_size = this.source_size;
    for (let i=0; i<this.components.length; i++) {
      target_size -= this.components[i].sublimits.length - 1;
    }
    return target_size;
  }

  // Normalize the regular levels of the provided limits, both in the source and target.
  // They all have the common source provided.
  // Return value is the normalized limits with source and target regular levels normalized.
  static normalizeRegularRecursive({source, limits}) {
    if (_debug) _assert(source instanceof Diagram);
    if (_debug) _assert(limits instanceof Array);

    // In the base case, do nothing
    if (source.n <= 1) return {source, limits};

    for (let i=0; i<limits.length; i++) {
      let limit = limits[i];
      if (_debug) _assert(limit.n == source.n);
      if (_debug) _assert(limit.n >= 2);
      if (_debug) _assert(limit instanceof Limit);
      if (limit.components.length == 0) continue;
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
      for (let j=0; j<limit.components.length; j++) {
        let component = limit.components[j];
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
      let slice_r = Limit.normalizeRegularRecursive({source: slice, limits: level_limits[i]});
      let slice_rs = slice_r.source.normalizeSingular();
      let limits_fully_normalized = slice_r.limits.map(x => x.compose(slice_rs.embedding));
      /*
      if (i == 0) source_source = n.source;
      if (i > 0) {
        source_limits.push(n.limits.shift());
      }
      if (i < source.data.length) {
        source_limits.push(n.limits.shift());
      }
      target_limits.push(n.limits);
      */
     if (i == 0) source_source = slice_rs.diagram;
     if (i > 0) {
       source_limits.push(limits_fully_normalized.shift());
     }
     if (i < source.data.length) {
       source_limits.push(limits_fully_normalized.shift());
     }
     target_limits.push(limits_fully_normalized);

    }

    // Build the new source diagram
    let data = [];
    if (_debug) _assert(source_limits.length % 2 == 0);
    for (let i=0; i<source_limits.length / 2; i++) {
      let forward_limit = source_limits[2 * i];
      let backward_limit = source_limits[2 * i + 1];
      let content = new Content({ n: source.n - 1, forward_limit, backward_limit });
      data.push(content);
    }

    // Get the regular normalizations of the outgoing limits from the singular levels
    let singular_outgoing_rn = []; // sing level, then limit
    for (let i=0; i<source.data.length; i++) {
      let original = [];
      for (let j=0; j<limits.length; j++) {
        let sublimit = limits[j].subLimit(i);
        original.push(sublimit);
      }
      let s_slice = source.getSlice({height: i, regular: false});
      let rn_slice = Limit.normalizeRegularRecursive({source: s_slice, limits: original});
      singular_outgoing_rn.push(rn_slice.limits);
    }

    // Update the limits
    let new_limits = [];
    for (let i=0; i<limits.length; i++) {
      let limit = limits[i];
      let new_components = [];
      for (let j=0; j<limit.components.length; j++) {
        let component = limit.components[j];
        let source_data = data.slice(component.first, component.first + component.sublimits.length);
        let forward_limit = target_limits[component.first].shift();
        let backward_limit = target_limits[component.getLast()].shift();
        let target_data = new Content({ n: source.n - 1, forward_limit, backward_limit });
        let first = component.first;
        let sublimits = [];
        for (let k=0; k<component.sublimits.length; k++) {
          sublimits[k] = singular_outgoing_rn[k + component.first][i];
        }
        //let sublimits = component.sublimits;
        let new_component = new LimitComponent({ n: source.n, source_data, target_data, first, sublimits});
        new_components.push(new_component);
      }
      let new_limit = new Limit({ n: source.n, components: new_components, source_size: limit.source_size });
      new_limits.push(new_limit);
    }

    // Create the new source
    let new_source = new Diagram({ n: source.n, source: source_source, data});

    // Verify the outgoing limits are compatible with the new source diagram
    if (_debug) {
      for (let i=0; i<new_limits.length; i++) {
        new_limits[i].verifySource(new_source);
      }
    }

    return { source: new_source, limits: new_limits };

    /*
    
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
    if (_debug) {
      for (let i=0; i<new_new_limits.length; i++) {
        new_new_limits[i].verifySource(source_normalized.diagram);
      }
    }
    
    // Return the normalized source along with the composed limits
    return { source: source_normalized.diagram, limits: new_new_limits };

    */

  }

  // Verify that the limit can act on the specified diagram
  verifySource(diagram) {

    if (_debug) _assert(this.n == diagram.n);
    if (this.components.length == 0) return;
    if (_debug) _assert(this.source_size == diagram.data.length);
    for (let i=0; i<this.components.length; i++) {
      let component = this.components[i];
      for (let j=0; j<component.source_data.length; j++) {
        if (_debug) _assert(component.source_data[j].equals(diagram.data[component.first + j]));
      }
    }

  }

  updateSliceForward(slice) {
    if (_debug) _assert(slice instanceof Array);
    if (this.components.length == 0) return slice;
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
      let component = this.components[index];
      let updated = component.target_data.forward_limit.updateSliceForward(rest);
      return [2 * s_target + 1, ...updated];
    }

    // Locally contractive on singular slices
    if (_debug) _assert(regular_inverse_image.length == 0);
    let s_target = singular_monotone[regular_height];
    let index = targets.indexOf(s_target);
    if (_debug) _assert(index >= 0);
    let component = this.components[index];
    if (_debug) _assert(component.source_data.length > 0);

    let first_limit = component.source_data[regular_height - component.first].forward_limit;

    //let first_limit = this.data[regular_height].forward_limit;
    let second_limit = this.subLimit(regular_height);
    let composed_limit = second_limit.compose(first_limit);
    let updated = composed_limit.updateSliceForward(rest);
    return [2 * s_target + 1, ...updated];

  }

  updateSliceBackward(slice) {

    if (_debug) _assert(slice instanceof Array);
    if (this.components.length == 0) return slice;
    if (slice.length == 0) return slice; // ???
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
    let component = this.components[index];
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

  // Take a singular point in the extended coordinate system and flow it forward
  flowForwardSingularPoints(points) {

    if (points.length == 0) return [];
    if (points[0].length == 0) return points.map(point => point.slice());

    // Verification
    if (_debug) {
      _assert(points instanceof Array);
      for (let i=0; i<points.length; i++) {
        _assert(points[i] instanceof Array);
      }
      let len = points[0].length;
      for (let i=1; i<points.length; i++) {
        _assert(points[i].length == len);
      }
      _assert(this.n >= len);
      for (let j=0; j<points.length; j++) {
        let point = points[j];
        for (let i=0; i<point.length; i++) {
          _assert(isInteger(point[i]));
          _assert(point[i] >= -1);
          _assert(Math.abs(point[i] % 2) == 1); // everything should be singular
        }
      }
    }

    // Logic
    if (this.components.length == 0) return points.map(point => point.slice()); // identity limits don't change the point
    if (this.n == 0) return points.map(point => point.slice());
    let monotone = this.getMonotone();
    let sublimits = [];
    let identity_sublimit = new Limit({ n: this.n, components: [] });
    
    let flowed_points = points.map(point => {

      let [first, ...rest] = point;

      // boundary points don't change
      if (first < 0) return point.slice(); 
      let first_adjusted = (first - 1)/2;
      let flow_first = 1 + 2 * monotone.applyAdjusted(first_adjusted);
      let sublimit;
      if (first < 0 || first > this.source_size * 2) {
        sublimit = identity_sublimit;
      } else {
        if (sublimits[first_adjusted] === undefined) {
          sublimits[first_adjusted] = this.subLimit(first_adjusted);
        }
        sublimit = sublimits[first_adjusted];
      }
      let flow_point = [flow_first, ...sublimit.flowForwardSingularPoints([rest])[0]];
      return flow_point;
  
    });

    return flowed_points;

  }

  // Take a regular point in the extended coordinate system and flow it backward
  flowBackwardRegularPoints(points) {

    if (points.length == 0) return [];
    if (points[0].length == 0) return points.map(point => point.slice());

    if (_debug) {
      _assert(points instanceof Array);
      /*
      _assert(this.n >= point.length);
      for (let i=0; i<point.length; i++) {
        _assert(isInteger(point[i]));
        _assert(point[i] >= -1);
        _assert(point[i] % 2 == 0); // everything should be regular
      }
      */
    }

    if (this.components.length == 0) return points.map(point => point.slice()); // identity limits don't change the point
    if (this.n == 0) return points.map(point => point.slice());
    let monotone = this.getMonotone().getAdjoint();
    let sublimits = [];
    let identity_sublimit = new Limit({ n: this.n, components: [] });
    let flowed_points = points.map(point => {
      let [first, ...rest] = point;
      // boundary points don't change
      if (first < 0) return point.slice(); 
      let first_adjusted = first/2;
      let flow_first = 2 * monotone.applyAdjusted(first_adjusted);
      let flow_point = [flow_first, ...rest];
      return flow_point;
    });
    return flowed_points;
  }

  extendedSubLimit(height, source_diagram) {
    if (height == -1 || height == source_diagram.data.length * 2 + 1) {
      return new Limit({ n: this.n - 1, components: [] });
    } else {
      _assert(height % 2 == 1);
      return this.subLimit((height - 1) / 2);
    }
  }

  // Get the full relation on source and target points
  getAllPointPairs({ source, target, dimension }) {

    if (_debug) {
      _assert(source instanceof Diagram);
      _assert(target instanceof Diagram);
      _assert(source.n == target.n);
      _assert(source.n == this.n);
      if (this.components.length > 0 && this.n > 0) _assert(this.source_size == source.data.length);
      _assert(isNatural(dimension));
      _assert(dimension <= this.n);
    }

    if (dimension == 0) {
      return [['','']];
    }

    let source_slices = source.getSlices();
    let target_slices = target.getSlices();
    let monotone = this.getMonotone(source, target);
    let adjoint = monotone.getAdjoint();
    let pairs = [];
    let comma = (dimension == 1) ? '' : ',';

    // Iterate over singular levels of source diagram
    for (let source_singular=-1; source_singular<source.data.length + 1; source_singular++) {

      let source_height = (2 * source_singular) + 1;
      let source_adjusted = source.adjustHeight(source_height);
      let source_slice = source_slices[source_adjusted];
      let target_singular = monotone.applyAdjusted(source_singular);
      let target_height = (2 * target_singular) + 1;
      let target_adjusted = target.adjustHeight(target_height);
      let target_slice = target_slices[target_adjusted];
      let sublimit = this.extendedSubLimit(source_height, source);
      let sublimit_pairs = sublimit.getAllPointPairs({ source: source_slice, target: target_slice, dimension: dimension - 1 });
      let source_prefix = source_height.toString() + comma;
      let target_prefix = target_height.toString() + comma;
      pairs.push(sublimit_pairs.map(pair => {
        return [source_prefix + pair[0], target_prefix + pair[1]];
      }));

      // Possibly also act on regular height just above
      if (source_singular == source.data.length) continue; // too high, no regular level above this
      if (target_singular != monotone.applyAdjusted(source_singular + 1)) continue; // no trapped regular level
      let backward_limit = source.data[source_singular].backward_limit;
      let composed_sublimit = sublimit.compose(backward_limit);
      let trapped_regular = source_slices[source_adjusted + 1];
      let composed_sublimit_pairs = composed_sublimit.getAllPointPairs({ source: trapped_regular, target: target_slice, dimension: dimension - 1 });
      let composed_source_prefix = (source_height + 1).toString() + ',';
      pairs.push(composed_sublimit_pairs.map(pair => {
        return [composed_source_prefix + pair[0], target_prefix + pair[1]];
      }));

    }

    // Iterate over regular levels of target diagram
    for (let target_regular = 0; target_regular <= target.data.length; target_regular ++) {

      let target_height = 2 * target_regular;
      let target_slice = target_slices[target_height];
      let source_regular = adjoint[target_regular];
      let source_height = 2 * source_regular;
      let sublimit = new Limit({ n: this.n - 1, components: [] });
      let sublimit_pairs = sublimit.getAllPointPairs({ source: target_slice, target: target_slice, dimension: dimension - 1 });
      let source_prefix = source_height.toString() + comma;
      let target_prefix = target_height.toString() + comma;
      pairs.push(sublimit_pairs.map(pair => {
        return [source_prefix + pair[0], target_prefix + pair[1]];
      }));

      // Possibly also act on singular height just above
      if (target_regular == target.data.length) continue; // too high, can't trap a singular level above this
      if (adjoint[target_regular] != adjoint[target_regular + 1]) continue; // no trapped singular level
      let forward_limit = target.data[target_regular].forward_limit;
      let forward_limit_pairs = forward_limit.getAllPointPairs({ source: target_slice, target: target_slices[target_height + 1], dimension: dimension - 1 });
      let new_target_prefix = (target_height + 1).toString() + comma;
      pairs.push(forward_limit_pairs.map(pair => {
        return [source_prefix + pair[0], new_target_prefix + pair[1]];
      }));

    }

    // Flatten and return the resulting list of pairs
    return pairs.flat();

  }
  
  getScaffoldPointPairs({ generators, source, target, dimension }) {
    if (_debug) {
      _assert(source instanceof Diagram);
      _assert(target instanceof Diagram);
      _assert(source.n == target.n);
      _assert(source.n == this.n);
      if (this.components.length > 0 && this.n > 0) _assert(this.source_size == source.data.length);
      _assert(isNatural(dimension));
      _assert(dimension <= this.n);
    }

    if (dimension == 0) {
      let point_names = ['',''];
      let id = source.getActionId([], generators);
      return [new Simplex({ point_names, id })];
    }

    let source_slices = source.getSlices();
    let target_slices = target.getSlices();
    let monotone = this.getMonotone(source, target);
    let adjoint = monotone.getAdjoint();
    let edges = [];
    let comma = (dimension == 1) ? '' : ',';

    // Iterate over singular levels of source diagram
    for (let source_singular=-1; source_singular<source.data.length + 1; source_singular++) {
      let source_height = (2 * source_singular) + 1;
      let source_adjusted = source.adjustHeight(source_height);
      let source_slice = source_slices[source_adjusted];
      let target_singular = monotone.applyAdjusted(source_singular);
      let target_height = (2 * target_singular) + 1;
      let target_adjusted = target.adjustHeight(target_height);
      let target_slice = target_slices[target_adjusted];
      let sublimit = this.extendedSubLimit(source_height, source);
      let sublimit_edges = sublimit.getScaffoldPointPairs({ generators, source: source_slice, target: target_slice, dimension: dimension - 1 });
      let source_prefix = source_height.toString() + comma;
      let target_prefix = target_height.toString() + comma;
      edges.push(sublimit_edges.map(edge => {
        return new Simplex({ point_names: [source_prefix + edge.point_names[0], target_prefix + edge.point_names[1]], id: edge.id });
      }));
    }

    // Iterate over regular levels of target diagram
    for (let target_regular = 0; target_regular <= target.data.length; target_regular ++) {
      let target_height = 2 * target_regular;
      let target_slice = target_slices[target_height];
      let source_regular = adjoint[target_regular];
      let source_height = 2 * source_regular;
      let sublimit = new Limit({ n: this.n - 1, components: [] });
      let sublimit_edges = sublimit.getScaffoldPointPairs({ generators, source: target_slice, target: target_slice, dimension: dimension - 1 });
      let source_prefix = source_height.toString() + comma;
      let target_prefix = target_height.toString() + comma;
      edges.push(sublimit_edges.map(edge => {
        return new Simplex({ point_names: [source_prefix + edge.point_names[0], target_prefix + edge.point_names[1]], id: edge.id });
      }));
    }

    // Flatten and return the resulting list of pairs
    return edges.flat();
  }
  
}


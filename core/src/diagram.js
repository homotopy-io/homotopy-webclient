import { _assert, _debug, isNatural, isInteger, _propertylist } from "~/util/debug";
import * as ArrayUtil from "~/util/array";
import { Limit, Content, LimitComponent } from "~/limit";
// blah
import { Generator } from "~/generator";
import { Monotone } from "~/monotone";
import { SerializeCyclic } from "~/serialize_flat";
import { Simplex, Complex } from "~/simplices";
import glpk from "~/util/glpk"

export class Diagram {

  constructor(args) {

    if (args.bare) return this;

    if (3 ==2) console.log('the universe is ending');

    this._t = "D";
    if (_debug) _assert(isNatural(args.n));
    this.n = args.n;
    if (this.n == 0) {
      if (_debug) _assert(typeof args.id === 'string');
      //if (_debug) _assert(args.type instanceof Generator);
      this.id = args.id;
    } else {
      if (_debug) _assert(args.source && (args.source.n + 1 == this.n));
      if (_debug) _assert(args.data instanceof Array);
      this.source = args.source;
      this.data = Content.makeContentArray(args.data, this.n);



      if (_debug) {

        if (this.n == 1) {

          let id = this.source.id;
          for (let i=0; i<this.data.length; i++) {
            let f = this.data[i].forward_limit;
            if (f.components.length > 0) {
              if (_debug) _assert(f.components[0].source_id == id);
              id = f.components[0].target_id;
            }
            let b = this.data[i].backward_limit;
            if (b.components.length > 0) {
              if (_debug) _assert(b.components[0].target_id == id);
              id = b.components[0].source_id;
            }
          }
  
        } else {
  
          // Shallow source/data consistency check
          let slice_data = this.source.data.slice();
          for (let i=0; i<this.data.length; i++) {
            let data = this.data[i];
  
            if (data.forward_limit.components.length > 0) {
              if (_debug) _assert(data.forward_limit.source_size == slice_data.length);
            }
  
            // Check forward limit data
            for (let j=data.forward_limit.components.length - 1; j>=0; j--) {
              let component = data.forward_limit.components[j];
              for (let k=0; k<component.source_data.length; k++) {
                if (_debug) _assert(slice_data[component.first + k].equals(component.source_data[k]));
              }
              slice_data.splice(component.first, component.source_data.length, component.target_data);
            }
  
  
            if (data.backward_limit.components.length > 0) {
  
              let targets = data.backward_limit.getComponentTargets();
  
              // Check backward limit data
              for (let j=data.backward_limit.components.length - 1; j>=0; j--) {
                let component = data.backward_limit.components[j];
                if (_debug) _assert(slice_data[targets[j]].equals(component.target_data));
                slice_data.splice(targets[j], 1, ...component.source_data);
              }
  
              if (_debug) _assert(data.backward_limit.source_size == slice_data.length);
            }
          }
        }
      }
    }

    //Object.freeze(this);

    /*
    let sc = new SerializeCyclic();
    sc.update(this);
    let string = sc.stringify();
    let re = SerializeCyclic.destringify(string);
    let di = re.getHead();
    _assert(this.equals(di));
    //console.log('Diagram, n=' + this.n + ', length=' + string.length);
    */
  }

  // Turn Javascript object into Diagram class, adding in generators by reference
  /*
  static postRehydrate(diagram, generators) {
    if (!diagram) return null;
    _assert(diagram);
    if (diagram.n == 0) {
      let id = diagram.id;
      let type = generators[id];
      return new Diagram({ n:0, type });
    } else {
      let source = Diagram.postRehydrate(diagram.source, generators);
      let data = [];
      for (let i=0; i<diagram.data.length; i++) {
        data.push(Content.postRehydrate(data[i], generators));
      }
      return new Diagram({ n: diagram.n, source, data });
    }
  }
  */

  copy({id = this.id, source = this.source, data = this.data, n = this.n} = this) {
    return new Diagram({ n, id, source, data });
  }


  static fromMinimal(args) {

    if (args === null) return null;
    if (args.n == 0) return new Diagram(args);
    let data = [];
    if (_debug) _assert(args.source instanceof Diagram);
    let source = args.source;
    let minimal_level = source;
    for (let i=0; i<args.data.length; i++) {
      let content = Content.fromMinimal(args.data[i], minimal_level);
      data.push(content);
      minimal_level = content.rewrite(minimal_level);
    }
    let n = args.n;
    return new Diagram({ n, source, data });

  }

  lexicographicSort(b, positions, substitutions) {

    let a = this;
    _assert(b instanceof Diagram);
    _assert(a.n == b.n);

    // Sort by dimension
    //if (a.n != b.n) return a.n - b.n;

    // In dimension 0, sort lexicographically by id
    if (a.n == 0) {
      if (a.id == b.id) return 0
      return a.id < b.id ? -1 : +1;
    }

    // Sort by data length
    if (a.data.length != b.data.length) return a.data.length - b.data.length;

    // Sort by source. These have a lower dimension and have already been sorted.
    let a_source_index = positions.get(substitutions.get(a.source));
    let b_source_index = positions.get(substitutions.get(b.source));
    _assert(isNatural(a_source_index) && isNatural(b_source_index));
    if (a_source_index != b_source_index) return a_source_index - b_source_index;

    // Finally, sort by data
    for (let i=0; i<a.data.length; i++) {
      let a_content = a.data[i];
      let b_content = b.data[i];
      let a_content_index = positions.get(substitutions.get(a_content));
      let b_content_index = positions.get(substitutions.get(b_content));
      _assert(isNatural(a_content_index) && isNatural(b_content_index));
      if (a_content_index != b_content_index) return a_content_index - b_content_index;
    }

    // They are equal
    return 0;
  }



  toJSON() {

    if (this.n == 0) {
      return {
        n: 0,
        id: this.id,
        _t: 'D'
      }
    };

    return {
      n: this.n,
      source: this.source.toJSON(),
      data: this.data.map(x => x.toMinimalJSON()),
      _t: 'MinimalDiagram'
    };

  }

  validate() {
    return true;
  }

  // The type of the object
  getType() {
    return "D";
  }

  // Check if the diagram has any non-identity data up to the given height
  hasTopLevelContent(height = this.height) {
    for (let level = 0; level <= height; level++) {
      if (this.data[height] != null) {
        return true;
      }
    }

    return false;
  }

  getTarget() {
    if (this.n == 0) {
      return null;
    } else {
      return this.getSlice({
        height: this.data.length,
        regular: true
      });
    }
  }

  // I don't like getters, do we have to use them?
  get target() {
    return this.getTarget();
  }

  getSlice(...locations) {
    if (locations.length == 0) return this;

    if (_debug) _assert(this.n > 0);

    // Recursive case
    let pos = locations.shift();

    if (typeof(pos) === "number") {
      pos = Math.max(0, pos);
      pos = Math.min(this.data.length * 2, pos);
      pos = { height: Math.floor(pos / 2), regular: pos % 2 == 0 };
    }

    if (_debug) _assert(!isNaN(pos.height));
    if (_debug) _assert(pos.regular != undefined);

    if (locations.length > 0) {
      // No need to copy slice.
      return this.getSlice(pos).getSlice(...locations);
    }

    // Handle request for slice 1 of identity diagram gracefully
    if (pos.height == 1 && pos.regular && this.data.length == 0) {
      return this.source;
    }

    if (_debug) _assert((pos.regular && pos.height <= this.data.length) || (!pos.regular && pos.height < this.data.length));
    if (_debug) _assert(pos.height <= this.data.length);

    if (pos.height == 0 && pos.regular) return this.source;

    if (pos.regular) {
      let singular = this.getSlice({ height: pos.height - 1, regular: false });
      if (_debug) _assert(this.data[pos.height - 1]);
      return this.data[pos.height - 1].backward_limit.rewrite_backward(singular);
    } else {
      let regular = this.getSlice({ height: pos.height, regular: true });
      if (_debug) _assert(this.data[pos.height]);
      return this.data[pos.height].forward_limit.rewrite_forward(regular);
    }
  }

  /**
   * Return the ways that the goal (up to goal_size) fits inside this diagram (up to max_height),
   * with match starting at the specified height, and including click_point if present
   */
  enumerate({
    goal,
    goal_size,
    start_height,
    max_height
  }) {
    if (_debug) _assert(this.n == goal.n);

    // Base case
    if (this.n == 0) {
      if (this.id == goal.id) {
        // Return a single trivial match
        return [[]]; 
      } else {
        // Return no matches
        return [];
      }
    }

    if (goal_size === undefined) goal_size = goal.data.length;

    if (max_height === undefined) max_height = this.data.length;

    // If this diagram is too short to yield a possible match, return empty
    if (start_height === undefined && max_height < goal_size) return [];

    if (start_height !== undefined && max_height < start_height + goal_size) return [];

    // The matches at least contain all the matches in the history of the diagram
    let matches = [];
    if (max_height > 0 && start_height == undefined) {
      matches = this.enumerate({ goal, goal_size, start_height, max_height: max_height - 1 });
    }

    // If goal_size == 0, we can try to find a match to a subslice
    if (goal_size == 0) {
      let slice_matches = this.getSlice({ height: max_height, regular: true })
        .enumerate({ goal: goal.source });

      for (let slice_match of slice_matches) {
        matches.push([max_height, ...slice_match]);
      }

      return matches;
    }

    // If goal_size > 0, we can try to extend a match of a smaller goal
    let new_matches = this.enumerate({
      goal,
      goal_size: goal_size - 1,
      start_height: max_height - goal_size,
      max_height: max_height - 1
    });

    for (let match of new_matches) {
      if (sub_content(this.data[max_height - 1], goal.data[goal_size - 1], match.slice(1))) {
        matches.push(match);
      }
    }

    return matches;
  }

  rewrite(data) {
    return data.backward_limit.rewrite_backward(data.forward_limit.rewrite_forward(this));
  }

  // Find the ID of the last cell that appears in the diagram
  getLastPoint() {
    if (this.n == 0) return this.type;
    if (this.data.length == 0) return this.source.getLastPoint();

    let point;
    for (let i=this.data.length-1; i>=0; i--) {
      let content = this.data[i];
      if (content.forward_limit.components.length == 0 && content.backward_limit.components.length == 0) {
        continue;
      }
      let slice_point = this.getSlice({height: i, regular: false}).getLastPoint();
      if (point === undefined || slice_point.n > point.n) {
        point = slice_point;
      }
    }

    return point;

    /*
    return this
      .getSlice({ height: k, regular: false })
      .getLastPoint();
    */
  }

  // Get the 0-diagram of 'leftmost action' at the given height (ANC-2018-2-2)
  getActionId(position) {
    if (this.n == 0) return this.id;
    if (typeof position === 'number') position = [position];
    if (position.length == 0) {
      if (this.data.length == 0) position = [0];
      else position = [1];
    }
    if (this.data.length == 0) return this.source.getActionId(position.slice(1)); // is this necessary?
    if (_debug) _assert(position.length > 0);
    let [slice, ...rest] = position;
    slice = Math.max(slice, 0);
    slice = Math.min(slice, 2 * this.data.length);
    
    // Recursive case
    if (rest.length > 0) {
      return this.getSlice(slice).getActionId(rest);
    }

    // Base case
    if (this.n == 1) {
      return this.getSlice(slice).id;

      /*
        if (height == null) {
            let t = 0;
            let max_dim = -1;
            for (let i = 0; i < this.data.length; i++) {
                let type = this.data[i].forward_limit.components[0].type;
                if (type.n > max_dim) {
                    max_dim = type.n;
                    t = i;
                }
            }
            return this.getSlice({ height: t, regular: false }).type;
        } else {
            return this.getSlice({ height, regular: false }).type;
        }
        */
    }

    // Regular subdiagram
    if (slice % 2 == 0) {
      return this.getSlice(slice).getActionId([]);
    }

    // Singular subdiagram, take the first nontrivial component
    let level = (slice - 1) / 2;
    let forward_targets = this.data[level].forward_limit.getComponentTargets();
    let backward_targets = this.data[level].backward_limit.getComponentTargets();
    if (forward_targets.length + backward_targets.length == 0) {
        return this.source.getActionId(0);
    }
    let t;
    if (forward_targets.length == 0 || backward_targets.length == 0) {
        t = forward_targets.length == 0 ? backward_targets[0] : forward_targets[0];
    } else {
        t = Math.min(forward_targets[0], backward_targets[0]);
    }
    return this.getSlice(slice).getActionId(2 * t + 1);
  }

  // Get apparent wire depths for displaying homotopies
  getWireDepths(up, across) {
    let r1 = this.getSlice({ height: up, regular: true });
    let s = this.getSlice({ height: up, regular: false });
    let source_depths = Diagram.getLimitWireDepths(this.data[up].forward_limit, r1, s, across);
    let r2 = this.getSlice({ height: up + 1, regular: true });
    let target_depths = Diagram.getLimitWireDepths(this.data[up].backward_limit, r2, s, across);
    return { source_depths, target_depths };
  }

  static getLimitWireDepths(limit, source, target, singular_index) {
    let m = limit.getMonotone(source.data.length, target.data.length);
    let p = m.preimage(singular_index);
    let sublimit_target = target.getSlice({ height: singular_index, regular: false });
    let depths = [];
    for (let i = p.first; i < p.last; i++) {
      let n = source.data[i].getFirstSingularNeighbourhood();
      if (_debug) _assert(n != null);
      let sublimit = limit.subLimit(i);
      let sublimit_source = source.getSlice({ height: i, regular: false });
      let sublimit_mono = sublimit.getMonotone(sublimit_source.data.length, sublimit_target.data.length);
      depths.push(sublimit_mono[n]);
    }
    return depths;
  }

  normalizeSingular() {
    let r = this.normalizeSingularRecursive([]);
    return { diagram: r.diagram, embedding: r.embedding };
  }

  /* Normalizes the diagram relative to the given incoming limits.
   * Returns object with the following properties:
   *  - diagram, the normalized diagram;
   *  - embedding, a limit from the normalized diagram into the original diagram;
   *  - factorizations, limits into the normalized diagram that factorize the originally-provided
   *      limits through the embedding.
   */
  normalizeSingularRecursive(limits) {
    for (let i = 0; i < limits.length; i++) {
      let limit = limits[i];
      if (_debug) _assert(limit instanceof Limit);
      if (_debug) _assert(limit.n == this.n);
    }

    // Starting point is that all limits have themselves as the factorization
    let factorizations = limits.slice();

    // Base case: 0-diagrams always normalize to themselves.
    if (this.n == 0) {
      let id = new Limit({ n: 0 });
      return { diagram: this, embedding: new Limit({ n: 0, components: [] }), factorizations: limits };
    }

    // If any incoming limits are the identity, the diagram doesn't change
    for (let i=0; i<limits.length; i++) {
      let limit = limits[i];
      if (limit.components.length == 0) {
        let diagram = this;
        let embedding = new Limit({ n: this.n, components: [] });
        let factorizations = limits;
        return { diagram, embedding, factorizations };
      }
    }

    // Store the new data for the normalized diagram
    let new_data = [];

    // Store the components for the embedding limit
    let embedding_components = [];

    // As we go along we will build up the components for the factorized limits
    let new_limit_components = [];
    for (let i=0; i<limits.length; i++) {
      new_limit_components.push([]);
    }

    // Now handle the main diagram level-by-level
    for (let i = 0; i < this.data.length; i++) {

      // Obtain this singular slice
      let slice = this.getSlice({ regular: false, height: i });

      // List all the incoming limits
      let level_limits = [];
      let level_sublimits = [];
      let limit_component_indices = [];
      for (let j = 0; j < limits.length; j++) {
        let limit = limits[j];
        let index = limit.getTargetComponentIndex(i);
        limit_component_indices.push(index);
        let sublimits = (index == null) ? [] : limit.components[index].sublimits;
        level_limits = level_limits.concat(sublimits);
        level_sublimits.push(sublimits);
      }
      level_limits.push(this.data[i].forward_limit);
      level_limits.push(this.data[i].backward_limit);

      // Normalize this singular slice recursively
      let recursive = slice.normalizeSingularRecursive(level_limits);

      // Store the new data for the normalized diagram at this level
      let new_content = new Content({ n: this.n - 1, forward_limit: ArrayUtil.penultimate(recursive.factorizations), backward_limit: ArrayUtil.last(recursive.factorizations) });
      new_data.push(new_content);

      // Create the LimitComponent to embed this slice of the normalized diagram
      if (recursive.embedding.components.length > 0) {
        let component = new LimitComponent({ n: this.n,
          first: i,
          source_data: [ new_content /*this.data[i]*/ ],
          sublimits: [ recursive.embedding ],
          target_data: /*new_content*/ this.data[i] });
        embedding_components.push(component);
      }

      // Update the factorizations of the limits which have been passed in
      let sublimit_index = 0;
      for (let j = 0; j < limits.length; j++) {
        let index = limit_component_indices[j];
        if (index == null) continue; // this limit might not hit this singular level
        let limit = limits[j];
        let orig = limit.components[index];

        let fac_sublimits = [];
        for (let k=0; k<orig.sublimits.length; k++) {
          fac_sublimits.push(recursive.factorizations[sublimit_index + k]);
        }
        sublimit_index += orig.sublimits.length;

        if (fac_sublimits.length == 1 && fac_sublimits[0].components.length == 0) {
          // trivial!
        } else {
          let comp = new LimitComponent({ n: orig.n, first: orig.first, sublimits: fac_sublimits, source_data: orig.source_data, target_data: new_content});
          new_limit_components[j].push(comp);
        }
      }
    }

    // Build the normalized diagram
    let diagram = new Diagram({ n: this.n, source: this.source, data: new_data });

    // Build the embedding of 'diagram' into 'this'
    let embedding = new Limit({ n: this.n, components: embedding_components, source_size: diagram.data.length });

    // Consistency debug check
    embedding.verifySource(diagram);

    // Build the factorizations
    //let factorizations = [];
    for (let i=0; i<limits.length; i++) {
      factorizations[i] = new Limit({ n: this.n, components: new_limit_components[i], source_size: limits[i].source_size }); // none of limits are the identity
    }

    // Prepare a list of the factorization monotones
    let factorization_monotones = [];
    for (let i=0; i<factorizations.length; i++) {
      let fac = factorizations[i];
      factorization_monotones.push(fac.components.length == 0 ? null : fac.getMonotone());
    }

    // Remove superfluous top-level bubbles in the normalized diagram
    for (let i = 0; i < diagram.data.length; i++) {

      // If there's something interesting happening here, we won't remove it
      let content = diagram.data[i];
      if (content.forward_limit.components.length > 0) continue;
      if (content.backward_limit.components.length > 0) continue;

      // This level is a vacuum bubble. Let's check if it's in the image of an incoming limit.
      let in_image = false;
      for (let j = 0; j < factorizations.length; j++) {
        /*
        let index = factorizations[j].getTargetComponentIndex(i);
        if (index == null) continue;
        in_image = true;
        break;
        */
        let fac = factorization_monotones[j];
        if (fac) {
          let preimage = fac.preimage({first: i, last: i+1});
          if (preimage.first == preimage.last) continue;          
        }
        in_image = true;
        break;
      }
      if (in_image) continue;

      // We've found a vacuum bubble not in the image of any incoming limit, so remove it.
      diagram = diagram.removeLevel(i);

      // Update the embedding limit so that it creates this bubble
      let bubble_component = new LimitComponent({ n: this.n, first: i, sublimits: [], source_data: [], target_data: content});
      let create_bubble_limit = new Limit({ n: this.n, components: [bubble_component], source_size: diagram.data.length });
      embedding = embedding.compose(create_bubble_limit);

      // Update the factorizations so that they omit this target level
      for (let j = 0; j < limits.length; j++) {
        factorizations[j] = factorizations[j].removeTargetLevel(i);
        let fac = factorizations[j];
        if (fac.components.length == 0) {
          factorization_monotones[j] = null;
        } else {
          factorization_monotones[j] = fac.getMonotone();
        }
      }

      // Reduce the index by one
      i--;

    }

    // Consistency debug check
    embedding.verifySource(diagram);

    return { diagram, embedding, factorizations };
  }

  // Build a new diagram which omits a given level
  removeLevel(i) {
    if (_debug) _assert(isNatural(i));
    let new_data = [...this.data.slice(0, i), ...this.data.slice(i+1)];
    return new Diagram({ n: this.n, data: new_data, source: this.source});
  }

  getNontrivialNeighbourhoods() {
    let neighbourhoods = [];
    for (let i=0; i<this.data.length; i++) {
      let content = this.data[i];
      neighbourhoods[i] = Limit.getNontrivialNeighbourhoodsFamily(content.forward_limit, content.backward_limit);
    }
    return neighbourhoods;
  }

  // Typecheck this diagram
  typecheck(generators) {
    //console.log('n=' + this.n + ', typechecking diagram');
    if (this.n == 0) return true; // 0-diagrams always typecheck
    let regular = this.source;
    for (let i = 0; i < this.data.length; i++) {
      let data = this.data[i];
      if (!data.typecheck(generators, regular)) {
        return false;
      }
      let singular = data.forward_limit.rewrite_forward(regular);
      regular = data.backward_limit.rewrite_backward(singular);
    }
    if (!this.source.typecheck(generators)) {
      return false;
    }
    return true;
  }

  getUniqueSingularType() {
    if (this.n == 0) return this.id;
    if (_debug) _assert(this.data.length == 1);
    let slice = this.getSlice({height: 0, regular: false});
    return slice.getUniqueSingularType();
  }

  // Typecheck a diagram with unique singular content
  typecheckBaseCase(generators) {

    // Identity diagrams type check
    if (this.data.length == 0) return true;

    // Get the type that sits at the centre of this diagram
    let id = this.getUniqueSingularType();
    let type = generators[id].generator;
    
    // Zero dimensional diagrams typecheck only for zero dimensional types
    if (this.n == 0) {
      if (type.n > 0) {
        console.log("Typecheck failed, 0-diagram must be a 0-cell");
        return false;
      }
    }

    // If the dimension of the central type is high, it cannot typecheck
    if (type.n > this.n) {
      console.log("Typecheck failed, dimension of central type is too high");
      return false;
    }

    // If the dimension of the central type is low, the separate limits must be homotopies
    if (type.n < this.n) {
      let f = this.data[0].forward_limit;
      let b = this.data[0].backward_limit;
      if (!f.typecheck({ forward: null, source: this.source, generators })) {
        console.log("Typecheck failed, forward limit is not a homotopy");
        return false;
      }
      if (!b.typecheck({ forward: null, source: this.getTarget(), generators })) {
        console.log("Typecheck failed, backward limit is not a homotopy");
        return false;
      }
      return true;
    }

    // Otherwise, it must be exactly the defining diagram of a generator
    if (!type.source.equals(this.source)) {
      console.log("Typecheck failed, source boundary error");
      return false;
    }
    if (!type.target.equals(this.getTarget())) {
      console.log("Typecheck failed, target boundary error");
      return false;
    }
    return true;
  }

  normalizeRegular() {
    return Limit.normalizeRegularRecursive({source: this, limits: []}).source;
  }
  
  composeAtRegularLevel({ height, limit }) {
    if (_debug) _assert(isNatural(height));
    if (_debug) _assert(limit instanceof Limit);

    // Base case
    if (this.n == limit.n + 1) {

      // Adjust the source if necessary
      let source = (height == 0 ? limit.rewrite_backward(this.source) : this.source);

      let data = this.data.slice();

      // Compose the forward limit
      if (height <= this.data.length - 1) {
        let forward_limit = data[height].forward_limit.compose(limit);
        let backward_limit = data[height].backward_limit;
        data[height] = new Content({ n: this.n - 1, forward_limit, backward_limit });
      }

      // Compose the backward limit
      if (height > 0) {
        let forward_limit = data[height - 1].forward_limit;
        let backward_limit = data[height - 1].backward_limit.compose(limit);
        data[height - 1] = new Content({ n: this.n - 1, forward_limit, backward_limit });
      }

      return new Diagram({ n: this.n, source, data });
    }

    if (_debug) _assert(this.n > limit.n);

    let source = this.source.composeAtRegularLevel({ height, limit });
    let data = [];
    for (let i=0; i<this.data.length; i++) {
      data[i] = this.data[i].composeAtRegularLevel({ height, limit });
    }

    return new Diagram({ n: this.n, source, data });
    
  }

  // Check if the specified id is used at all in this diagram
  usesId(id) {
    if (this.n == 0) return this.id == id;
    if (this.source && this.source.usesId(id)) return true;
    for (let content of this.data) {
      if (content.usesId(id)) return true;
    }
    return false;
  }

  // Get the bounding box surrounding a diagram component
  getLocationBoundingBox(location) {
    if (_debug) _assert(this.n == location.length);

    if (this.n == 0) return { min: [], max: [] };
    if (location.length == 0) debugger;
    var box = this.sgetSliceBoundingBox(location);
    if (box == null) return null;
    var extra = (location.length > this.n ? location.slice(1) : location);
    box.min = box.min.concat(extra);
    box.max = box.max.concat(extra);
    if (extra.length == location.length) box.max[box.max.length - location.length]++;
    return box;
  }

  // Create the limit which contracts the a subdiagram at a given position, to a given id
  contractForwardLimit(id, position, subdiagram) {
    position = position || Array(this.n).fill(0);
    subdiagram = subdiagram || this;

    if (_debug) _assert(position.length == this.n);
    if (_debug) _assert(this.n == subdiagram.n);

    if (this.n == 0) {
      let source_id = subdiagram.id;
      let target_id = id;
      if (source_id == target_id) return new Limit({ n: 0, components: [] });
      return new Limit({ n: 0, components: [new LimitComponent({ n: 0, source_id: subdiagram.id, target_id: id })] });
    }

    let [height, ...rest] = position;
    let sublimits = [];
    for (let i = 0; i < subdiagram.data.length; i++) {
      let singular_slice = this.getSlice({ height: height + i, regular: false });
      let subdiagram_singular_slice = subdiagram.getSlice({ height: i, regular: false });
      sublimits.push(singular_slice.contractForwardLimit( id, rest, subdiagram_singular_slice ));
    }

    // Alternative that makes more sense...
    let source = this.getSlice({height, regular: true});
    let source_first_limit = source.contractForwardLimit(id, rest, subdiagram.source );
    let target = this.getSlice({ height: height + subdiagram.data.length, regular: true });
    let source_second_limit = target.contractForwardLimit(id, rest, subdiagram.target);
    let target_data = new Content({ n: this.n - 1, forward_limit: source_first_limit, backward_limit: source_second_limit });
    //let source_data = subdiagram.data.slice(height, height + subdiagram.data.length);
    let source_data = this.data.slice(height, height + subdiagram.data.length);
    let limit_component = new LimitComponent({ n: this.n, first: height, source_data, target_data, sublimits });
    return new Limit({ n: this.n, components: [limit_component], source_size: this.data.length });
  }

  // Create the limit which inflates the point at the given position, to a given subdiagram
  // WE USE THIS WHEN ATTACHING A GENERATOR TO A DIAGRAM.
  // NEED TO PASS IN MORE DATA TO deepPadData TO ALLOW LIMIT source_size PROPERTY TO BE CORRECTLY UPDATED
  contractBackwardLimit(id, position, subdiagram) {
    position = position || Array(this.n).fill(0);
    subdiagram = subdiagram || this;

    if (_debug) _assert(position.length == this.n);
    if (_debug) _assert(this.n == subdiagram.n);

    if (this.n == 0) {
      let component = new LimitComponent({ n: 0, source_id: subdiagram.id, target_id: this.id });
      return new Limit({ n: 0, components: [component] });
    }

    let [first, ...rest] = position;

    let sublimits = [];
    let singular_slice = this.getSlice({ height: position[0], regular: false });
    for (let i = 0; i < subdiagram.data.length; i++) {
      let subdiagram_singular_slice = subdiagram.getSlice({ height: i, regular: false });
      sublimits.push(singular_slice.contractBackwardLimit(id, rest, subdiagram_singular_slice));
    }

    // Get width differences
    let width_deltas = [];
    let diag = this;
    let subdiag = subdiagram;
    for (let i=0; i<this.n - 1; i++) {
      diag = diag.getSlice({height: position[i], regular: true});
      let diagram_width = diag.data.length;
      subdiag = subdiag.source;
      let subdiagram_width = subdiag.data.length;
      width_deltas.push(diagram_width - subdiagram_width);
    }

    let source_data = Content.deepPadData(subdiagram.data, rest, width_deltas);
    let target_data = this.data[first];

    let limit_component = new LimitComponent({ n: this.n, first, source_data, target_data, sublimits });
    return new Limit({ n: this.n, components: [limit_component], source_size: this.data.length + subdiagram.data.length - 1 });
  }

  singularData() {
    if (this.n == 0) return this.id;
    let array = [];
    for (let i = 0; i < this.data.length; i++) {
      let slice_array = this
        .getSlice({ height: i, regular: false })
        .singularData();
      array.push(slice_array);
    }
    return array;
  }

  equals(d2) {
    var d1 = this;
    if (d1.n != d2.n) return false;
    if (d1.n == 0) return d1.id == d2.id;
    if (d1.data.length != d2.data.length) return false;
    for (var i = 0; i < this.data.length; i++) {
      if (!d1.data[i].equals(d2.data[i])) return false;
    }
    return d1.source.equals(d2.source);
  }

  sameBoundary(d2) {
    if (!d2) return false;
    let d1 = this;
    if (d1.n != d2.n) return false;
    if (d1.n == 0) return true;
    if (!d1.source.equals(d2.source)) return false;
    if (!d1.getTarget().equals(d2.getTarget())) return false;
    return true;
  }

  // Produce the Content object that contracts a diagram
  // 2018-11-HIO-2
  homotopy(point, compass, generators) {

    // Convert from integer coordinates to regular/singular coordinates
    let location = point.map(x => ({ height: Math.floor(x / 2), regular: x % 2 == 0 }));

    // Work out if we're dragging horizontally
    let horizontal = new Set(['ene', 'ese', 'wsw', 'wnw']).has(compass);

    // Get the subdiagram where the user is clicking
    let click_diagram = this.getSlice(...(location.slice(0, location.length - (horizontal ? 1 : 2))));
    if (_debug) _assert(click_diagram);

    if (click_diagram.n < 2) {
      return { error: "Can't perform homotopy in " + click_diagram.n + "d subdiagram"};
    }

    // If we're dragging horizontally, the last point has to be singular
    if (horizontal) {

      let last_point = location[location.length - 1];

      // Check for situation where there's nothing to do
      if (last_point.regular) {
        console.log('Horizontal drag on a regular-regular patch, nothing to do');
        return;
      }

      // Add the depth of the component that the user is implicitly selecting
      let content = click_diagram.data[last_point.height];
      if (_debug) _assert(content);
      let targets = [...content.forward_limit.getComponentTargets(), ...content.backward_limit.getComponentTargets()];
      targets = targets.sort((a, b) => a - b);
      if (_debug) _assert(targets.length > 0);
      location.push({height: targets[0], regular: false});

    }

    // Get the direction and 'tendency' of the drag
    let direction;
    let tendency;
    if (horizontal) {
      if (compass == 'ese' || compass == 'ene') {
        direction = +1;
        tendency = -1;
      } else if (compass == 'wnw' || compass == 'wsw') {
        direction = -1;
        tendency = +1;
      }
    } else {
      if (compass == 'nne') {
        direction = +1;
        tendency = +1;
      } else if (compass == 'nnw') {
        direction = +1;
        tendency = -1;
      } else if (compass == 'ssw') {
        direction = -1;
        tendency = +1;
      } else if (compass == 'sse') {
        direction = -1;
        tendency = -1;
      }
    }

    // Decide if it's a contraction or expansion
    let last = location[location.length - 1];
    let second_last = location[location.length - 2];
    let expansion;
    if (second_last.regular) {
      expansion = true;
    } else {
      let content = click_diagram.data[second_last.height];
      let targets = [...new Set([...content.forward_limit.getComponentTargets(), ...content.backward_limit.getComponentTargets()])];
      if (_debug) _assert(targets.length > 0);
      if (_debug) _assert(targets.indexOf(last.height) >= 0);
      expansion = targets.length > 1;
    }

    // Build the content object
    if (expansion) {

      let forward_limit = new Limit({ n: this.n, components: [], source_size: this.data.length });
      let backward_limit = this.getExpansionLimit({location, direction, generators});
      if (backward_limit.error) return backward_limit;
      let content = new Content({ n: this.n, forward_limit, backward_limit });
      if (!content.typecheck(generators, this)) {
        return { error: "Expansion doesn't typecheck" };
      }
      return content;
  
    } else { // contraction
    
      // Last coordinate irrelevant for contraction
      location = location.slice(0, location.length - 1);

      // We assume we're always contracting up, so adjust direction and last height appropriately
      if (direction < 0) {
        if (location[location.length - 1].height == 0) {
          return { error: "Can't drag a cell off the diagram" };
        }
        location[location.length - 1].height --;
      }
      let forward_limit = this.getContractionLimit({location, tendency, generators});
      if (forward_limit.error) return forward_limit;
      let singular = forward_limit.rewrite_forward(this);
      let normalization = singular.normalizeSingular();
      let backward_limit = normalization.embedding;
      let content = new Content({ n: this.n, forward_limit, backward_limit });
      if (!content.typecheck(generators, this)) {
        return { error: "Contraction doesn't typecheck" };
      }
      return content;  

    }

  }

  // Find the largest single contraction that type-checks, returning the contracting limit.
  // If no contractions are possible, return the identity.
  contract(generators, initial_height) {

    let n = this.n;

    if (initial_height === undefined) initial_height = 0;

    for (let start = initial_height; start < this.data.length - 1; start ++) {

      let valid_finish = null;
      let valid_contraction = null;

      for (let finish = start + 1; finish < this.data.length; finish ++) {

        // Try to contract from start to finish
        let singular = this.getSlice({ height: start, regular: false });
        let upper = [{ diagram: singular, bias: 0 }];
        let lower = [];
        for (let i=start; i<finish; i++) {
          let backward_limit = this.data[i].backward_limit;
          let forward_limit = this.data[i+1].forward_limit;
          let regular = backward_limit.rewrite_backward(singular);
          lower.push({ diagram: regular,
            left_index:  i - start,     left_limit:  backward_limit,
            right_index: i + 1 - start, right_limit: forward_limit
          });
          singular = forward_limit.rewrite_forward(regular);
          upper.push({ diagram: singular, bias: 0 });
        }
        let contraction = Diagram.multiUnify({ lower, upper, generators, depth: 0 });

        // If the contraction was not good, break out
        if (contraction.error) break;

        // The contraction seems good so far. Build the contracting limit.
        let source_data = this.data.slice(start, finish + 1);
        let sublimits = contraction.limits.slice();
        let first = start;
        let components = [new LimitComponent({ n, first, source_data, sublimits })];
        let source_size = this.data.length;
        let limit = new Limit({ n, components, source_size });

        // See if this contraction type checks
        let id = new Limit({ n });
        let content = new Content({ n, forward_limit: limit, backward_limit: id });
        if (!content.typecheck(generators, this)) break;

        // The contraction type checks, so remember it
        valid_finish = finish;
        valid_contraction = limit;

      }

      // We broke out, so this contraction wasn't valid.
      
      // If we never found a good one at this starting height, go to the next starting height
      if (!valid_contraction) continue;

      // Build the result of the contraction
      let target = valid_contraction.rewrite_forward(this);

      // Contract recursively
      let recursive = target.contract(generators, start + 1);

      // Return the final contraction as a composite
      return recursive.compose(valid_contraction);

    }

    // If we fell through to here, we never found a good contraction, so just return the identity
    return new Limit({ n });

  }

  getSingularContent() {
    if (this.n == 0) return this.id;
    let content = [];
    for (let i=0; i<this.data.length; i++) {
      let slice = this.getSlice({ height: i, regular: false});
      content.push(slice.getSingularContent());
    }
    return content;
  }

  getSingularContentJSON() {
    return JSON.stringify(this.getSingularContent());
  }

  // Recursive procedure constructing a Limit object that expands a diagram at a given position
  getExpansionLimit({location, direction, generators}) {

    if (_debug) _assert(location instanceof Array);
    if (_debug) _assert(location.length >= 2); // Expansion requires at least 2 coordinates

    if (location.length == 2) {

      // Smoothing
      if (location[0].regular) {

        // Check whether this is a valid smoothing scenario
        let smoothing_position;
        let r1_height;
        let c;

        // Forward smoothing
        if (direction > 0) {

          r1_height = location[0].height;
          c = this.data[r1_height];
          if (c.forward_limit.components.length == 0 || c.backward_limit.components.length == 0) {
            return { error: "Can't smooth homotopy, trivial limiting behaviour" };
          }
          let pushed_index = c.forward_limit.updateSliceForward([2 * location[1].height + (location[1].regular ? 0 : 1)]);
          smoothing_position = {height: Math.floor(pushed_index / 2), regular: pushed_index % 2 == 0};
          if (smoothing_position.regular) {
            return { error: "Can't smooth homotopy, chosen point flows to regular height" };
          }

        }

        // Backward smoothing
        else {

          r1_height = location[0].height - 1;
          c = this.data[r1_height];
          if (c.forward_limit.components.length == 0 || c.backward_limit.components.length == 0) {
            return { error: "Can't smooth homotopy, trivial limiting behaviour" };
          }
          let pushed_index = c.backward_limit.updateSliceForward([2 * location[1].height + (location[1].regular ? 0 : 1)]);
          smoothing_position = {height: Math.floor(pushed_index / 2), regular: pushed_index % 2 == 0};
          if (smoothing_position.regular) {
            return { error: "Can't smooth homotopy, chosen point flows to regular height" };
          }

        }


        let targets_f = c.forward_limit.getComponentTargets();
        let index_f = targets_f.indexOf(smoothing_position.height);
        let targets_b = c.backward_limit.getComponentTargets();
        let index_b = targets_b.indexOf(smoothing_position.height);
        if (index_f < 0 || index_b < 0) {
          return { error: "Can't smooth homotopy, chosen location not suitable" };
        }

        let range = { first: smoothing_position.height, last: smoothing_position.height + 1 };
        let forward_preimage = c.forward_limit.preimage(range);
        let backward_preimage = c.backward_limit.preimage(range);
        if (_debug) _assert(forward_preimage.length == 1);
        if (_debug) _assert(backward_preimage.length == 1);
        if (!forward_preimage.equals(backward_preimage)) {
          return { error: "Can't smooth homotopy, incoming limits not locally symmetrical" };
          throw 0;
        }
        let new_forward_components = [];
        for (let i=0; i<c.forward_limit.components.length; i++) {
          if (i == index_f) continue;
          new_forward_components.push(c.forward_limit[i]);
        }
        let new_backward_components = [];
        for (let i=0; i<c.backward_limit.components.length; i++) {
          if (i == index_b) continue;
          new_backward_components.push(c.backward_limit[i]);
        }
        let new_forward = c.forward_limit.copy({components: new_forward_components});
        let new_backward = c.backward_limit.copy({components: new_backward_components});
        let new_content = new Content({ n: this.n - 1, forward_limit: new_forward, backward_limit: new_backward });
        let source_data = [new_content];

        let offset_first = c.forward_limit.components[index_f].first;
        for (let i=0; i<index_f; i++) {
          let component = c.forward_limit.components[i];
          offset_first -= component.source_data.length - 1;
        }
        let sublimit_component = c.forward_limit.components[index_f].copy({ first: offset_first });
        let r1 = this.getSlice({height: r1_height, regular: true});
        let new_singular = new_forward.rewrite_forward(r1);
        let sublimit = new Limit({ n: this.n - 1, components: [sublimit_component], source_size: new_singular.data.length });

        // Construct expansion limit
        let collapse = c.forward_limit.components.length == 1 && c.backward_limit.components.length == 1;
        let component;
        if (collapse) {
          component = new LimitComponent({ n: this.n, first: r1_height,
            source_data: [], sublimits: [], target_data: c});
        } else {            
          component = new LimitComponent({ n: this.n, first: r1_height,
            source_data, sublimits: [sublimit], target_data: c});
        }

        let expansion_limit = new Limit({ n: this.n, components: [component], source_size: this.data.length - (collapse ? 1 : 0) });
        return expansion_limit;

      }

      // Expansion base case
      if (_debug) _assert(!location[0].regular && !location[1].regular); // both coordinates must be singular
      let r1 = this.getSlice({ height: location[0].height, regular: true });
      let r2 = this.getSlice({ height: location[0].height + 1, regular: true });
      let s = this.getSlice({ height: location[0].height, regular: false });
      let first = location[0].height;
      let target_data = this.data[first];

      if (direction > 0) {

        let expansion = target_data.getExpansionData(location[1].height, r1, r2, s);
        let component = new LimitComponent({ n: this.n, source_data: expansion.data, target_data, sublimits: expansion.sublimits, first });
        return new Limit({ n: this.n, components: [component], source_size: this.data.length + expansion.data.length - 1 });

      } else {

        let reverse_content = target_data.reverse();
        let reverse_expansion = reverse_content.getExpansionData(location[1].height, r2, r1, s);
        let data_0_rev = reverse_expansion.data[0].reverse();
        let data_1_rev = reverse_expansion.data[1].reverse();
        let source_data = [data_1_rev, data_0_rev];
        let sublimits = reverse_expansion.sublimits.reverse();
        let component = new LimitComponent({ n: this.n, source_data, target_data, sublimits, first });
        return new Limit({ n: this.n, components: [component], source_size: this.data.length + source_data.length - 1 });

      }

    } else if (location[0].regular) {

      return { error: "Can't expand regular slice" };

    } else { // Recursive expansion on singular slice, 2018-11-HIO-4

      console.log('Recursive expansion at ' + JSON.stringify(location));
      let slice = this.getSlice(location[0]);
      let recursive = slice.getExpansionLimit({ location: location.slice(1), direction, generators });

      // Try to factorize
      let expansion = (function() {

        // Factorize on the left and right
        let data = this.data[location[0].height];

        // Forward factorization
        let forward_factorization = data.forward_limit.factorThrough(recursive, generators);
        if (forward_factorization.error) {
          return { error: "Couldn't factorize forward limit\n" + forward_factorization.error };
        }

        // Backward factorization
        let backward_factorization = data.backward_limit.factorThrough(recursive, generators);
        if (backward_factorization.error) {
          return { error: "Couldn't factorize backward limit\n" + backward_factorization.error };
        }

        // Construct expansion data
        let first = location[0].height;
        let target_data = this.data[first];
        let source_data = [new Content({ n: this.n - 1, forward_limit: forward_factorization, backward_limit: backward_factorization })];
        let sublimits = [recursive];
        let component = new LimitComponent({ n: this.n, first, sublimits, source_data, target_data});
        let limit = new Limit({ n: this.n, components: [component], source_size: this.data.length });
        let preimage_diagram = limit.rewrite_backward(this);
        let normalization = preimage_diagram.normalizeSingular();
        console.log("Performed pullback");
        return limit.compose(normalization.embedding);

      }).bind(this)();

      // If the factorization was successful, return it
      if (!expansion.error) return expansion;

      // The factorization failed, just insert a bubble
      console.log('Factorization failed: ' + expansion.error);
      console.log('Inserting bubble instead');

      // Insert bubble
      let first = location[0].height;
      let target_data = this.data[first];
      let c1 = new Content({ n: this.n - 1, forward_limit: target_data.forward_limit, backward_limit: recursive });
      let c2 = new Content({ n: this.n - 1, forward_limit: recursive, backward_limit: target_data.backward_limit });
      let source_data = [c1, c2];
      let sublimits = [new Limit({ n: this.n - 1, components: [] }), new Limit({ n: this.n - 1, components: [] })];
      let component = new LimitComponent({ n: this.n, first, sublimits, source_data, target_data});
      let limit = new Limit({n: this.n, components: [component], source_size: this.data.length + 1 });
      return limit;

    }

  }

  // Recursive procedure that constructs a limit contracting a diagram at a given position
  getContractionLimit({location, tendency, generators}) {
    
    if (_debug) _assert(location instanceof Array);
    if (_debug) _assert(location.length >= 1); // Contraction requires at least 1 coordinate
    let height = location[0].height;
    if (_debug) _assert(!isNaN(height));
    if (_debug) _assert(tendency === -1 || tendency === 0 || tendency === 1);

    if (location.length == 1) {

      // Contraction base case
      if (_debug) _assert(!location[0].regular); // The UI should never trigger contraction from a regular slice
      if (_debug) _assert(height >= 0);
      if (height >= this.data.length - 1) {
        return { error: "Can't drag a cell off the diagram" };
      }
      let regular = this.getSlice({ height: height + 1, regular: true });
      let D1 = this.getSlice({ height, regular: false });
      let D2 = this.getSlice({ height: height + 1, regular: false });
      let L1 = this.data[height].backward_limit;
      let L2 = this.data[height + 1].forward_limit;
      /*
      let upper = [D1, D2];
      let lower = [{ diagram: regular, left_index: 0, right_index: 1, left_limit: L1, right_limit: L2, bias: tendency }];
      */

      let upper = [{ diagram: D1, bias: tendency }, {diagram: D2, bias: -tendency }];
      let lower = [{ diagram: regular, left_index: 0, right_index: 1, left_limit: L1, right_limit: L2 }];

      let contract_data = Diagram.multiUnify({ lower, upper, generators, depth: 0 });
      if (contract_data.error) return contract_data;

      // Build the limit to the contracted diagram
      let first = location[0].height;
      let sublimits = contract_data.limits;
      let data_forward = sublimits[0].compose(this.data[height].forward_limit);
      let data_backward = sublimits[1].compose(this.data[height + 1].backward_limit);
      let target_data = new Content({ n: this.n - 1, forward_limit: data_forward, backward_limit: data_backward });
      let source_data = this.data.slice(first, first + 2);
      let forward_component = new LimitComponent({ n: this.n, first, source_data, target_data, sublimits });
      return new Limit({n: this.n, components: [forward_component], source_size: this.data.length });

    } else if (location.length > 1) {

      // Recursive case
      let slice = this.getSlice(location[0]);
      let recursive = slice.getContractionLimit({ location: location.slice(1), tendency, generators });
      let first = height;

      if (location[0].regular) {

        // Contraction recursive case on regular slice: insert bubble.
        let target_data = new Content({ n: this.n - 1, forward_limit: recursive, backward_limit: recursive });
        let component = new LimitComponent({ n: this.n, source_data: [], target_data, first, sublimits: [] });
        return new Limit({ n: this.n, components: [component], source_size: this.data.length });

      } else {

        // Contraction recursive case on singular slice: postcompose.
        let forward_first = this.data[height].forward_limit;
        let backward_first = this.data[height].backward_limit;
        let new_forward = recursive.compose(forward_first);
        let new_backward = recursive.compose(backward_first);
        let target_data = new Content({ n: this.n - 1, forward_limit: new_forward, backward_limit: new_backward });
        let source_data = this.data.slice(height, height + 1);
        let component = new LimitComponent({ n: this.n, source_data, target_data, first, sublimits: [recursive] });
        return new Limit({ n: this.n, components: [component], source_size: this.data.length });

      }

    }

    if (_debug) _assert(false);

  }

  // Compute a simultaneous unification of limits
  static multiUnify({ lower, upper, depth, generators }) {

    _assert(upper[0].diagram);
    let n = upper[0].diagram.n;

    if (_debug) {

      for (let i = 0; i < upper.length; i++) {
        _propertylist(upper[i], ["diagram", "bias"]);
        _assert(upper[i].diagram instanceof Diagram);
        _assert(upper[i].diagram.n == n);
        _assert(upper[i].bias === -1 || upper[i].bias === 0 || upper[i].bias === 1);
      }

      for (let i = 0; i < lower.length; i++) {
        let l = lower[i];
        _propertylist(l, ["left_index", "left_limit", "right_index", "right_limit", "diagram"]);
        _assert(l.diagram instanceof Diagram && l.left_limit instanceof Limit && l.right_limit instanceof Limit);
        _assert(isNatural(l.left_index) && isNatural(l.right_index));
        _assert(l.left_index < upper.length && l.right_index < upper.length);
        _assert(l.diagram.n == n && l.left_limit.n == n && l.right_limit.n == n);
        //_assert(Number.isInteger(l.bias) && (l.bias >= -1) && (l.bias <= 1));
      }

      _assert(upper.length > 0); // doesn't make sense to pushout no families (?)
      _assert(isNatural(depth));
    }

    // Special case of an identity pushout
    // ... should handle this as it occurs a lot ...    

    // Base case
    if (n == 0) {

      // Tabulate the top-dimensional types that appear
      let top_types = [];
      for (let i = 0; i < upper.length; i++) Diagram.updateTopTypes(top_types, upper[i].diagram.id, generators);
      for (let i = 0; i < lower.length; i++) Diagram.updateTopTypes(top_types, lower[i].diagram.id, generators);

      // If there's more than one top-dimensional type, throw an error
      if (_debug) _assert(top_types.length > 0);
      if (top_types.length > 1) {
        return { error: "Doesn't contract"
          + (depth > 0 ? " at codimension " + depth : "")
          + ", multiple top types in base case"
        };
      }
      let target_id = top_types[0].generator.id;

      // Build the cocone maps
      let limits = [];
      for (let i = 0; i < upper.length; i++) {
        let source_id = upper[i].diagram.id;
        limits.push(new Limit({ n: 0,
          components:
            source_id == target_id
            ? []
            : [new LimitComponent({ n: 0, source_id, target_id })] 
          })
        );
      }

      // Return the final data
      let target = new Diagram({ n: 0, id: target_id });
      return { limits, target };
      
    }

    // Get the unification of the singular monotones
    let m_upper = [];
    for (let i = 0; i < upper.length; i++) {
      m_upper[i] = { size: upper[i].diagram.data.length, bias: upper[i].bias };
    }
    let m_lower = [];
    for (let i = 0; i < lower.length; i++) {
      let m_left = lower[i].left_limit.getMonotone(lower[i].diagram, upper[lower[i].left_index].diagram);
      let left = { target: lower[i].left_index, monotone: m_left };
      let m_right = lower[i].right_limit.getMonotone(lower[i].diagram, upper[lower[i].right_index].diagram);
      let right = { target: lower[i].right_index, monotone: m_right };
      //let bias = lower[i].bias;
      m_lower.push({ left, right });
    }
    let m_unif = Monotone.multiUnify({ lower: m_lower, upper: m_upper });
    if (m_unif.error) {
      if (depth == 0) return m_unif;
      m_unif.error += " at codimension " + depth;
      return m_unif;
    }

    // Find size of unification set
    let target_size = m_unif[0].target_size;

    // For each element of unification set, recursively unify
    let limit_components = [];
    for (let i = 0; i < upper.length; i++) limit_components[i] = [];
    let target_content = [];
    for (let i = 0; i < target_size; i++) {
      let component = Diagram.multiUnifyComponent({ upper, lower }, m_unif, m_lower, i, generators, depth);
      if (component.error) return component;
      target_content.push(component.target_content);
      for (let j = 0; j < upper.length; j++) {
        if (!component.cocone_components[j]) continue;
        limit_components[j].push(component.cocone_components[j]);
      }
    }

    // Build final data
    let target = new Diagram({ n, source: upper[0].diagram.source, data: target_content });
    let limits = [];
    for (let i = 0; i < upper.length; i++) {
      limits.push(new Limit({ n, components: limit_components[i], source_size: upper[i].diagram.data.length }));
    }

    // Return final data
    return { limits, target };
  }


  static updateTopTypes(top_types, id, generators) {
    if (_debug) _assert(generators);
    let type = generators[id];
    if (top_types.indexOf(type) >= 0) return; // type already in list
    if (top_types.length == 0 || type.generator.n == top_types[0].generator.n) {
      top_types.push(type);
      return;
    }
    if (type.generator.n < top_types[0].generator.n) return;
    if (_debug) _assert(type.generator.n > top_types[0].generator.n);
    top_types.length = 0;
    top_types.push(type);
  }

  static updateTypes(types, type) {
    if (_debug) _assert(type instanceof Generator);
    if (_debug) _assert(types.type1 != types.type2 || (types.type1 == null && types.type2 == null));
    if (types.type1 != null && types.type2 != null) _assert(types.type1.n < types.type2.n);
    if (types.type2 != null) _assert(types.type1 != null);
    if (types.type1 == type || types.type2 == type) return;
    if (types.type1 == null) types.type1 = type;
    else if (types.type2 == null) types.type2 = type;
    else throw "inconsistent types";
    if (types.type1 != null && types.type2 != null && types.type1.n > types.type2.n) {
      [types.type1, types.type2] = [types.type2, types.type1];
    }
  }

  static multiUnifyComponent({ upper, lower }, m_cocone, m_lower, height, generators, depth) {

    // Restrict upper, lower to the appropriate heights
    let upper_preimage = [];
    let lower_preimage = [];
    let upper_ranges = [];
    let lower_ranges = [];
    for (let i = 0; i < upper.length; i++) {
      upper_ranges[i] = m_cocone[i].preimage(height);
      upper_preimage.push(upper[i].diagram.restrict(upper_ranges[i]));
    }
    for (let i = 0; i < lower.length; i++) {
      let l = lower[i];
      let left_index = l.left_index;
      let right_index = l.right_index;
      let left_limit = l.left_limit.preimage(upper_ranges[left_index]);
      let right_limit = l.right_limit.preimage(upper_ranges[right_index]);
      let left_monotone = l.left_limit.getMonotone(l.diagram.data.length, upper[l.left_index].diagram.data.length);
      let left_preimage = left_monotone.preimage(upper_ranges[l.left_index]);
      lower_ranges.push(left_preimage);
      let diagram = l.diagram.restrict(left_preimage);
      let bias = l.bias;
      lower_preimage.push({ left_index, right_index, left_limit, right_limit, diagram /*, bias*/ });
    }

    // Explode the upper singular and regular diagrams
    let upper_exploded = [];
    let lower_exploded = [];
    let upper_slice_position = [];
    for (let i = 0; i < upper.length; i++) {
      let u = upper_preimage[i];
      let slice_positions = [];
      //let bias = upper[i].bias;
      let bias = 0; // remove bias for codimension > 0
      for (let j = 0; j < u.data.length; j++) {
        slice_positions.push(upper_exploded.length);
        //upper_exploded.push(u.getSlice({ height: j, regular: false }));
        upper_exploded.push({diagram: u.getSlice({ height: j, regular: false }), bias});
        if (j == 0) continue; // one less regular level than singular level to include
        let diagram = u.getSlice({ height: j, regular: true });
        let left_limit = u.data[j - 1].backward_limit;
        let right_limit = u.data[j].forward_limit;
        let left_index = upper_exploded.length - 2;
        let right_index = upper_exploded.length - 1;
        //lower_exploded.push({ diagram, left_limit, right_limit, left_index, right_index, bias: 0 });
        lower_exploded.push({ diagram, left_limit, right_limit, left_index, right_index /*, bias: 0*/ });
      }
      upper_slice_position.push(slice_positions);
    }

    // Extract the lower singular diagrams
    for (let i = 0; i < lower.length; i++) {
      let l = lower_preimage[i];
      for (let j = 0; j < l.diagram.data.length; j++) {
        let diagram = l.diagram.getSlice({ height: j, regular: false }); 
        let left_limit = l.left_limit.subLimit(j);
        let right_limit = l.right_limit.subLimit(j);
        let lower_offset = lower_ranges[i].first;
        let upper_right_offset = upper_ranges[l.right_index].first;
        let upper_left_offset = upper_ranges[l.left_index].first;
        let left_index = upper_slice_position[l.left_index][m_lower[i].left.monotone[j + lower_offset] - upper_left_offset];
        let right_index = upper_slice_position[l.right_index][m_lower[i].right.monotone[j + lower_offset] - upper_right_offset];
        let bias = l.bias;
        //lower_exploded.push({ diagram, left_limit, right_limit, left_index, right_index, bias });
        lower_exploded.push({ diagram, left_limit, right_limit, left_index, right_index /*, bias*/ });
      }
    }
    let exploded = { upper: upper_exploded, lower: lower_exploded, generators, depth: depth + 1 };
    if (_debug) _assert(upper_exploded.length > 0);
    let nonempty_upper = null;
    for (let i = 0; i < upper.length; i++) {
      if (upper_preimage[i].data.length > 0) {
        nonempty_upper = i;
        break;
      }
    }

    if (_debug) _assert(nonempty_upper != null);

    // Recursively unify
    let recursive = Diagram.multiUnify(exploded);
    if (recursive.error) return recursive;

    // Get the content for the main diagram
    let nu = upper[nonempty_upper].diagram;
    let recursive_first = recursive.limits[upper_slice_position[nonempty_upper][0]];
    let forward = recursive_first.compose(nu.data[upper_ranges[nonempty_upper].first].forward_limit);
    let last_slice_position = ArrayUtil.last(upper_slice_position[nonempty_upper]);
    let recursive_last = recursive.limits[last_slice_position];
    let backward = recursive_last.compose(nu.data[upper_ranges[nonempty_upper].last - 1].backward_limit);
    let target_content = new Content({ n: nu.n - 1, forward_limit: forward, backward_limit: backward });

    // Get the cocone components as forward limits
    let cocone_components = [];
    for (let i = 0; i < upper.length; i++) {
      let first = upper_ranges[i].first;
      let last = upper_ranges[i].last;
      let sublimits = [];
      for (let j = first; j < last; j++) {
        let sublimit = recursive.limits[upper_slice_position[i][j - first]];
        sublimits.push(sublimit);
      }
      if (sublimits.length == 1 && sublimits[0].components.length == 0) {
        cocone_components[i] = null;
      } else {
        let source_data = upper_preimage[i].data.slice();
        cocone_components[i] = new LimitComponent({ n: upper[0].diagram.n, first, source_data, target_data: target_content, sublimits });
      }
    }

    return { target_content, cocone_components };
  }

  restrict(range) {
    let source = this.getSlice({ height: range.first, regular: true });
    let data = [];
    for (let i = range.first; i < range.last; i++) {
      data.push(this.data[i]);
    }
    let n = this.n;
    return new Diagram({ n, source, data });
  }

  // Turns an n-diagram into an identity (n+1)-diagram
  boost() {
    return new Diagram({ n: this.n + 1, source: this, data: [] });
  }

  // Compute preimage of this diagram under the given subset
  restrictToSubset(subset) {

    // Return everything
    if (subset === null) return this;

    // Return nothing
    if (subset === undefined) return null;

    if (_debug) _assert(subset instanceof Array);

    // Check top-level range of the subset of the target
    let range = {first: null, last: null};
    for (let i=0; i<subset.length; i++) {
      if (subset[i] === undefined) continue;
      if (range.first === null) range.first = i;
      range.last = i + 1;
    }

    // Handle the case of a regular subset
    if (subset.regular) {
      if (_debug) _assert(range.last == range.first + 1);
      let regular = this.getSlice({height: range.first, regular: true});
      let restricted = regular.restrictToSubset(subset[range.first]);
      return new Diagram({ n: this.n, source: restricted, data: [] });
    }

    let source;
    let data = [];
    for (let i=range.first; i<range.last; i++) {
      if (_debug) _assert(this.data[i]);
      let forward_limit = this.data[i].forward_limit.restrictToPreimage(subset[i]);
      let backward_limit = this.data[i].backward_limit.restrictToPreimage(subset[i]);
      let content = new Content({ n: this.n - 1, forward_limit, backward_limit });
      data.push(content);

      // Set the source of the restricted diagram
      if (i == range.first) {
        let source_level_subset = this.data[i].forward_limit.pullbackSubset(subset[i]);
        source = this.getSlice({ height: i, regular: true }).restrictToSubset(source_level_subset);
      }
    }

    return new Diagram({ n: this.n, source, data });
  }

  getSingularPointsWithId(dimension) {
    if (_debug) {
      _assert(isNatural(dimension));
      _assert(dimension <= this.n);
    }
    if (dimension == 0) return [{ coordinates: [], id: this.getActionId([]) }];
    let slices = this.getSlices();
    let slices_singular = [];
    for (let i=0; i<this.data.length + 2; i++) {
      let height = (2 * i) - 1;
      let adjusted = this.adjustHeight(height);
      let slice = slices[adjusted];
      let slice_singular = slice.getSingularPointsWithId(dimension - 1)
        .map(point => { return {coordinates: [height, ...point.coordinates], id: point.id} });
      slices_singular.push(slice_singular);
    }
    return slices_singular.flat();
  }

  getSingularPoints(dimension) {
    if (_debug) {
      _assert(isNatural(dimension));
      _assert(dimension <= this.n);
    }
    if (dimension == 0) return [[]];
    let slices = this.getSlices();
    let slices_singular = [];
    for (let i=0; i<this.data.length + 2; i++) {
      let height = (2 * i) - 1;
      let adjusted = this.adjustHeight(height);
      let slice = slices[adjusted];
      let slice_singular = slice.getSingularPoints(dimension - 1)
        .map(point => [height, ...point]);
      slices_singular.push(slice_singular);
    }
    return slices_singular.flat();
  }

  getRegularPoints(dimension) {
    if (_debug) {
      _assert(isNatural(dimension));
      _assert(dimension <= this.n);
    }
    if (dimension == 0) return [[]];
    let slices = this.getSlices();
    let slices_regular = [];
    for (let i=0; i<this.data.length + 1; i++) {
      let height = 2 * i;
      let slice = slices[height];
      let slice_regular = slice.getRegularPoints(dimension - 1).map(point => [height, ...point]);
      slices_regular.push(slice_regular);
    }
    return slices_regular.flat();
  }

  // Get a list of simplices, for a rendering of the given dimension
  skeleton({ generators, dimension, max_simplex_size, need_scaffold_pairs }) {

    if (_debug) {
        _assert(isNatural(dimension));
        _assert(dimension <= this.n);
        _assert(isNatural(max_simplex_size));
    }

    // 0-dimensional diagrams have a single 1-simplex, with no coordinates
    if (dimension == 0) {
      let point_names = [''];
      let id = this.getActionId([]);
      let simplices = [new Simplex({point_names, id})];
      let n = this.n;
      let complex = new Complex({simplices, n, generators});
      return { complex, scaffold_pairs: null };
    }

    // Get all the slices of the diagram
    let slices = this.getSlices();
    let simplices = [];

    // Take the disjoint union of all the slices of the diagram
    let complex = new Complex({ n: this.n, generators, simplices }); // start with an empty complex
    for (let height=-1; height<=1+this.data.length*2; height++) {
      let adjusted = this.adjustHeight(height);
      let slice = slices[adjusted];
      let slice_skeleton = slice
        .skeleton({ generators, dimension: dimension - 1, max_simplex_size: max_simplex_size - 1 });
      let slice_complex = slice_skeleton.complex.prependCoordinate(height);
      complex = complex.addDisjointSimplices(slice_complex);
    }

    // For all pairs of adjacent heights, get the new edges
    let scaffold_pairs = [];
    for (let i=0; i<this.data.length + 1; i++) {
      let regular_height = 2 * i;
      let regular_slice = slices[regular_height];

      // Edges to singular level below
      let singular_below = slices[this.adjustHeight(regular_height - 1)];
      let b = this.getBackwardLimitFromRegular(regular_height);
      let b_edge_pairs = b.getScaffoldPointPairs({ source: regular_slice, target: singular_below, dimension: dimension - 1 });
      let comma = dimension == 1 ? '' : ',';
      let str_regular_height = regular_height.toString() + comma;
      let str_regular_minus_1 = (regular_height - 1).toString() + comma;
      b_edge_pairs = b_edge_pairs.map(edge => {
        return new Simplex({ point_names: [str_regular_height + edge.point_names[0], str_regular_minus_1 + edge.point_names[1]], id: edge.id });
      });
      scaffold_pairs.push(b_edge_pairs);
      complex = complex.addEdges(b_edge_pairs, max_simplex_size);

      // Edges to singular level above
      let singular_above = slices[this.adjustHeight(regular_height + 1)];
      let f = this.getForwardLimitFromRegular(regular_height);
      let f_edge_pairs = f.getScaffoldPointPairs({ source: regular_slice, target: singular_above, dimension: dimension - 1 });
      let str_regular_plus_1 = (regular_height + 1).toString() + comma;
      f_edge_pairs = f_edge_pairs.map(edge => {
        return new Simplex({ point_names: [str_regular_height + edge.point_names[0], str_regular_plus_1 + edge.point_names[1]], id: edge.id });
      });
      scaffold_pairs.push(f_edge_pairs);
      complex = complex.addEdges(f_edge_pairs, max_simplex_size);

    }

    return { complex, scaffold_pairs };
  }

  /* Gets all the names of all the points in the diagram */
  getAllPointNames(dimension) {
    if (dimension == 0) return [''];
    let names = [];
    if (dimension == 1) {
      for (let i=-1; i<2+2*this.data.length; i++) {
        names.push(i.toString());
      }
      return names;
    }
    let slices = this.getSlices();
    for (let i=-1; i<2+2*this.data.length; i++) {
      let adjusted = this.adjustHeight(i);
      let slice = slices[adjusted];
      let slice_names = slice.getAllPointNames(dimension - 1);
      let prefix = i.toString() + ',';
      let prefixed_slice_names = slice_names.map(name => prefix + name);
      names.push(prefixed_slice_names);
    }
    return names.flat();
  }

  /* Get all the points in the diagram */
  getAllPointsWithBoundaryFlag(dimension) {
    if (dimension == 0) return [[]];
    let names = [];
    if (dimension == 1) {
      for (let i=-1; i<2+2*this.data.length; i++) {
        names.push([i, i == -1 || i == 1 + 2 * this.data.length]);
      }
      return names;
    }
    let slices = this.getSlices();
    for (let i=-1; i<2+2*this.data.length; i++) {
      let adjusted = this.adjustHeight(i);
      let slice = slices[adjusted];
      let slice_names = slice.getAllPointsWithBoundaryFlag(dimension - 1);
      let prefixed_slice_names = slice_names.map(name => [i, ...name]);
      names.push(prefixed_slice_names);
    }
    return names.flat();
  }

  /* Get an array of all the slices of the diagram */
  getSlices() {
    let d = this.source;
    let array = [d];
    for (let i=0; i<this.data.length; i++) {
      let data = this.data[i];
      d = data.forward_limit.rewrite_forward(d);
      array.push(d);
      d = data.backward_limit.rewrite_backward(d);
      array.push(d);
    }
    return array;
  }

  /* Adjust height which is potentially out-of-bounds */
  adjustHeight(height) {
    if (_debug) {
      _assert(isInteger(height));
      _assert(height >= -1);
      _assert(height <= 1 + 2 * this.data.length);
    }
    if (height == -1) return 0;
    if (height == 1 + 2 * this.data.length) return 2 * this.data.length;
    return height;
  }

  getForwardLimitFromRegular(height) {
    if (_debug) {
      _assert(isInteger(height));
      _assert(height >= -1);
      _assert(height <= 1 + 2 * this.data.length);
      _assert(height % 2 == 0);
    }
    if (height == 2 * this.data.length) {
      return new Limit({n: this.n - 1, components: []});
      //return Monotone.getIdentity(slices[slices.length - 1].data.length - 1);
    }
    return this.data[height / 2].forward_limit;//.getMonotone(slices[height].data.length);
  }

  getBackwardLimitFromRegular(height) {
    if (_debug) {
      _assert(isInteger(height));
      _assert(height >= -1);
      _assert(height <= 1 + 2 * this.data.length);
      _assert(height % 2 == 0);
    }
    if (height == 0) {
      return new Limit({n: this.n - 1, components: []});
      //return Monotone.getIdentity(slices[0].data.length - 1);
    }
    return this.data[(height / 2) - 1].backward_limit;//.getMonotone(slices[height].data.length);
  }

  getForwardLimitToSingular(height) {
    return this.getForwardLimitFromRegular(height - 1);
  }

  getBackwardLimitToSingular(height) {
    return this.getBackwardLimitFromRegular(height + 1);
  }

  // Get the deep source points as strings
  getDeepSourcePoints(dimension) {
    if (dimension == 0) return [];
    if (dimension == 1) return ['-1'];
    let points = [];
    let slices = this.getSlices();
    for (let i=-1; i<2*this.data.length+2; i++) {
      let adjusted = this.adjustHeight(i);
      let slice = slices[adjusted];
      let slice_dsp = slice.getDeepSourcePoints(dimension - 1);
      let prefix = i.toString() + ',';
      let prefixed_slice_dsp = slice_dsp.map(point => prefix + point);
      points.push(prefixed_slice_dsp);
    }
    return points.flat();
  }


  // Get the deep target points as strings
  getDeepTargetPoints(dimension) {
    if (dimension == 0) return [];
    if (dimension == 1) return [ (2 * this.data.length + 1).toString() ];
    let slices = this.getSlices();
    let points = [];
    if (dimension == 1) {
      for (let i=-1; i<2*this.data.length+2; i++) {
        let adjusted = this.adjustHeight(i);
        let slice = slices[adjusted];
        let slice_max_coordinate = 2 * slice.data.length + 1;
        points.push(slice_max_coordinate.toString());
      }
      return points;
    }
    for (let i=-1; i<2*this.data.length+2; i++) {
      let adjusted = this.adjustHeight(i);
      let slice = slices[adjusted];
      let slice_dsp = slice.getDeepTargetPoints(dimension - 1);
      let prefix = i.toString() + ',';
      let prefixed_slice_dsp = slice_dsp.map(point => prefix + point);
      points.push(prefixed_slice_dsp);
    }
    return points.flat();
  }

  // Get a layout of this diagram, assuming a rendering of the given dimension
  layout(dimension) {
    if (_debug) {
      _assert(isNatural(dimension));
      _assert(dimension <= 4);
      _assert(dimension >= 0);
    }

    console.log(dimension);

    // For a 0-dimensional layout, the unique point has no coordinates
    if (dimension == 0 && true) {
      return { layout: { '': [] }, boundary: { '': [] }, singular: { '': [0] } }
    }

    // Get the distance constraints, which ensure all elements are suitably spaced
    let distance_constraint_data = this.getDistanceConstraintData(dimension);
    let distance_constraints = distance_constraint_data.map((constraint, index) => {
      let name = 'distance_' + index;
      let name_1 = constraint[0].join(',');
      let name_2 = constraint[1].join(',');
      let vars = [ { name: name_1, coef: -1.0 }, { name: name_2, coef: 1.0 } ];
      let bnds = { type: glpk.GLP_LO, lb: 1.0, ub: 0.0 }; // ub is ignored
      return { name, vars, bnds };
    });

    // Get the average depth constraints
    let average_constraint_data = this.getAverageConstraintData(dimension);
    /*
    let average_constraints = average_constraint_data.map((data, index) => {
      let [centre, points] = data;
      let name = 'average_' + index;
      let central_var = { name: centre, coef: 1.0 };
      let boundary_vars = points.map(point => {
        return { name: point, coef: -1.0/points.length }
      });
      let bnds = { type: glpk.GLP_FX, lb: 0.0, ub: 0.0 };
      return { name, vars: [central_var, ...boundary_vars], bnds };
    });
    */
    // We minimize the absolute value of the difference between the mean
    // and the centre, encoding this absolute value problem as a linear
    // programming problem using a standard trick:
    // https://optimization.mccormick.northwestern.edu/index.php/Optimization_with_absolute_values
    let average_constraints = [];
    let auxiliary_variables = [];
    for (let i=0; i<average_constraint_data.length; i++) {
      let [centre, points] = average_constraint_data[i];
      let aux_name = 'average_' + i;
      let aux_term = { name: aux_name, coef: 1.0 };
      auxiliary_variables.push(aux_name);

      // First constraint
      {
        let name = aux_name + '_constraint_1';
        let sum_term = points.map(point => {
          return { name: point, coef: +1.0/points.length };
        });
        let centre_term = { name: centre, coef: -1.0 };
        let bnds = { type: glpk.GLP_LO, lb: 0.0, ub: 0.0 };
        let vars = [ aux_term, centre_term, ...sum_term ];
        average_constraints.push({ name, vars, bnds });
      }

      // Second constraint
      {
        let name = aux_name + '_constraint_2';
        let sum_term = points.map(point => {
          return { name: point, coef: -1.0/points.length };
        });
        let centre_term = { name: centre, coef: +1.0 };
        let bnds = { type: glpk.GLP_LO, lb: 0.0, ub: 0.0 };
        let vars = [ aux_term, centre_term, ...sum_term ];
        average_constraints.push({ name, vars, bnds });
      }

      // Third constraint (auxiliary variable is positive)
      {
        let name = aux_name + '_constraint_3';
        let bnds = { type: glpk.GLP_LO, lb: 0.0, ub: 0.0 };
        let vars = [ aux_term ];
        average_constraints.push({ name, vars, bnds });
      }
    }
    
    // All the deep source points have depth 0
    let deep_source = this.getDeepSourcePoints(dimension);
    let constraints_deep_source = deep_source.map((point, index) => {
      let name = 'deep_source_' + index;
      let vars = [ { name: point, coef: 1.0 } ];
      let bnds = { type: glpk.GLP_FX, lb: 0.0, ub: 0.0 };
      return { name, vars, bnds };
    });

    // All the deep target points are equal
    let deep_target = this.getDeepTargetPoints(dimension);
    let constraints_deep_target = deep_target.slice(1).map((point, index) => {
      let name = 'deep_target_' + index;
      let vars = [ { name: point, coef: 1.0 }, { name: deep_target[0], coef: -1.0 } ];
      let bnds = { type: glpk.GLP_FX, lb: 0.0, ub: 0.0 };
      return { name, vars, bnds };
    });

    // Corresponding points in bottom 2 slices have the same depths
    let source_points = this.source.getAllPointNames(dimension - 1);
    let constraints_fixed_source = source_points.map((point, index) => {
      let name = 'fixed_source_' + index;
      let vars = [ { name: '-1,' + point, coef: 1.0 }, { name: '0,' + point, coef: -1.0 } ];
      let bnds = { type: glpk.GLP_FX, lb: 0.0, ub: 0.0 };
      return { name, vars, bnds};
    });

    // Corresponding points in top 2 slices have the same depths
    let target_points = this.getTarget().getAllPointNames(dimension - 1);
    let target_prefix = (this.data.length * 2 + 1).toString() + ',';
    let sub_target_prefix = (this.data.length * 2).toString() + ',';
    let constraints_fixed_target = target_points.map((point, index) => {
      let name = 'fixed_target_' + index;
      let vars = [ { name: target_prefix + point, coef: 1.0 }, { name: sub_target_prefix + point, coef: -1.0 } ];
      let bnds = { type: glpk.GLP_FX, lb: 0.0, ub: 0.0 };
      return { name, vars, bnds};
    });

    // Objective function asks for the overall depth of the diagram to be
    // minimized, as well as the auxiliary variables.
    let aux_weight = .1;
    let aux_objectives = auxiliary_variables.map(name => {
      return { name, coef: aux_weight };
    });
    let objective = {
      direction: glpk.GLP_MIN,
      name: 'obj',
      vars: [ { name: deep_target[0], coef: 1.0 }, ...aux_objectives ]
    };

    // Gather together all constraints
    let subjectTo = [
      ...average_constraints,
      ...distance_constraints,
      ...constraints_deep_source,
      ...constraints_deep_target,
      ...constraints_fixed_source,
      ...constraints_fixed_target
    ];

    // Solve the constraint problem
    let solution = glpk.solve({ name: 'LP', objective, subjectTo }, glpk.GLP_MSG_ALL);

    // Layout recursively
    let { layout, boundary, singular } = this.layout(dimension - 1);

    // Build the full layout coordinates of every point
    let all_points = this.getAllPointsWithBoundaryFlag(dimension);
    let full_layout_all = {};
    for (let i=0; i<all_points.length; i++) {
      let point = all_points[i].slice(0, dimension);
      let full_name = point.join(',');
      point.pop();
      let full_layout = layout[point.join(',')].slice();
      let last_layout = solution.result.vars[full_name];
      full_layout.push(last_layout);
      full_layout_all[full_name] = full_layout;
    }

    // Build the full boundary data for every point
    let full_boundary = {};
    for (let i=0; i<all_points.length; i++) {
      let point = all_points[i].slice(0, dimension);
      let flag = all_points[i][dimension];
      let full_name = point.join(',');
      let sub_point = point.slice(0, point.length - 1);
      let boundary_data = [...boundary[sub_point.join(',')], flag];
      full_boundary[full_name] = boundary_data;
    }

    return { layout: full_layout_all, boundary: full_boundary };
      
  }

  // Get the distance constraints, in the form of pairs of points that must
  // be at least distance 1 from each other in the highest dimension
  getDistanceConstraintData(dimension) {

    let constraints = [];

    // In dimension 0, no points, so no constraints
    if (dimension == 0) {
      // Nothing to do
    }

    // In dimension 1, constraints given by a chain
    else if (dimension == 1) {
      for (let i=-1; i<2*this.data.length+1; i++) {
        constraints.push([[i], [i+1]]);
      }
    }

    // In higher dimension, just take the union of constraints in each
    // slice, and pad with the appropriate coordinate.
    else {
      let slices = this.getSlices();
      for (let i=-1; i<2*this.data.length+2; i++) {
        let adjusted = this.adjustHeight(i);
        let slice = slices[adjusted];
        let recursive = slice.getDistanceConstraintData(dimension - 1);
        constraints.push(...recursive.map(constraint => {
          return [[i, ...constraint[0]], [i, ...constraint[1]]];
        }));
      }
    }

    return constraints;
  }

  // Get the average constraints, in the form of pairs of lists of points
  // which will be weakly required to have the same mean
  getAverageConstraintData(dimension) {
    if (_debug) {
      _assert(isNatural(dimension));
      _assert(dimension >= 0);
    }

    if (dimension < 2) {
      return []; // no constraints
    }

    let slices = this.getSlices();

    // Get all the singular points
    let slice_singular_points = [];
    for (let i=0; i<=this.data.length * 2; i++) {
      slice_singular_points.push(slices[i].getSingularPoints(dimension - 1));
    }

    let identity_limit = new Limit({ n: this.n - 1, components: [] });

    // Get the top-level singular constraints
    let top_level_singular_constraints = [];
    for (let i=-1; i<this.data.length + 1; i++) {
      //if (i == this.data.length) continue;
      //if (i == -1) continue;

      // Prepare lookup table
      let singular_height = 2 * i + 1;
      let adjusted = this.adjustHeight(singular_height);
      let prefix = singular_height.toString() + ',';
      let lookup = {};
      let singular_height_points = slice_singular_points[adjusted];
      let labels = [];
      for (let j=0; j<singular_height_points.length; j++) {
        let point = singular_height_points[j];
        let label = point.join(',');
        labels.push(label);
        lookup[label] = { below: [], above: [] };
      }

      // Flow forward points from regular slice below
      if (i > -1) {
        let regular_below = singular_height - 1;
        let forward_limit = (i == this.data.length) ? identity_limit : this.data[i].forward_limit;
        let flow_forward = forward_limit.flowForwardSingularPoints(slice_singular_points[regular_below]);
        let regular_below_singular_points = slice_singular_points[regular_below];
        let regular_below_prefix = regular_below.toString() + ',';
        for (let j=0; j<regular_below_singular_points.length; j++) {
          let flowed = flow_forward[j];
          let label = flowed.join(',');
          lookup[label].below.push(regular_below_prefix + regular_below_singular_points[j].join(','));
        }
      }

      // Flow backward points from regular slice above
      if (i < this.data.length) {
        let regular_above = singular_height + 1;
        let backward_limit = (i == -1) ? identity_limit : this.data[i].backward_limit;
        let flow_backward = backward_limit.flowForwardSingularPoints(slice_singular_points[regular_above]);
        let regular_above_singular_points = slice_singular_points[regular_above];
        let regular_above_prefix = regular_above.toString() + ',';
        for (let j=0; j<regular_above_singular_points.length; j++) {
          let flowed = flow_backward[j];
          let label = flowed.join(',');
          lookup[label].above.push(regular_above_prefix + regular_above_singular_points[j].join(','));
        }
      }

      // Prepare the constraints
      for (let j=0; j<labels.length; j++) {
        let label = labels[j];
        let data = lookup[label];
        //if (data.below.length == 1 && data.above.length == 1) continue;
        if (data.below.length > 0) top_level_singular_constraints.push([prefix + label, data.below]);
        if (data.above.length > 0) top_level_singular_constraints.push([prefix + label, data.above]);
      }
    }

    // Get all the regular points
    let slice_regular_points = [];
    for (let i=0; i<=this.data.length * 2; i++) {
      slice_regular_points.push(slices[i].getRegularPoints(dimension - 1));
    }

    // Get the top-level regular constraints
    let top_level_regular_constraints = [];
    for (let i=0; i<this.data.length + 1; i++) {
      //if (i == this.data.length) continue;
      //if (i == -1) continue;

      // Prepare lookup table
      let regular_height = 2 * i;
      let adjusted = this.adjustHeight(regular_height);
      let prefix = regular_height.toString() + ',';
      let lookup = {};
      let regular_height_points = slice_regular_points[adjusted];
      let labels = [];
      for (let j=0; j<regular_height_points.length; j++) {
        let point = regular_height_points[j];
        let label = point.join(',');
        labels.push(label);
        lookup[label] = { below: [], above: [] };
      }

      // Flow backward regular points from singular slice below
      let singular_below = regular_height - 1;
      let backward_limit = (i == 0) ? identity_limit : this.data[i - 1].backward_limit;
      let singular_below_adjusted = this.adjustHeight(singular_below);
      let flow_backward = backward_limit.flowBackwardRegularPoints(slice_regular_points[singular_below_adjusted]);
      let singular_below_regular_points = slice_regular_points[singular_below_adjusted];
      let singular_below_prefix = singular_below.toString() + ',';
      for (let j=0; j<singular_below_regular_points.length; j++) {
        let flowed = flow_backward[j];
        let label = flowed.join(',');
        lookup[label].below.push(singular_below_prefix + singular_below_regular_points[j].join(','));
      }

      // Flow forward regular points from singular slice above
      let singular_above = regular_height + 1;
      let forward_limit = (i == this.data.length) ? identity_limit : this.data[i].forward_limit;
      let singular_above_adjusted = this.adjustHeight(singular_above);
      let flow_forward = forward_limit.flowBackwardRegularPoints(slice_regular_points[singular_above_adjusted]);
      let singular_above_regular_points = slice_regular_points[singular_above_adjusted];
      let singular_above_prefix = singular_above.toString() + ',';
      for (let j=0; j<singular_above_regular_points.length; j++) {
        let flowed = flow_forward[j];
        let label = flowed.join(',');
        lookup[label].above.push(singular_above_prefix + singular_above_regular_points[j].join(','));
      }

      // Prepare the constraints
      for (let j=0; j<labels.length; j++) {
        let label = labels[j];
        let data = lookup[label];
        //if (data.below.length == 1 && data.above.length == 1) continue;
        if (data.below.length > 0) top_level_regular_constraints.push([prefix + label, data.below]);
        if (data.above.length > 0) top_level_regular_constraints.push([prefix + label, data.above]);
      }
    }

    // Get the slice weak constraints
    let regular_constraint = true;
    let singular_constraint = true;
    let slice_constraints = [];
    for (let i=-1; i<=2*this.data.length + 1; i++) {
      if (Math.abs(i % 2) == 0 && !regular_constraint) continue;
      if (Math.abs(i % 2) == 1 && !singular_constraint) continue;
      let adjusted = this.adjustHeight(i);
      let weak_slice_constraint = slices[adjusted].getAverageConstraintData(dimension - 1);
      let prefix = i.toString() + ',';
      let processed = weak_slice_constraint.map(constraint => {
        let new_label = prefix + constraint[0];
        let new_points = constraint[1].map(point => prefix + point);
        return [new_label, new_points];
      });
      slice_constraints.push(processed);
    }

    // Build and return the final list of constraints
    let constraints = [
      ...top_level_singular_constraints,
      ...top_level_regular_constraints,
      ...slice_constraints.flat()
    ];
    return constraints;
  }



}

function sub_content(content, subcontent, position) {
  if (!sub_limit(content.forward_limit, subcontent.forward_limit, position)) return false;
  if (!sub_limit(content.backward_limit, subcontent.backward_limit, position)) return false;
  return true;
}

// Check if the given subdata is present with the indicated offset
function sub_data(data, subdata, offset) {
  //    if (!sub_limit(this.data[height].forward_limit, subdata.forward_limit, offset)) return false;
  //    if (!sub_limit(this.data[height].backward_limit, subdata.backward_limit, offset)) return false;
  if (!sub_limit(data.forward_limit, subdata.forward_limit, offset)) return false;
  if (!sub_limit(data.backward_limit, subdata.backward_limit, offset)) return false;
  return true;
}

// Check if a forward limit contains all the content of another
function sub_limit(limit, sublimit, offset) {
  if (_debug) _assert(limit.n == sublimit.n);
  if (limit.components.length != sublimit.components.length) return false; // number of components must be the same
  for (let i = 0; i < limit.components.length; i++) {
    if (!sub_limit_component(limit.components[i], sublimit.components[i], offset)) return false;
  }
  return true;
}

function sub_limit_component(component, subcomponent, offset) {
  if (_debug) _assert(component.n == subcomponent.n);
  if (_debug) _assert(offset.length == component.n);
  if (component.n == 0) {
    return ((component.source_id == subcomponent.source_id)
      && (component.target_id == subcomponent.target_id));
  }
  if (component.first != subcomponent.first + offset[0]) return false;
  if (component.getLast() != subcomponent.getLast() + offset[0]) return false;
  if (component.source_data.length != subcomponent.source_data.length) return false;
  let offset_slice = offset.slice(1);
  for (let i = 0; i < component.source_data.length; i++) {
    if (!sub_data(component.source_data[i], subcomponent.source_data[i], offset_slice)) return false;
  }
  if (!sub_data(component.target_data, subcomponent.target_data, offset_slice)) return false;  
  if (component.sublimits.length != subcomponent.sublimits.length) return false;
  for (let i = 0; i < component.sublimits.length; i++) {
    if (!sub_limit(component.sublimits[i], subcomponent.sublimits[i], offset_slice)) return false;
  }
  return true;
}

// Make a new copy of a limit
/*
function copy_limit(old_limit) {
  if (old_limit == null) return null;
  let new_limit = [];
  for (let i = 0; i < old_limit.length; i++) {
    let x = old_limit[i];
    let entry = {};
    entry.data = copy_data(x.data);
    entry.first = x.first;
    entry.last = x.last;
    entry.data = copy_limit(o.data);
  }
}
*/

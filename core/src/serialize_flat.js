import { _assert, _debug, isNatural, _propertylist } from "~/util/debug";
import { Diagram } from "~/diagram";
import { Limit, Content, LimitComponent } from "~/limit";
import { Generator } from "~/generator";

/* Serializes a cyclic class-aware Javascript object, and allow the serialization to be efficiently updated */

export class SerializeCyclic {

  constructor(args) {

    if (args && args.bare) return this;

    // Shallow copy
    if (args instanceof SerializeCyclic) {
      this.object_to_index = args.object_to_index;
      this.index_to_object = args.index_to_object;
      this.index_to_stored = args.index_to_stored;
      this.head = args.head;
      this.entries = args.entries;
      return this;
    }

    // For each object, remember its index
    this.object_to_index = new Map();
    this.index_to_object = new Map();
    this.index_to_stored = new Map();

    // Remember the index of the head object
    this.head = null;

    // Remember how many things are in the library
    this.entries = 0;

  }

  toJSON() {
    return {
      head: this.head,
      entries: this.entries,
      index_to_stored_array: [...this.index_to_stored].map(arr => {
        let index = arr[0];
        let value = arr[1];
        let obj = { f: value.f };
        if (value.a) obj.a = value.a;
        if (value.n !== undefined) obj.n = value.n;
        if (value.t) obj.t = value.t;
        /*
        let f = arr[1].f;
        let a = arr[1].a;
        return [ index , { f , a } ];
        */
        return [ index , obj ];
      })
    };
  }

  stringify() {
    let now = performance.now();
    let json = this.toJSON();
    let string = JSON.stringify(json);
    //console.log('Stringified state in ' + Math.floor(performance.now() - now) + 'ms');
    return string;
  }

  static destringify(string) {
    console.log('DESERIALIZING');
    let parsed = JSON.parse(string);
    let serializer = SerializeCyclic.fromJSON(parsed);
    //serializer.deduplicate();
    return serializer;
  }

  static fromJSON({ head, entries, index_to_stored_array }) {

    //let type_transform = new Map([['Diagram', 'D'], ['Limit', 'L'], ['LimitComponent', 'I'], ['Generator', 'G'], ['Content', 'C']]);

    let library_stored = [];
    let index_to_stored = new Map(index_to_stored_array);
    let object_to_index = new Map();
    let index_to_object = new Map();
    let library_keys = index_to_stored.keys();

    // Create all the objects but don't yet populate
    for (let index of library_keys) {
      let stored = index_to_stored.get(index);
      _assert(stored !== undefined);

      let flattened = stored.f;
      _assert(flattened);
      let object;
      if (!stored.a) {
        if (stored.t) {
          if (stored.t === 'D') {
            object = new Diagram({ bare: true });
          } else if (stored.t === 'C') {
            object = new Content({ bare: true });
          } else if (stored.t === 'L') {
            object = new Limit({ bare: true });
          } else if (stored.t === 'I') {
            object = new LimitComponent({ bare: true });
          } else if (stored.t === 'G') {
            object = new Generator({ bare: true });
          } else _assert(false);
        } else {
          object = {};
        }
      } else {
        // Object is an array
        if (stored.t === 'D') {
          _assert(false);
        } else if (stored.t === 'C') {
          object = Content.makeContentArray([], stored.n);
        } else if (stored.t === 'L') {
          object = Limit.makeLimitArray([], stored.n);
        } else if (stored.t === 'I') {
          object = LimitComponent.makeLimitComponentArray([], stored.n);
        } else if (stored.t === 'G') {
          _assert(false);
        } else {
          object = [];
        }
      }

      // Associate this object to the appropriate maps
      object_to_index.set(object, index);
      index_to_object.set(index, object);
    }

    // Populate the objects, and freeze where appropriate
    library_keys = index_to_stored.keys();
    for (let index of library_keys) {
      let stored = index_to_stored.get(index);
      let object = index_to_object.get(index);
      let keys = Object.keys(stored.f);
      for (let i in keys) {
        let key = keys[i];
        let value = stored.f[key];
        let restored;
        //if (key === '_t') continue;
        if (value !== null && value !== undefined && typeof value === 'object') {
          _assert(value._l !== undefined);
          restored = index_to_object.get(value._l);
        } else {
          restored = value;
        }
        //object[key] = key == '_t' ? (type_transform.get(value) || value) : restored;
        object[key] = restored;
      }
      if (stored.n !== undefined) object.n = stored.n;
      if (stored.t) object._t = stored.t;
      /*
      //if (stored.f._t) {
      //  Object.freeze(object);
      //}
      */
    }

    // Compute descendents
    library_keys = index_to_stored.keys();
    for (let index of library_keys) {
      this.computeDescendants({ index, index_to_object, object_to_index, index_to_stored });
    }

    // Wrap this up into a fresh SerializeCyclic object
    let sc = new SerializeCyclic({ bare: true });
    sc.head = head;
    sc.entries = entries;
    sc.index_to_stored = index_to_stored;
    sc.index_to_object = index_to_object;
    sc.object_to_index = object_to_index;
    return sc;

  }

  static computeDescendants({ index, index_to_object, object_to_index, index_to_stored }) {

    let stored = index_to_stored.get(index);
    _assert(stored);
    if (stored.descendants) return stored.descendants;
    if (_debug) {
      _assert(stored);
      _assert(stored.f);
    }
    let object = index_to_object.get(index);
    let keys = Object.keys(object);
    let multi_descendants = [];
    for (let i of keys) {
      let key = keys[i];
      let value = stored.f[key];
      if (value !== null && value !== undefined && typeof value === 'object') {
        //let subindex = object_to_index.get({ value });
        //let subindex = index_to_object.get({ value });
        let subindex = value._l;
        let sub_descendants = SerializeCyclic.computeDescendants({
          index: subindex,
          index_to_object,
          object_to_index,
          index_to_stored
        });
        multi_descendants.push(sub_descendants);
        multi_descendants.push([subindex]);
      }
    }
    let descendants = [...new Set(multi_descendants.flat())]; // group and deduplicate
    stored.descendants = descendants;
    return descendants;
  }

  // Update the library to store the given object as the head
  update(object) {

    // Add the object to the store
    let index = this.add(object);

    // Convert its descendant set into a Set for efficient membership testing
    let descendant_set = new Set(this.index_to_stored.get(index).descendants);

    // Loop through everything in storage and delete what we don't need
    let entries = this.index_to_stored.keys();
    for (let key of entries) {
      if (key === index) continue;
      if (descendant_set.has(key)) continue;
      let object = this.index_to_object.get(key);
      this.index_to_object.delete(key);
      this.index_to_stored.delete(key);
      this.object_to_index.delete(object);
    }
    this.head = index;

    //this.deduplicate();

  }

  getHead() {
    _assert(this.head !== null);
    return this.index_to_object.get(this.head);
  }

  // Add a single object to the library
  add(object) {

    // Verify it's an object
    _assert(typeof object === 'object');

    // If it's already in the library, don't do anything
    if (this.object_to_index.get(object) !== undefined) {
      return this.object_to_index.get(object);
    }

    // Assign it a slot in the library
    let index = this.entries++;
    this.index_to_object.set(index, object);
    this.object_to_index.set(object, index);

    // Create the new library entry
    let flattened = {};

    // Iterate through the object's keys
    let keys = Object.keys(object);
    let multi_descendants = [];
    for (let i=0; i<keys.length; i++) {
      let key = keys[i];
      if (key == 'n' || key == '_t') continue; // these are stored in object metadata
      let value = object[key];
      if (value !== null && value !== undefined && typeof value === 'object') {
        let subindex = this.add(value);
        flattened[key] = this.getLibraryReference(subindex);
        let subentry = this.index_to_stored.get(subindex);
        //_assert(subentry);
        //_assert(subentry.descendants);
        multi_descendants.push([...subentry.descendants, subindex]);
      } else {
        flattened[key] = value;
      }
    }

    // Add this to the library
    let descendants = [...new Set(multi_descendants.flat())];
    this.index_to_stored.set(index, this.makeLibraryEntry(flattened, object, descendants));

    // Return the index of the object
    return index;

  }

  makeLibraryEntry(f, object, descendants) {
    //let serialization = JSON.stringify(flattened);
    let a = Array.isArray(object);
    let t = object._t;
    let n = object.n;
    let library = { f, descendants, a };
    if (t !== undefined) library.t = t;
    if (n !== undefined) library.n = n;
    return library;
  }

  getLibraryReference(index) {
    return { '_l': index };
  }

  static objectUpdateSubstitution(array, positions, substitutions) {

    // Sort the array lexicographically
    array.sort((a,b) => a.lexicographicSort(b, positions, substitutions));

    // Store the positions of the array items
    for (let i=0; i<array.length; i++) {
      positions.set(array[i], i);
    }

    // Update substitution map to deduplicate
    let original = array[0];
    for (let i=1; i<array.length; i++) {
      if (array[i].lexicographicSort(original, positions, substitutions) == 0) {
        //_assert(array[i].equals(original));
        substitutions.set(array[i], original);
      } else {
        original = array[i];
      }
    }
  }

  static arrayLexicographicSort(a, b, positions, substitutions) {
    /*
    if (_debug) {
      _assert(Array.isArray(a));
      _assert(Array.isArray(b));
      _assert(a._t);
      _assert(b._t);
      _assert(isNatural(a.n));
      _assert(isNatural(b.n));
      _assert(a._t === b._t);
      _assert(a.n === b.n);
    }
    */
    if (a.length != b.length) return a.length - b.length;
    for (let i=0; i<a.length; i++) {
      let value = a[i].lexicographicSort(b[i], positions, substitutions);
      if (value != 0) return value;
    }
    return 0;
  }

  static arrayUpdateSubstitution(array, positions, substitutions) {

    //return;

    // Sort the array lexicographically
    array.sort((a,b) => SerializeCyclic.arrayLexicographicSort(a, b, positions, substitutions));

    // Store the positions of the array items
    for (let i=0; i<array.length; i++) {
      positions.set(array[i], i);
    }

    // Update substitution map to deduplicate
    let original = array[0];
    for (let i=1; i<array.length; i++) {
      if (SerializeCyclic.arrayLexicographicSort(array[i], original, positions, substitutions) == 0) {
        /*
        if (_debug) {
          _assert(array[i].length == original.length);
          for (let j=0; j<array[i].length; j++) {
            _assert(array[i][j].equals);
            _assert(array[i][j].equals(original[j]));
          }
        }
        */
        substitutions.set(array[i], original)
      } else {
        original = array[i];
      }
    }
  }

  // Identify equal objects in memory and deduplicate
  deduplicate() {

    const t0 = performance.now();

    //let objects = [...this.object_to_index.keys()];
    let object_reference = { 'I': [[]], 'L': [[]], 'C': [[]], 'D': [[]], 'other': [] };
    let array_reference = { 'I': [[]], 'L': [[]], 'C': [[]], 'other': [] };
    let positions = new Map();
    let substitutions = new Map();
    let highest_n = 0;
    for (let o of this.object_to_index.keys()) {
      let is_object = Array.isArray(o) ? false : true;
      if (o.n !== undefined && o.n > highest_n) {
        for (let j=highest_n + 1; j<=o.n; j++) {
          object_reference.D[j] = [];
          object_reference.L[j] = [];
          object_reference.I[j] = [];
          object_reference.C[j] = [];
          array_reference.L[j] = [];
          array_reference.I[j] = [];
          array_reference.C[j] = [];
        }
        highest_n = o.n;
      }
      if (Array.isArray(o)) {
        if (o._t) {
          array_reference[o._t][o.n].push(o);
        } else {
          array_reference.other.push(o);
        }
      } else {
        if (o._t && o._t != 'G') { // no need to sort generators
          //_assert(object_reference[o._t]);
          object_reference[o._t][o.n].push(o);
        } else {
          object_reference.other.push(o);
        }
      }

      // Start with the identity substitution
      substitutions.set(o, o);
    }

    // Sort by dimension and in the order LimitComponent, Limit, Content, Diagram.
    // This ensures any recursive reference are to already-sorted things
    for (let n=0; n<=highest_n; n++) {

      // For each structure type, sort it, and identify the substitution map to identify duplicates
      SerializeCyclic.objectUpdateSubstitution(object_reference.I[n], positions, substitutions);
      SerializeCyclic.objectUpdateSubstitution(object_reference.L[n], positions, substitutions);
      SerializeCyclic.objectUpdateSubstitution(object_reference.C[n], positions, substitutions);
      SerializeCyclic.objectUpdateSubstitution(object_reference.D[n], positions, substitutions);

      // The same for each array of structure types
      SerializeCyclic.arrayUpdateSubstitution(array_reference.I[n], positions, substitutions);
      SerializeCyclic.arrayUpdateSubstitution(array_reference.L[n], positions, substitutions);
      SerializeCyclic.arrayUpdateSubstitution(array_reference.C[n], positions, substitutions);

    }

    // Rebuild index-object bijection
    let new_object_to_index = new Map();
    let new_index_to_object = new Map();
    let new_entries = 0;

    for (let object of this.object_to_index.keys()) {

      // Ignore objects which will be substituted
      if (object !== substitutions.get(object)) {
        continue;
      }

      // Surgically modify this object to only keep the chosen children.
      // For this reason we cannot work with frozen objects.
      for (let key of Object.keys(object)) {
        let value = object[key];
        if (typeof value !== 'object' || value === null || value === undefined) continue;
        let new_value = substitutions.get(value);
        //_assert(new_value.equals ? new_value.equals(value) : true); // DEBUG
        object[key] = new_value;
      }

      // Give this object a new index
      new_object_to_index.set(object, new_entries);
      new_index_to_object.set(new_entries, object);
      new_entries ++;

    }

    // Calculate new head element
    let new_head = new_object_to_index.get(substitutions.get(this.index_to_object.get(this.head)));

    // Rebuild stored data
    let new_index_to_stored = new Map();

    for (let object of new_object_to_index.keys()) {

      let old_index = this.object_to_index.get(object);
      let new_index = new_object_to_index.get(object);
      let old_stored = this.index_to_stored.get(old_index);
      if (object instanceof Content) {
        let x = 0;
      }
      let new_stored = {};
      if (old_stored.a !== undefined) new_stored.a = old_stored.a;
      if (old_stored.n !== undefined) new_stored.n = old_stored.n;
      if (old_stored.t !== undefined) new_stored.t = old_stored.t;
      new_stored.descendants = [...new Set(old_stored.descendants.map(
        old_index => new_object_to_index.get(substitutions.get(this.index_to_object.get(old_index)))
      ))];

      let f = {};
      for (let key of Object.keys(old_stored.f)) {
        let value = old_stored.f[key];
        if (typeof value === 'object' && value !== null && value !== undefined) {
          //_assert(isNatural(value._l));
          let _l = new_object_to_index.get(substitutions.get(this.index_to_object.get(value._l)));
          //_assert(isNatural(_l));
          f[key] = { _l };
        } else {
          f[key] = value;
        }
      }

      new_stored.f = f;
      new_index_to_stored.set(new_index, new_stored);
    }

    // Output the result of the analysis to the console
    const t1 = performance.now();
    //console.log(`Deduplication analysis (${Math.floor(t1 - t0)} ms): ${this.object_to_index.size} -> ${new_index_to_stored.size}`);

    // Reassign
    this.object_to_index = new_object_to_index;
    this.index_to_object = new_index_to_object;
    this.index_to_stored = new_index_to_stored;
    this.entries = new_entries;
    this.head = new_head;

  }
}

function classifyObject(obj) {
  if (obj._t) return obj._t;
  else if (Array.isArray(obj)) {
    return 'Array';
  } else {
    return 'Object';
  }
  /*
  if (a instanceof Limit) {
    return 'Limit';
  } else if (a instanceof LimitComponent) {
    return 'LimitComponent';
  } else if (a instanceof Diagram) {
    return 'Diagram';
  } else if (a instanceof Generator) {
    return 'Generator';
  } else if (a instanceof Content) {
    return 'Content';
  } else if (Array.isArray(a)) {
    return 'Array';
  } else {
    return 'Object';
  }
  */
}

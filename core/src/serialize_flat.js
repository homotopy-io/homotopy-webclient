import { _assert, _debug, isNatural, _propertylist } from "~/util/debug";
import { Diagram } from "~/diagram";
import { Limit, Content, LimitComponent } from "~/limit";
import { Generator } from "~/generator";

/* Serializes a cyclic class-aware Javascript object, and allow the serialization to be efficiently updated */

/*
  To do:
  - Only persist an object in memory if it's frozen
  - Persist frozen status direcly, not via _t lookup
*/

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
        let f = arr[1].f;
        let a = arr[1].a;
        return [ index , { f , a } ];
      })
    };
  }

  stringify() {
    let now = performance.now();
    let json = this.toJSON();
    let string = JSON.stringify(json);
    console.log('Stringified state in ' + Math.floor(performance.now() - now) + 'ms');
    return string;
  }

  static destringify(string) {
    let parsed = JSON.parse(string);
    return SerializeCyclic.fromJSON(parsed);
  }

  static fromJSON({ head, entries, index_to_stored_array }) {

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
      if (flattened._t) {
        if (flattened._t === 'Diagram') {
          object = new Diagram({ bare: true });
        } else if (flattened._t === 'Content') {
          object = new Content({ bare: true });
        } else if (flattened._t === 'Limit') {
          object = new Limit({ bare: true });
        } else if (flattened._t === 'LimitComponent') {
          object = new LimitComponent({ bare: true });
        } else if (flattened._t === 'Generator') {
          object = new Generator({ bare: true });
        } else _assert(false);
      } else if (stored.a) {
        object = [];
      } else {
        object = {};
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
        object[key] = restored;
      }
      if (stored.f._t) {
        Object.freeze(object);
      }
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
      let value = object[key];
      if (value !== null && value !== undefined && typeof value === 'object') {
        let subindex = this.add(value);
        flattened[key] = this.getLibraryReference(subindex);
        let subentry = this.index_to_stored.get(subindex);
        _assert(subentry);
        _assert(subentry.descendants);
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
    let a = !object._t && Array.isArray(object);
    return { f, descendants, a };
  }

  getLibraryReference(index) {
    return { '_l': index };
  }

}

import { _assert, _debug } from "../../../core/src/util/debug"; // this is a mess
import workspace from "~/state/store/workspace";
import signature from "~/state/store/signature";
import attach from "~/state/store/attach";
//import object_store from "~/state/store/object_store";
//import LZ from "lz-string";
//import * as Core from "homotopy-core";
import dotProp from "dot-prop-immutable";
//import stringify from "json-stringify-safe";
import persist from "~/state/store/persist";
import * as Core from "homotopy-core";
import * as Compression from "../util/compression";

// Persistent serializer
let serializer = new Core.SerializeCyclic();

export const initialState = {
  signature: {
    generators: {},
    edited: null /* not sure what this does */
  },
  workspace: {
    diagram: null,
    source: null,
    target: null,
    slice: null,
    projection: null,
    renderer: 2
  },
  attach: {
    options: null,
    highlight: null
  },
  serialization: null,
  hash: null
};

let persist_blacklist = [
  'persist/deserialize',
  'persist/newhash',
  'persist/loaded',
  'attach/set-highlight',
  'attach/clear-highlight',
];

export default (state, action) => {

  let action_t0 = performance.now();

  _assert(state.diagram === undefined);
  state = persist(state, action);
  state = workspace(state, action);
  state = signature(state, action);
  state = attach(state, action);

  // Persist the state
  if (action.type.indexOf('INIT') == -1 && persist_blacklist.indexOf(action.type) == -1) {

    const t0 = performance.now();

    // Prepare part of the state ready to be serialized
    let { workspace, signature, attach } = state;
    let state_to_serialize = { workspace, signature, attach };

    // Update the serializer with the current state
    serializer.update(state_to_serialize);

    const t1 = performance.now();
    const s1 = serializer.object_to_index.size;

    serializer.deduplicate();

    const t2 = performance.now();
    const s2 = serializer.object_to_index.size;

    // Stringify and compress the state
    let string = serializer.stringify();

    const t3 = performance.now();

    let compressed = Compression.compress(string);
    state.serialization = compressed;
    state.hash = compressed;
    window.location.hash = compressed;

    const t4 = performance.now();

    console.log(`State decycled (${Math.floor(t1-t0)} ms, ${s1} objects), `
      + `deduplicated (${Math.floor(t2-t1)} ms, ${s2} objects), `
      + `serialized (${Math.floor(t3-t2)} ms, ${Math.floor(string.length/1024)} kb), `
      + `compressed (${Math.floor(t4-t3)} ms, ${Math.floor(compressed.length/1024)} kb)`);

    state = { ...state, ...serializer.getHead() };

    // Deduplication analysis
    //serializer.deduplicate();

  }

  console.log(`Handled action \"${action.type}" in ${Math.floor(performance.now() - action_t0)} ms`);

  return state;
};

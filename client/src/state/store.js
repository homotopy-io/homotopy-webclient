import { _assert, _debug } from "../../../core/src/util/debug"; // this is a mess
import workspace from "~/state/store/workspace";
import signature from "~/state/store/signature";
import attach from "~/state/store/attach";
//import object_store from "~/state/store/object_store";
//import LZ from "lz-string";
//import * as Core from "homotopy-core";
//import dotProp from "dot-prop-immutable";
//import stringify from "json-stringify-safe";
import persist from "~/state/store/persist";
import * as Core from "homotopy-core";
import * as Compression from "../util/compression";

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
  serialization: null
};

export default (state, action) => {
  _assert(state.diagram === undefined);
  state = persist(state, action);
  state = workspace(state, action);
  state = signature(state, action);
  state = attach(state, action);

  // Persist the state
  if (action.type.indexOf('INIT') == -1
      && action.type != 'persist/newhash'
      && action.type != 'persist/loaded'
      && action.type != 'attach/set-highlight'
      && action.type != 'attach/clear-highlight') {

    const t0 = performance.now();

    // We've been asked to serialize the state
    let state_modified = {
      workspace: Object.assign({}, state.workspace),
      signature: Object.assign({}, state.signature),
      attach: Object.assign({}, state.attach)
    }

    // Update the serializer with the current state
    serializer.update(state_modified);

    const t1 = performance.now();

    // Stringify and compress the state
    let string = serializer.stringify();

    const t2 = performance.now();

    let compressed = Compression.compress(string);

    const t3 = performance.now();

    state.serialization = compressed;

    // Put the string into the URL
    window.location.hash = compressed;

    const t4 = performance.now();
    console.log(`State flattened (${Math.floor(t1-t0)} ms), `
      + `serialized (${Math.floor(string.length/1024)} kb, ${Math.floor(t2-t1)} ms), `
      + `compressed (${Math.floor(compressed.length/1024)} kb, ${Math.floor(t3-t2)} ms)`);

  }

  _assert(state.diagram === undefined);

  return state;
};

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
import LZ from "lz-string";

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

  if (action.type.indexOf('INIT') == -1
      && action.type != 'persist/newhash'
      && action.type != 'persist/loaded'
      && action.type != 'attach/set-highlight'
      && action.type != 'attach/clear-highlight') {

    const serializer = new Core.SerializeCyclic();

    // We've been asked to serialize the state
    let state_modified = Object.assign({}, state);
    delete state_modified.serialization;

    // Update the serializer with the current state
    const timeBefore = performance.now();
    serializer.update(state_modified);
    const timeAfter = performance.now();
    console.log(`Updated object store in ${Math.floor(timeAfter - timeBefore)}ms`);

    // Stringify and compress the state
    let string = serializer.stringify();
    let compressed = LZ.compressToBase64(string);
    console.log(`Compressed length is ${compressed.length}`);
    state.serialization = compressed;

    // Put the string into local storage
    //window.localStorage.setItem("homotopy_io_state", compressed);

    // Put the string into the URL
    window.location.hash = compressed;

  }

  _assert(state.diagram === undefined);

  return state;
};

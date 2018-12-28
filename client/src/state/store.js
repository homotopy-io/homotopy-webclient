import workspace from "~/state/store/workspace";
import signature from "~/state/store/signature";
import attach from "~/state/store/attach";
import LZ from "lz-string";
import * as Core from "homotopy-core";
//import stringify from "json-stringify-safe";

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
  object_store: {
    serialize_cyclic: null
  }
};

export default (state, action) => {
  state = workspace(state, action);
  state = signature(state, action);
  state = attach(state, action);
  // send an action to the object store

  if (action.type.indexOf('INIT') >= 0) return state;
  if (action.type === 'persist/PERSIST') return state;
  if (action.type === 'persist/REHYDRATE') return state;

  // Update the object store
  if (!state.object_store.serialize_cyclic) state.object_store.serialize_cyclic = new Core.SerializeCyclic();
  let now = performance.now();
  let state_for_storage = Object.assign({}, state);
  delete state_for_storage['object_store'];
  state.object_store.serialize_cyclic.update(state_for_storage);
  let ms = performance.now() - now;
  console.log('Updated object store in ' + ms + ' ms');

  // Trick redux-persist into thinking the object store has changed
  let old_store = state.object_store.serialize_cyclic;
  state.object_store.serialize_cyclic = new Core.SerializeCyclic(old_store);

  /*
  let sc = new Core.SerializeCyclic();
  sc.update(state);
  let str = sc.stringify();
  let compressed = LZ.compressToUTF16(str);
  console.log('State ' + str.length + ' => ' + compressed.length + ', ratio ' + Math.floor(compressed.length*100/str.length) + '%');
  */

  return state;
};

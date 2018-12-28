import workspace from "~/state/store/workspace";
import signature from "~/state/store/signature";
import attach from "~/state/store/attach";
import object_store from "~/state/store/object_store";
import LZ from "lz-string";
import * as Core from "homotopy-core";
import dotProp from "dot-prop-immutable";
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

  if (action.type === 'persist/REHYDRATE') {
    if (!action.payload) return state;
    let sc_json = action.payload.object_store.serialize_cyclic;
    if (sc_json === null) return state;
    let head = sc_json.head;
    let entries = sc_json.entries;
    let index_to_stored_array = sc_json.index_to_stored_array;
    let sc = Core.SerializeCyclic.fromJSON({ head, entries, index_to_stored_array });
    let new_state = sc.getHead();
    state = dotProp.set(state, `signature`, new_state.signature);
    state = dotProp.set(state, `workspace`, new_state.workspace);
    state = dotProp.set(state, `attach`, new_state.attach);
    state = dotProp.set(state, `object_store.serialize_cyclic`, sc);
    return state;
  }

  state = workspace(state, action);
  state = signature(state, action);
  state = attach(state, action);
  state = object_store(state, action);
  return state;
};

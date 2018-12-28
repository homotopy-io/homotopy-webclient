import dotProp from "dot-prop-immutable";
import createReducer from "~/util/create-reducer";
import * as ObjectStoreActions from "~/state/actions/object_store";
import * as Core from "homotopy-core";

export default function reduce_object_store(state, action) {

  if (typeof state === 'undefined') {
    return { serialize_cyclic: null };
  }

  if (action.type.indexOf('INIT') >= 0) return state;
  if (action.type === 'persist/PERSIST') return state;

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

  // Otherwise, update the object store
  if (!state.object_store.serialize_cyclic) state.object_store.serialize_cyclic = new Core.SerializeCyclic();
  let sc = state.object_store.serialize_cyclic;
  let now = performance.now();
  let state_for_storage = Object.assign({}, state);
  delete state_for_storage['object_store']; // don't store the store!
  sc.update(state_for_storage);
  let ms = performance.now() - now;
  console.log('Updated object store in ' + ms + ' ms');
  state = dotProp.set(state, `object_store.serialize_cyclic`, sc);
  return state;

}

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

  // Otherwise, update the object store
  //if (!state.object_store.serialize_cyclic) state.object_store.serialize_cyclic = new Core.SerializeCyclic();
  let sc = state.object_store.serialize_cyclic || new Core.SerializeCyclic();
  let now = performance.now();
  let state_for_storage = Object.assign({}, state);
  delete state_for_storage['object_store']; // don't store the store!
  sc.update(state_for_storage);
  let ms = performance.now() - now;
  console.log('Updated object store in ' + ms + ' ms');
  state = dotProp.set(state, `object_store.serialize_cyclic`, sc);
  return state;

}

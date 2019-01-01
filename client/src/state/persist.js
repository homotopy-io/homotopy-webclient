import * as Core from "homotopy-core";
import * as Compression from "../util/compression";

/**
 * Connect the redux store to local storage.
 */
export function connectStore(store) {
  loadState(store);
}

/**
 * Load the state from local storage, if it exists. This is used to initially
 * populate the state.
 */

const loadState = (store) => {
  let stored = window.location.hash.substr(1);
  console.log('Hash value: ' + stored);

  try {
    let decompressed = Compression.decompress(stored);
    let deserializer = Core.SerializeCyclic.destringify(decompressed);
    const state = deserializer.getHead();
    state.serialization = stored;
    store.dispatch({ type: 'persist/loaded', payload: state });
  } catch (err) {
    console.log('Rehydration error');
  }
};

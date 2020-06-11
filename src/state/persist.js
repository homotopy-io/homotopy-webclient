import { change } from 'redux-form'
import * as Core from "homotopy-core";
import * as Compression from "~/util/compression";

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
  const metadata = JSON.parse(window.sessionStorage.getItem("metadata"))
  const proof = window.sessionStorage.getItem("proof_state")
  if (proof) {
    try {
      // load metadata
      for (const k in metadata) {
        console.log('Changing meta', k)
        store.dispatch(change('metadata', k, metadata[k]))
      }
      // load proof
      const decompressed = Compression.decompress(proof);
      const deserializer = Core.SerializeCyclic.destringify(decompressed);
      const state = deserializer.getHead();
      state.serialization = proof;
      store.dispatch({ type: 'persist/loaded', payload: state });
    } catch (err) {
      console.log('Rehydration error');
    }
  }
};

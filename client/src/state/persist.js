import { change } from 'redux-form'
import * as Core from "homotopy-core";
import * as Compression from "~/util/compression";
import history from '~/util/history'
import URLON from 'urlon'

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
  const raw = window.location.hash.substr(1)
  if (raw) {
    const data = URLON.parse(raw);

    try {
      // load metadata
      for (const k in data.metadata) {
        console.log('Changing meta', k)
        store.dispatch(change('metadata', k, data.metadata[k]))
      }
      // load proof
      if (data.proof) {
        const decompressed = Compression.decompress(data.proof);
        const deserializer = Core.SerializeCyclic.destringify(decompressed);
        const state = deserializer.getHead();
        state.serialization = data.proof;
        store.dispatch({ type: 'persist/loaded', payload: state });
      }
    } catch (err) {
      console.log('Rehydration error');
    }
  }
};

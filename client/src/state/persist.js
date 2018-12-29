import * as Core from "homotopy-core";
import * as PersistActions from "~/state/actions/persist";
import LZ from "lz-string";

/**
 * Connect the redux store to local storage.
 */
export function connectStore(store) {
  loadState(store);
  //persistState(store);
  //listenForHashChange(store);
}

/**
 * Setup a subscription to the store that serializes the state to local
 * storage everytime it has changed.
 */
const persistState = (store) => {
  const serializer = new Core.SerializeCyclic();

  store.subscribe(() => {
    const state = store.getState();
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
    if (state.serialization !== compressed) {
      state.serialization = compressed;
    }

    // Put the string into local storage
    //window.localStorage.setItem("homotopy_io_state", compressed);

    // Put the string into the URL
    window.location.hash = compressed;

  });
};

/**
 * Load the state from local storage, if it exists. This is used to initially
 * populate the state.
 */
const loadState = (store) => {
  let stored = window.location.hash.substr(1);
  //if (!stored) stored = window.localStorage.getItem("homotopy_io_state");
  //const stored = window.localStorage.getItem("homotopy_io_state");

  try {
    let decompressed = LZ.decompressFromBase64(stored);
    let deserializer = Core.SerializeCyclic.destringify(decompressed);
    const state = deserializer.getHead();
    state.serialization = stored;
    //store.dispatch(PersistActions.loaded(state));
    store.dispatch({ type: 'persist/loaded', payload: state });
  } catch (err) {
    console.log('Rehydration error');
  }
};

/**
 * Listen for a change in the hash fragment of the URL
 */
const listenForHashChange = (store) => {
  window.addEventListener("hashchange",
    function() {
      let state = store.getState();
      let hash = window.location.hash.substr(1);
      if (state.serialization === hash) return;
      loadState(store)
    }
    , false
  );
}
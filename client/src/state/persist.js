import * as Core from "homotopy-core";
import * as PersistActions from "~/state/actions/persist";

/**
 * Connect the redux store to local storage.
 */
export default function connectStore(store) {
  loadState(store);
  persistState(store);
}

/**
 * Setup a subscription to the store that serializes the state to local
 * storage everytime it has changed.
 */
const persistState = (store) => {
  const serializer = new Core.SerializeCyclic();

  store.subscribe(() => {
    const state = store.getState();

    const timeBefore = performance.now();

    serializer.update(state);
    window.localStorage.setItem("state", serializer.stringify());

    const timeAfter = performance.now();

    console.log(`Updated object store in ${timeAfter - timeBefore}ms`);
  });
};

/**
 * Load the state from local storage, if it exists. This is used to initially
 * populate the state.
 */
const loadState = (store) => {
  const stored = window.localStorage.getItem("state");

  if (stored) {
    const state = Core.SerializeCyclic.destringify(stored).getHead();
    store.dispatch(PersistActions.loaded(state));
  }
};

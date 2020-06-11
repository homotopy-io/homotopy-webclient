import { loop, Cmd } from 'redux-loop'
import { setMetadata } from '~/state/store/project'
import * as Core from "homotopy-core";
import * as Compression from "../../util/compression";
import dotProp from "dot-prop-immutable";
import { initialProof } from '~/state/store.js'

export const initialPersist = null

export default (state = initialPersist, action) => {

  const serializer = new Core.SerializeCyclic();

  switch (action.type) {

    case 'persist/deserialize': {
      const proof = window.sessionStorage.getItem("proof_state")
      const metadata = JSON.parse(window.sessionStorage.getItem("metadata"))

      const initialMetadata = {
        title: "Untitled Project",
        author: "",
        abstract: ""
      }
      if (!proof) {
        console.log('Got nothing to rehydrate, clearing proof')
        return loop({ ...state, ...initialProof }, Cmd.list(setMetadata(initialMetadata)))
      }
      const stateWithMetadata = state =>
      metadata ? loop(state, Cmd.list(setMetadata({ ...initialMetadata, ...metadata }))) : state
      if (!proof) { // no proof found, give empty proof but set the metadata
        console.log('Got no proof, got metadata, clearing proof')
        return stateWithMetadata({ ...state, ...initialProof })
      }
      if (state.serialization === proof) return stateWithMetadata(state) // no update needed
      try {
        let compressed = proof;
        let decompressed = Compression.decompress(compressed);
        let deserializer = Core.SerializeCyclic.destringify(decompressed);
        let new_state = deserializer.getHead();
        new_state.serialization = compressed;
        return stateWithMetadata({ ...state, ...new_state });
      } catch (err) {
        console.log('Rehydration error');
        return stateWithMetadata(state)
      }
    }

    // If we just loaded a new state, integrate it into the Redux state
    case 'persist/loaded':

      return { ...state, ...action.payload };

    case 'persist/serialize': {

      const t0 = performance.now();

      // Prepare part of the state ready to be serialized
      let { workspace, signature, attach } = state;
      let state_to_serialize = { workspace, signature, attach };

      // Update the serializer with the current state
      serializer.update(state_to_serialize);

      const t1 = performance.now();
      const s1 = serializer.object_to_index.size;

      // Deduplication analysis
      serializer.deduplicate();

      const t2 = performance.now();
      const s2 = serializer.object_to_index.size;

      // Stringify and compress the state
      let string = serializer.stringify();

      const t3 = performance.now();

      let compressed = Compression.compress(string);

      // Put the string into session storage
      window.sessionStorage.setItem("proof_state", compressed);

      const t4 = performance.now();
      console.log(`State decycled (${Math.floor(t1-t0)} ms, ${s1} objects), `
        + `deduplicated (${Math.floor(t2-t1)} ms, ${s2} objects), `
        + `serialized (${Math.floor(t3-t2)} ms, ${Math.floor(string.length/1024)} kb), `
        + `compressed (${Math.floor(t4-t3)} ms, ${Math.floor(compressed.length/1024)} kb)`);

      return { ...state, serialization: compressed }
    }
    default: return state;
  }
}

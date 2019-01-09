import { loop, Cmd } from 'redux-loop'
import { setMetadata } from '~/state/store/project'
import * as Core from "homotopy-core";
import * as Compression from "../../util/compression";
import dotProp from "dot-prop-immutable";
import { initialProof } from '~/state/store.js'
import URLON from 'urlon'

export const initialPersist = null

export default (state = initialPersist, action) => {
  const serializer = new Core.SerializeCyclic();
  switch (action.type) {
    case 'persist/deserialize': {
      const hash = window.location.hash.substr(1)
      const initialMetadata = {
        title: "Untitled Project",
        author: "",
        abstract: ""
      }
      if (!hash) {
        console.log('Rehydrating empty hash, clearing proof')
        return loop({ ...state, ...initialProof }, Cmd.list(setMetadata(initialMetadata)))
      }
      const parsed = URLON.parse(hash)
      console.log('Hash parsed', parsed)
      const { proof, metadata } = parsed
      const stateWithMetadata = state =>
      metadata ? loop(state, Cmd.list(setMetadata({ ...initialMetadata, ...metadata }))) : state
      if (!proof) { // no proof in hash, give empty proof but set the metadata
        console.log('Hash has no proof, got metadata, clearing proof')
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
    /*
    case 'persist/serialize': {

      // We've been asked to serialize the state
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
    }
    */
    default: return state;
  }
}

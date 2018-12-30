import * as Core from "homotopy-core";
import * as Compression from "../../util/compression";

export default (state, action) => {

  const serializer = new Core.SerializeCyclic();

  if (action.type === 'persist/newhash') {

    if (state.serialization === action.payload) return state;

    try {

      let compressed = action.payload;
      let decompressed = Compression.decompress(compressed);
      let deserializer = Core.SerializeCyclic.destringify(decompressed);
      let new_state = deserializer.getHead();
      new_state.serialization = compressed;
      state = { ...state, ...new_state };

    } catch (err) {
      console.log('Rehydration error');
    }

  }

  // If we just loaded a new state, integrate it into the Redux state
  else if (action.type === 'persist/loaded') {

    state = { ...state, ...action.payload };

  }

  /*
  else if (action.type === 'persist/serialize') {

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
  else {

    // We've changed the state, so serialize it
    //dispatch(PersistActions.serialize(state));

  }

  return state;

  //default: return state;
};

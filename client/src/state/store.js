import { _assert, _debug } from "../../../core/src/util/debug"; // this is a mess
import dotProp from "dot-prop-immutable";
import { createStore, compose } from 'redux'
import { install, combineReducers } from 'redux-loop'
import ReduxQuerySync from 'redux-query-sync'
import workspaceReducer, { initialWorkspace } from '~/state/store/workspace'
import signatureReducer, { initialSignature } from '~/state/store/signature'
import attachReducer, { initialAttach } from '~/state/store/attach'
import persistReducer, { initialPersist } from '~/state/store/persist'
import userReducer, { initialUser } from '~/state/store/user'
import { setProjectID } from '~/state/actions/project'
import projectReducer, { initialProject } from '~/state/store/project'
import { reducer as formReducer, change } from 'redux-form'
import { reducer as projectListingReducer } from 'redux-modal'

import { reactReduxFirebase, firebaseReducer } from 'react-redux-firebase'
import { reduxFirestore, firestoreReducer } from 'redux-firestore'
import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'
import 'firebase/storage'
import firebaseConfig from '~/../config/firebaseConfig.js'

import * as Core from "homotopy-core";
import * as Compression from "../util/compression";

import { composeWithDevTools } from 'redux-devtools-extension';

// Persistent serializer
let serializer = new Core.SerializeCyclic();

export const initialState = {
  proof: {
    signature: initialSignature,
    workspace: initialWorkspace,
    attach: initialAttach,
    serialization: initialPersist,
    hash: null
  },
  user: initialUser,
  project: initialProject
}


let persist_blacklist = [
  'persist/deserialize',
  'persist/newhash',
  'persist/loaded',
  'attach/set-highlight',
  'attach/clear-highlight',
];

const proofReducer = (state = initialState, action) => {
  let action_t0 = performance.now();

  _assert(state.diagram === undefined);
  state = persistReducer(state, action)
  state = workspaceReducer(state, action)
  state = signatureReducer(state, action)
  state = attachReducer(state, action)

  // Persist the state
  if (action.type.indexOf('@@redux') == -1
      && persist_blacklist.indexOf(action.type) == -1) {

    const t0 = performance.now();

    // Prepare part of the state ready to be serialized
    let { workspace, signature, attach } = state;
    let state_to_serialize = { workspace, signature, attach };

    // Update the serializer with the current state
    serializer.update(state_to_serialize);

    const t1 = performance.now();
    const s1 = serializer.object_to_index.size;

    serializer.deduplicate();

    const t2 = performance.now();
    const s2 = serializer.object_to_index.size;

    // Stringify and compress the state
    let string = serializer.stringify();

    const t3 = performance.now();

    let compressed = Compression.compress(string);
    state.serialization = compressed;
    state.hash = compressed;
    window.location.hash = compressed;

    const t4 = performance.now();

    console.log(`State decycled (${Math.floor(t1-t0)} ms, ${s1} objects), `
      + `deduplicated (${Math.floor(t2-t1)} ms, ${s2} objects), `
      + `serialized (${Math.floor(t3-t2)} ms, ${Math.floor(string.length/1024)} kb), `
      + `compressed (${Math.floor(t4-t3)} ms, ${Math.floor(compressed.length/1024)} kb)`);

    state = { ...state, ...serializer.getHead() };

    // Deduplication analysis
    //serializer.deduplicate();

  }

  console.log(`Handled action \"${action.type}" in ${Math.floor(performance.now() - action_t0)} ms`);

  return state;
}

const rootReducer = combineReducers({
  proof: proofReducer,
  project: projectReducer,
  form: formReducer,
  user: userReducer,
  modal: projectListingReducer,
  firebase: firebaseReducer,
  firestore: firestoreReducer
})

const reactReduxFirebaseConfig = {
  userProfile: 'users',
  useFirestoreForProfile: true,
  enableLogging: true
}

export default () => {
  firebase.initializeApp(firebaseConfig)
  const firestore = firebase.firestore()
  firestore.settings({timestampsInSnapshots: true})

  return createStore(
    rootReducer,
    initialState,
    compose(
      reduxFirestore(firebase),
      reactReduxFirebase(firebase, reactReduxFirebaseConfig),
      install(),
      ReduxQuerySync.enhancer({
        params: {
          id: {
            selector: state => state.project.id,
            action: setProjectID
          },
          title: {
            selector: state => state.form.metadata ? state.form.metadata.values.title : undefined,
            action: value => change('metadata', 'title', value)
          },
          author: {
            selector: state => state.form.metadata ? state.form.metadata.values.author : undefined,
            action: value => change('metadata', 'author', value)
          },
          abstract: {
            selector: state => state.form.metadata ? state.form.metadata.values.abstract : undefined,
            action: value => change('metadata', 'abstract', value)
          }
        },
        initialTruth: 'location',
        replaceState: true // make browser back/forward skip metadata/projectid changes
      }),
      composeWithDevTools()
    )
  )
}

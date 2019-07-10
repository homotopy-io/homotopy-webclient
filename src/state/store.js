import { _assert, _debug } from "homotopy-core/src/util/debug";
import dotProp from "dot-prop-immutable";
import { createStore, compose, applyMiddleware } from 'redux'
import { install, combineReducers, loop, Cmd } from 'redux-loop'
import blockUiMiddleware from 'react-block-ui/lib/reduxMiddleware'
import { urlQueryMiddleware } from 'react-url-query'
import workspaceReducer, { initialWorkspace } from '~/state/store/workspace'
import signatureReducer, { initialSignature } from '~/state/store/signature'
import attachReducer, { initialAttach } from '~/state/store/attach'
import persistReducer, { initialPersist } from '~/state/store/persist'
import copied from '~/state/store/copied'
import focus from '~/state/store/focus'
import { setProjectID } from '~/state/actions/project'
import projectReducer from '~/state/store/project'
import { reducer as form, change } from 'redux-form'
import { reducer as modal } from 'redux-modal'

import { firebaseReducer } from 'react-redux-firebase'
import { firestoreReducer, createFirestoreInstance } from 'redux-firestore'
import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'
import 'firebase/storage'
import firebaseConfig from '~/../config/firebaseConfig.js'

import { composeWithDevTools } from 'redux-devtools-extension/logOnlyInProduction';

export const initialProof = {
  signature: initialSignature,
  workspace: initialWorkspace,
  attach: initialAttach,
  serialization: initialPersist,
}

export const initialState = {
  proof: initialProof,
  copied: false,
  focus: {
    title: false,
    abstract: false
  }
}

let persist_blacklist = [
  'persist/serialize',
  'persist/deserialize',
  'persist/loaded',
  'attach/set-highlight',
  'attach/clear-highlight',
  'signature/set-focus',
];

const proofReducer = (state = initialState, action) => {
  // ignore non-proof-related actions
  if (!action.type.startsWith('attach')
    && !action.type.startsWith('signature')
    && !action.type.startsWith('workspace')
    && !action.type.startsWith('persist'))
    return state

  const action_t0 = performance.now();

  _assert(state.diagram === undefined);
  state = persistReducer(state, action)
  state = workspaceReducer(state, action)
  state = signatureReducer(state, action)
  state = attachReducer(state, action)

  // Persist the state
  if (persist_blacklist.indexOf(action.type) == -1) {
    return loop(state, Cmd.action({type: 'persist/serialize'}))
  }

  console.log(`Handled action \"${action.type}" in ${Math.floor(performance.now() - action_t0)} ms`);

  return state
}

const rootReducer = combineReducers({
  proof: proofReducer,
  project: projectReducer, // this reducer is meta - no associated state
  firebase: firebaseReducer,
  firestore: firestoreReducer,
  form,
  modal,
  copied,
  focus
})

const reactReduxFirebaseConfig = {
  userProfile: 'users',
  useFirestoreForProfile: true,
  attachAuthIsReady: true,
  enableLogging: true
}

export const rrfProps = {
  firebase,
  config: reactReduxFirebaseConfig,
  createFirestoreInstance
};

export default () => {
  firebase.initializeApp(firebaseConfig)

  return createStore(
    rootReducer,
    initialState,
    composeWithDevTools({trace: true})(
      install(),
      applyMiddleware(urlQueryMiddleware()),
      applyMiddleware(blockUiMiddleware)
    )
  )
}

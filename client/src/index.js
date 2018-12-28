import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Redux from "redux";
import * as ReactRedux from "react-redux";
import * as ReduxPersist from "redux-persist";
import storage from "redux-persist/lib/storage";
import { PersistGate } from "redux-persist/integration/react";
import hardSet from 'redux-persist/lib/stateReconciler/hardSet';
import * as Core from "homotopy-core";
import "typeface-roboto";
import "@icon/stroke-7/stroke-7.css";

import App from "~/components/App";
import reducer, { initialState } from "~/state/store";

import * as Rx from "rxjs";
import * as RxOps from "rxjs/operators";

import LZ from "lz-string";
import stringify from "json-stringify-safe";

import {
  setSource,
  setTarget,
  takeIdentity,
  clearDiagram,
  restrictDiagram,
  makeTheorem
} from "~/state/actions/workspace";

const coreTransform = ReduxPersist.createTransform(
  (inboundState, key) => {
    return JSON.stringify(inboundState)
  },
  (outboundState, key) => {
    return JSON.parse(outboundState, (name, val) => {
      return val;
      if (val === null) {
        return null;
      } else if (typeof val !== 'object') {
        return val;
      } else if (val._t === 'MinimalDiagram' ) {
        return Core.Diagram.fromMinimal(val);
      } else if (val._t === 'MinimalGenerator' ) {
        return Core.Generator.fromMinimal(val);
      } else if (val._t === 'MinimalLimitComponent' ) {
        //return Core.LimitComponent.fromMinimal(val);
        return val;
      } else if (val._t === 'MinimalLimit') {
        //return Core.Limit.fromMinimal(val);
        return val;
      } else if (val._t === 'MinimalContent') {
        //return Core.Content.fromMinimal(val);
        return val;
      } else if (val._t === 'Diagram' ) {
        return new Core.Diagram(val);
      } else if (val._t === 'Generator' ) {
        return new Core.Generator(val);
      } else if (val._t === 'LimitComponent' ) {
        return new Core.LimitComponent(val);
      } else if (val._t === 'Limit') {
        return new Core.Limit(val);
      } else if (val._t === 'Content') {
        return new Core.Content(val);
      } else return val;

      return val;
      if ( name == 'generator' ) {
        if (val.source == null && val.target == null) {
          return new Core.Generator(val.id, null, null);
        } else {
          return new Core.Generator(val.id, val.source, val.target);
        }
      }
      /*
      else if (name == 'diagram') {
        return Core.Diagram.fromJSON(val);
      }
      */
      else {
        return val;
      }
    });
  },
  { /* no options required */ }
);


///////////////////////


const compressor = ReduxPersist.createTransform(
  (state) => {
    let t = performance.now();
    let s = stringify(state);
    let c = LZ.compressToBase64(stringify(state));
    console.log('Compressed ' + s.length + ' bytes to ' + c.length + ' bytes in ' + (performance.now() - t) + ' ms');
    return c;
  },
  //(state) => LZ.compressToUTF16(stringify(state)),
    (state) => {
      if (typeof state !== "string") {
        if (_debug) {
          console.error("redux-persist-transform-compress: expected outbound state to be a string")
        }
        return state
      }
      try {
        return JSON.parse(LZ.decompressFromBase64(state))
      } catch (err) {
        if (_debug) {
          console.error("redux-persist-transform-compress: error while decompressing state", err)
        }
        return null
      }
    },
  {} /*config*/
);

////////////////////////

//const compressor = createCompressor()

//persistStore(store, { transforms: [compressor] })

  const persistConfig = {
    transforms: [coreTransform /*, compressor*/],
    key: 'root',
    storage,
    whitelist: 'object_store',
    stateReconciler: hardSet
  };

  const store = Redux.createStore(
    ReduxPersist.persistReducer(persistConfig, reducer),
    initialState
  );
  window.store = store;
  const persistor = ReduxPersist.persistStore(store, null, () => {
    //store.dispatch(postRehydrate());

    /*
    let state = store.getState();
    let sc_json = state.object_store.serialize_cyclic;
    if (sc_json === null) return;
    let head = sc_json.head;
    let entries = sc_json.entries;
    let index_to_stored_array = sc_json.index_to_stored_array;
    let sc = Core.SerializeCyclic.fromJSON({ head, entries, index_to_stored_array });
    let new_state = sc.getHead();
    Object.assign(state, new_state);
    state.object_store.serialize_cyclic = sc;
    */
  });

  Rx.fromEvent(document, "keydown") 
    .pipe(RxOps.filter(event => event.target.tagName.toLowerCase() != "input"))
    .pipe(RxOps.map(event => event.key))
    .subscribe(key => {
      switch (key) {
      case "s": return store.dispatch(setSource());
      case "t": return store.dispatch(setTarget());
      case "i": return store.dispatch(takeIdentity());
      case "c": return store.dispatch(clearDiagram());
      case "r": return store.dispatch(restrictDiagram());
      case "h": return store.dispatch(makeTheorem());
      //case "r": return store.dispatch(setRenderer(2));
      //case "R": return store.dispatch(setRenderer(3));
      }
    }
  );

  const render = () => {
    ReactDOM.render(
      <ReactRedux.Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <App />
        </PersistGate>
      </ReactRedux.Provider>,
      document.getElementById("app")
    );
  };

  if (module.hot) {
    module.hot.accept("./components/App.js", () => {
      setTimeout(render);
    }
  );

  module.hot.accept(["homotopy-core", "./state/store"], () => {
    store.replaceReducer(reducer);
  });
}

render();
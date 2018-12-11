import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Redux from "redux";
import * as ReactRedux from "react-redux";
import * as ReduxPersist from "redux-persist";
import storage from "redux-persist/lib/storage";
import { PersistGate } from "redux-persist/integration/react";
import * as Core from "homotopy-core";
import "typeface-roboto";
import "@icon/stroke-7/stroke-7.css";

import App from "~/components/App";
import reducer, { initialState } from "~/state/store";

import * as Rx from "rxjs";
import * as RxOps from "rxjs/operators";

import {
  setSource,
  setTarget,
  takeIdentity,
  clearDiagram,
  restrictDiagram,
  makeTheorem,
  setRenderer
} from "~/state/actions/diagram";

import { Diagram } from "../../core/src/diagram";

const coreTransform = ReduxPersist.createTransform(
  (inboundState, key) => JSON.stringify(inboundState),
  (outboundState, key) => {
    return JSON.parse(outboundState, (name, val) => {
      if ( name == 'generator' ) {
        if (val.source == null && val.target == null) {
          return new Core.Generator(val.id, null, null);
        } else {
          // TODO: reserialise diagrams
          return new Core.Generator(val.id, Diagram.fromJSON(val.source), Diagram.fromJSON(val.target));
        }
      } else if (name == 'diagram') {
        return Diagram.fromJSON(val);
      } else {
        return val;
      }
    });
  },
  { /* no options required */ }
);

const persistConfig = {
  transforms: [coreTransform],
  key: 'root',
  storage,
};

const store = Redux.createStore(
  ReduxPersist.persistReducer(persistConfig, reducer)
  , initialState);
window.store = store;
const persistor = ReduxPersist.persistStore(store);

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
  });

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
  });

  module.hot.accept(["homotopy-core", "./state/store"], () => {
    store.replaceReducer(reducer);
  });
}

render();
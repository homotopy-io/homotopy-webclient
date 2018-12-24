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


import createCompressor from 'redux-persist-transform-compress'



import {
  setSource,
  setTarget,
  takeIdentity,
  clearDiagram,
  restrictDiagram,
  makeTheorem
} from "~/state/actions/workspace";

const coreTransform = ReduxPersist.createTransform(
  (inboundState, key) => JSON.stringify(inboundState),
  (outboundState, key) => {
    return JSON.parse(outboundState, (name, val) => {
      if (val === null) {
        return null;
      } else if (typeof val !== 'object') {
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


const compressor = createCompressor()

//persistStore(store, { transforms: [compressor] })


const persistConfig = {
  transforms: [coreTransform, compressor],
  key: 'root',
  storage,
};

const store = Redux.createStore(
  ReduxPersist.persistReducer(persistConfig, reducer)
  , initialState);
window.store = store;
const persistor = ReduxPersist.persistStore(store, null, () => {
  //store.dispatch(postRehydrate());
  console.log("Rehydrated");
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
/* global module */
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Redux from "redux";
import * as ReactRedux from "react-redux";
import "typeface-roboto";
import "@icon/stroke-7/stroke-7.css";

import App from "~/components/App";
import reducer, { initialState } from "~/state/store";
import { connectStore } from "~/state/persist";

import * as Rx from "rxjs";
import * as RxOps from "rxjs/operators";

//import LZ from "lz-string";
//import stringify from "json-stringify-safe";

/*
import {
  setSource,
  setTarget,
  takeIdentity,
  clearDiagram,
  restrictDiagram,
  makeTheorem
} from "~/state/actions/workspace";
*/

/*const compressor = ReduxPersist.createTransform(
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
  {}
);*/

const store = Redux.createStore(reducer, initialState);

connectStore(store);

Rx.fromEvent(document, "keydown") 
  .pipe(RxOps.filter(event => event.target.tagName.toLowerCase() != "input"))
  .pipe(RxOps.map(event => event.key))
  .subscribe(key => {
    switch (key) {
      /*
    case "s": return store.dispatch(setSource());
    case "t": return store.dispatch(setTarget());
    case "i": return store.dispatch(takeIdentity());
    case "c": return store.dispatch(clearDiagram());
    case "r": return store.dispatch(restrictDiagram());
    case "h": return store.dispatch(makeTheorem());
    */
   case "s": return store.dispatch({ type: 'workspace/set-source' });
   case "t": return store.dispatch({ type: 'workspace/set-target' });
   case "i": return store.dispatch({ type: 'workspace/take-identity' });
   case "c": return store.dispatch({ type: 'workspace/clear-diagram' });
   case "r": return store.dispatch({ type: 'workspace/restrict-diagram' });
   case "h": return store.dispatch({ type: 'workspace/make-theorem' });
   //case "r": return store.dispatch(setRenderer(2));
    //case "R": return store.dispatch(setRenderer(3));
    }
  });

const render = () => {
  ReactDOM.render(
    <ReactRedux.Provider store={store}>
      <App />
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

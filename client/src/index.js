import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Redux from "redux";
import * as ReactRedux from "react-redux";
import "typeface-roboto";

import * as Core from "homotopy-core";
import App from "~/components/App";
import reducer from "~/state/store";

import * as Test from "~/layout/master";
import { Geometry } from "homotopy-core";

import * as Rx from "rxjs";
import * as RxOps from "rxjs/operators";

import {
  setSource,
  setTarget,
  takeIdentity,
  clearDiagram,
  selectRenderer
} from "~/state/actions/diagram";

const configureStore = () => {
  if (window.store == null) {
    window.store = Redux.createStore(reducer);
    return window.store;
  }

  if (process.env.NODE_ENV === "development") {
    window.store.replaceReducer(reducer);
  } 

  return window.store;
}

const store = configureStore();

if (window.keySubscriptions) {
  window.keySubscriptions.unsubscribe();
}

window.keySubscriptions = Rx.fromEvent(document, "keydown") 
  .pipe(RxOps.filter(event => event.target.tagName.toLowerCase() != "input"))
  .pipe(RxOps.map(event => event.key))
  .subscribe(key => {
    console.log(key);
    switch (key) {
      case "s": return store.dispatch(setSource());
      case "t": return store.dispatch(setTarget());
      case "i": return store.dispatch(takeIdentity());
      case "c": return store.dispatch(clearDiagram());
      case "r": return store.dispatch(selectRenderer(2));
      case "R": return store.dispatch(selectRenderer(3));
    }
  });

ReactDOM.render(
  <ReactRedux.Provider store={store}>
    <App />
  </ReactRedux.Provider>,
  document.getElementById("app")
);
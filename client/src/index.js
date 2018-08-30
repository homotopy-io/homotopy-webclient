import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Redux from "redux";
import * as ReactRedux from "react-redux";
import "typeface-roboto";
import "@icon/stroke-7/stroke-7.css";

import App from "~/components/App";
import reducer from "~/state/store";

import { Geometry } from "homotopy-core";

import * as Rx from "rxjs";
import * as RxOps from "rxjs/operators";

import {
  setSource,
  setTarget,
  takeIdentity,
  clearDiagram,
  setRenderer
} from "~/state/actions/diagram";

const store = Redux.createStore(reducer);

Rx.fromEvent(document, "keydown") 
  .pipe(RxOps.filter(event => event.target.tagName.toLowerCase() != "input"))
  .pipe(RxOps.map(event => event.key))
  .subscribe(key => {
    console.log(key);
    switch (key) {
      case "s": return store.dispatch(setSource());
      case "t": return store.dispatch(setTarget());
      case "i": return store.dispatch(takeIdentity());
      case "c": return store.dispatch(clearDiagram());
      case "r": return store.dispatch(setRenderer(2));
      case "R": return store.dispatch(setRenderer(3));
    }
  });

const render = () => ReactDOM.render(
  <ReactRedux.Provider store={store}>
    <App />
  </ReactRedux.Provider>,
  document.getElementById("app")
);


if (module.hot) {
  console.log("Setup HMR");

  module.hot.accept('./components/App.js', () => {
    console.log("Render");
    setTimeout(render);
  });

  module.hot.accept(["homotopy-core", './state/store'], () => {
    console.log("Replaced store");
    store.replaceReducer(reducer);
  });
}

render();
/* global module */
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Redux from "redux";
import * as ReactRedux from "react-redux";
import "typeface-roboto";
import "@icon/stroke-7/stroke-7.css";

import App from "~/components/App";
import createStore from "~/state/store";
import { connectStore } from "~/state/persist";

import * as Rx from "rxjs";
import * as RxOps from "rxjs/operators";

//import stringify from "json-stringify-safe";

const store = createStore()

connectStore(store);

Rx.fromEvent(document, "keydown")
  .pipe(RxOps.filter(event => event.target.tagName.toLowerCase() != "input" &&
                              event.target.tagName.toLowerCase() != "textarea" ))
  .pipe(RxOps.map(event => event.key))
  .subscribe(key => {
    switch (key) {
      case "s": return store.dispatch({ type: 'workspace/set-source' });
      case "t": return store.dispatch({ type: 'workspace/set-target' });
      case "i": return store.dispatch({ type: 'workspace/take-identity' });
      case "c": return store.dispatch({ type: 'workspace/clear-diagram' });
      case "r": return store.dispatch({ type: 'workspace/restrict-diagram' });
      case "h": return store.dispatch({ type: 'workspace/make-theorem' });
      case "d": return store.dispatch({ type: 'workspace/behead' });
      case "o": return store.dispatch({ type: 'workspace/contract' });
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

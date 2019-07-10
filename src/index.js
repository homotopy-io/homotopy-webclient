/* global module */
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Redux from "redux";
import * as ReactRedux from "react-redux";
import { ReactReduxFirebaseProvider } from 'react-redux-firebase'
import "typeface-roboto";
import "@icon/stroke-7/stroke-7.css";

import App from "~/components/App";
import createStore, { rrfProps } from "~/state/store";
import { configureUrlQuery } from 'react-url-query'
import history from '~/util/history'
import { connectStore } from "~/state/persist";

import * as Rx from "rxjs";
import * as RxOps from "rxjs/operators";

//import stringify from "json-stringify-safe";

configureUrlQuery({ history, addChangeHandlers: false })

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
      case "p": return store.dispatch({ type: 'workspace/increase-projection' });
      case "P": return store.dispatch({ type: 'workspace/decrease-projection' });
      case "j": return store.dispatch({ type: 'workspace/decrease-slice' });
      case "k": return store.dispatch({ type: 'workspace/increase-slice' });
    }
  });

const render = () => {
  ReactDOM.render(
    <ReactRedux.Provider store={store}>
      <ReactReduxFirebaseProvider dispatch={store.dispatch} {...rrfProps}>
        <App authIsReady={store.firebaseAuthIsReady} />
      </ReactReduxFirebaseProvider>
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

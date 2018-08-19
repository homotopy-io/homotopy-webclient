import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Redux from "redux";
import * as ReactRedux from "react-redux";
import "typeface-roboto";

import * as Core from "homotopy-core";
import App from "~/components/App";
import reducer from "~/state/store";

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

ReactDOM.render(
  <ReactRedux.Provider store={configureStore()}>
    <App />
  </ReactRedux.Provider>,
  document.getElementById("app")
);
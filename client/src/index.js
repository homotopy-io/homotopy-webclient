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


const x = new Core.Generator("x", null, null);
const y = new Core.Generator("y", null, null);
const f = new Core.Generator("f", x.getDiagram(), y.getDiagram());
const xBoost = x.getDiagram();
xBoost.boost();

const aSource = f.getDiagram().copy();
aSource.attach(f.getDiagram().data[0], { type: "s", depth: 0 });

const aTarget = xBoost;
const a = new Core.Generator("a", aSource, aTarget);
window.diagram = a.getDiagram();


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
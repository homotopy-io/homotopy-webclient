import { combineReducers } from "redux";
import diagram from "~/state/store/diagram";
import signature from "~/state/store/signature";
import attach from "~/state/store/attach";

export default (state, action) => {
  state = state || {
    signature: {
      generators: {},
      id: 0
    },
    diagram: {
      diagram: null,
      source: null,
      target: null,
      slice: null,
      projection: null,
    },
    attach: {
      options: null,
      highlight: null
    }
  };

  state = diagram(state, action);
  state = signature(state, action);
  state = attach(state, action);
  return state;
}

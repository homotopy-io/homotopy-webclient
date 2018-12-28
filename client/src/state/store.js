import workspace from "~/state/store/workspace";
import signature from "~/state/store/signature";
import attach from "~/state/store/attach";
//import object_store from "~/state/store/object_store";
//import LZ from "lz-string";
//import * as Core from "homotopy-core";
//import dotProp from "dot-prop-immutable";
//import stringify from "json-stringify-safe";
import persist from "~/state/store/persist";

export const initialState = {
  signature: {
    generators: {},
    edited: null /* not sure what this does */
  },
  workspace: {
    diagram: null,
    source: null,
    target: null,
    slice: null,
    projection: null,
    renderer: 2
  },
  attach: {
    options: null,
    highlight: null
  },
};

export default (state, action) => {
  state = persist(state, action);
  state = workspace(state, action);
  state = signature(state, action);
  state = attach(state, action);
  return state;
};

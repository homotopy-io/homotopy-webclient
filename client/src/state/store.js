import workspace from "~/state/store/workspace";
import signature from "~/state/store/signature";
import attach from "~/state/store/attach";
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

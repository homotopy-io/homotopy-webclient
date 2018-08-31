import diagram from "~/state/store/diagram";
import signature from "~/state/store/signature";
import attach from "~/state/store/attach";

export const initialState = {
  signature: {
    generators: {},
    edited: null,
    id: 0
  },
  diagram: {
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
  }
};

export default (state, action) => {
  state = diagram(state, action);
  state = signature(state, action);
  state = attach(state, action);
  return state;
};

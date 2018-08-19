import { combineReducers } from "redux";
import diagram from "~/state/store/diagram";
import signature from "~/state/store/signature";

export default (state, action) => {
  state = state || {
    signature: {},
    diagram: {
      diagram: null,
      source: null,
      target: null
    }
  };

  console.log(action.type);

  state = diagram(state, action);
  state = signature(state, action);
  return state;
}

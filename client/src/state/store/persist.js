import * as PersistActions from "../actions/persist";

export default (state, action) => {
  switch (action.type) {
  case [PersistActions.LOADED]: {
    state = { ...state, ...action.payload };
    return state;
  }

  default: return state;
  }
};

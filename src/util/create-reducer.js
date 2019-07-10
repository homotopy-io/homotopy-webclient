export default (initialState, reducers) => (state = initialState, action) => {
  if (reducers.hasOwnProperty(action.type)) {
    return reducers[action.type](state, action.payload || {});
  } else {
    return state;
  }
};

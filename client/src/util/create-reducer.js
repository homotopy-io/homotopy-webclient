export default (reducers) => (state, action) => {
  if (reducers.hasOwnProperty(action.type)) {
    return reducers[action.type](state, action.payload || {});
  } else {
    return state;
  }
}
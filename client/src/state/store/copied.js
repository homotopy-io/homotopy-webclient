import createReducer from '~/util/create-reducer'

export default createReducer(false, {
  ["copied/set"]: (state) => true,
  ["copied/clear"]: (state) => false
})

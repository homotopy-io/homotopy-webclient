import createReducer from '~/util/create-reducer'
import dotProp from "dot-prop-immutable";

export default createReducer(false, {
  ["copied/set"]: (state) => true,
  ["copied/clear"]: (state) => false
})

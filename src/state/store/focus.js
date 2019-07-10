import createReducer from '~/util/create-reducer'
import dotProp from "dot-prop-immutable"

export default createReducer({ title: false, abstract: false }, {
  ["focus/set-title-focus"]: (state, { focus }) => dotProp.set(state, "title", focus),
  ["focus/set-abstract-focus"]: (state, { focus }) => dotProp.set(state, "abstract", focus)
})

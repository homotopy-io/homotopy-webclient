import dotProp from "dot-prop-immutable";
import * as UserActions from "~/state/actions/user";
import createReducer from "~/util/create-reducer";

export const initialUser = {
  loginForm: {
    showModal: false,
    initialTab: null,
    error: null
  }
}

export const getShowModal = (state) => state.user.loginForm.showModal

export const getInitialTab = (state) => state.user.loginForm.initialTab

export const getError = (state) => state.user.loginForm.error

export default createReducer(initialUser, {
  [UserActions.OPEN_MODAL]: (state, { index }) =>
    dotProp.set(state, "loginForm.showModal", true)
  ,
  [UserActions.CLOSE_MODAL]: (state) =>
    dotProp.set(state, "loginForm.showModal", false)
  ,
  [UserActions.SET_INITIAL_TAB]: (state, { index }) =>
    dotProp.set(state, "loginForm.initialTab", index)
  ,
  [UserActions.SET_ERROR]: (state, { error }) =>
    dotProp.set(state, "loginForm.error", error)
});

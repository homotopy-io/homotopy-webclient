export const OPEN_MODAL = "user/login-form/open-modal"
export const CLOSE_MODAL = "user/login-form/close-modal"
export const SET_INITIAL_TAB = "user/login-form/set-initial-tab"
export const SET_ERROR = "user/login-form/set-error"

export const openModal = () => ({
  type: OPEN_MODAL,
})

export const closeModal = () => ({
  type: CLOSE_MODAL,
})

export const setInitialTab = (index) => ({
  type: SET_INITIAL_TAB,
  payload: { index }
})

export const setError = (error) => ({
  type: SET_ERROR,
  payload: { error }
})

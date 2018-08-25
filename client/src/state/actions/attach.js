export const SET_HIGHLIGHT = "attach/set-highlight";
export const CLEAR_HIGHLIGHT = "attach/clear-highlight";
export const SELECT_OPTION = "attach/select-option";
export const CLEAR_OPTIONS = "attach/clear-options";

export const setHighlight = (index) => ({
  type: SET_HIGHLIGHT,
  payload: { index }
});

export const clearHighlight = () => ({
  type: CLEAR_HIGHLIGHT,
});

export const selectOption = (index) => ({
  type: SELECT_OPTION,
  payload: { index }
});

export const clearOptions = (index) => ({
  type: CLEAR_OPTIONS,
  payload: { index }
});
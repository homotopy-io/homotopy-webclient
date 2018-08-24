export const SET_SOURCE = "diagram/set-source";
export const SET_TARGET = "diagram/set-target";
export const CLEAR_DIAGRAM = "diagram/clear-diagram";
export const TAKE_IDENTITY = "diagram/take-identity";
export const SELECT_CELL = "diagram/select-cell";

export const setSource = () => ({
  type: SET_SOURCE
});

export const setTarget = () => ({
  type: SET_TARGET
});

export const clearDiagram = () => ({
  type: CLEAR_DIAGRAM
});

export const takeIdentity = () => ({
  type: TAKE_IDENTITY
});

export const selectCell = (points) => ({
  type: SELECT_CELL,
  payload: { points }
});
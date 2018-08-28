export const SET_SOURCE = "diagram/set-source";
export const SET_TARGET = "diagram/set-target";
export const SET_PROJECTION = "diagram/set-projection";
export const SET_SLICE = "diagram/set-slice";
export const CLEAR_BOUNDARY = "diagram/clear-boundary";
export const CLEAR_DIAGRAM = "diagram/clear-diagram";
export const TAKE_IDENTITY = "diagram/take-identity";
export const SELECT_CELL = "diagram/select-cell";
export const CONTRACT = "diagram/contract";

export const setSource = () => ({
  type: SET_SOURCE
});

export const setTarget = () => ({
  type: SET_TARGET
});

export const setProjection = (projection) => ({
  type: SET_PROJECTION,
  payload: { projection }
});

export const setSlice = (index, height) => ({
  type: SET_SLICE,
  payload: { index, height }
})

export const clearBoundary = () => ({
  type: CLEAR_BOUNDARY
});

export const clearDiagram = () => ({
  type: CLEAR_DIAGRAM
});

export const takeIdentity = () => ({
  type: TAKE_IDENTITY
});

export const selectCell = (point) => ({
  type: SELECT_CELL,
  payload: { point }
});

export const contract = (point, direction) => ({
  type: CONTRACT,
  payload: { point, direction }
});
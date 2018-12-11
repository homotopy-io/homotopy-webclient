export const SET_SOURCE = "diagram/set-source";
export const SET_TARGET = "diagram/set-target";
export const SET_PROJECTION = "diagram/set-projection";
export const SET_SLICE = "diagram/set-slice";
export const SET_RENDERER = "diagram/set-renderer";
export const CLEAR_BOUNDARY = "diagram/clear-boundary";
export const CLEAR_DIAGRAM = "diagram/clear-diagram";
export const TAKE_IDENTITY = "diagram/take-identity";
export const RESTRICT_DIAGRAM = "diagram/restrict-diagram";
export const MAKE_THEOREM = "diagram/make-theorem";
export const SELECT_CELL = "diagram/select-cell";
export const HOMOTOPY = "diagram/homotopy";

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
});

export const setRenderer = (renderer) => ({
  type: SET_RENDERER,
  payload: { renderer }
});

export const clearBoundary = () => ({
  type: CLEAR_BOUNDARY
});

export const clearDiagram = () => ({
  type: CLEAR_DIAGRAM
});

export const takeIdentity = () => ({
  type: TAKE_IDENTITY
});

export const restrictDiagram = () => ({
  type: RESTRICT_DIAGRAM
});

export const makeTheorem = () => ({
  type: MAKE_THEOREM
});

export const selectCell = (points) => {
  return {
  type: SELECT_CELL,
  payload: { points }
}};

export const homotopy = (point, direction) => ({
  type: HOMOTOPY,
  payload: { point, direction }
});

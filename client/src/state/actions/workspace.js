export const SET_SOURCE = "workspace/set-source";
export const SET_TARGET = "workspace/set-target";
export const SET_PROJECTION = "workspace/set-projection";
export const SET_SLICE = "workspace/set-slice";
export const SET_RENDERER = "workspace/set-renderer";
export const CLEAR_BOUNDARY = "workspace/clear-boundary";
export const CLEAR_DIAGRAM = "workspace/clear-diagram";
export const TAKE_IDENTITY = "workspace/take-identity";
export const RESTRICT_DIAGRAM = "workspace/restrict-diagram";
export const MAKE_THEOREM = "workspace/make-theorem";
export const SELECT_CELL = "workspace/select-cell";
export const HOMOTOPY = "workspace/homotopy";
export const POST_REHYDRATE = "workspace/post-rehydrate";

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

/*
export const postRehydrate = () => ({
  type: POST_REHYDRATE
});
*/

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

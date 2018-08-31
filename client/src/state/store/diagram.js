import dotProp from "dot-prop-immutable";
import createReducer from "~/util/create-reducer";
import * as DiagramActions from "~/state/actions/diagram";
import * as SignatureActions from "~/state/actions/signature";
import * as Core from "homotopy-core";
import { createGenerator } from "~/state/store/signature";

export const getDiagram = (state) => {
  return state.diagram.diagram;
};

export const getDisplayDiagram = (state) => {
  let { diagram, slice } = state.diagram;

  if (diagram == null) {
    return null;
  } else {
    return Core.Geometry.getSlice(diagram, ...slice);
  }
};

export const getDisplayDimension = (state) => {
  let { diagram, projection, renderer } = state.diagram;

  if (diagram == null) {
    return null;
  } else {
    return Math.min(renderer, diagram.n - projection);
  }
};

export const getSliceBounds = (state) => {
  let { diagram, slice } = state.diagram;

  if (diagram == null) {
    return [];
  } else {
    let options = [];
    for (let height of slice) {
      options.push(diagram.data.length * 2);
      diagram = Core.Geometry.getSlice(diagram, height);
    }
    return options;
  }
};

export const getSource = (state) => {
  return state.diagram.source;
};

export const getTarget = (state) => {
  return state.diagram.target;
};

export const getSlice = (state) => {
  return state.diagram.slice;
};

export const getRenderer = (state) => {
  return state.diagram.renderer;
};

export const getProjection = (state) => {
  return state.diagram.projection;
};

export const setDiagram = (state, diagram) => {
  let slice = Array(Math.max(0, diagram.n - state.diagram.renderer)).fill(0);

  state = dotProp.set(state, "diagram.diagram", diagram);
  state = dotProp.set(state, "diagram.projection", 0);
  state = dotProp.set(state, "diagram.slice", slice);
  return state;
};

export const updateSlices = (state) => {
  let { slice, diagram, projection, renderer } = state.diagram;

  if (diagram == null) {
    return state;
  }

  let sliceCount = diagram.n - renderer - projection;

  if (sliceCount > slice.length) {
    slice = [...slice, Array(sliceCount - slice.length).fill(0)];
  } else {
    slice = slice.slice(0, sliceCount);
  }

  for (let i = 0; i < slice.length; i++) {
    slice[i] = Math.max(slice[i], 0);
    slice[i] = Math.min(slice[i], diagram.data.length * 2);
    diagram = Core.Geometry.getSlice(diagram, slice[i]);
  }

  state = dotProp.set(state, "diagram.slice", slice);
  return state;
};

export default createReducer({
  [DiagramActions.SET_SOURCE]: (state) => {
    let { target, diagram } = state.diagram;

    if (diagram == null) {
      return state;
    } else if (target != null) {
      if (target.n == diagram.n) {
        state = createGenerator(state, diagram, target);
        state = dotProp.set(state, "diagram.diagram", null);
        state = dotProp.set(state, "diagram.target", null);
        return state;
      } else {
        return state;
      }
    } else {
      state = dotProp.set(state, "diagram.source", diagram);
      state = dotProp.set(state, "diagram.diagram", null);
      return state;
    }
  },

  [DiagramActions.SET_TARGET]: (state) => {
    let { source, diagram } = state.diagram;

    if (diagram == null) {
      return state;
    } else if (source != null) {
      if (source.n == diagram.n) {
        state = createGenerator(state, source, diagram);
        state = dotProp.set(state, "diagram.diagram", null);
        state = dotProp.set(state, "diagram.source", null);
        return state;
      } else {
        return state;
      }
    } else {
      state = dotProp.set(state, "diagram.target", diagram);
      state = dotProp.set(state, "diagram.diagram", null);
      return state;
    }
  },

  [DiagramActions.SET_RENDERER]: (state, { renderer }) => {
    state = dotProp.set(state, "diagram.renderer", renderer);
    state = updateSlices(state);
    return state;
  },

  [DiagramActions.CONTRACT]: (state, { point, direction }) => {
    let { diagram, slice } = state.diagram;

    if (diagram == null) {
      return state;
    }

    point = Core.Geometry.unprojectPoint(diagram, [...slice, ...point]);

    let path = Core.Boundary.getPath(diagram, point);
    path.point[path.point.length - 1] -= direction[1] < 0 ? 2 : 0;

    try {
      diagram = Core.attach(
        diagram,
        (boundary, point) => {
          return boundary.contract(point.slice(0, -1), direction);
        },
        path
      );

      state = dotProp.set(state, "diagram.diagram", diagram);
      state = updateSlices(state);
      return state;

    } catch(error) {
      console.error(error);
      return state;
    }
  },

  [DiagramActions.CLEAR_DIAGRAM]: (state) => {
    state = dotProp.set(state, "diagram.diagram", null);
    return state;
  },

  [DiagramActions.TAKE_IDENTITY]: (state) => {
    state = dotProp.set(state, "diagram.diagram", diagram => diagram.boost());
    state = updateSlices(state);
    return state;
  },

  [DiagramActions.SET_PROJECTION]: (state, { projection }) => {
    state = dotProp.set(state, "diagram.projection", projection);
    state = updateSlices(state);
    return state;
  },

  [DiagramActions.SET_SLICE]: (state, { index, height }) => {
    state = dotProp.set(state, `diagram.slice.${index}`, height);
    state = updateSlices(state);
    return state;
  },

  [DiagramActions.CLEAR_BOUNDARY]: (state) => {
    state = dotProp.set(state, "diagram.source", null);
    state = dotProp.set(state, "diagram.target", null);
    return state;
  },

  [SignatureActions.SELECT_GENERATOR]: (state, { id }) => {
    let { diagram } = state.diagram;
    let generator = state.signature.generators[id];

    if (diagram == null) {
      diagram = generator.generator.diagram;
      state = setDiagram(state, diagram);
      return state;
    } else {
      return state;
    }
  }

});
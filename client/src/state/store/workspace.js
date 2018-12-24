import { _assert, _debug } from "../../../../core/src/util/debug"; // this is a mess
import dotProp from "dot-prop-immutable";
import { createSelector } from "reselect";
import createReducer from "~/util/create-reducer";
import * as WorkspaceActions from "~/state/actions/workspace";
import * as SignatureActions from "~/state/actions/signature";
import * as Core from "homotopy-core";
import { createGenerator, getGenerator } from "~/state/store/signature";

export const getDiagram = (state) => {
  return state.workspace.diagram;
};

export const getDisplayDiagram = (state) => {
  let { diagram, slice } = state.workspace;

  if (diagram == null) {
    return null;
  } else {
    return Core.Geometry.getSlice(diagram, ...slice);
  }
};

export const getDisplayDimension = (state) => {
  let { diagram, projection, renderer } = state.workspace;

  if (diagram == null) {
    return null;
  } else {
    return Math.min(renderer, diagram.n - projection);
  }
};

export const getSliceBounds = (state) => {
  let { diagram, slice } = state.workspace;

  if (diagram == null) {
    return [];
  } else {
    let options = [];
    if (_debug) _assert(slice instanceof Array);
    for (let height of slice) {
      options.push(diagram.data.length * 2);
      diagram = Core.Geometry.getSlice(diagram, height);
    }
    return options;
  }
};

export const getSource = (state) => {
  return state.workspace.source;
};

export const getTarget = (state) => {
  return state.workspace.target;
};

export const getSlice = (state) => {
  return state.workspace.slice;
};

export const getRenderer = (state) => {
  return state.workspace.renderer;
};

export const getProjection = (state) => {
  return state.workspace.projection;
};

export const setDiagram = (state, diagram) => {
  let slice = Array(Math.max(0, diagram.n - state.workspace.renderer)).fill(0);

  state = dotProp.set(state, "workspace.diagram", diagram);
  state = dotProp.set(state, "workspace.projection", 0);
  state = dotProp.set(state, "workspace.slice", slice);
  return state;
};

export const updateSlices = createSelector(
  state => state.workspace.slice,
  state => state.workspace.diagram,
  state => state.workspace.projection,
  state => state.workspace.renderer,
  (slice, diagram, projection, renderer) => {

    if (diagram == null) return [];

    let sliceCount = diagram.n - renderer - projection;

    if (sliceCount > slice.length) {
      slice = [...slice, Array(sliceCount - slice.length).fill(0)];
    } else {
      slice = slice.slice(0, sliceCount);
    }

    for (let i = 0; i < slice.length; i++) {
      slice[i] = Math.max(slice[i], -1);
      slice[i] = Math.min(slice[i], diagram.data.length * 2 + 1);
      diagram = Core.Geometry.getSlice(diagram, slice[i]);
    }

    return slice
  }
);

export default createReducer({

  /*
  [WorkspaceActions.POST_REHYDRATE]: (state) => {

    let { diagram, source, target } = state.workspace;
    let { generators } = state.signature;

    if (diagram) {
      let diagram_rehydrated = Core.Diagram.postRehydrate(diagram, generators);
      state = dotProp.set(state, "workspace.diagram", diagram_rehydrated);
    }

    if (source) {
      let source_rehydrated = Core.Diagram.postRehydrate(source, generators);
      state = dotProp.set(state, "workspace.source", source_rehydrated);
    }

    if (target) {
      let target_rehydrated = Core.Diagram.postRehydrate(target, generators);
      state = dotProp.set(state, "workspace.target", target_rehydrated);
    }

    return state;
  },
  */

  [WorkspaceActions.SET_SOURCE]: (state) => {
    let { target, diagram } = state.workspace;
    let source = diagram;

    if (diagram == null) return state;
    
    // If there is already a source, create a new generator
    if (target != null) {

      if (target.n != source.n) {
        alert ('Source and target must have the same dimension');
        return state;
      }

      if (source.n > 1) {
        if (!source.source.equals(target.source)
          || !source.getTarget().equals(target.getTarget())) {
            alert ('Source and target must have the same boundary');
            return state;
        }
      }

      state = createGenerator(state, source, target);
      state = dotProp.set(state, "workspace.diagram", null);
      state = dotProp.set(state, "workspace.target", null);
      return state;
    }

    // If there is not already a source, just store this target
    else {
      state = dotProp.set(state, "workspace.source", source);
      state = dotProp.set(state, "workspace.diagram", null);
      return state;
    }
  },

  [WorkspaceActions.SET_TARGET]: (state) => {
    let { source, diagram } = state.workspace;
    let target = diagram;

    if (diagram == null) return state;
    
    // If there is already a source, create a new generator
    if (source != null) {

      if (source.n != target.n) {
        alert ('Source and target must have the same dimension');
        return state;
      }

      if (source.n >= 1) {
        if (!source.source.equals(target.source)
          || !source.getTarget().equals(target.getTarget())) {
            alert ('Source and target must have the same boundary');
            return state;
        }
      }

      state = createGenerator(state, source, target);
      state = dotProp.set(state, "workspace.diagram", null);
      state = dotProp.set(state, "workspace.source", null);
      return state;
    }

    // If there is not already a source, just store this target
    else {
      state = dotProp.set(state, "workspace.target", target);
      state = dotProp.set(state, "workspace.diagram", null);
      return state;
    }
  },

  [WorkspaceActions.MAKE_THEOREM]: (state) => {
    let { diagram } = state.workspace;
    state = createGenerator(state, diagram.source, diagram.getTarget());
    let generator = getGenerator(state, state.signature.id - 1);
    state = createGenerator(state, generator.generator.diagram, diagram);
    state = dotProp.set(state, "workspace.diagram", null);
    return state;
  },

  [WorkspaceActions.SET_RENDERER]: (state, { renderer }) => {
    state = dotProp.set(state, "workspace.renderer", renderer);
    state = dotProp.set(state, "workspace.slice", updateSlices(state));
    return state;
  },

  [WorkspaceActions.HOMOTOPY]: (state, { point, direction }) => {
    let { diagram, slice } = state.workspace;
    let { generators } = state.signature;

    if (diagram == null || point.length < 2) return state;

    //point = Core.Geometry.unprojectPoint(diagram, [...slice, ...point]);
    let path = Core.Boundary.getPath(diagram, [...slice, ...point]);

    try {
      let { new_diagram, new_slice } = Core.attach(
        generators,
        diagram,
        (boundary, point) => boundary.homotopy(point, direction, generators),
        path,
        slice
      );

      state = dotProp.set(state, "workspace.diagram", new_diagram);
      state = dotProp.set(state, "workspace.slice", new_slice);

      //state = dotProp.set(state, "workspace.slice", updateSlices(state));

      return state;
    } catch(error) {
      console.error(error);
      return state;
    }
  },

  [WorkspaceActions.CLEAR_DIAGRAM]: (state) => {
    state = dotProp.set(state, "workspace.diagram", null);
    return state;
  },

  [WorkspaceActions.RESTRICT_DIAGRAM]: (state) => {
    let { diagram, slice } = state.workspace;
    for (let i=0; i<slice.length; i++) {
      if (slice > 0 && slice < 2 * diagram.data.length) {
        if (slice % 2 == 1) {
          alert('Cannot restrict diagram to singular slice');
          return state;
        }
      }
    }
    state = dotProp.set(state, "workspace.diagram", diagram.getSlice(...slice));
    state = dotProp.set(state, "workspace.slice", []);
    return state;
  },

  [WorkspaceActions.TAKE_IDENTITY]: (state) => {
    state = dotProp.set(state, "workspace.diagram", diagram => diagram.boost());
    let slice = state.workspace.slice.slice();
    let diagram = state.workspace.diagram;
    let sliceCount = diagram.n - state.workspace.renderer - state.workspace.projection;
    if (sliceCount > slice.length) slice.push(1);
    state = dotProp.set(state, "workspace.slice", slice);
    return state;
  },

  [WorkspaceActions.SET_PROJECTION]: (state, { projection }) => {
    state = dotProp.set(state, "workspace.projection", projection);
    state = dotProp.set(state, "workspace.slice", updateSlices(state));
    return state;
  },

  [WorkspaceActions.SET_SLICE]: (state, { index, height }) => {
    state = dotProp.set(state, `workspace.slice.${index}`, height);
    state = dotProp.set(state, "workspace.slice", updateSlices(state));
    return state;
  },

  [WorkspaceActions.CLEAR_BOUNDARY]: (state) => {
    state = dotProp.set(state, "workspace.source", null);
    state = dotProp.set(state, "workspace.target", null);
    return state;
  },

  [SignatureActions.SELECT_GENERATOR]: (state, { id }) => {
    let { diagram } = state.workspace;
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
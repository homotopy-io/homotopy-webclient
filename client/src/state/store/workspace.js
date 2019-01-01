import { _assert, _debug } from "../../../../core/src/util/debug"; // this is a mess
import dotProp from "dot-prop-immutable";
import { createSelector } from "reselect";
import createReducer from "~/util/create-reducer";
import * as WorkspaceActions from "~/state/actions/workspace";
import * as SignatureActions from "~/state/actions/signature";
import * as Core from "homotopy-core";
import { createGenerator, getGenerator, getFreshId } from "~/state/store/signature";

export const initialWorkspace = {
  diagram: null,
  source: null,
  target: null,
  slice: null,
  projection: null,
  renderer: 2
}

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

export default (state = initialWorkspace, action) => {

  switch (action.type) {

    case 'workspace/set-source': {

      let { target, diagram } = state.workspace;
      let source = diagram;
      if (diagram == null) return state;

      // If there's no target, just store this source
      if (target == null) {
        state = dotProp.set(state, "workspace.source", source);
        state = dotProp.set(state, "workspace.diagram", null);
        break;
      }

      // Dimension test
      if (target.n != source.n) {
        alert ('Source and target must have the same dimension');
        break;
      }

      // Globularity test
      if (source.n > 1) {
        if (!source.source.equals(target.source)
          || !source.getTarget().equals(target.getTarget())) {
            alert ('Source and target must have the same boundary');
            break;
        }
      }

      state = createGenerator(state, source, target, getFreshId(state));
      state = dotProp.set(state, "workspace.diagram", null);
      state = dotProp.set(state, "workspace.target", null);
      break;

    } case 'workspace/set-target': {

      _assert(state);
      let { source, diagram } = state.workspace;
      let target = diagram;
      if (diagram == null) break;

      // If there is not already a source, just store this target
      if (source == null) {
        state = dotProp.set(state, "workspace.target", target);
        state = dotProp.set(state, "workspace.diagram", null);
        break;
      }
      
      // Dimension test
      if (source.n != target.n) {
        alert ('Source and target must have the same dimension');
        break;
      }

      // Globularity test
      if (source.n >= 1) {
        if (!source.source.equals(target.source)
          || !source.getTarget().equals(target.getTarget())) {
            alert ('Source and target must have the same boundary');
            break;
        }
      }

      _assert(state);
      _assert(source);
      _assert(target);
      state = createGenerator(state, source, target, getFreshId(state));
      state = dotProp.set(state, "workspace.diagram", null);
      state = dotProp.set(state, "workspace.source", null);

      break;

    } case 'workspace/make-theorem': {

      let workspace = state.workspace;
      let diagram = workspace.diagram;
      let id = getFreshId(state);
      state = createGenerator(state, diagram.source, diagram.getTarget(), id);
      let generator = getGenerator(state, id);
      state = createGenerator(state, generator.generator.diagram, diagram, getFreshId(state));
      state = dotProp.set(state, "workspace.diagram", null);
      break;

    } case 'workspace/set-renderer': {

      state = dotProp.set(state, "workspace.renderer", renderer);
      state = dotProp.set(state, "workspace.slice", updateSlices(state));
      break;

    } case 'workspace/homotopy': {

      let { point, direction } = action.payload;
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

      } catch(error) {
        console.error(error);
      }

      break;

    } case 'workspace/clear-diagram': {

      state = dotProp.set(state, "workspace.diagram", null);
      break;

    } case 'workspace/restrict-diagram': {

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
      break;

    } case 'workspace/behead': {

      let { diagram } = state.workspace;

      // Can't behead an empty diagram or a 0-dimensional diagram
      if (!diagram || diagram.n == 0) break;

      // We can't decapitate an identity diagram
      if (diagram.data.length == 0) break;

      // Build the new diagram
      let new_diagram = diagram.copy({ data: diagram.data.slice(0, diagram.data.length - 1) });

      // Set it in the state
      state = dotProp.set(state, "workspace.diagram", new_diagram);

      // Update the slices so they are still valid
      state = dotProp.set(state, "workspace.slice", updateSlices(state));

      break;

    } case 'workspace/take-identity': {

      state = dotProp.set(state, "workspace.diagram", diagram => diagram.boost());
      let slice = state.workspace.slice.slice();
      let diagram = state.workspace.diagram;
      let sliceCount = diagram.n - state.workspace.renderer - state.workspace.projection;
      if (sliceCount > slice.length) slice.push(1);
      state = dotProp.set(state, "workspace.slice", slice);
      break;

    } case 'workspace/set-projection': {

      let { projection } = action.payload;
      state = dotProp.set(state, "workspace.projection", projection);
      state = dotProp.set(state, "workspace.slice", updateSlices(state));
      break;

    } case 'workspace/set-slice': {

      let { index, height } = action.payload;
      state = dotProp.set(state, `workspace.slice.${index}`, height);
      state = dotProp.set(state, "workspace.slice", updateSlices(state));
      break;

    } case 'workspace/clear-boundary': {

      state = dotProp.set(state, "workspace.source", null);
      state = dotProp.set(state, "workspace.target", null);
      break;

    } case 'workspace/contract': {

      let { diagram } = state.workspace;
      let { generators } = state.signature;
      if (!diagram) break;
      let contract = diagram.contract(generators);
      let new_diagram = contract.rewrite_forward(diagram);
      if (_debug) _assert(new_diagram.typecheck(generators));
      state = dotProp.set(state, "workspace.diagram", new_diagram);

      // Update the slices so they are still valid
      state = dotProp.set(state, "workspace.slice", updateSlices(state));

      break;

    } case 'signature/select-generator': {

      let { id } = action.payload;
      let { diagram } = state.workspace;
      let generator = state.signature.generators[id];
      if (diagram == null) {
        diagram = generator.generator.diagram;
        state = setDiagram(state, diagram);
      }
      break;

    }

  }

  return state;

}

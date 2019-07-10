import { _assert, _debug } from "homotopy-core/src/util/debug";
import dotProp from "dot-prop-immutable";
import { createSelector } from "reselect";
import createReducer from "~/util/create-reducer";
import * as WorkspaceActions from "~/state/actions/workspace";
import * as SignatureActions from "~/state/actions/signature";
import * as Core from "homotopy-core";
import { createGenerator, getGenerator, getFreshId } from "~/state/store/signature";
import { notify } from "~/state/store/notify";

export const initialWorkspace = {
  diagram: null,
  source: null,
  target: null,
  slice: null,
  projection: null,
  renderer: 2,
  notifications: []
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

      let { target, diagram, notifications } = state.workspace;
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

      state = dotProp.set(state, "workspace.renderer", action.payload.renderer);
      state = dotProp.set(state, "workspace.slice", updateSlices(state));
      break;

    } case 'workspace/homotopy3d':
      case 'workspace/homotopy': {

      let { point, direction } = action.payload;
      let { diagram, slice, notifications } = state.workspace;
      let { generators } = state.signature;

      if (point.length < 2) {
        state = notify(state, "Can't perform homotopy on " + point.length + "d diagram");
        return state;
      }

      if (diagram == null || point.length < 2) return state;

      //point = Core.Geometry.unprojectPoint(diagram, [...slice, ...point]);
      let path = Core.Boundary.getPath(diagram, [...slice, ...point]);

      try {
        let attach_result = Core.attach(
          generators,
          diagram,
          (boundary, point) => boundary.homotopy(point, direction, generators),
          path,
          slice
        );

        // If the attach failed, then the action is done
        if (attach_result.error) {
          state = notify(state, attach_result.error);
          break;
        };

        let { new_diagram, new_slice } = attach_result;

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
      if (!diagram || !slice) break;
      if (slice.length == 0) break;
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

    } case 'workspace/increase-projection': {

      console.log("Increase projection")
      const projection = getProjection(state)
      state = dotProp.set(state, "workspace.projection", Math.min(projection+1, state.workspace.diagram.n))
      state = dotProp.set(state, "workspace.slice", updateSlices(state))
      break

    } case 'workspace/decrease-projection': {

      console.log("Decrease projection")
      const projection = getProjection(state)
      state = dotProp.set(state, "workspace.projection", Math.max(projection-1, 0))
      state = dotProp.set(state, "workspace.slice", updateSlices(state))
      break

    } case 'workspace/set-slice': {

      let { index, height } = action.payload;
      state = dotProp.set(state, `workspace.slice.${index}`, height);
      state = dotProp.set(state, "workspace.slice", updateSlices(state));
      break;

    } case 'workspace/increase-slice': {

      const currentSlice = getSlice(state)
      const index = currentSlice.length - 1
      const sliceBounds = getSliceBounds(state)
      const lastSliceMax = sliceBounds[index]
      state = dotProp.set(state, `workspace.slice.${index}`, Math.min(currentSlice[index]+1, lastSliceMax+1))
      state = dotProp.set(state, "workspace.slice", updateSlices(state))
      break

    } case 'workspace/decrease-slice': {

      const currentSlice = getSlice(state)
      const index = currentSlice.length - 1
      state = dotProp.set(state, `workspace.slice.${index}`, Math.max(currentSlice[index]-1, -1))
      state = dotProp.set(state, "workspace.slice", updateSlices(state))
      break

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

    } case 'workspace/toasted': {

      state = dotProp.set(state, "workspace.notifications", []);
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

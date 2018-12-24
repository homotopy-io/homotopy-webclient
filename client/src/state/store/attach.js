import dotProp from "dot-prop-immutable";
import createReducer from "~/util/create-reducer";
import * as WorkspaceActions from "~/state/actions/workspace";
import * as AttachActions from "~/state/actions/attach";
import * as Core from "homotopy-core";
import { _assert, _debug } from "../../../../core/src/util/debug";

export const getOptions = (state) => {
  // TODO: Memoized selector
  let options = state.attach.options;
  let generators = state.signature.generators;

  if (options == null) {
    return null;
  } else {
    return options.map(option => ({
      generator: generators[option.generator],
      path: option.path
    }));
  }
};

export const getHighlight = (state) => {
  let { options, highlight } = state.attach;

  if (options === null || highlight === null) {
    return null;
  } else {
    let option = options[highlight];
    let generator = state.signature.generators[option.generator].generator;
    let subdiagram = option.path.boundary == "source" ? generator.target : generator.source;
    return { path: option.path, subdiagram };
  }
};

export const clearOptions = (state) => {
  state = dotProp.set(state, "attach.options", null);
  state = dotProp.set(state, "attach.highlight", null);
  return state;
};

export default createReducer({
  [AttachActions.CLEAR_HIGHLIGHT]: (state) => {
    state = dotProp.set(state, "attach.highlight", null);
    return state;
  },

  [AttachActions.SET_HIGHLIGHT]: (state, { index }) => {
    state = dotProp.set(state, "attach.highlight", index);
    return state;
  },

  [AttachActions.SELECT_OPTION]: (state, { index }) => {
    let options = state.attach.options;
    let diagram = state.workspace.diagram;
    let generators = state.signature.generators;

    if (options == null || !options[index]) {
      return state;
    }

    let option = options[index];
    //let generator = generators[option.generator];

    let { new_diagram, new_slice } = Core.attachGenerator(generators, diagram, option.generator, option.path, state.workspace.slice);

    state = dotProp.set(state, "workspace.diagram", new_diagram);
    state = dotProp.set(state, "attach.options", null);
    state = dotProp.set(state, "attach.highlight", null);
    state = dotProp.set(state, "workspace.slice", new_slice);

    return state;
  },

  [WorkspaceActions.SELECT_CELL]: (state, { points }) => {
    let { diagram, slice } = state.workspace;
    let { generators } = state.signature;

    if (diagram == null) return;
    if (_debug) _assert(points instanceof Array);
    if (_debug) _assert(points.length > 0);

    // Respect the current slices
    for (let i=0; i<points.length; i++) {
      //point[i] = Core.Geometry.unprojectPoint(diagram, [...slice, ...points[i]]);
      points[i] = [...slice, ...points[i]];
    }

    let boundary = [];
    let boundaryPath = [];
    let boundaryPoints = [];
    for (let i=0; i<points.length; i++) {
      boundaryPath[i] = Core.Boundary.getPath(diagram, points[i]);
      boundary[i] = Core.Boundary.followPath(diagram, boundaryPath[i]);
      boundaryPoints[i] = boundaryPath[i].point;
    }

    let options = Core.Matches.getAttachmentOptions(
      boundary[0],
      [...Object.values(generators)].map(generator => generator.generator),
      boundaryPath[0].boundary == "source",
      boundaryPoints
      //boundaryPath.point
    );

    options = options.map(match => ({
      generator: match.generator.id,
      path: { ...boundaryPath[0], point: match.match.map(x => x * 2) }
      /*,
      point: [...points[0].slice(0, boundaryPath[0].depth || 0), ...match.match.map(x => x * 2)]
      */
    }));

    if (options.length == 1) {
      let [ option ] = options;
      let {new_diagram, new_slice} = Core.attachGenerator(generators, diagram, option.generator, option.path, slice);
      state = dotProp.set(state, "workspace.diagram", new_diagram);
      state = dotProp.set(state, "diagram.slice", new_slice);
      return state;
    } else if (options.length > 1) {
      state = dotProp.set(state, "attach.options", options);
      state = dotProp.set(state, "attach.highlight", null);
      return state;
    } else {
      return state;
    }
  },

  [AttachActions.CLEAR_OPTIONS]: (state) => {
    return clearOptions(state);
  },

  [WorkspaceActions.CLEAR_DIAGRAM]: (state) => {
    return clearOptions(state);
  },

  [WorkspaceActions.TAKE_IDENTITY]: (state) => {
    return clearOptions(state);
  },

  [WorkspaceActions.RESTRICT_DIAGRAM]: (state) => {
    return clearOptions(state);
  },

  [WorkspaceActions.MAKE_THEOREM]: (state) => {
    return clearOptions(state);
  },

  [WorkspaceActions.SET_PROJECTION]: (state) => {
    return clearOptions(state);
  },

  [WorkspaceActions.SET_SLICE]: (state) => {
    return clearOptions(state);
  },

  [WorkspaceActions.SET_SOURCE]: (state) => {
    return clearOptions(state);
  },

  [WorkspaceActions.SET_TARGET]: (state) => {
    return clearOptions(state);
  }

});
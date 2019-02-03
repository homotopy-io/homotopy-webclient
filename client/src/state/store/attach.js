import dotProp from "dot-prop-immutable";
import createReducer from "~/util/create-reducer";
import * as WorkspaceActions from "~/state/actions/workspace";
import * as AttachActions from "~/state/actions/attach";
import * as Core from "homotopy-core";
import { _assert, _debug } from "../../../../core/src/util/debug";
import { toast } from 'react-toastify';
import { notify } from "~/state/store/notify";

export const initialAttach = {
  options: null,
  highlight: null
}

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

export default createReducer(initialAttach, {
  ["attach/clear-highlight"]: (state) => {
    state = dotProp.set(state, "attach.highlight", null);
    return state;
  },

  ["attach/set-highlight"]: (state, { index }) => {
    state = dotProp.set(state, "attach.highlight", index);
    return state;
  },

  ["attach/select-option"]: (state, { index }) => {
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

  ["workspace/select-cell"]: (state, { points }) => {

    let { diagram, slice } = state.workspace;
    let { generators } = state.signature;

    if (diagram == null) return;
    if (_debug) _assert(points instanceof Array);
    if (_debug) _assert(points.length > 0);
    //if (_debug && points.length > 1) debugger;

    let new_points = [];
    for (let i=0; i<points.length; i++) {
      new_points.push(points[i].slice());
    }
    points = new_points;

    console.log('workspace/select-cell at ' + JSON.stringify(points));

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

    if (options.length == 0) {
      state = notify(state, "Couldn't attach anything");
    } else if (options.length == 1) {
      let [ option ] = options;
      let {new_diagram, new_slice} = Core.attachGenerator(generators, diagram, option.generator, option.path, slice);
      state = dotProp.set(state, "workspace.diagram", new_diagram);
      state = dotProp.set(state, "workspace.slice", new_slice);
    } else {
      state = dotProp.set(state, "attach.options", options);
      state = dotProp.set(state, "attach.highlight", null);
    }
    return state;
  },

  ["workspace/clear-options"]: (state) => {
    return clearOptions(state);
  },

  ["workspace/clear-diagram"]: (state) => {
    return clearOptions(state);
  },

  ["workspace/take-identity"]: (state) => {
    return clearOptions(state);
  },

  ["workspace/restrict-diagram"]: (state) => {
    return clearOptions(state);
  },

  ["workspace/make-theorem"]: (state) => {
    return clearOptions(state);
  },

  ["workspace/set-projection"]: (state) => {
    return clearOptions(state);
  },

  ["workspace/set-slice"]: (state) => {
    return clearOptions(state);
  },

  ["workspace/set-source"]: (state) => {
    return clearOptions(state);
  },

  ["workspace/set-target"]: (state) => {
    return clearOptions(state);
  }

});

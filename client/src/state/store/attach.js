import dotProp from "dot-prop-immutable";
import createReducer from "~/util/create-reducer";
import * as DiagramActions from "~/state/actions/diagram";
import * as AttachActions from "~/state/actions/attach";
import * as Core from "homotopy-core";

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
}

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
}

export const clearOptions = (state) => {
  state = dotProp.set(state, `attach.options`, null);
  state = dotProp.set(state, `attach.highlight`, null);
  return state;
}

export default createReducer({
  [AttachActions.CLEAR_HIGHLIGHT]: (state, {}) => {
    state = dotProp.set(state, `attach.highlight`, null);
    return state;
  },

  [AttachActions.SET_HIGHLIGHT]: (state, { index }) => {
    state = dotProp.set(state, `attach.highlight`, index);
    return state;
  },

  [AttachActions.SELECT_OPTION]: (state, { index }) => {
    let options = state.attach.options;
    let diagram = state.diagram.diagram;
    let generators = state.signature.generators;

    if (options == null || !options[index]) {
      return state;
    }

    let option = options[index];
    let generator = generators[option.generator];

    diagram = Core.attach(diagram, generator.generator, option.path);

    state = dotProp.set(state, `diagram.diagram`, diagram);
    state = dotProp.set(state, `attach.options`, null);
    state = dotProp.set(state, `attach.highlight`, null);

    return state;
  },

  [DiagramActions.SELECT_CELL]: (state, { point }) => {
    let { diagram, slice } = state.diagram;
    let { generators } = state.signature;

    if (diagram == null) {
      return;
    }

    // Respect the current slices
    point = Core.Geometry.unprojectPoint(diagram, [...slice, ...point]);

    let boundaryPath = Core.Boundary.getPath(diagram, point);
    let boundary = Core.Boundary.followPath(diagram, boundaryPath);

    let options = Core.Matches.getAttachmentOptions(
      boundary,
      [...Object.values(generators)].map(generator => generator.generator),
      boundaryPath.boundary == "source",
      boundaryPath.point
    ).map(match => ({
      generator: match.generator.id,
      path: { ...boundaryPath, point: match.match },
      point: [...point.slice(0, boundaryPath.depth || 0), ...match.match.map(x => x * 2)]
    }));

    if (options.length == 1) {
      let [ option ] = options;
      diagram = Core.attach(diagram, generators[option.generator].generator, option.path);
      state = dotProp.set(state, `diagram.diagram`, diagram);
      return state;
    } else if (options.length > 1) {
      state = dotProp.set(state, `attach.options`, options);
      state = dotProp.set(state, `attach.highlight`, null);
      return state;
    } else {
      return state;
    }
  },

  [AttachActions.CLAER_OPTIONS]: (state, {}) => {
    return clearOptions(state);
  },

  [DiagramActions.CLEAR_DIAGRAM]: (state, {}) => {
    return clearOptions(state);
  },

  [DiagramActions.TAKE_IDENTITY]: (state, {}) => {
    return clearOptions(state);
  },

  [DiagramActions.SET_PROJECTION]: (state, {}) => {
    return clearOptions(state);
  },

  [DiagramActions.SET_SLICE]: (state, {}) => {
    return clearOptions(state);
  },

  [DiagramActions.SET_SOURCE]: (state, {}) => {
    return clearOptions(state);
  },

  [DiagramActions.SET_TARGET]: (state, {}) => {
    return clearOptions(state);
  }

})
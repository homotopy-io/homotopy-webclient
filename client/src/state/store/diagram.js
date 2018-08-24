import dotProp from "dot-prop-immutable";
import createReducer from "~/util/create-reducer";
import * as DiagramActions from "~/state/actions/diagram";
import * as SignatureActions from "~/state/actions/signature";
import * as Actions from "~/state/actions/diagram";
import * as Core from "homotopy-core";
import { createGenerator } from "~/state/store/signature";

export const getDiagram = (state) => {
  return state.diagram.diagram;
}

export default createReducer({
  [DiagramActions.SET_SOURCE]: (state, {}) => {
    let { target, diagram } = state.diagram;

    if (diagram == null) {
      return state;
    } else if (target != null) {
      state = createGenerator(state, diagram, target);
      state = dotProp.set(state, `diagram.diagram`, null);
      state = dotProp.set(state, `diagram.target`, null);
      return state;
    } else {
      state = dotProp.set(state, `diagram.source`, diagram);
      state = dotProp.set(state, `diagram.diagram`, null);
      return state;
    }
  },

  [DiagramActions.SET_TARGET]: (state, {}) => {
    let { source, diagram } = state.diagram;

    if (diagram == null) {
      return state;
    } else if (source != null) {
      state = createGenerator(state, source, diagram);
      state = dotProp.set(state, `diagram.diagram`, null);
      state = dotProp.set(state, `diagram.source`, null);
      return state;
    } else {
      state = dotProp.set(state, `diagram.target`, diagram);
      state = dotProp.set(state, `diagram.diagram`, null);
      return state;
    }
  },

  [DiagramActions.CLEAR_DIAGRAM]: (state, {}) => {
    state = dotProp.set(state, `diagram.diagram`, null);
    return state;
  },

  [DiagramActions.TAKE_IDENTITY]: (state, {}) => {
    state = dotProp.set(state, `diagram.diagram`, diagram => {
      let copy = diagram.copy();
      copy.boost();
      return copy;
    });
    return state;
  },

  [SignatureActions.SELECT_GENERATOR]: (state, { id }) => {
    let { diagram } = state.diagram;
    let generator = state.signature.generators[id];

    if (diagram == null) {
      state = dotProp.set(state, `diagram.diagram`, generator.generator.getDiagram());
      return state;
    } else {
      return state;
    }
  },

  [DiagramActions.SELECT_CELL]: (state, { points }) => {
    let { diagram } = state.diagram;
    let { generators } = state.signature;

    if (diagram == null) {
      return;
    }

    // TODO: Respect current slices

    let boundaryPath = Core.Boundary.getPath(diagram, points);
    console.log(boundaryPath);
    let boundary = Core.Boundary.followPath(diagram, boundaryPath);
    console.log(boundary);

    let options = Core.Matches.getAttachmentOptions(
      boundary,
      [...Object.values(generators)].map(generator => generator.generator),
      boundaryPath.boundary == "source",
      boundaryPath.point
    ).map(match => ({
      generator: match.generator.id,
      path: { ...boundaryPath, point: match.match },
    }));

    console.log(options);

    if (options.length == 1) {
      let [ option ] = options;
      diagram = diagram.copy();
      Core.attach(diagram, generators[option.generator].generator, option.path);
      console.log(diagram, boundaryPath);
      state = dotProp.set(state, `diagram.diagram`, diagram);
      return state;
    } else {
      state = dotProp.set(state, `diagram.options`, options);
      return state;
    }
  }
})
import dotProp from "dot-prop-immutable";
import createReducer from "~/util/create-reducer";
import * as Actions from "~/state/actions/signature";
import * as Core from "homotopy-core";
import { cellColors } from "~/style";

export const getDimensionGroups = (state) => {
  let { signature } = state;
  let { generators } = signature;

  let dimension = Math.max(0, ...Object.values(generators).map(g => g.generator.n));
  let groups = [];

  for (let i = 0; i <= dimension; i++) {
    groups[i] = [];
  }

  for (let [id, generator] of Object.entries(generators)) {
    groups[generator.generator.n].push(id);
  }

  return groups;
};

export const getGenerators = (state) => {
  return state.signature.generators;
};

export const getGenerator = (state, id) => {
  let { signature } = state;
  let { generators } = signature;

  if (!generators[id]) {
    throw `Unknown generator id ${id}.`;
  } else {
    return generators[id];
  }
};

export const createGenerator = (state, source, target) => {
  let id = state.signature.id;
  let name = `Cell ${id + 1}`;
  let color = cellColors[id % cellColors.length];

  let generator = new Core.Generator(id, source, target);

  state = dotProp.set(state, "signature.id", id + 1);
  state = dotProp.set(state, `signature.generators.${id}`, {
    name, generator, color
  });

  return state;
};

export default createReducer({
  [Actions.REMOVE_GENERATOR]: (state, { id }) => {
    let generators = state.signature.generators;
    let removedGenerator = generators[id].generator;

    // Remove all generators that use this generator.
    generators = {...generators};
    let keep = {};
    for (let generator of Object.values(generators)) {
      if (!generator.generator.usesCell(removedGenerator)) {
        keep[generator.generator.id] = generator;
      }
    }
    state = dotProp.set(state, "signature.generators", keep);

    // Clear the current diagram if it uses the removed cell
    let diagram = state.diagram.diagram;
    if (diagram != null && diagram.usesCell(removedGenerator)) {
      state = dotProp.set(state, "diagram.diagram", null);
    }

    return state;
  },

  [Actions.RENAME_GENERATOR]: (state, { id, name }) => {
    state = dotProp.set(state, `signature.generators.${id}.name`, name);
    return state;
  },

  [Actions.RECOLOR_GENERATOR]: (state, { id, color }) => {
    state = dotProp.set(state, `signature.generators.${id}.color`, color);
    return state;
  },

  [Actions.CREATE_GENERATOR]: (state) => {
    state = createGenerator(state, null, null);
    return state;
  },
});
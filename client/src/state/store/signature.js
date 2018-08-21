import dotProp from "dot-prop-immutable";
import createReducer from "~/util/create-reducer";
import * as Actions from "~/state/actions/signature";
import * as Core from "homotopy-core";

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
}

export const getGenerators = (state) => {
  return state.signature.generators;
}

export const getGenerator = (state, id) => {
  let { signature } = state;
  let { generators } = signature;

  if (!generators[id]) {
    throw `Unknown generator id ${id}.`;
  } else {
    return generators[id];
  }
}

export const createGenerator = (state, source, target) => {
  let id = state.signature.id;
  let name = `Cell ${id + 1}`;
  let color = ["red", "green", "blue"][id % 3];
  let generator = new Core.Generator(id, source, target);

  state = dotProp.set(state, `signature.id`, id + 1);
  state = dotProp.set(state, `signature.generators.${id}`, {
    name, generator, color
  });

  return state;
}

export default createReducer({
  [Actions.REMOVE_GENERATOR]: (state, { id }) => {
    // TODO: Also remove all cells that reference this cell
    state = dotProp.delete(state, `signature.generators.${id}`);
    return state;
  },

  [Actions.RENAME_GENERATOR]: (state, { name }) => {
    state = dotProp.set(state, `signature.generators.${id}.name`, name);
    return state;
  },

  [Actions.CREATE_GENERATOR]: (state, {}) => {
    state = createGenerator(state, null, null);
    return state;
  },
});
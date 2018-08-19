import dotProp from "dot-prop-immutable";
import createReducer from "~/util/create-reducer";
import * as Actions from "~/state/actions/signature";
import * as Core from "homotopy-core";

export const getDimensionGroups = (state) => {
  let { signature } = state;
  let dimension = Math.max(1, ...Object.values(signature).map(g => g.generator.n));
  let groups = [];

  for (let i = 0; i < dimension; i++) {
    groups[i] = [];
  }

  for (let [id, generator] of Object.entries(signature)) {
    groups[generator.generator.n].push(id);
  }

  return groups;
}

export const getGenerator = (state, id) => {
  let { signature } = state;

  if (!signature[id]) {
    throw `Unknown generator id ${id}.`;
  } else {
    return signature[id];
  }
}

export const createGenerator = (state, source, target) => {
  let id = Object.keys(state.signature).length;
  let name = `Cell ${id + 1}`;
  let color = ["red", "green", "blue"][id % 3];
  let generator = new Core.Generator(id, source, target);

  state = dotProp.set(state, `signature.${id}`, {
    name, generator, color
  });

  return state;
}

export default createReducer({
  [Actions.REMOVE_GENERATOR]: (state, { id }) => {
    // TODO: Also remove all cells that reference this cell
    state = dotProp.delete(state, `signature.${id}`);
    return state;
  },

  [Actions.RENAME_GENERATOR]: (state, { name }) => {
    state = dotProp.set(state, `signature.${id}.name`, name);
    return state;
  },

  [Actions.CREATE_GENERATOR]: (state, {}) => {
    state = createGenerator(state, null, null);
    return state;
  },
});
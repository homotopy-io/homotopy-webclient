import dotProp from "dot-prop-immutable";
import createReducer from "~/util/create-reducer";
import * as WorkspaceActions from "~/state/actions/workspace";
import * as SignatureActions from "~/state/actions/signature";
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

  // Find a fresh id for the new generator
  let id_num = 1;
  while (state.signature.generators[id_num.toString()]) {
    id_num ++;
  }
  let id = id_num.toString();

  // Give it an appropriate name for the UI
  let num_generators = Object.entries(state.signature.generators).length + 1;
  let name = `Cell ${num_generators}`;

  // Choose the colour
  let color = cellColors[num_generators % cellColors.length];

  // Construct the generator object
  let generator = new Core.Generator({ id, source, target });

  // Set the appropriate data
  state = dotProp.set(state, `signature.generators.${id}`, { name, generator, color });

  return state;
};

export default (state, action) => {

  switch (action.type) {

    case 'signature/remove-generator': {

      let { id } = action.payload;
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

      // Clear main diagram and source/target previews if necessary
      let w = state.workspace;
      if (w.diagram && w.diagram.usesCell(removedGenerator)) {
        state = dotProp.set(state, "workspace.diagram", null);
      }
      if (w.source && w.source.usesCell(removedGenerator)) {
        state = dotProp.set(state, "workspace.source", null);
      }
      if (w.target && w.target.usesCell(removedGenerator)) {
        state = dotProp.set(state, "workspace.target", null);
      }

      break;

    } case 'signature/rename-generator': {

      let { id, name } = action.payload;
      state = dotProp.set(state, `signature.generators.${id}.name`, name);
      break;

    } case 'signature/recolor-generator': {

      let { id, color } = action.payload;
      state = dotProp.set(state, `signature.generators.${id}.color`, color);
      break;

    } case 'signature/create-generator': {

      state = createGenerator(state, null, null);

    }
  }

  return state;
}

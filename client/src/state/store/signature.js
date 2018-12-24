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

export default createReducer({

  /*
  [WorkspaceActions.POST_REHYDRATE]: (state) => {
    // Ensure all the generators have source and target diagrams properly inserted
    let { generators } = state.signature;
    let new_generators = [];
    for (let generator of Object.values(generators)) {
      let new_generator = Core.Generator.postRehydrate(generator.generator, generators);
      let id = generator.generator.id;
      new_generators.push(new_generator);
      //state = dotProp.set(state, `signature.generators.${id}`, new_generator);
    }
    // Add them to the state
    for (let i=0; i<new_generators.length; i++) {
      let new_generator = new_generators[i];
      let id = new_generator.id;
      state = dotProp.set(state, `signature.generators.${id}.generator`, new_generator);
    }
    //state = dotProp.set(state, "signature.generators", new_generators);

    return state;
  },
  */

  [SignatureActions.REMOVE_GENERATOR]: (state, { id }) => {
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
    let diagram = state.workspace.diagram;
    if (diagram != null && diagram.usesCell(removedGenerator)) {
      state = dotProp.set(state, "workspace.diagram", null);
    }

    return state;
  },

  [SignatureActions.RENAME_GENERATOR]: (state, { id, name }) => {
    state = dotProp.set(state, `signature.generators.${id}.name`, name);
    return state;
  },

  [SignatureActions.RECOLOR_GENERATOR]: (state, { id, color }) => {
    state = dotProp.set(state, `signature.generators.${id}.color`, color);
    return state;
  },

  [SignatureActions.CREATE_GENERATOR]: (state) => {
    state = createGenerator(state, null, null);
    return state;
  },
});
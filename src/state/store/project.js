import { loop, Cmd } from 'redux-loop'
import { change } from 'redux-form'
import dotProp from "dot-prop-immutable";
import * as ProjectActions from "~/state/actions/project";
import createReducer from "~/util/create-reducer";

// returns an array of metadata-setting Cmd actions, one for each field
export const setMetadata = (metadata) =>
  Object.keys(metadata).map((k, i) => Cmd.action(change('metadata', k, metadata[k])))

export default createReducer(undefined, {
  [ProjectActions.SET_PROJECT]: (state, { project }) => {
    return loop(
      state,
      Cmd.list(
        setMetadata(project.metadata) // set metadata
        .concat(project.id ? Cmd.action(ProjectActions.setProjectID(project.id)) : [])
        .concat(
          Cmd.run((metadata, proof) => {
            window.sessionStorage.setItem("metadata", JSON.stringify(metadata))
            window.sessionStorage.setItem("proof_state", proof)
          }, { args: [project.metadata, project.proof] })
        )
      )
    )
  }
})

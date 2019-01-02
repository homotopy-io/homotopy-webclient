import { loop, Cmd } from 'redux-loop'
import { change } from 'redux-form'
import dotProp from "dot-prop-immutable";
import * as ProjectActions from "~/state/actions/project";
import createReducer from "~/util/create-reducer";

export const initialProject = { id: undefined }

export const getProjectID = (state) => state.id

// returns an array of metadata-setting Cmd actions, one for each field
const setMetadata = (metadata) =>
  Object.keys(metadata).map((k, i) => Cmd.action(change('metadata', k, metadata[k])))

export default createReducer(initialProject, {
  [ProjectActions.SET_PROJECT]: (state, { project }) => loop(
    dotProp.set(state, "id", project.id),
    Cmd.list(
      setMetadata(project.metadata) // set metadata
      .concat(Cmd.list([
          Cmd.action({ type: 'persist/newhash', payload: project.proof }), // set hash
          // change window location; NOTE: this does not trigger the hashchange listener
          Cmd.run((hash) => window.location.hash = hash, { args: ["#" + project.proof] })
        ], { sequence: true }),
      )
    )
  ),
  [ProjectActions.SET_PROJECT_ID]: (state, { id }) =>
    dotProp.set(state, "id", id)
})

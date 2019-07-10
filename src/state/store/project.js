import { loop, Cmd } from 'redux-loop'
import { change } from 'redux-form'
import dotProp from "dot-prop-immutable";
import * as ProjectActions from "~/state/actions/project";
import createReducer from "~/util/create-reducer";
import URLON from 'urlon'

// returns an array of metadata-setting Cmd actions, one for each field
export const setMetadata = (metadata) =>
  Object.keys(metadata).map((k, i) => Cmd.action(change('metadata', k, metadata[k])))

export default createReducer(undefined, {
  [ProjectActions.SET_PROJECT]: (state, { project }) => {
    const data = URLON.stringify({
      metadata: project.metadata,
      proof: project.proof
    })
    return loop(
      state,
      Cmd.list(
        setMetadata(project.metadata) // set metadata
        .concat(project.id ? Cmd.action(ProjectActions.setProjectID(project.id)) : [])
        .concat(
          Cmd.run((newhash) => window.location.hash = newhash, { args: [data] })
        )
      )
    )
  }
})

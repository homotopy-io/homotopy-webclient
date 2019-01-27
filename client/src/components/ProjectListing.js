import * as React from 'react'
import { compose } from 'redux'
import { connect } from 'react-redux'
import styled from "styled-components";

import Button from '@material-ui/core/Button'
import Card from '@material-ui/core/Card'
import CardActions from '@material-ui/core/CardActions'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import DeleteIcon from '@material-ui/icons/Delete'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import FilterNoneIcon from '@material-ui/icons/FilterNone'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import IconButton from '@material-ui/core/IconButton'
import LaunchIcon from '@material-ui/icons/Launch'
import LinkIcon from '@material-ui/icons/Link'
import Switch from '@material-ui/core/Switch'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'

import { connectModal } from 'redux-modal'
import { firebaseConnect, firestoreConnect } from 'react-redux-firebase'

import copy from 'copy-to-clipboard'

import { setProject, setProjectID } from '~/state/actions/project'
import { save, load } from '~/util/firebase'

export const ProjectListing = ({
  show, handleHide, uid, projects, firebase, firestore, setProject, serialization, copied, clearCopied, setCopied
}) =>
  <Dialog
    open={show}
    onClose={handleHide}
    scroll="paper"
    aria-labelledby="project-listing-title"
  >
    <DialogTitle id="project-listing-title">Projects</DialogTitle>
    <DialogContent>
      {projects.map(project =>
        <Project key={project.id}>
        {/* TODO: handle multiple versions */}
          <Card>
            <CardHeader
              title={project.versions[0].metadata.title}
              subheader={`Author: ${project.versions[0].metadata.author}`} />
            <CardContent>
              <Typography>
                {project.versions[0].metadata.abstract}
              </Typography>
            </CardContent>
            <CardActions disableActionSpacing>
              <FormControlLabel
                control={
                  <Switch
                    checked={project.public}
                    onChange={evt => {
                      const readable = evt.target.checked
                      firestore.update({ collection: "projects", doc: project.id }, {public: readable})
                      const blob = firebase.storage().ref().child(`${uid}/${project.id}/0.proof`)
                      blob.updateMetadata({
                        customMetadata: {public: readable}
                      })
                    }}
                    value="public"
                  />
                }
                label="Public"
              />
              <Tooltip
                title={project.public ? copied ? "Copied!" : "Copy link to clipboard" : "Make the project public to create a sharable link"}
                onClose={evt => setTimeout(clearCopied, 1000)}
                interactive
              >
                <div>
                  <IconButton aria-label="Copy link to clipboard" disabled={!project.public} onClick={() => {
                    copy(`${window.location.host}/?id=${project.id}`)
                    setCopied()
                  }}>
                    <LinkIcon />
                  </IconButton>
                </div>
              </Tooltip>
              <Tooltip title="Load">
                <IconButton aria-label="Load" onClick={() => {
                  load(firebase, project, setProject)
                  handleHide()
                }}>
                  <LaunchIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Clone">
                <IconButton aria-label="Clone" onClick={() => {
                  load(firebase, project, setProject)
                  save(firebase, firestore, {
                    uid,
                    docid: undefined, // force a new document to be created
                    metadata: project.versions[0].metadata,
                    proof: serialization
                  }, setProjectID)
                }}>
                  <FilterNoneIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton aria-label="Delete" onClick={() => {
                  // delete db entry in firestore
                  firestore.delete({ collection: 'projects', doc: project.id })
                  // delete blob in firebase storage
                  firebase.deleteFile(`${uid}/${project.id}/0.proof`)
                }}>
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </CardActions>
          </Card>
        </Project>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={handleHide}>Close</Button>
    </DialogActions>
  </Dialog>

export default compose(
  connect(
    state => ({
      uid: state.firebase.auth.uid,
      projects: state.firestore.ordered.projects,
      serialization: state.proof.serialization,
      copied: state.copied
    }),
    dispatch => ({
      setProject: project => dispatch(setProject(project)),
      setProjectID: id => dispatch(setProjectID(id)),
      setCopied: () => dispatch({ type: "copied/set" }),
      clearCopied: () => dispatch({ type: "copied/clear" })
    })
  ),
  firebaseConnect(),
  firestoreConnect(({ uid }) => {
    if (!uid) return []
    else
      return [{
        collection: "projects",
        where: [
          ["uid", "==", uid]
        ]
      }]
  }),
  connectModal({ name: "projectListing" })
)(ProjectListing)

const Project = styled.div`
 margin-bottom: 12px;
`;

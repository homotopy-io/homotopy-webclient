import * as React from 'react'
import { compose } from 'redux'
import { connect } from 'react-redux'
import styled from "styled-components";

import { connectModal } from 'redux-modal'
import { firebaseConnect, firestoreConnect } from 'react-redux-firebase'
import Modal from 'react-modal'

import { setProject, setProjectID } from '~/state/actions/project'
import { save, load } from '~/util/firebase'

Modal.setAppElement('body')

// TODO: styling

export const ProjectListing = ({
  show, handleHide, uid, projects, firebase, firestore, setProject, serialization
}) =>
  <Modal
    isOpen={show}
    onAfterOpen={() => console.log("Project listing opened")}
    onRequestClose={handleHide}
    contentLabel="Project Listing"
  >
    {projects.map(project =>
      <Project key={project.id}>
      {/* TODO: handle multiple versions */}
      {JSON.stringify(project.versions[0].metadata)}
      <br /><input type="checkbox" checked={project.public} onClick={evt => {
        const readable = evt.target.checked
        firestore.update({ collection: "projects", doc: project.id }, {public: readable})
        const blob = firebase.storage().ref().child(`${uid}/${project.id}/0.proof`)
        blob.updateMetadata({
          customMetadata: {public: readable}
        })
      }}/>Public<br />
      <button onClick={() => {
        load(firebase, project, setProject)
        handleHide()
      }}>Load</button>
      <button onClick={() => {
        load(firebase, project, setProject)
        save(firebase, firestore, {
          uid,
          docid: undefined, // force a new document to be created
          metadata: project.versions[0].metadata,
          proof: serialization
        }, setProjectID)
        handleHide()
      }}>Clone</button>
      <button onClick={() => {
        // delete db entry in firestore
        firestore.delete({ collection: 'projects', doc: project.id })
        // delete blob in firebase storage
        firebase.deleteFile(`${uid}/${project.id}/0.proof`)
      }}>Delete</button>
      </Project>
    )}
    <button onClick={handleHide}>Close</button>
  </Modal>

export default compose(
  connect(
    state => ({
      uid: state.firebase.auth.uid,
      projects: state.firestore.ordered.projects,
      serialization: state.proof.serialization
    }),
    dispatch => ({
      setProject: project => dispatch(setProject(project)),
      setProjectID: id => dispatch(setProjectID(id))
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
`;

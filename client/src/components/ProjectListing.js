import * as React from 'react'
import { compose } from 'redux'
import { connect } from 'react-redux'
import styled from "styled-components";

import { connectModal } from 'redux-modal'
import { firebaseConnect, firestoreConnect } from 'react-redux-firebase'
import Modal from 'react-modal'

import { setProject } from '~/state/actions/project'

Modal.setAppElement('body')

// TODO: styling

export const ProjectListing = ({
  show, handleHide, uid, projects, firebase, firestore, setProject
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
        <button onClick={() => {
          // download the proof blob corresponding to this project
          // see: https://firebase.google.com/docs/storage/web/download-files
          const storageRef = firebase.storage().ref()
          const fileRef = storageRef.child(`${uid}/${project.id}/0.proof`)
          fileRef.getDownloadURL().then(url => {
            const xhr = new XMLHttpRequest()
            xhr.onload = (evt => {
              setProject({
                ...project.versions[0], // set metadata from firestore
                id: project.id,
                proof: xhr.response
              })
              handleHide()
            })
            xhr.open('GET', url) // get proof blob from firebase storage
            xhr.send()
          })
            .catch(err => console.error('Error downloading proof', err))
        }}>Load</button>
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
      projects: state.firestore.ordered.projects
    }),
    dispatch => ({
      setProject: project => dispatch(setProject(project))
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

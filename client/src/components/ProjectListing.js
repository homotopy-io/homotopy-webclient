import * as React from 'react'
import { compose } from 'redux'
import { connect } from 'react-redux'
import styled from "styled-components";

import { change } from 'redux-form'
import { connectModal } from 'redux-modal'
import { firestoreConnect } from 'react-redux-firebase'
import Modal from 'react-modal'

import { setProject } from '~/state/actions/project'

Modal.setAppElement('body')

// TODO: styling

export const ProjectListing = ({
  show, handleHide, uid, projects, firestore, setProject
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
        setProject({ ...project.versions[0], id: project.id })
        handleHide()
      }}>Load</button>
      <button onClick={() => firestore.delete({
         collection: 'projects',
         doc: project.id })}>Delete</button>
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
  firestoreConnect(({ uid }) => {
    if (!uid) return []
    else
      return [{
        collection: "projects",
        where: [
          ["owners", "array-contains", uid]
        ]
      }]
  }),
  connectModal({ name: "projectListing" })
)(ProjectListing)

const Project = styled.div`
`;

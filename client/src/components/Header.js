import * as React from "react";
import PropTypes from 'prop-types'
import { compose, bindActionCreators } from 'redux'
import { connect } from "react-redux";
import ReactFileReader from 'react-file-reader'
import { show } from 'redux-modal'
import { change } from 'redux-form'

import { firebaseConnect, firestoreConnect, isLoaded, isEmpty } from 'react-redux-firebase'
import { openModal, setInitialTab } from "~/state/actions/user";
import { setProject, setProjectID } from '~/state/actions/project'

import styled from "styled-components";
import * as Compression from '~/util/compression'
import downloadJSON from '~/util/export'

export const Header = ({
  serialization,
  metadata,
  setProject, setProjectID, project,
  showModal,
  openModal, setInitialTab,
  firebase, firestore, auth
}) =>
  <Actions style={{userSelect: 'none'}}>
    {/* 0ms sleeps are an ugly hack because otherwise the initialTab state does
    not propagate properly --- TODO: fixme */}
    { !isLoaded(auth)
      ? <span>Loading…</span>
      : isEmpty(auth)
        ? <React.Fragment>
          <Action onClick={ () => {setInitialTab('login'); setTimeout(() => openModal(), 0)} }>Log In</Action>
          <Action onClick={ () => {setInitialTab('register'); setTimeout(() => openModal(), 0)} }>Sign Up</Action>
          </React.Fragment>
        : <React.Fragment>
          <Action onClick={() => alert('TODO: implement email/password changing')}>{auth.email}</Action>
          <Action onClick={() => firebase.logout()}>Log out</Action>
          <Action onClick={() => save(firebase, firestore, {
            uid: auth.uid,
            docid: project.id,
            metadata,
            proof: serialization
          }, setProjectID)}>Save</Action>
          <Action onClick={() => showModal('projectListing')}>My projects</Action>
          </React.Fragment>
    }
    {/*<Action>Gallery</Action>
    <Action>Help</Action>*/}
    <Action onClick={() => downloadJSON({
      metadata,
      proof: serialization
    }, `homotopy.io - ${new Date()}`)}>Export</Action>
    <ReactFileReader fileTypes={'application/json'} handleFiles={files => handleUpload(files, setProject)}>
      <Action>Import</Action>
    </ReactFileReader>
  </Actions>;

Header.propTypes = {
  openModal: PropTypes.func.isRequired,
  setInitialTab: PropTypes.func.isRequired,
  firebase: PropTypes.shape({
    logout: PropTypes.func.isRequired
  }),
  auth: PropTypes.object
}

export default compose(
  firebaseConnect(),
  firestoreConnect(),
  connect(
    ({ firebase: { auth }, proof: { serialization }, form, project }) => ({
      auth,
      metadata: form.metadata.values,
      serialization, project
    }),
    dispatch => ({
      setInitialTab: (index) => dispatch(setInitialTab(index)),
      openModal: () => dispatch(openModal()),
      setProject: (project) => dispatch(setProject(project)),
      setProjectID: id => dispatch(setProjectID(id)),
      showModal: bindActionCreators(show, dispatch)
    })
  ),
)(Header)

const handleUpload = (files, setProject) => {
  const fr = new FileReader()
  fr.onload = (event) => {
    // onload triggers on successful read
    const project = JSON.parse(fr.result)
    setProject(project)
  }
  fr.readAsText(files.item(0)) // TODO: input validation
}

const save = ({ storage }, firestore, { uid, docid, metadata, proof }, callback) => {
  // build saveable object
  const project = {
    date: Date.now(), // last modified date
    uid, // uid of owner
    versions: [{
      version: 0, // version number
      metadata, // title, author, abstract
    }]
  }
  // path to proof in firebase storage is `/${uid}/${docid}/${versions.version}`
  const storageRef = storage().ref()

  // now, in the following order
  // 1. create or locate a firestore entry for this proof object, containing all
  //    the metadata (firestore is our database to run queries against)
  // 2. upload the proof blob to firebase storage
  // 3. set the metadata for the proof blob on firebase storage (currently not
  //    used)
  if (!docid)
    // create object and update docid
    // TODO: handle add errors
    firestore.add({ collection: 'projects' }, project)
      .then(result => {
        const id = result.id
        // upload blob to firebase storage
        const fileRef = storageRef.child(`${uid}/${id}/0.proof`)
        callback(id) // set project id
        return fileRef.putString(proof, "raw", { customMetadata: { ...metadata, version: 0 }})
          .then(res => console.log('Proof uploaded successfully', res))
          .catch(err => console.error('Error uploading proof', err))
      })
  else
    // update existing doc
    // TODO: handle update errors
    firestore.update({ collection: 'projects', doc: docid }, project)
      .then(result => {
        // upload blob to firebase storage
        const fileRef = storageRef.child(`${uid}/${docid}/0.proof`)
        return fileRef.putString(proof, "raw", { customMetadata: { ...metadata, version: 0 }})
          .then(res => console.log('Proof uploaded successfully', res))
          .catch(err => console.error('Error uploading proof', err))
      })
}

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 8px;
  margin: 0px;
  overflow: hidden;
`;

const Action = styled.div`
  display: block;
  padding: 8px;
  text-transform: uppercase;
  cursor: pointer;
  :hover {
    background: #ecf0f1;
  }
`;

import * as React from "react";
import PropTypes from 'prop-types'
import { compose, bindActionCreators } from 'redux'
import { connect } from "react-redux";
import { addUrlProps, UrlQueryParamTypes } from 'react-url-query'
import ReactFileReader from 'react-file-reader'
import { show } from 'redux-modal'
import { change } from 'redux-form'

import { firebaseConnect, firestoreConnect, isLoaded, isEmpty } from 'react-redux-firebase'
import { openModal, setInitialTab } from "~/state/actions/user";
import { setProject, setProjectID } from '~/state/actions/project'

import styled from "styled-components";
import * as Compression from '~/util/compression'
import downloadJSON from '~/util/export'
import { save } from '~/util/firebase'

import URLON from 'urlon' // for an ugly hack

export const Header = ({
  serialization, proof,
  metadata,
  setProject, setProjectID,
  id,
  showModal,
  openModal, setInitialTab,
  firebase, firestore, auth,
  serialize
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
          <Action onClick={() => { setProjectID(undefined); window.location.hash = '' }}>New</Action>
          <Action onClick={() => {
            if (!window.location.hash.substr(1))
              serialize()
            // FIXME: this really ought to update the proof.serialization key in
            // the redux store when we get here, but it's still undefined for
            // some reason, even though it's updated in window.location.hash:
            // console.log("Serialization", serialization)
            // as a workaround, we'll parse it from window.location.hash -
            // should find out what's going on and fix this eventually
            save(firebase, firestore, {
              uid: auth.uid,
              docid: id,
              metadata,
              proof: serialization || URLON.parse(window.location.hash.substr(1)).proof
            }, setProjectID)
          }}>Save</Action>
          <Action onClick={() => showModal('projectListing')}>Projects</Action>
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
    ({ firebase: { auth }, proof, form }) => ({
      auth,
      metadata: form.metadata.values,
      serialization: proof.serialization, proof
    }),
    dispatch => ({
      setInitialTab: (index) => dispatch(setInitialTab(index)),
      openModal: () => dispatch(openModal()),
      setProject: (project) => dispatch(setProject(project)),
      setProjectID: id => dispatch(setProjectID(id)),
      showModal: bindActionCreators(show, dispatch),
      serialize: () => dispatch({ type: "persist/serialize" })
    })
  ),
  addUrlProps({ id: UrlQueryParamTypes.string })
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

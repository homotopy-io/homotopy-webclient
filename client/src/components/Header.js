import * as React from "react";
import PropTypes from 'prop-types'
import { compose } from 'redux'
import { connect } from "react-redux";
import ReactFileReader from 'react-file-reader'
import { change } from 'redux-form'

import { firebaseConnect, firestoreConnect, isLoaded, isEmpty } from 'react-redux-firebase'
import { openModal, setInitialTab } from "~/state/actions/user";

import styled from "styled-components";
import * as Compression from '~/util/compression'
import downloadJSON from '~/util/export'

export const Header = ({
  serialization,
  metadata, setMetadata,
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
          <Action onClick={() => firebase.logout()}>Log out</Action>
          <Action>Save</Action>
          </React.Fragment>
    }
    {/*<Action>Gallery</Action>
    <Action>Help</Action>*/}
    <Action onClick={() => downloadJSON({
      metadata,
      proof: serialization
    }, `homotopy.io - ${new Date()}`)}>Export</Action>
    <ReactFileReader fileTypes={'application/json'} handleFiles={files => handleUpload(files, setMetadata)}>
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
    ({ firebase: { auth }, proof: { serialization }, form }) => ({
      auth,
      metadata: form.metadata.values,
      serialization
    }),
    dispatch => ({
      setInitialTab: (index) => dispatch(setInitialTab(index)),
      openModal: () => dispatch(openModal()),
      setMetadata: (metadata) => {
        for (const k in metadata) {
          dispatch(change('metadata', k, metadata[k]))
        }
      }
    })
  ),
)(Header)

const handleUpload = (files, setMetadata) => {
  const fr = new FileReader()
  fr.onload = (event) => {
    // onload triggers on successful read
    const project = JSON.parse(fr.result)
    setMetadata(project.metadata)
    window.location.hash = project.proof
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

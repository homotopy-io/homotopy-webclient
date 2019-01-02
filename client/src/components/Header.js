import * as React from "react";
import { connect } from "react-redux";
import ReactFileReader from 'react-file-reader'
import { change } from 'redux-form'

import styled from "styled-components";
import * as Compression from '~/util/compression'
import downloadJSON from '~/util/export'

export const Header = ({
  metadata, setMetadata, serialization
}) =>
  <Actions style={{userSelect: 'none'}}>
    {/*<Action>Log In</Action>
    <Action>Sign Up</Action>
    <Action>Gallery</Action>
    <Action>Help</Action>*/}
    <Action onClick={() => downloadJSON({
      metadata,
      content: serialization
    }, `homotopy.io - ${new Date()}`)}>Export</Action>
    <ReactFileReader fileTypes={'application/json'} handleFiles={files => handleUpload(files, setMetadata)}>
      <Action>Import</Action>
    </ReactFileReader>
  </Actions>;

export default connect(
  ({ serialization, form }) => ({
    metadata: form.metadata.values,
    serialization
  }),
  dispatch => ({
    setMetadata: (metadata) => {
      for (const k in metadata) {
        dispatch(change('metadata', k, metadata[k]))
      }
    }
  })
)(Header)

const handleUpload = (files, setMetadata) => {
  const fr = new FileReader()
  fr.onload = (event) => {
    // onload triggers on successful read
    const project = JSON.parse(fr.result)
    setMetadata(project.metadata)
    window.location.hash = project.content
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

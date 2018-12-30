import * as React from "react";
import { connect } from "react-redux";
import ReactFileReader from 'react-file-reader'

import styled from "styled-components";
import * as Compression from '~/util/compression'
import downloadJSON from '~/util/export'

export const Header = ({
  serialization
}) =>
  <Actions style={{userSelect: 'none'}}>
    {/*<Action>Log In</Action>
    <Action>Sign Up</Action>
    <Action>Gallery</Action>
    <Action>Help</Action>*/}
    <Action onClick={() => downloadJSON(Compression.decompress(serialization), `homotopy.io - ${new Date()}`)}>Export</Action>
    <ReactFileReader fileTypes={'application/json'} handleFiles={handleUpload}>
      <Action>Import</Action>
    </ReactFileReader>
  </Actions>;

export default connect(
  ({ serialization }) => ({
    serialization
  })
)(Header)

const handleUpload = (files) => {
  const fr = new FileReader()
  fr.onload = (event) => {
    // onload triggers on successful read
    window.location.hash = Compression.compress(fr.result)
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

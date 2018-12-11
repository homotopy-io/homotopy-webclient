import * as React from "react";
import styled from "styled-components";
import downloadJSON from "~/util/export";

export const Header = () =>
  <Actions style={{userSelect: 'none'}}>
    <Action>Log In</Action>
    <Action>Sign Up</Action>
    <Action>Gallery</Action>
    <Action>Help</Action>
    <Action onClick={() => downloadJSON(store.getState(), `homotopy.io - ${new Date()}`)}>Export</Action>
    <Action onClick={() => alert("TODO: implement import")}>Import</Action>
  </Actions>;

export default Header;

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

import * as React from "react";
import styled from "styled-components";
import Header from "~/components/Header";
import Signature from "~/components/Signature";
import Workspace from "~/components/Workspace";
import DiagramTool from "~/components/tools/Diagram";
import BoundaryTool from "~/components/tools/Boundary";
import AttachmentTool from "~/components/tools/Attachment";

export const App = () =>
  <Container>
    <SignatureBar>
      <Logo>homotopy.io</Logo>
      <Signature />
    </SignatureBar>
    <Content>
      <Header />
      <Workspace />
    </Content>
    <ToolBar>
      <DiagramTool />
      <AttachmentTool />
      <BoundaryTool />
    </ToolBar>
  </Container>;

export default App;

const Container = styled.div`
  display: flex;
  height: 100%;
`;

const SignatureBar = styled.div`
  display: flex;
  flex-direction: column;
  background: #2c3e50;
  color: #ecf0f1;
  min-width: 350px;
  overflow: auto;
`;

const ToolBar = styled.div`
  display: flex;
  flex-direction: column;
  background: #2c3e50;
  color: #ecf0f1;
  min-width: 250px;
  overflow: auto;
`;

const Logo = styled.div`
  font-size: 1.8em;
  padding: 16px;
`;

//background: #bdc3c7;
const Content = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
`;


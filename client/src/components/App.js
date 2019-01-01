import * as React from "react";
import styled from "styled-components";
import Header from "~/components/Header";
import Signature from "~/components/Signature";
import Workspace from "~/components/Workspace";
import DiagramTool from "~/components/tools/Diagram";
import BoundaryTool from "~/components/tools/Boundary";
import AttachmentTool from "~/components/tools/Attachment";
import LogoImg from '../logo.svg';
import * as Core from "homotopy-core";
import { connect } from "react-redux";

//import * as PersistActions from "~/state/persist";

export class App extends React.Component {

  constructor(props) {
    //this.props = props;
    super(props);
    //this.props = props;
    this.state = { hash: null, serialization: null };
  }

  componentDidMount() {
    window.addEventListener("hashchange", () => {
      let hash = window.location.hash.substr(1);
      this.props.dispatch({ type: 'persist/newhash', payload: hash });
    }, false);
  }

  shouldComponentUpdate(nextProps, nextState) {
    
    return nextProps.hash != this.props.hash;
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.props.hash != this.props.serialization) {
      //console.log('NEED TO DESERIALIZE HASH');
      this.props.dispatch({ type: 'persist/deserialize' });
    } else {
      //console.log('NOT DESERIALIZING HASH');
    }
  }

  render() {
    return (
      <Container>
        <SignatureBar>
          <Logo><LogoImage src={LogoImg}/></Logo>
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
      </Container>
    );
  }
}

function mapStateToProps(state) {
  return {
    hash: state.hash,
    serialization: state.serialization
  }
}

// This gives App access to dispatch
export default connect(mapStateToProps)(App);

//export default App;

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
  padding: 0px;
  background-color: white;
  text-align: center;
  padding-top: 11px;
`;

const LogoImage = styled.img`
  width: 300px;
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
`;


import * as React from "react";
import { compose } from 'redux'
import { connect } from "react-redux";
import { firebaseConnect } from 'react-redux-firebase'
import styled from "styled-components";
import Header from "~/components/Header";
import Login from "~/components/Login";
import ProjectListing from "~/components/ProjectListing";
import Signature from "~/components/Signature";
import Workspace from "~/components/Workspace";
import DiagramTool from "~/components/tools/Diagram";
import BoundaryTool from "~/components/tools/Boundary";
import AttachmentTool from "~/components/tools/Attachment";
import LogoImg from '../logo.svg';

//import * as PersistActions from "~/state/persist";
import { setProject } from '~/state/actions/project'

export class App extends React.Component {

  constructor(props) {
    //this.props = props;
    super(props);
    //this.props = props;
  }

  componentDidMount() {
    window.addEventListener("hashchange", () => {
      let hash = window.location.hash.substr(1);
      this.props.dispatch({ type: 'persist/newhash', payload: hash });
    }, false);
    // if we're logged in, and got a project id, try to load it
    this.props.firebase.auth().onAuthStateChanged(user => {
      if(user.uid && this.props.id) {
        const fileRef = this.props.firebase.storage().ref().child(`${user.uid}/${this.props.id}/0.proof`)
        fileRef.getMetadata()
          .then(meta => {
            fileRef.getDownloadURL()
              .then(url => {
                const xhr = new XMLHttpRequest()
                xhr.onload = (evt => {
                  this.props.dispatch(setProject({
                    metadata: meta.customMetadata, // set metadata from firebase storage metadata
                    proof: xhr.response
                  }))
                })
                xhr.open('GET', url) // get proof blob from firebase storage
                xhr.send()
              })
          })
          .catch(err => console.error('Error downloading proof', err))
      }
    })
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
        <Login />
      <ProjectListing />
      </Container>
    );
  }
}

export default compose(
  firebaseConnect(),
  connect(
    state => ({
      hash: state.proof.hash,
      serialization: state.proof.serialization,
      id: state.project.id,
      uid: state.firebase.auth.uid
    })
  )
)(App);

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


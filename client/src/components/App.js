import * as React from "react";
import PropTypes from 'prop-types'
import { compose } from 'redux'
import { connect } from "react-redux";
import { addUrlProps, UrlQueryParamTypes } from 'react-url-query'
import history from '~/util/history'
import { firebaseConnect } from 'react-redux-firebase'
import styled from "styled-components";
import Header from "~/components/Header";
import Login from "~/components/Login";
import ProjectListing from "~/components/ProjectListing";
import Signature from "~/components/Signature";
import Workspace from "~/components/Workspace";
import ButtonTool from "~/components/tools/Buttons";
import DiagramTool from "~/components/tools/Diagram";
import BoundaryTool from "~/components/tools/Boundary";
import AttachmentTool from "~/components/tools/Attachment";
import LogoImg from '../logo.svg';
import URLON from 'urlon'
import ReactGA from 'react-ga';

import { setProject, setProjectID } from '~/state/actions/project'

const urlPropsQueryConfig = {
  id: { type: UrlQueryParamTypes.string }
}

// Google Analytics integration
ReactGA.initialize('UA-132388362-1');
ReactGA.pageview(window.location.pathname + window.location.search);

// Alert if the browser is not Chrome
var isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
if (!isChrome) alert ('Homotopy.io works best when viewed in the Chrome web browser.');

export class App extends React.PureComponent {

  constructor(props) {
    super(props);
  }

  static propTypes = {
    id: PropTypes.string
  }

  componentDidMount() {
    const hash = window.location.hash.substr(1);
    this.props.authIsReady
      .then(() => {
        if (this.props.id) { // if we got a project id
          if (this.props.uid) { // and a user id
            const fileRef = this.props.firebase.storage().ref().child(`${this.props.uid}/${this.props.id}/0.proof`)
            fileRef.getMetadata() // try to retrieve the project…
              .then(meta => {
                if (!hash || hash === 'undefined' || hash === 'null') // set it if we got no data in the url
                  fileRef.getDownloadURL()
                    .then(url => {
                      const xhr = new XMLHttpRequest()
                      xhr.onload = (evt => {
                        this.props.dispatch(setProject({
                          id: this.props.id,
                          metadata: meta.customMetadata, // set metadata from firebase storage metadata
                          proof: xhr.response
                        }))
                      })
                      xhr.open('GET', url) // get proof blob from firebase storage
                      xhr.send()
                    })
              })
            .catch(err => { // not found
              this.props.dispatch(setProjectID(undefined))
            })
          } else { // not logged in
            this.props.dispatch(setProjectID(undefined))
          }
        }
      })
    // listen for hash changes
    history.listen((location, action) => {
      try {
        this.props.dispatch({ type: 'persist/deserialize' })
      } catch(err) {
        if (err.message !== 'Reducers may not dispatch actions.')
          throw err // redux bug?
      }
    })
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
          <ButtonTool />
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
      serialization: state.proof.serialization,
      uid: state.firebase.auth.uid
    })
  ),
  addUrlProps({ urlPropsQueryConfig })
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


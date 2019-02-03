import * as React from "react";
import PropTypes from 'prop-types'
import { compose } from 'redux'
import { connect } from "react-redux";
import ReduxBlockUi from 'react-block-ui/redux'
import 'react-block-ui/style.css'
import { addUrlProps, UrlQueryParamTypes } from 'react-url-query'
import history from '~/util/history'
import { firebaseConnect, firestoreConnect } from 'react-redux-firebase'
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
import ToastTool from "~/components/tools/Toast";
import LogoImg from '../logo.svg';
import URLON from 'urlon'
import ReactGA from 'react-ga';

// Toast stuff
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Slide, Zoom, Flip, Bounce } from 'react-toastify';
import { css } from 'glamor';

import { MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress'

import { setProject, setProjectID } from '~/state/actions/project'

const urlPropsQueryConfig = {
  id: { type: UrlQueryParamTypes.string }
}

// Google Analytics integration
ReactGA.initialize('UA-132388362-1');
ReactGA.pageview(window.location.pathname + window.location.search);

// Material UI theme
const theme = createMuiTheme({
  typography: {
    useNextVariants: true
  }
})

// Alert if the browser is not Firefox or Chrome
const isFirefox = /Mozilla/.test(navigator.userAgent)
const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor)
if (!isFirefox && !isChrome) alert ('Homotopy.io is only tested on Firefox and Chrome.')

export class App extends React.PureComponent {

  constructor(props) {
    super(props);
  }

  static propTypes = {
    id: PropTypes.string
  }

  async componentDidMount() {
    const hash = window.location.hash.substr(1);
    const getProofPath = async () => {
      // get from firestore the path to the blob
      await this.props.firestore.get({ collection: "projects", doc: this.props.id })
      const uid = this.props.projects[this.props.id].uid
      if (this.props.uid !== uid)
        this.props.dispatch(setProjectID(undefined)) // doesn't belong to us
      return `${uid}/${this.props.id}/0.proof`
    }
    await this.props.authIsReady
    if (this.props.id) { // if we got a project id
      try {
        const path = await getProofPath()
        const fileRef = this.props.firebase.storage().ref().child(path)
        const meta = await fileRef.getMetadata() // try to retrieve the project…
        if (!hash || hash === 'undefined' || hash === 'null') { // set it if we got no data in the url
          const url = await fileRef.getDownloadURL()
          const xhr = new XMLHttpRequest()
          xhr.onload = (evt => {
            this.props.dispatch(setProject({
              metadata: meta.customMetadata, // set metadata from firebase storage metadata
              proof: xhr.response
            }))
          })
          xhr.open('GET', url) // get proof blob from firebase storage
          xhr.send()
        }
      } catch (err) { // couldn't retrieve project
        this.props.dispatch(setProjectID(undefined))
      }
    }
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
      <MuiThemeProvider theme={theme}>
        <ReduxBlockUi
          style={{height: "100%"}}
          block={"@@reduxFirestore/GET_REQUEST"}
          unblock={["persist/deserialize", /fail/i]}
          loader={<CircularProgress />}
        >
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
            <ToastTool />
            <ToastContainer
              position={toast.POSITION.BOTTOM_RIGHT}
              autoClose={3000}
              transition={Slide}
              closeButton={false}
              hideProgressBar={true}
              //newestOnTop={true}
              draggable={false}
              style={{width: '305px',
                borderRadius: '8px!important',
                fontFamily: 'Roboto',
                userSelect: 'none'
              }}
            />
          </Container>
        </ReduxBlockUi>
      </MuiThemeProvider>
    );
  }
}

export default compose(
  firebaseConnect(),
  firestoreConnect(),
  connect(
    state => ({
      serialization: state.proof.serialization,
      uid: state.firebase.auth.uid,
      projects: state.firestore.data.projects
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


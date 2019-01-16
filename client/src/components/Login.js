import * as React from "react";
import PropTypes from 'prop-types'
import { compose } from 'redux'
import { connect } from 'react-redux'
import { connectModal } from 'redux-modal'
import Modal from 'react-modal'
import { firebaseConnect } from 'react-redux-firebase'
import FirebaseAuth from 'react-firebaseui/FirebaseAuth'
import * as firebaseui from 'firebaseui'

const Login = ({
  show, handleHide, firebase
}) => {
  const uiConfig = {
    signInFlow: 'popup',
    signInOptions: [
      {
        provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
        requireDisplayName: false
      },
      {
        provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        authMethod: "https://accounts.google.com",
        clientId: "872831343483-3ainm8ml47jtavd2lth1bmhs5drfs4c8.apps.googleusercontent.com"
      },
      firebase.auth.GithubAuthProvider.PROVIDER_ID
    ],
    callbacks: {
      // Close modal after sign-in.
      signInSuccessWithAuthResult: () => {handleHide(); false}
    },
    credentialHelper: firebaseui.auth.CredentialHelper.GOOGLE_YOLO
  }
  return <Modal
    isOpen={show}
    onAfterOpen={() => console.log("Login opened")}
    onRequestClose={handleHide}
    style={{
      content: {
        top: "50%",
        left: "50%",
        right: "auto",
        bottom: "auto",
        marginRight: "-50%",
        transform: 'translate(-50%, -50%)'
      }
    }}
    contentLabel="Login"
  >
    <FirebaseAuth uiCallback={ui => ui.disableAutoSignIn()} uiConfig={uiConfig} firebaseAuth={firebase.auth()} />
  </Modal>
}

Login.propTypes = {
  firebase: PropTypes.shape({
    login: PropTypes.func.isRequired,
    createUser: PropTypes.func.isRequired
  })
}

export default compose(
  firebaseConnect(),
  connect(),
  connectModal({ name: "firebaseUiAuth" })
)(Login)


import * as React from "react";
import PropTypes from 'prop-types'
import { compose } from 'redux'
import { connect } from 'react-redux'
import { connectModal } from 'redux-modal'
import { firebaseConnect } from 'react-redux-firebase'
import FirebaseAuth from 'react-firebaseui/FirebaseAuth'
import * as firebaseui from 'firebaseui'

import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'

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
  return <Dialog
    open={show}
    onClose={handleHide}
    aria-labelledby="login-title"
  >
    <DialogTitle id="login-title">Login</DialogTitle>
    <DialogContent>
      <FirebaseAuth uiCallback={ui => ui.disableAutoSignIn()} uiConfig={uiConfig} firebaseAuth={firebase.auth()} />
    </DialogContent>
  </Dialog>
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


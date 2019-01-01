import * as React from "react";
import PropTypes from 'prop-types'
import { compose } from 'redux'
import { connect } from 'react-redux'
import { firebaseConnect } from 'react-redux-firebase'
import ReactModalLogin from "react-modal-login";

import { getShowModal, getInitialTab, getError } from "~/state/store/user";
import { closeModal, setError } from "~/state/actions/user";

const Login = ({
  getShowModal, onCloseModal, tab, error, setError, firebase
}) =>
    <ReactModalLogin visible={getShowModal()}
                     onCloseModal={onCloseModal}
                     initialTab={tab}
                     error={error}
                     loginError={error ? { label: error.loginError } : null}
                     registerError={error ? { label: error.registerError } : null}
                     recoverPasswordError={error ? { label: error.recoverPasswordError } : null}
                     form={{
                       loginBtn: {
                         label: "Sign in"
                       },
                       loginInputs: [
                         {
                           label: 'Email',
                           type: 'email',
                           id: 'email'
                         },
                         {
                           label: 'Password',
                           type: 'password',
                           id: 'password'
                         }
                       ],
                       onLogin: () => onLogin(firebase.login, setError)
                         .then((response) => onCloseModal()),
                       registerInputs: [
                         {
                           label: 'Email',
                           type: 'email',
                           id: 'email'
                         },
                         {
                           label: 'Password',
                           type: 'password',
                           id: 'password'
                         },
                         {
                           label: 'Confirm password',
                           type: 'password',
                           id: 'confirmpassword'
                         }
                       ],
                       registerBtn: {
                         label: "Sign up"
                       },
                       onRegister: () => onRegister(firebase.createUser, setError),
                       recoverPasswordInputs: [
                         {
                           label: 'Email',
                           type: 'email',
                           id: 'email'
                         }
                       ],
                       recoverPasswordAnchor: {
                         label: "Forgot your password?"
                       },
                       recoverPasswordBtn: {
                         label: "Send new password"
                       }
                     }}
    />

Login.propTypes = {
  getShowModal: PropTypes.func.isRequired,
  onCloseModal: PropTypes.func.isRequired,
  tab: PropTypes.string,
  error: PropTypes.object,
  setError: PropTypes.func.isRequired,
  firebase: PropTypes.shape({
    login: PropTypes.func.isRequired,
    createUser: PropTypes.func.isRequired
  })
}

export default compose(
  firebaseConnect(),
  connect(
    state => ({
      getShowModal: () => getShowModal(state),
      tab: getInitialTab(state),
      error: getError(state),
      loginError: getError(state) ? getError(state).loginError : null,
      registerError: getError(state) ? getError(state).registerError : null,
      recoverPasswordError: getError(state) ? getError(state).recoverPasswordError : null
    }),
    dispatch => ({
      onCloseModal: () => dispatch(closeModal()),
      setError: (error) => dispatch(setError(error))
    })
  ),
)(Login)

const onLogin = (login, setError) => {
  const email = document.querySelector('#email').value
  const password = document.querySelector('#password').value
  if (!email)
    setError({loginError: "Empty email address"})
  else if (!password)
    setError({loginError: "Empty password"})
  else
    return login({email, password})
}

const onRegister = (register, setError) => {
  const email = document.querySelector('#email').value
  const password = document.querySelector('#password').value
  const confirmpassword = document.querySelector('#confirmpassword').value
  if (!email)
    setError({registerError: "Empty email address"})
  else if (!password)
    setError({registerError: "Empty password"})
  else if (password.length < 6)
    setError({registerError: "Password needs to be at least 6 characters"})
  else if (!confirmpassword)
    setError({registerError: "Please confirm password"})
  else if (password != confirmpassword)
    setError({registerError: "Passwords do not match"})
  else
    return register({email, password}, {email})
}


import * as React from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';

import { connectModal } from 'redux-modal';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { firebaseConnect, firestoreConnect } from 'react-redux-firebase';

export const DeleteConfirmation = ({
  show, handleHide, project, uid, firebase, firestore
}) => {
  const [inputText, setInputText] = React.useState('');

  const projectName = project.versions[0].metadata.title;

  const handleChange = (event) => {
    setInputText(event.target.value);
  };

  const deleteProject = () => {
    // delete db entry in firestore
    firestore.delete({ collection: 'projects', doc: project.id });
    // delete blob in firebase storage
    firebase.deleteFile(`${uid}/${project.id}/0.proof`);
    handleHide();
  };

  return (
    <Dialog
      open={show}
      onClose={handleHide}
      aria-labelledby="delete-project"
      aria-describedby={"delete-project-titled-" + projectName}
    >
      <DialogTitle id="delete-dialog-title">{"Delete " + projectName}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete {projectName}?
        </DialogContentText>
        <DialogContentText>
          Type out its name below to continue.
        </DialogContentText>
        <TextField
          autoFocus
          id="name"
          fullWidth
          value = {inputText}
          onChange = {handleChange}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleHide} color="secondary">
          Cancel
        </Button>
        <Button onClick={deleteProject} disabled={!(inputText == projectName)} color="primary">
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default compose(
  connect(
    state => ({
      uid: state.firebase.auth.uid
    }),
    dispatch => ({})
  ),
  firebaseConnect(),
  firestoreConnect(({ uid }) => {
    if (!uid) return []
    else
      return [{
        collection: "projects",
        where: [
          ["uid", "==", uid]
        ]
      }]
  }),
  connectModal({ name: "deleteConfirmation" })
)(DeleteConfirmation);

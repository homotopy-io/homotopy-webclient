import * as React from "react";
import { connect } from "react-redux";
import { toast } from 'react-toastify';
import { css } from 'glamor';

const custom_class = css({
  color: "#000",
  //minHeight: "60px",
  borderRadius: "8px"
});

export const ToastTool = ({
  notificationProp, onToasted
}) => {
  for (let i=0; i<notificationProp.length; i++) {
    toast.error(notificationProp[i] /*{ bodyClassName: custom_class }*/);
  }
  if (notificationProp.length > 0) onToasted();
  return null;
};

export default connect(
  state => ({
    notificationProp: state.proof.workspace.notifications,
  }),
  dispatch => ({
    onToasted: () => dispatch({ type: 'workspace/toasted' })
  })
)(ToastTool);

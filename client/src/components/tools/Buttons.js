import * as React from "react";
import { connect } from "react-redux";
import MaterialButton from '@material-ui/core/Button';

import Tool, { Control } from "~/components/Tool";
import styled from "styled-components";
import { getSource, getTarget, getDiagram } from "~/state/store/workspace";

const ActionButtonStyle = {
  margin: "5px",
  width: "100px"
};

const ActionToolStyle = {
  padding: "20px"
};

export const ButtonTool = ({
  onSource, onTarget, onIdentity, onClear, onRestrict, onTheorem, onBehead,
  source, target, diagram
}) => {
  return (
    <Tool title="Actions" style={ActionToolStyle}>
      <div style={{maxWidth: '350px', padding: '5px'}}>
      <MaterialButton disabled={!diagram || (target && !diagram.sameBoundary(target))} style={ActionButtonStyle} variant="contained" onClick={onSource}> <u>S</u>ource </MaterialButton>
      <MaterialButton disabled={!diagram || (source && !diagram.sameBoundary(source))} style={ActionButtonStyle} variant="contained" onClick={onTarget}> <u>T</u>arget </MaterialButton>
      <MaterialButton disabled={!diagram} style={ActionButtonStyle} variant="contained" onClick={onIdentity}> <u>I</u>dentity </MaterialButton>
      <MaterialButton disabled={!diagram} style={ActionButtonStyle} variant="contained" onClick={onClear}> <u>C</u>lear </MaterialButton>
      <MaterialButton disabled={!diagram} style={ActionButtonStyle} variant="contained" onClick={onRestrict}> <u>R</u>estrict </MaterialButton>
      <MaterialButton disabled={!diagram} style={ActionButtonStyle} variant="contained" onClick={onTheorem}> T<u>h</u>eorem </MaterialButton>
      <MaterialButton disabled={!diagram || diagram.n == 0 || diagram.data.length == 0} style={ActionButtonStyle} variant="contained" onClick={onBehead}> Behea<u>d</u> </MaterialButton>
      </div>
    </Tool>
  );
};

export default connect(
  
  state => ({
    source: getSource(state.proof),
    target: getTarget(state.proof),
    diagram: getDiagram(state.proof)
  }),
  dispatch => ({
    onSource: () => dispatch({ type: 'workspace/set-source' }),
    onTarget: () => dispatch({ type: 'workspace/set-target'}),
    onIdentity: () => dispatch({ type: 'workspace/take-identity' }),
    onClear: () => dispatch({ type: 'workspace/clear-diagram'}),
    onRestrict: () => dispatch({ type: 'workspace/restrict-diagram' }),
    onTheorem: () => dispatch({ type: 'workspace/make-theorem'}),
    onBehead: () => dispatch({ type: 'workspace/behead' }),
  })
)(ButtonTool);


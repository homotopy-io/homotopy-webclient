import * as React from "react";
import { connect } from "react-redux";

import { MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';

import Tool, { Control } from "~/components/Tool";
import { getSource, getTarget, getDiagram, getSlice } from "~/state/store/workspace";

const theme = createMuiTheme({
  typography: {
    useNextVariants: true
  },
  palette: {
    type: "dark",
  }
})

const ActionButtonStyle = {
  margin: "5px",
  width: "100px"
};

const ActionToolStyle = {
  padding: "20px"
};

export const ButtonTool = ({
  onSource, onTarget, onIdentity, onClear, onRestrict, onTheorem, onBehead, onContract,
  source, target, diagram, slice, onCatt
}) => {
  return (
    <Tool title="Actions" style={ActionToolStyle}>
      <div style={{maxWidth: '350px', padding: '5px'}}>
        <MuiThemeProvider theme={theme}>
          <Button disabled={!diagram || (target && !diagram.sameBoundary(target))} style={ActionButtonStyle} variant="contained" onClick={function() {
            onSource()
            }/*onSource*/ }> <u>S</u>ource </Button>
          <Button disabled={!diagram || (source && !diagram.sameBoundary(source))} style={ActionButtonStyle} variant="contained" onClick={onTarget}> <u>T</u>arget </Button>
          <Button disabled={!diagram} style={ActionButtonStyle} variant="contained" onClick={onIdentity}> <u>I</u>dentity </Button>
          <Button disabled={!diagram} style={ActionButtonStyle} variant="contained" onClick={onClear}> <u>C</u>lear </Button>
          <Button disabled={!diagram || slice.length == 0} style={ActionButtonStyle} variant="contained" onClick={onRestrict}> <u>R</u>estrict </Button>
          <Button disabled={!diagram} style={ActionButtonStyle} variant="contained" onClick={onTheorem}> T<u>h</u>eorem </Button>
          <Button disabled={!diagram || diagram.n == 0 || diagram.data.length == 0} style={ActionButtonStyle} variant="contained" onClick={onBehead}> Behea<u>d</u> </Button>
          <Button disabled={!diagram || slice.length != 0} style={ActionButtonStyle} variant="contained" onClick={onContract}> C<u>o</u>ntract </Button>
          <Button disabled={!diagram} style={ActionButtonStyle} variant="contained" onClick={onCatt}> C<u>a</u>tt </Button>
        </MuiThemeProvider>
      </div>
  </Tool>
  );
};

export default connect(
  state => ({
    source: getSource(state.proof),
    target: getTarget(state.proof),
    diagram: getDiagram(state.proof),
    slice: getSlice(state.proof)
  }),

  dispatch => ({
    onSource: () => dispatch({ type: 'workspace/set-source' }),
    onTarget: () => dispatch({ type: 'workspace/set-target'}),
    onIdentity: () => dispatch({ type: 'workspace/take-identity' }),
    onClear: () => dispatch({ type: 'workspace/clear-diagram'}),
    onRestrict: () => dispatch({ type: 'workspace/restrict-diagram' }),
    onTheorem: () => dispatch({ type: 'workspace/make-theorem'}),
    onBehead: () => dispatch({ type: 'workspace/behead' }),
    onContract: () => dispatch({ type: 'workspace/contract' }),
    onCatt: () => dispatch({ type: 'workspace/catt' })
  })
)(ButtonTool);


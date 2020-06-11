import * as React from "react";
import dotProp from "dot-prop-immutable";
import { connect } from "react-redux";
import styled from "styled-components";
import { Field, reduxForm } from 'redux-form'

import Generator from "~/components/Generator";
import { getDimensionGroups } from "~/state/store/signature";

import IconButton from "~/components/misc/IconButton";

import { MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField'
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import Typography from '@material-ui/core/Typography'

const theme = createMuiTheme({
  typography: {
    useNextVariants: true
  },
  palette: {
    type: "dark",
    background: {
      paper: "#34495e"
    }
  }
})

// from https://redux-form.com/8.1.0/examples/material-ui/
const renderTextField = ({
  label,
  input,
  meta: { touched, invalid, error },
  ...custom
}) => (
  <TextField
  label={label}
  placeholder={label}
  error={touched && invalid}
  helperText={touched && error}
  {...input}
  {...custom}
  />
)

export const Signature = ({
  groups, titleFocused, setTitleFocus, abstractFocused, setAbstractFocus, onAddGenerator, metadata
}) =>
  <MuiThemeProvider theme={theme}>
    <Group>
      <GroupHeader onMouseEnter={() => setTitleFocus(true)}
                   onMouseLeave={() => {
                     setTitleFocus(false)
                     setTimeout(() =>
                       renderMathInElement(document.getElementById("title"), {
                         delimiters: [
                           {left: "$$", right: "$$", display: true},
                           {left: "\\[", right: "\\]", display: true},
                           {left: "$", right: "$", display: false},
                           {left: "\\(", right: "\\)", display: false}
                         ]
                       }),
                     0)
                   }}>
        {!titleFocused && <RenderedTitle id="title">{metadata.title}</RenderedTitle>}
        <Field name="title" type={titleFocused ? "text" : "hidden"} component={renderTextField} fullWidth={titleFocused} inputProps={{style: titleStyle}} onBlur={evt => {
            // update metadata
            window.sessionStorage.setItem("metadata", JSON.stringify(metadata))
          }} />
      </GroupHeader>
      <div style={{margin: '0px 16px 8px 16px'}}>
        <Field name="author" component={renderTextField} label="Author" fullWidth onBlur={evt => {
          // update metadata
          window.sessionStorage.setItem("metadata", JSON.stringify(metadata))
        }} />
      </div>
      <ExpansionPanel onMouseEnter={() => setAbstractFocus(true)}
                      onMouseLeave={() => {
                        setAbstractFocus(false)
                        setTimeout(() =>
                          renderMathInElement(document.getElementById("abstract"), {
                            delimiters: [
                              {left: "$$", right: "$$", display: true},
                              {left: "\\[", right: "\\]", display: true},
                              {left: "$", right: "$", display: false},
                              {left: "\\(", right: "\\)", display: false}
                            ]
                          }),
                        0)
                      }}>
        <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Abstract</Typography>
        </ExpansionPanelSummary>
        <ExpansionPanelDetails>
          {!abstractFocused && <RenderedAbstract id="abstract">{metadata.abstract}</RenderedAbstract>}
          <Field name="abstract" type={abstractFocused ? "text" : "hidden"} component={renderTextField} multiline={abstractFocused} fullWidth={abstractFocused} onBlur={evt => {
            // update metadata
            // FIXME: in Chrome, this is not called unless you <TAB> out of the
            // field
            window.sessionStorage.setItem("metadata", JSON.stringify(metadata))
          }} />
        </ExpansionPanelDetails>
      </ExpansionPanel>
    </Group>
    {groups.map((generators, dimension) =>
      <Group key={dimension}>
        <GroupHeader>
          <GroupLabel>
            {dimension}-cells
          </GroupLabel>
          <GroupActions>
            {dimension == 0 &&
              <IconButton
                onClick={onAddGenerator}
                icon="plus"
              />
            }
          </GroupActions>
        </GroupHeader>
        <GroupContent>
          {generators.map(generator => <Generator key={generator} id={generator} />)}
        </GroupContent>
      </Group>
    )}
  </MuiThemeProvider>;

export default connect(
  state => ({
    groups: getDimensionGroups(state.proof),
    initialValues: {
      title: state.form.metadata ? state.form.metadata.values.title : "Untitled Project",
      author: state.form.metadata ? state.form.metadata.values.author : "",
      abstract: state.form.metadata ? state.form.metadata.values.abstract : "",
    },
    metadata: state.form.metadata ? state.form.metadata.values : {},
    titleFocused: state.focus.title,
    abstractFocused: state.focus.abstract
  }),
  dispatch => ({
    onAddGenerator: () => dispatch({ type: "signature/create-zero-cell" }),
    setTitleFocus: (focus) => dispatch({ type: "focus/set-title-focus", payload: { focus }}),
    setAbstractFocus: (focus) => dispatch({ type: "focus/set-abstract-focus", payload: { focus }})
  })
)(reduxForm({
  form: "metadata"
})(Signature))

const Group = styled.div``;

const GroupHeader = styled.div`
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #34495e;
`;

const GroupLabel = styled.div`
  font-size: 1.2em;
  font-weight: 500;
  padding: 8;
`;

const GroupActions = styled.div`
  padding: 8px;
  font-weight: 600;
  cursor: pointer;
`;

const GroupContent = styled.div`
  padding-top: 16px;
  padding-bottom: 16px;
`;

const RenderedTitle = styled.div`
  font-size: 1.3em;
  padding-top: 3.5px;
  padding-bottom: 5px;
`

const RenderedAbstract = styled.div`
  padding-top: 6px;
  padding-bottom: 7px;
`

const titleStyle = {
  fontSize: "1.3em"
}


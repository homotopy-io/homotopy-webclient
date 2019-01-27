import * as React from "react";
import dotProp from "dot-prop-immutable";
import { connect } from "react-redux";
import styled from "styled-components";
import { Field, reduxForm } from 'redux-form'

import Generator from "~/components/Generator";
import { getDimensionGroups } from "~/state/store/signature";

import IconButton from "~/components/misc/IconButton";

import URLON from 'urlon'

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
  groups, onAddGenerator, metadata
}) =>
  <MuiThemeProvider theme={theme} style={{userSelect: 'none'}}>
    <Group>
      <GroupHeader>
        <Field name="title" component={renderTextField} fullWidth onBlur={evt => {
          // update hash
          const hash = window.location.hash.substr(1)
          if (hash) {
            const data = URLON.parse(window.location.hash.substr(1))
            window.location.hash = URLON.stringify(dotProp.set(data, 'metadata.title', metadata.title))
          } else {
            window.location.hash = URLON.stringify({ metadata })
          }
        }} inputProps={{style: titleStyle}} />
      </GroupHeader>
			<div style={{margin: '0px 16px 8px 16px'}}>
				<Field name="author" component={renderTextField} label="Author" fullWidth onBlur={evt => {
					// update hash
					const hash = window.location.hash.substr(1)
					if (hash) {
						const data = URLON.parse(window.location.hash.substr(1))
						window.location.hash = URLON.stringify(dotProp.set(data, 'metadata.author', metadata.author))
					} else {
						window.location.hash = URLON.stringify({ metadata })
					}
				}} />
			</div>
			<ExpansionPanel>
				<ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
					<Typography>Abstract</Typography>
				</ExpansionPanelSummary>
				<ExpansionPanelDetails>
					<Field name="abstract" component={renderTextField} multiline fullWidth onBlur={evt => {
						// update hash
						const hash = window.location.hash.substr(1)
						if (hash) {
							const data = URLON.parse(window.location.hash.substr(1))
							window.location.hash = URLON.stringify(dotProp.set(data, 'metadata.abstract', metadata.abstract))
						} else {
							window.location.hash = URLON.stringify({ metadata })
						}
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
    metadata: state.form.metadata ? state.form.metadata.values : {}
  }),
  dispatch => ({
    onAddGenerator: () => dispatch({ type: "signature/create-zero-cell" })
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

const titleStyle = {
  fontSize: "1.3em"
}


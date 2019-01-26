import * as React from "react";
import dotProp from "dot-prop-immutable";
import { connect } from "react-redux";
import styled from "styled-components";
import Collapsible from 'react-collapsible'
import './Collapsible.css'
import { Field, reduxForm } from 'redux-form'

import Generator from "~/components/Generator";
import { getDimensionGroups } from "~/state/store/signature";

import IconButton from "~/components/misc/IconButton";

import URLON from 'urlon'

export const Signature = ({
  groups, onAddGenerator, metadata
}) =>
  <Wrapper style={{userSelect: 'none'}}>
    <Group>
      <GroupHeader>
        <GroupLabel>
          <Field name="title" component="input" type="text" onBlur={evt => {
            // update hash
            const hash = window.location.hash.substr(1)
            if (hash) {
              const data = URLON.parse(window.location.hash.substr(1))
              window.location.hash = URLON.stringify(dotProp.set(data, 'metadata.title', metadata.title))
            } else {
              window.location.hash = URLON.stringify({ metadata })
            }
          }} style={titleStyle} />
        </GroupLabel>
      </GroupHeader>
      <GroupContent>
        <Wrapper style={{padding: '0px 8px 8px 8px'}}>
          <MetaLabel>
            <label htmlFor="author" style={{paddingRight: '8px'}}>Author</label>
            <Field name="author" component="input" type="text" onBlur={evt => {
              // update hash
              const hash = window.location.hash.substr(1)
              if (hash) {
                const data = URLON.parse(window.location.hash.substr(1))
                window.location.hash = URLON.stringify(dotProp.set(data, 'metadata.author', metadata.author))
              } else {
                window.location.hash = URLON.stringify({ metadata })
              }
            }} style={inputStyle} />
          </MetaLabel>
        </Wrapper>
        <Wrapper style={{padding: '0px 8px 8px 8px'}}>
          <Collapsible trigger={<MetaLabel><label htmlFor="abstract" style={{paddingRight: '8px'}}>Abstract</label></MetaLabel>}
                       open={typeof metadata !== 'undefined'
                             && typeof metadata.abstract !== 'undefined'
                             && metadata.abstract !== ""}>
            <Field name="abstract" component="textarea" rows={5} onBlur={evt => {
              // update hash
              const hash = window.location.hash.substr(1)
              if (hash) {
                const data = URLON.parse(window.location.hash.substr(1))
                window.location.hash = URLON.stringify(dotProp.set(data, 'metadata.abstract', metadata.abstract))
              } else {
                window.location.hash = URLON.stringify({ metadata })
              }
            }} style={inputStyle} />
          </Collapsible>
        </Wrapper>
      </GroupContent>
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
  </Wrapper>;

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

const Wrapper = styled.div``;

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

const MetaLabel = styled.div`
  font-weight: 500;
  padding: 8px;
  display: flex;
  background: #34495e;
  border: none;
  color: #ecf0f1;
  text-transform: capitalize;
`

const titleStyle = {
  paddingLeft: '4px',
  background: '#34495e',
  border: 'none',
  width: '100%',
  color: '#ecf0f1',
  fontSize: '1.2em'
}

const inputStyle = {
  paddingLeft: '4px',
  background: '#46596c',
  border: 'none',
  width: '100%',
  color: '#ecf0f1'
}

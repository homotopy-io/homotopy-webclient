import * as React from "react";
import styled from "styled-components";
import { connect } from "react-redux";

import { getOptions } from "~/state/store/attach";
// import { clearHighlight, selectOption } from "~/state/actions/attach";
import Tool from "~/components/Tool";

export const AttachmentTool = ({
  options,
  onSetHighlight,
  onClearHighlight,
  onSelect
}) => {
  if (options == null) {
    return null;
  }

  return (
    <Tool title="Attachment">
      <Options>
        {options.map((option, index) =>
          <Option
            onMouseOver={() => onSetHighlight(index)}
            onMouseOut={onClearHighlight}
            onClick={() => onSelect(index)}
            key={index}>
            {option.generator.name}
          </Option>
        )}
      </Options>
    </Tool>
  );
};

export default connect(
  state => ({
    options: getOptions(state.proof)
  }),
  dispatch => ({
    onSelect: (index) => dispatch({ type: "attach/select-option", payload: { index } }),
    onSetHighlight: (index) => dispatch({ type: "attach/set-highlight", payload: { index } }),
    onClearHighlight: () => dispatch({ type: "attach/clear-highlight" })
  })
)(AttachmentTool);

const Options = styled.ul`
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
`;

const Option = styled.li`
  display: block;
  margin: 0;
  padding: 8px;
  cursor: pointer;
`;

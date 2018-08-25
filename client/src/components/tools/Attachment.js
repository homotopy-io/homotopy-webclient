import * as React from "react";
import { StyleSheet, css } from "aphrodite";
import { connect } from "react-redux";

import { getOptions } from "~/state/store/attach";
import { setHighlight, clearHighlight, selectOption } from "~/state/actions/attach";
import Tool from "~/components/Tool"

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
      <ul className={css(styles.options)}>
        {options.map((option, index) =>
          <li
            className={css(styles.option)}
            onMouseOver={() => onSetHighlight(index)}
            onMouseOut={onClearHighlight}
            onClick={() => onSelect(index)}>
            {option.generator.name}
          </li>
        )}
      </ul>
    </Tool>
  );
}

export default connect(
  state => ({
    options: getOptions(state)
  }),
  dispatch => ({
    onSelect: (index) => dispatch(selectOption(index)),
    onSetHighlight: (index) => dispatch(setHighlight(index)),
    onClearHighlight: () => dispatch(clearHighlight())
  })
)(AttachmentTool);

const styles = StyleSheet.create({
  options: {
    display: "flex",
    flexDirection: "column",
    padding: 0,
    margin: 0
  },

  option: {
    display: "block",
    margin: 0,
    padding: 8,
    cursor: "pointer",
  }
});
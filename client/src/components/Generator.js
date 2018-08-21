import * as React from "react";
import { StyleSheet, css } from "aphrodite";
import { connect } from "react-redux";

import { getGenerator } from "~/state/store/signature";
import { selectGenerator, removeGenerator } from "~/state/actions/signature";

import IconButton from "~/components/misc/IconButton";
import Diagram2D from "~/components/diagram/Diagram2D";

export const Generator = ({
  name,
  generator,
  onSelect,
  onRemove
}) =>
  <div className={css(styles.generator)}>
    <div className={css(styles.preview)} onClick={onSelect}>
      <Diagram2D
        diagram={generator.getDiagram()}
        width={100}
        height={100}
        padding={2}
        scale={100}
        dimension={generator.n}
      />
    </div>
    <div className={css(styles.details)}>
      <div className={css(styles.name)}>
        {name}
      </div>
    </div>
    <div className={css(styles.actions)}>
      <IconButton
        className={`${css(styles.groupAction)}`}
        onClick={onRemove}
        icon="trash"
      />
    </div>
  </div>

export default connect(
  (state, { id }) => getGenerator(state, id),
  (dispatch, { id }) => ({
    onSelect: () => dispatch(selectGenerator(id)),
    onRemove: () => dispatch(removeGenerator(id))
  })
)(Generator);

const styles = StyleSheet.create({
  generator: {
    display: "flex",
    paddingLeft: 8,
    paddingRight: 8
  },

  preview: {
    width: 100,
    height: 100,
    border: "2px dashed #34495e",
    margin: 8,
    display: "flex"
  },

  details: {
    display: "flex",
    flexDirection: "column",
    flex: 1
  },

  name: {
    fontWeight: 500,
    padding: 8
  },

  actions: {
    fontWeight: 600,
    display: "flex",
    flexDirection: "column",
    justifyContent: "right",
  }
});


import * as React from "react";
import { StyleSheet, css } from "aphrodite";
import { connect } from "react-redux";

import { getGenerator } from "~/state/store/signature";
import { selectGenerator, removeGenerator, renameGenerator, recolorGenerator } from "~/state/actions/signature";
import { cellColors } from "~/style";

import IconButton from "~/components/misc/IconButton";
import ColorPicker from "~/components/misc/ColorPicker";
import Diagram2D from "~/components/diagram/Diagram2D";

export const Generator = ({
  name,
  color,
  generator,
  onSelect,
  onRemove,
  onRename,
  onRecolor
}) =>
  <div className={css(styles.generator)}>
    <div className={css(styles.preview)} onClick={onSelect}>
      <Diagram2D
        diagram={generator.diagram}
        slice={[]}
        dimension={Math.min(2, generator.n)}
      />
    </div>
    <div className={css(styles.details)}>
      <input
        type="text"
        value={name}
        className={css(styles.name)}
        onChange={e => onRename(e.target.value)}
      />
      <ColorPicker
        color={color}
        colors={cellColors}
        onChange={color => onRecolor(color)}
      />
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
    onRemove: () => dispatch(removeGenerator(id)),
    onRename: (name) => dispatch(renameGenerator(id, name)),
    onRecolor: (color) => dispatch(recolorGenerator(id, color))
  })
)(Generator);

const styles = StyleSheet.create({
  generator: {
    display: "flex",
    paddingLeft: 8,
    paddingRight: 8
  },

  preview: {
    width: 75,
    height: 75,
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
    padding: 8,
    background: "#34495e",
    border: "none",
    color: "#ecf0f1",
  },

  actions: {
    fontWeight: 600,
    display: "flex",
    flexDirection: "column",
    justifyContent: "right",
  }
});


import * as React from "react";
import { StyleSheet, css } from "aphrodite";
import { connect } from "react-redux";
import Diagram2D from "~/components/diagram/Diagram2D";

import { getDiagram, getDisplayDimension, getSlice } from "~/state/store/diagram";
import { getHighlight } from "~/state/store/attach";
import { selectCell } from "~/state/actions/diagram";

export const Workspace = ({
  diagram,
  dimension,
  highlight,
  slice,
  onSelectCell
}) =>
  <div className={css(styles.workspace)}>
    { !diagram ? null : 
      <Diagram2D
        diagram={diagram}
        dimension={dimension}
        highlight={highlight}
        slice={slice}
        interactive
        className={css(styles.diagram)}
        onSelect={onSelectCell}
      />
    }
  </div>

export default connect(
  state => ({
    diagram: getDiagram(state),
    dimension: getDisplayDimension(state),
    highlight: getHighlight(state),
    slice: getSlice(state)
  }),
  dispatch => ({
    onSelectCell: (points) => dispatch(selectCell(points))
  })
)(Workspace);

const styles = StyleSheet.create({
  workspace: {
    display: "flex",
    flex: 1,
    position: "relative"
  },

  diagram: {
  }
})
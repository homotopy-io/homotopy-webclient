import * as React from "react";
import { StyleSheet, css } from "aphrodite";
import { connect } from "react-redux";
import Diagram2D from "~/components/diagram/Diagram2D";

import { getDisplayDiagram, getDisplayDimension } from "~/state/store/diagram";
import { selectCell } from "~/state/actions/diagram";

export const Workspace = ({
  diagram,
  dimension,
  onSelectCell
}) =>
  <div className={css(styles.workspace)}>
    { !diagram ? null : 
      <Diagram2D
        diagram={diagram}
        dimension={dimension}
        interactive
        className={css(styles.diagram)}
        onSelect={onSelectCell}
      />
    }
  </div>

export default connect(
  state => ({
    diagram: getDisplayDiagram(state),
    dimension: getDisplayDimension(state)
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
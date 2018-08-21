import * as React from "react";
import { StyleSheet, css } from "aphrodite";
import { connect } from "react-redux";
import Diagram2D from "~/components/diagram/Diagram2D";

import { getDiagram } from "~/state/store/diagram";
import { selectCell } from "~/state/actions/diagram";

export const Workspace = ({
  diagram,
  onSelectCell
}) =>
  <div className={css(styles.workspace)}>
    {/*<div className={css(styles.tools)}>
      <div className={css(styles.tool)}>
        <div className={css(styles.toolHeader)}>
          Diagram
        </div>
        <div className={css(styles.toolContent)}>
          <div>Display</div>
          <div>Project</div>
          <div>Slice</div>
        </div>
      </div>
      <div className={css(styles.tool)}>
        Source
      </div>
    </div>*/}
    { !diagram ? null : 
      <Diagram2D
        diagram={diagram}
        scale={60}
        padding={20}
        dimension={diagram.n}
        interactive
        className={css(styles.diagram)}
        onSelect={onSelectCell}
      />
    }
  </div>

export default connect(
  state => ({
    diagram: getDiagram(state)
  }),
  dispatch => ({
    onSelectCell: (point) => dispatch(selectCell(point))
  })
)(Workspace);

const styles = StyleSheet.create({
  workspace: {
    display: "flex",
    flex: 1
  },

  tools: {
    position: "absolute",
    top: 16,
    right: 16,
    bottom: 16,
    width: 300,
  },

  tool: {
    background: "#ecf0f1",
    margin: 16,
    //boxShadow: "5px 5px 10px #aaaaaa",
  },

  toolContent: {
    padding: 8
  },

  toolHeader: {
    background: "#2c3e50",
    color: "#ecf0f1",
    fontWeight: 500,
    padding: 8
  },

  diagram: {

  }
})
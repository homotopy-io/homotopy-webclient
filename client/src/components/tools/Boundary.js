import * as React from "react";
import { StyleSheet, css } from "aphrodite";
import { connect } from "react-redux";

import { clearBoundary } from "~/state/actions/diagram";
import { getSource, getTarget } from "~/state/store/diagram";

import Tool, { Control } from "~/components/Tool";
import Diagram2D from "~/components/diagram/Diagram2D";

export const BoundaryTool = ({
  source,
  target,
  onClearBoundary
}) => {
  if (!source && !target) {
    return null;
  }

  let boundary = source ? "Source" : "Target";
  let diagram = source || target;

  return (
    <Tool title={boundary} actions={[
      { label: "Clear boundary", icon: "close", onClick: onClearBoundary }
    ]}>
      <div className={css(styles.container)}>
        <div className={css(styles.diagram)}>
          <Diagram2D diagram={diagram} dimension={Math.min(2, diagram.n)} />
        </div>
      </div>
    </Tool>
  );
}

export default connect(
  state => ({
    source: getSource(state),
    target: getTarget(state)
  }),
  dispatch => ({
    onClearBoundary: () => dispatch(clearBoundary())
  })
)(BoundaryTool);

const styles = StyleSheet.create({
  diagram: {
    display: "flex",
    flex: 1,
    height: 100,
  },

  container: {
    display: "flex",
    justifyContent: "center",
    padding: 16,
  }
});
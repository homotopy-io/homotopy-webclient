import * as React from "react";
import styled from "styled-components";
import { connect } from "react-redux";

import { clearBoundary } from "~/state/actions/diagram";
import { getSource, getTarget } from "~/state/store/diagram";

import Tool from "~/components/Tool";
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
      <Container>
        <Diagram>
          <Diagram2D diagram={diagram} dimension={Math.min(2, diagram.n)} slice={[]} />
        </Diagram>
      </Container>
    </Tool>
  );
};

export default connect(
  state => ({
    source: getSource(state),
    target: getTarget(state)
  }),
  dispatch => ({
    onClearBoundary: () => dispatch(clearBoundary())
  })
)(BoundaryTool);

const Diagram = styled.div`
  display: flex;
  flex: 1;
  height: 100px;
`;

const Container = styled.div`
  display: flex;
  justify-content: center;
  padding: 16px;
`;

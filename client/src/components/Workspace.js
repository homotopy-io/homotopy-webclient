import * as React from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import Diagram2D from "~/components/diagram/Diagram2D";
import Diagram3D from "~/components/diagram/Diagram3D";

import { getDiagram, getDisplayDimension, getSlice, getRenderer } from "~/state/store/diagram";
import { getHighlight } from "~/state/store/attach";
import { selectCell, contract, expand } from "~/state/actions/diagram";

export const Workspace = ({
  diagram,
  dimension,
  highlight,
  slice,
  renderer,
  onSelectCell,
  onContract,
  onExpand
}) => {
  let Diagram = renderer == 2 ? Diagram2D : Diagram3D;

  return (
    <Wrapper>
      { !diagram ? null : 
        <Diagram
          diagram={diagram}
          dimension={dimension}
          highlight={highlight}
          slice={slice}
          interactive
          onSelect={onSelectCell}
          onContract={onContract}
          onExpand={onExpand}
        />
      }
    </Wrapper>
  );
};

export default connect(
  state => ({
    diagram: getDiagram(state),
    dimension: getDisplayDimension(state),
    highlight: getHighlight(state),
    slice: getSlice(state),
    renderer: getRenderer(state)
  }),
  dispatch => ({
    onSelectCell: (point) => dispatch(selectCell(point)),
    onContract: (point, direction) => dispatch(contract(point, direction)),
    onExpand: (point, direction) => dispatch(expand(point, direction))
  })
)(Workspace);

const Wrapper = styled.div`
  display: flex;
  flex: 1;
  position: relative;
`;

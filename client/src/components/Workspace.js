import * as React from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import Diagram2D from "~/components/diagram/Diagram2D";
import Diagram3D from "~/components/diagram/Diagram3D";

import { getDiagram, getDisplayDimension, getSlice, getRenderer } from "~/state/store/diagram";
import { getHighlight } from "~/state/store/attach";
import { selectCell, homotopy } from "~/state/actions/diagram";


let prev = null;

export const Workspace = ({
  diagram,
  dimension,
  highlight,
  slice,
  renderer,
  onSelectCell,
  test,
  onHomotopy
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
          onHomotopy={onHomotopy}
          //onContract={onContract}
          //onExpand={onExpand}
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
    renderer: getRenderer(state),
    test: state.diagram
  }),
  dispatch => ({
    onSelectCell: (point) => dispatch(selectCell(point)),
    onHomotopy: (point, direction) => dispatch(homotopy(point, direction))
  })
)(Workspace);

const Wrapper = styled.div`
  display: flex;
  flex: 1;
  position: relative;
`;

import * as React from "react";
import styled from "styled-components";
import { connect } from "react-redux";

import { getGenerator } from "~/state/store/signature";
//import { selectGenerator, removeGenerator, renameGenerator, recolorGenerator } from "~/state/actions/signature";
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
  <Wrapper>
    <Preview onClick={onSelect}>
      <Diagram2D
        diagram={generator.diagram}
        slice={[]}
        dimension={Math.min(2, generator.n)}
      />
    </Preview>
    <Details>
      <Name
        type="text"
        value={name}
        onChange={e => onRename(e.target.value)}
      />
      <ColorPicker
        color={color}
        colors={cellColors}
        onChange={color => onRecolor(color)}
      />
    </Details>
    <Actions>
      <IconButton
        onClick={onRemove}
        icon="trash"
      />
    </Actions>
  </Wrapper>;

export default connect(
  (state, { id }) => getGenerator(state.proof, id),
  (dispatch, { id }) => ({
    onSelect: () => dispatch({ type: "signature/select-generator", payload: { id } }),
    onRemove: () => dispatch({ type: "signature/remove-generator", payload: { id } }),
    onRename: (name) => dispatch({ type: "signature/rename-generator", payload: { id, name } }),
    onRecolor: (color) => dispatch({ type: "signature/recolor-generator", payload: { id, color } })
  })
)(Generator);

const Wrapper = styled.div`
  display: flex;
  padding-left: 8px;
  padding-right: 8px;
`;

const Preview = styled.div`
  width: 75px;
  height: 75px;
  border: 2px dashed #34495e;
  margin: 8px;
  display: flex;
`;

const Details = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const Name = styled.input`
  font-weight: 500;
  padding: 8px;
  background: #34495e;
  border: none;
  color: #ecf0f1;
`;

const Actions = styled.div`
  fontWeight: 600;
  display: flex;
  flex-direction: column;
  justify-content: right;
`;

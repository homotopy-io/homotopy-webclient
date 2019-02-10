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
  id,
  name,
  color,
  focused,
  setFocus,
  generator,
  onSelect,
  onRemove,
  onRename,
  onRecolor
}) =>
  <Wrapper onMouseEnter={() => setFocus(true)}
           onMouseLeave={() => {
            setFocus(false)
            const nameInput = document.getElementById(`generator-${id}-input`).value
            if (name !== nameInput)
              onRename(nameInput)
            setTimeout(() =>
              renderMathInElement(document.getElementById(`generator-${id}`), {
                delimiters: [
                  {left: "$$", right: "$$", display: true},
                  {left: "\\[", right: "\\]", display: true},
                  {left: "$", right: "$", display: false},
                  {left: "\\(", right: "\\)", display: false}
                ]
              }),
            0)
           }}>
    <Preview onClick={onSelect}>
      <Diagram2D
        diagram={generator.diagram}
        slice={[]}
        dimension={Math.min(2, generator.n)}
      />
    </Preview>
    <Details>
      {!focused && <RenderedName id={`generator-${id}`}>{name}</RenderedName>}
      <Name
        id={`generator-${id}-input`}
        type={focused ? "text" : "hidden"}
        defaultValue={name}
        onBlur={e => {
          if (e.target.value !== name)
            onRename(e.target.value)
        }}
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
    onRecolor: (color) => dispatch({ type: "signature/recolor-generator", payload: { id, color } }),
    setFocus: (focus, cmd) => dispatch({ type: "signature/set-focus", payload: { id, focus, cmd } })
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

const RenderedName = styled.div`
  padding-left: 8px;
  padding-top: 7px;
  padding-bottom: 7px;
  background: #34495e;
  font-size: 15px;
`

const Name = styled.input`
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

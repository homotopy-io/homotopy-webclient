import * as React from "react";
import styled from "styled-components";

export const IconButton = ({
  icon,
  label,
  onClick
}) =>
  <Button onClick={onClick} title={label}>
    <i className={`s7 s7-${icon}`} />
  </Button>;

export default IconButton;

const Button = styled.button`
  border: none;
  background: transparent;
  color: inherit;
  vertical-align: middle;
  padding: 8px;
  padding-bottom: 5px;
  cursor: pointer;
`;

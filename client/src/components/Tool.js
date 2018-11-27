import * as React from "react";
import styled from "styled-components";

import IconButton from "~/components/misc/IconButton";

export const Tool = ({
  title,
  actions = [],
  children
}) =>
  <Wrapper style={{userSelect: 'none'}}>
    <Header>
      <Title>{title}</Title>
      <Actions>{actions.map((action, index) => <Action key={index} {...action} />)}</Actions>
    </Header>
    <Content>{children}</Content>
  </Wrapper>;

export const Control = ({
  label,
  children
}) =>
  <ControlWrapper>
    <ControlLabel>
      {label}
    </ControlLabel>
    <ControlContent>
      {children}
    </ControlContent>
  </ControlWrapper>;

export const Action = ({
  label,
  icon,
  onClick
}) =>
  <IconButton
    label={label}
    icon={icon}
    onClick={onClick}
  />;


export default Tool;

const Wrapper = styled.div``;
const Content = styled.div``;
const Actions = styled.div``;

const Header = styled.div`
  font-weight: 500;
  font-size: 1.2em;
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: #34495e;
`;

const Title = styled.div`
  padding: 8px;
`;

const ControlWrapper = styled.div`
  display: flex;
`;

const ControlLabel = styled.div`
  padding: 8px;
`;

const ControlContent = styled.div`
  padding: 8px;
  flex: 1;
`;

import * as React from "react";
import { connect } from "react-redux";
import styled from "styled-components";

import Generator from "~/components/Generator";
import { getDimensionGroups } from "~/state/store/signature";
import { createGenerator } from "~/state/actions/signature";

import IconButton from "~/components/misc/IconButton";

export const Signature = ({
  groups, onAddGenerator
}) =>
  <Wrapper>
    {groups.map((generators, dimension) =>
      <Group key={dimension}>
        <GroupHeader>
          <GroupLabel>
            {dimension}-cells
          </GroupLabel>
          <GroupActions>
            {dimension == 0 &&
              <IconButton
                onClick={onAddGenerator}
                icon="plus"
              />
            }
          </GroupActions>
        </GroupHeader>
        <GroupContent>
          {generators.map(generator => <Generator key={generator} id={generator} />)}
        </GroupContent>
      </Group>
    )}
  </Wrapper>;

export default connect(
  state => ({ groups: getDimensionGroups(state) }),
  dispatch => ({ onAddGenerator: () => dispatch(createGenerator()) })
)(Signature);

const Wrapper = styled.div``;

const Group = styled.div``;

const GroupHeader = styled.div`
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #34495e;
`;

const GroupLabel = styled.div`
  font-size: 1.2em;
  font-weight: 500;
  padding: 8;
`;

const GroupActions = styled.div`
  padding: 8px;
  font-weight: 600;
  cursor: pointer;
`;

const GroupContent = styled.div`
  padding-top: 16px;
  padding-bottom: 16px;
`;

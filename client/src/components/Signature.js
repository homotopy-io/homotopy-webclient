import * as React from "react";
import { StyleSheet, css } from "aphrodite";
import { connect } from "react-redux";
import Icon from "react-ionicons";

import Generator from "~/components/Generator";
import { getDimensionGroups } from "~/state/store/signature";
import { createGenerator } from "~/state/actions/signature";

import IconButton from "~/components/misc/IconButton";

export const Signature = ({
  groups, onAddGenerator
}) =>
  <div className={css(styles.signature)}>
    {groups.map((generators, dimension) =>
      <div key={dimension} className={css(styles.group)}>
        <div className={css(styles.groupHeader)}>
          <div className={css(styles.groupLabel)}>
            {dimension}-Generators
          </div>
          <div className={css(styles.groupActions)}>
            {dimension == 0 &&
              <IconButton
                className={css(styles.groupAction)}
                onClick={onAddGenerator}
                icon="plus"
              />
            }
          </div>
        </div>
        <div className={css(styles.groupContent)}>
          {generators.map(generator => <Generator key={generator} id={generator} />)}
        </div>
      </div>
    )}
  </div>

export default connect(
  state => ({ groups: getDimensionGroups(state) }),
  dispatch => ({ onAddGenerator: () => dispatch(createGenerator()) })
)(Signature);

const styles = StyleSheet.create({
  header: {
    fontSize: "1.8em"
  },

  group: {
    marginBottom: 16
  },

  groupHeader: {
    padding: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  groupLabel: {
    fontSize: "1.2em",
    fontWeight: 500,
    padding: 8
  },

  groupAction: {
    padding: 8,
    fontWeight: 600,
    "cursor": "pointer",
  }
});
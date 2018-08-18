import * as React from "react";
import { StyleSheet, css } from "aphrodite";
import SignatureCell from "~/components/SignatureCell";

export const Signature = ({
  groups, onAddZeroCell
}) =>
  <div className={css(styles.signature)}>
    {groups.map((cells, dimension) =>
      <div key={dimension} className={css(styles.group)}>
        <div className={css(styles.groupLabel)}>
          {dimension}-Cells
        </div>
        <div className={css(styles.groupContent)}>
          {cells.map(cell => <SignatureCell key={cell} id={cell} />)}
        </div>
      </div>
    )}
  </div>

export default ({}) =>
  <Signature groups={[[0, 1, 2], [3, 4, 5]]} onAddZeroCell={() => {}} />

const styles = StyleSheet.create({
  header: {
    fontSize: "1.8em"
  },

  group: {
    marginBottom: 16
  },

  groupLabel: {
    fontSize: "1.2em",
    fontWeight: 500,
    padding: 16
  }
});
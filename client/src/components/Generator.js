import * as React from "react";
import { StyleSheet, css } from "aphrodite";

export const SignatureCell = ({
  name,
  diagram
}) =>
  <div className={css(styles.cell)}>
    <div className={css(styles.preview)}>
      {/*<Diagram2D diagram={diagram} />*/}
    </div>
    <div className={css(styles.details)}>
      <div className={css(styles.name)}>
        {name}
      </div>
    </div>
  </div>

export default ({ id }) =>
  <SignatureCell name="Cell 0" diagram={null} />

const styles = StyleSheet.create({
  cell: {
    display: "flex",
    padding: 8,
    cursor: "pointer",
    ":hover":  {
      background: "#34495e"
    }
  },

  preview: {
    width: 100,
    height: 100,
    border: "2px dashed #34495e",
    margin: 8
  },

  details: {
    padding: 8,
    display: "flex",
    flexDirection: "column"
  },

  name: {
    fontWeight: 500
  }
});


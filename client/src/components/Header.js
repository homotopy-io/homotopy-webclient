import * as React from "react";
import { StyleSheet, css } from "aphrodite";

export const Header = ({}) =>
  <div className={css(styles.header)}>
    <ul className={css(styles.actions)}>
      <li className={css(styles.action)}>Log In</li>
      <li className={css(styles.action)}>Sign Up</li>
      <li className={css(styles.action)}>Gallery</li>
      <li className={css(styles.action)}>Help</li>
    </ul>
  </div>

export default Header;

const styles = StyleSheet.create({
  header: {
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    padding: 8,
    margin: 0,
  },

  action: {
    display: "block",
    padding: 8,
    textTransform: "uppercase",
    cursor: "pointer",
    ":hover": {
      "background": "#ecf0f1"
    }
  },
});
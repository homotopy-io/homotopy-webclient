import * as React from "react";
import { StyleSheet, css } from "aphrodite";

export const Logo = ({}) =>
  <div className={css(styles.logo)}>
    homotopy.io
  </div>

export default Logo;

const styles = StyleSheet.create({
  logo: {
    fontSize: "1.8em"
  }
});
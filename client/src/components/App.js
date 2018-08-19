import * as React from "react";
import { StyleSheet, css } from "aphrodite";
import Header from "~/components/Header";
import Signature from "~/components/Signature";

export const Layout = ({}) =>
  <div className={css(styles.layout)}>
    <div className={css(styles.sidebar)}>
      <div className={css(styles.logo)}>
        homotopy.io
      </div>
      <Signature />
    </div>
    <div className={css(styles.content)}>
      <Header />
      {/*<Workspace />*/}
    </div>
  </div>

export default Layout;

const styles = StyleSheet.create({
  layout: {
    display: "flex",
    height: "100%",
  },

  sidebar: {
    display: "flex",
    flexDirection: "column",
    background: "#2c3e50",
    color: "#ecf0f1",
    width: 350
  },

  content: {
    background: "#bdc3c7",
    display: "flex",
    flexDirection: "column",
    flex: 1
  },

  logo: {
    fontSize: "1.8em",
    padding: 16
  }
});

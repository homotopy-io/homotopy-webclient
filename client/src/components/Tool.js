import * as React from "react";
import { StyleSheet, css } from "aphrodite";

import IconButton from "~/components/misc/IconButton";

export const Tool = ({
  title,
  actions = [],
  children,
  className
}) =>
  <div className={`${css(styles.tool)} ${className}`}>
    <div className={css(styles.header)}>
      <div className={css(styles.title)}>
        {title}
      </div>
      <div className={css(styles.actions)}>
        {actions.map(action => 
          <Action {...action} />
        )}
      </div>
    </div>
    <div className={css(styles.content)}>
      {children}
    </div>
  </div>

export const Control = ({
  label,
  children
}) =>
  <div className={css(styles.control)}>
    <div className={css(styles.controlLabel)}>
      {label}
    </div>
    <div className={css(styles.controlContent)}>
      {children}
    </div>
  </div>

export const Action = ({
  label,
  icon,
  onClick
}) =>
  <IconButton
    label={label}
    icon={icon}
    onClick={onClick}
    className={css(styles.action)}
  />


export default Tool;

const styles = StyleSheet.create({
  tool: {
    //boxShadow: "5px 5px 10px #aaaaaa",
  },

  content: {
    padding: 8
  },

  header: {
    fontWeight: 500,
    fontSize: "1.2em",
    display: "flex",
    justifyContent: "space-between",
    padding: 8,
    background: "#34495e"
  },

  title: {
    padding: 8
  },

  actions: {
  },

  action: {
    fontSize: "1.2em",
  },

  control: {
    display: "flex"
  },

  controlLabel: {
    width: 100,
    padding: 8,
  },

  controlContent: {
    padding: 8,
    flex: 1
  }
});